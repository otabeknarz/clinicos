import { Injectable } from '@nestjs/common'

import { CLINIC_MODULES, TRIAL_DAYS, TRIAL_DISABLED_MODULES } from '../common/modules'
import { RestrictionsService } from '../common/restrictions.service'
import { PrismaService } from '../prisma/prisma.service'
import { RestrictionDto, TrialPolicyDto } from './access.dto'

/**
 * PLATFORMA: IMKONIYATLAR VA SINOV SHARTLARI.
 *
 * Ikkala sozlama ham SOTUV qurollari, shuning uchun ular
 * dasturchida emas, adminning qo'lida bo'lishi kerak:
 *
 *   1. CHEKLOV — bo'limni yopib, sababini yozish: "tez kunda",
 *      "tarifingizda yo'q", "texnik ishlar". Hamma uchun yoki
 *      bitta klinika uchun.
 *   2. SINOV SHARTI — yo'nalish bo'yicha necha kun bepul va
 *      qaysi bo'limlar ochiq. Sotuv har hafta boshqa taklif
 *      sinab ko'rishi mumkin, kod esa o'zgarmaydi.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restrictions: RestrictionsService,
  ) {}

  private get db() {
    return this.prisma.acrossAllClinics()
  }

  /** Barcha qoidalar — umumiysi va klinikaga tegishlisi */
  async list() {
    const rows = await this.db.moduleRestriction.findMany({
      orderBy: [{ targetClinicId: 'asc' }, { module: 'asc' }],
    })

    const clinicIds = rows.map((row) => row.targetClinicId).filter(Boolean)

    const clinics = clinicIds.length
      ? await this.db.clinic.findMany({
          where: { id: { in: clinicIds } },
          select: { id: true, name: true },
        })
      : []
    const names = new Map(clinics.map((one) => [one.id, one.name]))

    return {
      modules: [...CLINIC_MODULES],
      items: rows.map((row) => ({
        id: row.id,
        clinicId: row.targetClinicId || null,
        clinicName: row.targetClinicId ? (names.get(row.targetClinicId) ?? '') : '',
        module: row.module,
        reason: row.reason.toLowerCase(),
        note: row.note,
      })),
    }
  }

  /**
   * Qoidani qo'yish yoki yangilash.
   *
   * `clinicId` berilmasa — hamma uchun. Bitta modulga bitta qoida:
   * takrorlanmasin deb `upsert`.
   */
  async set(dto: RestrictionDto) {
    const row = await this.db.moduleRestriction.upsert({
      where: {
        targetClinicId_module: {
          /* Bo'sh satr — "hamma uchun" */
          targetClinicId: dto.clinicId ?? '',
          module: dto.module,
        },
      },
      create: {
        targetClinicId: dto.clinicId ?? '',
        module: dto.module,
        reason: dto.reason.toUpperCase() as 'SOON',
        note: dto.note?.trim() ?? '',
      },
      update: {
        reason: dto.reason.toUpperCase() as 'SOON',
        note: dto.note?.trim() ?? '',
      },
    })

    /* Kesh 30 soniya yashaydi — bu yerda darhol bo'shatamiz */
    this.restrictions.clearCache()

    return { id: row.id }
  }

  async remove(id: string) {
    await this.db.moduleRestriction.deleteMany({ where: { id } })
    this.restrictions.clearCache()
    return { ok: true }
  }

  /**
   * Sinov shartlari.
   *
   * Bazada yozuv bo'lmasa — koddagi qiymatlar qaytadi, ya'ni
   * jadval bo'sh bo'lsa ham tizim ishlaydi.
   */
  async trialPolicies() {
    const rows = await this.db.trialPolicy.findMany()
    const byDirection = new Map(rows.map((row) => [row.direction, row]))

    const directions = ['default', 'general', 'dental', 'eye', 'lab']

    return {
      modules: [...CLINIC_MODULES],
      items: directions.map((direction) => {
        const row = byDirection.get(direction)
        return {
          direction,
          days: row?.days ?? TRIAL_DAYS,
          disabledModules: row?.disabledModules ?? [...TRIAL_DISABLED_MODULES],
          /* Bazada yozuv bormi — interfeysda "sukut" deb ko'rsatiladi */
          custom: Boolean(row),
        }
      }),
    }
  }

  async setTrialPolicy(dto: TrialPolicyDto) {
    await this.db.trialPolicy.upsert({
      where: { direction: dto.direction },
      create: {
        direction: dto.direction,
        days: dto.days,
        disabledModules: dto.disabledModules,
      },
      update: { days: dto.days, disabledModules: dto.disabledModules },
    })

    return { ok: true }
  }

  /**
   * Ro'yxatdan o'tish uchun: shu yo'nalishda nima amal qiladi.
   *
   * Aniq yo'nalish topilmasa `default`, u ham bo'lmasa koddagi
   * qiymat — uchta pog'ona, va hech biri yiqilmaydi.
   */
  async trialFor(direction: string): Promise<{ days: number; disabledModules: string[] }> {
    const rows = await this.db.trialPolicy.findMany({
      where: { direction: { in: [direction, 'default'] } },
    })

    const exact = rows.find((row) => row.direction === direction)
    const fallback = rows.find((row) => row.direction === 'default')
    const row = exact ?? fallback

    return {
      days: row?.days ?? TRIAL_DAYS,
      disabledModules: row?.disabledModules ?? [...TRIAL_DISABLED_MODULES],
    }
  }
}
