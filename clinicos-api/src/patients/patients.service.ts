import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'
import { paginated } from '../common/pagination'
import { RequestContext } from '../common/request-context'
import { AuditService } from '../common/audit.service'
import { escapeHtml, money } from '../common/telegram-text'
import { DeleteCodeService } from '../delete-code/delete-code.service'
import { PrismaService } from '../prisma/prisma.service'
import { OwnerAlertsService } from '../telegram/owner-alerts.service'
import {
  CreatePatientDto,
  DeletePatientDto,
  PatientListQueryDto,
  UpdatePatientDto,
} from './patients.dto'
import { PatientStats, toApiPatient, toApiPatientWithStats } from './patients.mapper'

/** Necha tashrifdan keyin bemor "qaytgan" hisoblanadi */
const RETURNING_FROM = 2

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly codes: DeleteCodeService,
    private readonly audit: AuditService,
    private readonly alerts: OwnerAlertsService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Shifokor faqat O'ZIGA tegishli bemorlarni ko'radi.
   *
   * Tegishli degani: yo biriktirilgan shifokori, yo o'sha shifokorga
   * qabulga yozilgan. Frontendda ham shu mantiq bor, lekin u
   * ko'rsatish uchun — haqiqiy cheklov shu yerda.
   */
  private doctorScope(): Prisma.PatientWhereInput {
    const { role, doctorId } = this.ctx.require()
    if (role !== 'DOCTOR' || !doctorId) return {}

    return {
      OR: [
        { primaryDoctorId: doctorId },
        { appointments: { some: { doctorId } } },
      ],
    }
  }

  async list(query: PatientListQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.PatientWhereInput = {
      AND: [
        this.doctorScope(),
        /* Ro'yxatdan o'chirilganlar ko'rinmaydi */
        { deletedAt: null },
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {},
        this.filterToWhere(query.filter),
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.patient.count({ where }),
    ])

    const stats = await this.statsFor(rows.map((r) => r.id))
    const items = rows.map((row) => toApiPatientWithStats(row, stats[row.id]))

    return paginated(items, total, query.page, query.pageSize)
  }

  private filterToWhere(filter: string): Prisma.PatientWhereInput {
    switch (filter) {
      case 'active':
        return { status: 'ACTIVE' }
      case 'inactive':
        return { status: 'INACTIVE' }
      /*
        "Yangi" — bitta ham tugallangan tashrifi yo'q.
        "Qaytgan" — ikkitadan ko'p tashrif.
        Ikkalasi ham tashriflar bo'yicha hisoblanadi, saqlanmaydi:
        saqlansa, tashrif qo'shilganda yangilashni unutish mumkin
        va raqam jimgina noto'g'ri bo'lib qolardi.
      */
      case 'new':
        return { visits: { none: {} } }
      case 'returning':
        return { visits: { some: {} } }
      default:
        return {}
    }
  }

  /**
   * Bemorlar statistikasi.
   *
   * Har bir bemor uchun alohida so'rov yubormaymiz — 20 ta bemor
   * uchun 60 ta so'rov bo'lardi (N+1). Uchta guruh so'rovi bilan
   * hammasi olinadi.
   */
  private async statsFor(ids: string[]): Promise<Record<string, PatientStats>> {
    const empty: PatientStats = {
      visitCount: 0,
      lastVisitAt: null,
      totalSpent: 0,
      isReturning: false,
      nextFollowUpAt: null,
    }

    if (ids.length === 0) return {}

    const [visits, payments, followUps] = await Promise.all([
      this.db.visit.groupBy({
        by: ['patientId'],
        where: { patientId: { in: ids } },
        _count: { _all: true },
        _max: { visitedAt: true },
      }),
      this.db.payment.groupBy({
        by: ['patientId'],
        where: { patientId: { in: ids }, status: 'PAID' },
        _sum: { amount: true },
      }),
      this.db.followUp.groupBy({
        by: ['patientId'],
        where: { patientId: { in: ids }, status: 'PENDING' },
        _min: { recommendedDate: true },
      }),
    ])

    const out: Record<string, PatientStats> = {}
    for (const id of ids) out[id] = { ...empty }

    for (const v of visits) {
      const s = out[v.patientId]
      s.visitCount = v._count._all
      s.lastVisitAt = toApiDate(v._max.visitedAt)
      s.isReturning = v._count._all >= RETURNING_FROM
    }
    for (const p of payments) {
      out[p.patientId].totalSpent = p._sum.amount ?? 0
    }
    for (const f of followUps) {
      out[f.patientId].nextFollowUpAt = toApiDate(f._min.recommendedDate)
    }

    return out
  }

  async get(id: string) {
    const row = await this.db.patient.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
    })
    if (!row) throw new NotFoundException('Bemor topilmadi')

    const stats = await this.statsFor([id])
    return toApiPatientWithStats(row, stats[id])
  }

  async create(dto: CreatePatientDto) {
    const { clinicId, role, doctorId } = this.ctx.require()

    /*
      SHIFOKOR OCHGAN BEMOR — o'ziga biriktiriladi. Shifokor faqat o'z
      bemorlarini ko'radi (`doctorScope`): biriktirilmasa, u hozirgina
      ochgan kartani ro'yxatda topa olmasdi.
    */
    const primaryDoctorId =
      role === 'DOCTOR' && doctorId ? (dto.primaryDoctorId ?? doctorId) : dto.primaryDoctorId

    const data = {
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      birthDate: new Date(dto.birthDate),
      gender: dto.gender === 'male' ? ('MALE' as const) : ('FEMALE' as const),
      address: dto.address,
      notes: dto.notes,
      primaryDoctorId,
      telegramUserId: await this.telegramFor(dto.phone),
    }

    /*
      RO'YXATDAN O'CHIRILGAN BEMOR QAYTIB KELDI. Telefon raqami klinikada
      yagona, ya'ni yangi karta ochib bo'lmaydi — eski karta tiklanadi va
      yangi ma'lumot bilan yangilanadi. Tarixi ham o'zi bilan qaytadi.
    */
    const hidden = await this.db.patient.findFirst({
      where: { phone: data.phone, deletedAt: { not: null } },
      select: { id: true },
    })
    if (hidden) {
      const row = await this.db.patient.update({
        where: { id: hidden.id },
        data: { ...data, deletedAt: null, status: 'ACTIVE' },
      })
      return toApiPatient(row)
    }

    try {
      const row = await this.db.patient.create({
        data: {
          // Filtr buni baribir bosib yozadi — tip talab qilgani uchun turibdi
          clinicId,
          ...data,
        },
      })
      return toApiPatient(row)
    } catch (error) {
      throw this.duplicatePhone(error)
    }
  }

  /**
   * Shu raqam botda tasdiqlanganmi — tasdiqlangan bo'lsa Telegram id.
   *
   * Bemor botda raqamini OLDIN ulashgan bo'lishi mumkin (kartasi
   * yo'q paytda yoki boshqa klinikada). Karta ochilgan zahoti u botga
   * bog'lanadi: qabul xabari va eslatmalar kela boshlaydi.
   *
   * `TelegramPhoneLink` umumiy jadval — unda klinika ma'lumoti yo'q,
   * faqat Telegram O'ZI tasdiqlagan raqam va id.
   */
  private async telegramFor(phone: string | undefined): Promise<string | null> {
    const digits = (phone ?? '').replace(/\D/g, '')
    if (digits.length < 9) return null
    const link = await this.db.telegramPhoneLink.findUnique({ where: { phone: digits } })
    return link?.telegramUserId ?? null
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.assertExists(id)
    try {
      const row = await this.db.patient.update({
        where: { id },
        data: {
          fullName: dto.fullName?.trim(),
          phone: dto.phone?.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender ? (dto.gender === 'male' ? 'MALE' : 'FEMALE') : undefined,
          address: dto.address,
          notes: dto.notes,
          status: dto.status ? (dto.status === 'active' ? 'ACTIVE' : 'INACTIVE') : undefined,
          primaryDoctorId: dto.primaryDoctorId,
          /*
            Raqam o'zgarsa, bog'lanish YANGI raqamdan olinadi. Eski
            raqamning Telegram hisobi qolib ketsa, xabarlar boshqa odamga
            ketardi.
          */
          ...(dto.phone !== undefined ? { telegramUserId: await this.telegramFor(dto.phone) } : {}),
        },
      })
      return toApiPatient(row)
    } catch (error) {
      throw this.duplicatePhone(error)
    }
  }

  /**
   * BEMORNI O'CHIRISH — o'chirish kodi bilan.
   *
   * `hide`  — faqat ro'yxatdan. Tarix, to'lovlar va tushum joyida.
   * `purge` — hammasi: to'lovlar, qabullar (tashriflari bilan), statsionar,
   *           eslatmalar. Tushum va hisobotlardan AYRILADI.
   *
   * Pul yozuvlari odatda o'zgarmaydi. Bu yagona istisno: xato ochilgan yoki
   * sinov kartasi butun tarixi bilan yo'qolishi kerak bo'lganda. Shuning
   * uchun kod shart, audit jurnaliga nima o'chgani yoziladi va egasiga
   * Telegramda xabar boradi.
   */
  async remove(id: string, dto: DeletePatientDto) {
    await this.codes.assert(dto.code)

    const { clinicId, userId } = this.ctx.require()
    const fullName = await this.codes.actorName()
    const patient = await this.db.patient.findFirst({
      where: { id },
      select: { id: true, fullName: true, phone: true },
    })
    if (!patient) throw new NotFoundException('Bemor topilmadi')

    if (dto.mode === 'hide') {
      await this.db.patient.update({ where: { id }, data: { deletedAt: new Date() } })
      void this.alerts.send(
        clinicId,
        [
          '<b>Bemor ro‘yxatdan o‘chirildi</b>',
          `${escapeHtml(patient.fullName)} · ${escapeHtml(patient.phone)}`,
          'Tarixi va to‘lovlari saqlandi.',
          `Kim: ${escapeHtml(fullName)}`,
        ].join('\n'),
        { skipUserId: userId },
      )
      return { mode: 'hide' as const }
    }

    const summary = await this.db.$transaction(async (tx) => {
      const payments = await tx.payment.aggregate({
        where: { patientId: id, status: 'PAID' },
        _sum: { amount: true },
        _count: { _all: true },
      })
      const admissions = await tx.admission.findMany({
        where: { patientId: id },
        select: { id: true, bedId: true, status: true },
      })

      /* To'lovlar birinchi: ular qabulga ham, yotqizishga ham bog'langan */
      await tx.payment.deleteMany({ where: { patientId: id } })

      /* Band yotoq bo'shatiladi — aks holda palatada "egasiz" band joy qoladi */
      const busyBeds = admissions
        .filter((a) => a.status === 'ACTIVE' || a.status === 'PLANNED')
        .map((a) => a.bedId)
      if (busyBeds.length > 0) {
        await tx.bed.updateMany({ where: { id: { in: busyBeds } }, data: { status: 'FREE' } })
      }
      await tx.admission.deleteMany({ where: { patientId: id } })

      const appointments = await tx.appointment.count({ where: { patientId: id } })
      /* Qabullar, tashriflar, nazoratlar, eslatmalar — kaskad bilan */
      await tx.patient.delete({ where: { id } })

      return {
        paymentsCount: payments._count._all,
        paymentsSum: payments._sum.amount ?? 0,
        admissions: admissions.length,
        appointments,
      }
    })

    await this.audit.record({
      action: 'purge',
      entityType: 'patient',
      entityId: id,
      meta: { fullName: patient.fullName, phone: patient.phone, ...summary },
    })

    void this.alerts.send(
      clinicId,
      [
        '<b>Bemor butunlay o‘chirildi</b>',
        `${escapeHtml(patient.fullName)} · ${escapeHtml(patient.phone)}`,
        `Qabullar: ${summary.appointments}, to‘lovlar: ${summary.paymentsCount} (${money(summary.paymentsSum)})`,
        'Summa tushumdan ayrildi.',
        `Kim: ${escapeHtml(fullName)}`,
      ].join('\n'),
      { skipUserId: userId },
    )

    return { mode: 'purge' as const, ...summary }
  }

  /* --- Bemor kartasidagi ro'yxatlar --- */

  async visits(id: string) {
    await this.assertExists(id)
    const rows = await this.db.visit.findMany({
      where: { patientId: id },
      orderBy: { visitedAt: 'desc' },
      include: {
        doctor: { select: { id: true, fullName: true, specialty: true } },
        /*
          Rasmlar bemor kartasida ko'rinadi — shifokor eski rentgenni
          shu yerdan ochadi. `imageUrl` da kalit yotadi, uni
          `SignedUrlInterceptor` havolaga o'giradi.
        */
        images: { select: { id: true, imageUrl: true }, orderBy: { createdAt: 'asc' } },
      },
    })
    return rows.map((v) => ({
      id: v.id,
      clinicId: v.clinicId,
      appointmentId: v.appointmentId,
      patientId: v.patientId,
      doctorId: v.doctorId,
      visitedAt: toApiDateTime(v.visitedAt)!,
      price: v.price,
      images: v.images,
      complaint: v.complaint,
      diagnosis: v.diagnosis,
      treatment: v.treatment,
      notes: v.notes,
      createdAt: toApiDateTime(v.createdAt)!,
      doctor: v.doctor,
    }))
  }

  async appointments(id: string) {
    await this.assertExists(id)
    const rows = await this.db.appointment.findMany({
      where: { patientId: id },
      orderBy: { startsAt: 'desc' },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true, specialty: true } },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMinutes: true,
            priceMode: true,
            minPrice: true,
            maxPrice: true,
          },
        },
      },
    })
    return rows.map((a) => ({
      id: a.id,
      clinicId: a.clinicId,
      patientId: a.patientId,
      doctorId: a.doctorId,
      serviceId: a.serviceId,
      startsAt: toApiDateTime(a.startsAt)!,
      durationMinutes: a.durationMinutes,
      status: toApi(a.status),
      paymentStatus: toApi(a.paymentStatus),
      notes: a.notes,
      checkedInAt: toApiDateTime(a.checkedInAt),
      completedAt: toApiDateTime(a.completedAt),
      cancelledAt: toApiDateTime(a.cancelledAt),
      cancelReason: a.cancelReason,
      createdBy: a.createdById,
      createdAt: toApiDateTime(a.createdAt)!,
      patient: a.patient,
      doctor: a.doctor,
      service: { ...a.service, priceMode: toApi(a.service.priceMode) },
    }))
  }

  async payments(id: string) {
    await this.assertExists(id)
    const rows = await this.db.payment.findMany({
      where: { patientId: id },
      orderBy: { paidAt: 'desc' },
      include: {
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, fullName: true } },
        service: { select: { id: true, name: true } },
      },
    })
    return rows.map((p) => ({
      id: p.id,
      clinicId: p.clinicId,
      patientId: p.patientId,
      doctorId: p.doctorId,
      serviceId: p.serviceId,
      appointmentId: p.appointmentId,
      amount: p.amount,
      method: toApi(p.method),
      status: toApi(p.status),
      paidAt: toApiDateTime(p.paidAt)!,
      notes: p.notes,
      createdBy: p.createdById,
      createdAt: toApiDateTime(p.createdAt)!,
      patient: p.patient,
      doctor: p.doctor,
      service: p.service,
    }))
  }

  async followUps(id: string) {
    await this.assertExists(id)
    const rows = await this.db.followUp.findMany({
      where: { patientId: id },
      orderBy: { recommendedDate: 'asc' },
    })
    return rows.map((f) => ({
      id: f.id,
      clinicId: f.clinicId,
      patientId: f.patientId,
      doctorId: f.doctorId,
      visitId: f.visitId,
      recommendedDate: toApiDate(f.recommendedDate)!,
      reason: f.reason,
      status: toApi(f.status),
      appointmentId: f.appointmentId,
      createdAt: toApiDateTime(f.createdAt)!,
    }))
  }

  /* ------------------------------------------------------------------ */

  private async assertExists(id: string) {
    const found = await this.db.patient.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Bemor topilmadi')
  }

  private duplicatePhone(error: unknown): unknown {
    /*
      P2002 — noyoblik buzildi. Sxemada `@@unique([clinicId, phone])`
      turibdi, ya'ni bu telefon shu klinikada allaqachon bor.
      Boshqa klinikada bo'lsa muammo yo'q va bu to'g'ri.
    */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Bu telefon raqami ro‘yxatda bor')
    }
    return error
  }
}
