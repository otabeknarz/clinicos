import { Injectable, NotFoundException } from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ClinicInputDto } from './clinic.dto'

/**
 * Klinika profili va ish vaqti.
 *
 * `clinicId` so'rovdan olinmaydi — tokendan. Ya'ni foydalanuvchi
 * faqat O'Z klinikasini ko'radi va tahrirlaydi, boshqasini emas.
 */
@Injectable()
export class ClinicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  async get() {
    const { clinicId } = this.ctx.require()

    /*
      `Clinic` klinikaga TEGISHLI jadval emas — u klinikaning
      o'zi. Shuning uchun avtomatik filtr unga tegmaydi va
      `clinicId` ni bu yerda o'zimiz, tokendan qo'yamiz.
    */
    const row = await this.prisma.acrossAllClinics().clinic.findUnique({
      where: { id: clinicId },
      include: { workingHours: { orderBy: { weekday: 'asc' } } },
    })
    if (!row) throw new NotFoundException('Klinika topilmadi')

    return toApiClinic(row)
  }

  async update(dto: ClinicInputDto) {
    const { clinicId } = this.ctx.require()
    const db = this.prisma.acrossAllClinics()

    const row = await db.$transaction(async (tx) => {
      if (dto.workingHours) {
        // Ish vaqti to'liq almashtiriladi — haftada bor-yo'g'i 7 qator
        await tx.workingHour.deleteMany({ where: { clinicId } })
        await tx.workingHour.createMany({
          data: dto.workingHours.map((h) => ({
            clinicId,
            weekday: h.weekday,
            open: h.open,
            close: h.close,
            isClosed: h.isClosed,
          })),
        })
      }

      return tx.clinic.update({
        where: { id: clinicId },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          slotMinutes: dto.slotMinutes,
        },
        include: { workingHours: { orderBy: { weekday: 'asc' } } },
      })
    })

    return toApiClinic(row)
  }
}

/**
 * Klinika yozuvini interfeys kutgan shaklga keltirish.
 *
 * Eksport qilingan, chunki sessiya javobida ham shu klinika
 * qaytadi (`auth.service.ts`). Ikki joyda alohida yozilsa,
 * biri ikkinchisidan orqada qolardi.
 */
export function toApiClinic(row: {
  id: string
  name: string
  logoUrl: string | null
  phone: string
  address: string
  slotMinutes: number
  currency: string
  timezone: string
  createdAt: Date
  workingHours: { weekday: number; open: string; close: string; isClosed: boolean }[]
}) {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    phone: row.phone,
    address: row.address,
    workingHours: row.workingHours.map((h) => ({
      weekday: h.weekday,
      open: h.open,
      close: h.close,
      isClosed: h.isClosed,
    })),
    slotMinutes: row.slotMinutes,
    currency: row.currency,
    timezone: row.timezone,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
