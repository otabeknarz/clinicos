import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { dayKeysBetween, dayKeyToDb, dbDateToKey, localDayKey } from '../common/day-key'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDayOffDto, DaysOffRangeDto } from './days-off.dto'

/** Bir yo'la ko'pi bilan shuncha kun — adashib bir yilni yopib qo'ymaslik uchun */
const MAX_DAYS = 62

/**
 * DAM OLISH KUNLARI.
 *
 * Belgilangan kunga yangi qabul yozilmaydi (`appointments.service.ts`).
 * Allaqachon yozilgan qabullar o'z-o'zidan ko'chmaydi — javobda ularning
 * soni qaytadi va interfeys darhol "ko'chirish" oynasini taklif qiladi.
 */
@Injectable()
export class DaysOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list(query: DaysOffRangeDto) {
    const rows = await this.db.dayOff.findMany({
      where: { date: { gte: dayKeyToDb(query.from), lte: dayKeyToDb(query.to) } },
      include: { doctor: { select: { fullName: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(toApiDayOff)
  }

  async create(dto: CreateDayOffDto) {
    const { clinicId, userId } = this.ctx.require()

    if (dto.from > dto.to) throw new BadRequestException('Boshlanish sanasi tugashidan keyin')
    const keys = dayKeysBetween(dto.from, dto.to)
    if (keys.length > MAX_DAYS) {
      throw new BadRequestException(`Bir yo‘la ko‘pi bilan ${MAX_DAYS} kun belgilanadi`)
    }

    const doctorId = dto.doctorId ?? null
    if (doctorId) {
      const doctor = await this.db.doctor.findFirst({ where: { id: doctorId }, select: { id: true } })
      if (!doctor) throw new NotFoundException('Shifokor topilmadi')
    }

    /* Allaqachon belgilangan kunlar qayta yozilmaydi */
    const existing = await this.db.dayOff.findMany({
      where: { doctorId, date: { in: keys.map(dayKeyToDb) } },
      select: { date: true },
    })
    const taken = new Set(existing.map((row) => dbDateToKey(row.date)))
    const fresh = keys.filter((key) => !taken.has(key))

    if (fresh.length > 0) {
      await this.db.dayOff.createMany({
        data: fresh.map((key) => ({
          clinicId,
          doctorId,
          date: dayKeyToDb(key),
          reason: dto.reason.trim(),
          createdById: userId,
        })),
      })
    }

    /*
      TA'SIR QILGAN QABULLAR — faqat hali bo'lib o'tmagan va faol
      (rejada yoki tasdiqlangan). Klinika yopilsa hamma shifokorniki,
      aks holda faqat shu shifokorniki.
    */
    const from = new Date(`${dto.from}T00:00:00`)
    const to = new Date(`${dto.to}T23:59:59.999`)
    const affected = await this.db.appointment.findMany({
      where: {
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startsAt: { gte: from, lte: to },
        ...(doctorId ? { doctorId } : {}),
      },
      select: { startsAt: true },
    })
    const affectedDays = [...new Set(affected.map((a) => localDayKey(a.startsAt)))].sort()

    return {
      created: fresh.length,
      affectedAppointments: affected.length,
      affectedDays,
      items: await this.list({ from: dto.from, to: dto.to }),
    }
  }

  async remove(id: string) {
    const row = await this.db.dayOff.findFirst({ where: { id }, select: { id: true } })
    if (!row) throw new NotFoundException('Dam olish kuni topilmadi')
    await this.db.dayOff.delete({ where: { id } })
    return { ok: true }
  }
}

function toApiDayOff(row: {
  id: string
  doctorId: string | null
  date: Date
  reason: string
  doctor: { fullName: string } | null
}) {
  return {
    id: row.id,
    date: dbDateToKey(row.date),
    doctorId: row.doctorId,
    doctorName: row.doctor?.fullName ?? null,
    reason: row.reason,
  }
}
