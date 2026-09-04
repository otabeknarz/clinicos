import { Injectable, NotFoundException } from '@nestjs/common'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { AttendanceInputDto, AttendanceRangeDto } from './attendance.dto'

/**
 * Kelish vaqti shu chegaradan ko'proq orqaga surilsa — belgilanadi.
 *
 * Ikki soat: kun davomida "kechikdi" ni keyinroq to'g'rilash odatiy
 * ish, lekin ertalabki vaqtni kechqurun yozish — boshqa narsa.
 */
const BACKDATE_THRESHOLD_MINUTES = 120

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list(query: AttendanceRangeDto) {
    const rows = await this.db.attendance.findMany({
      where: {
        staffId: query.staffId,
        date: { gte: new Date(query.from), lte: new Date(query.to) },
      },
      orderBy: { date: 'asc' },
      select: { date: true, status: true, lateMinutes: true },
    })

    return rows.map((r) => ({
      date: toApiDate(r.date)!,
      status: toApi(r.status),
      lateMinutes: r.lateMinutes,
    }))
  }

  async summary(staffId: string, days: number) {
    const from = new Date()
    from.setDate(from.getDate() - days)
    from.setHours(0, 0, 0, 0)

    const rows = await this.db.attendance.findMany({
      where: { staffId, date: { gte: from } },
      select: { status: true, lateMinutes: true },
    })

    const count = (s: string) => rows.filter((r) => r.status === s).length
    const present = count('PRESENT')
    const late = count('LATE')
    const absent = count('ABSENT')
    const excused = count('EXCUSED')
    const workdays = present + late + absent + excused
    const totalLateMinutes = rows.reduce((sum, r) => sum + r.lateMinutes, 0)
    const attendancePct = workdays
      ? Math.round(((present + late) / workdays) * 100)
      : 0

    return {
      staffId,
      period: `${days} kun`,
      workdays,
      present,
      late,
      absent,
      excused,
      totalLateMinutes,
      attendancePct,
      // Har 60 daqiqa kechikish bir ball chegiradi
      disciplineScore: Math.max(
        0,
        Math.min(100, attendancePct - Math.round(totalLateMinutes / 60)),
      ),
    }
  }

  /**
   * Kunlik davomat jadvali.
   *
   * BARCHA faol xodimlar chiqadi — belgilanmaganlari ham. Aks
   * holda registrator kimni o'tkazib yuborganini bilmasdi.
   */
  async daily(date: string) {
    const day = new Date(date)
    day.setHours(0, 0, 0, 0)

    const [staff, marks] = await Promise.all([
      this.db.staff.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { fullName: 'asc' },
      }),
      this.db.attendance.findMany({ where: { date: day } }),
    ])

    const byStaff = new Map(marks.map((m) => [m.staffId, m]))

    const rows = staff.map((s) => {
      const mark = byStaff.get(s.id)
      return {
        staffId: s.id,
        fullName: s.fullName,
        positionTitle: s.positionTitle,
        department: s.department,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        isWorkday: s.workdays.includes(day.getDay()),
        status: mark ? toApi(mark.status) : null,
        arrivedAt: mark?.arrivedAt ?? null,
        lateMinutes: mark?.lateMinutes ?? 0,
        note: mark?.note ?? '',
        flagged: mark?.flagged ?? false,
      }
    })

    const has = (status: string) => rows.filter((r) => r.status === status).length

    /*
      Sanoq interfeys uchun MUHIM: registratura shu raqamlarga
      qarab kimni belgilamaganini biladi. `expected` — bugun
      ishlashi kerak bo'lganlar, `unmarked` — hali belgilanmagani.
    */
    return {
      date: toApiDate(day)!,
      rows,
      counts: {
        expected: rows.filter((r) => r.isWorkday).length,
        present: has('present'),
        late: has('late'),
        absent: has('absent'),
        excused: has('excused'),
        unmarked: rows.filter((r) => r.isWorkday && r.status === null).length,
      },
    }
  }

  /**
   * Davomat belgilash.
   *
   * KECHIKISH DAQIQASI SERVERDA hisoblanadi — mijozdan olinmaydi.
   * Aks holda registrator "kechikdi, 0 daqiqa" deb yozib, jarimani
   * chetlab o'tardi.
   *
   * Vaqt orqaga surib kiritilsa — yozuv belgilanadi va egasiga
   * ogohlantirish bo'lib chiqadi.
   */
  async mark(dto: AttendanceInputDto) {
    const { clinicId, userId } = this.ctx.require()

    const staff = await this.db.staff.findFirst({ where: { id: dto.staffId } })
    if (!staff) throw new NotFoundException('Xodim topilmadi')

    const user = await this.db.user.findFirst({
      where: { id: userId },
      select: { fullName: true },
    })

    const day = new Date(dto.date)
    day.setHours(0, 0, 0, 0)

    const lateMinutes =
      dto.status === 'late' && dto.arrivedAt
        ? lateMinutesFrom(staff.shiftStart, dto.arrivedAt, staff.shiftEnd)
        : 0

    const { flagged, reason } = checkArrivalTime(dto.date, dto.arrivedAt ?? null)

    const row = await this.db.attendance.upsert({
      where: { staffId_date: { staffId: dto.staffId, date: day } },
      create: {
        clinicId,
        staffId: dto.staffId,
        date: day,
        status: toDb(dto.status),
        arrivedAt: dto.arrivedAt ?? null,
        lateMinutes,
        note: dto.note,
        markedById: userId,
        flagged,
        flagReason: reason,
      },
      update: {
        status: toDb(dto.status),
        arrivedAt: dto.arrivedAt ?? null,
        lateMinutes,
        note: dto.note,
        markedById: userId,
        markedAt: new Date(),
        flagged,
        flagReason: reason,
      },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      staffId: row.staffId,
      date: toApiDate(row.date)!,
      status: toApi(row.status),
      checkInAt: toApiDateTime(row.checkInAt),
      checkOutAt: toApiDateTime(row.checkOutAt),
      arrivedAt: row.arrivedAt,
      lateMinutes: row.lateMinutes,
      workedMinutes: row.workedMinutes,
      note: row.note,
      markedBy: row.markedById,
      markedByName: user?.fullName ?? '',
      markedAt: toApiDateTime(row.markedAt)!,
      flagged: row.flagged,
      flagReason: row.flagReason,
      createdAt: toApiDateTime(row.createdAt)!,
    }
  }

  /**
   * Belgilangan yozuvlar — egasining davomat sahifasida yuqorida
   * ogohlantirish bo'lib turadi.
   */
  async flags(limit: number) {
    const rows = await this.db.attendance.findMany({
      where: { flagged: true },
      include: {
        staff: { select: { id: true, fullName: true, positionTitle: true } },
        markedBy: { select: { fullName: true } },
      },
      orderBy: { markedAt: 'desc' },
      take: limit,
    })

    return rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff.fullName,
      positionTitle: r.staff.positionTitle,
      date: toApiDate(r.date)!,
      arrivedAt: r.arrivedAt,
      lateMinutes: r.lateMinutes,
      markedByName: r.markedBy.fullName,
      markedAt: toApiDateTime(r.markedAt)!,
      reason: r.flagReason,
      gapMinutes: gapMinutes(r.date, r.arrivedAt, r.markedAt),
    }))
  }
}

/* ------------------------------------------------------------------ */

/**
 * Kechikish daqiqasi.
 *
 * Tungi smenani hisobga oladi: smena tugashi boshlanishidan
 * oldin bo'lsa va kelish vaqti boshlanishdan oldin bo'lsa,
 * demak keyingi kunga o'tgan.
 */
export function lateMinutesFrom(
  shiftStart: string,
  arrivedAt: string,
  shiftEnd?: string,
): number {
  const start = toMinutes(shiftStart)
  let arrived = toMinutes(arrivedAt)

  if (shiftEnd) {
    const end = toMinutes(shiftEnd)
    if (end <= start && arrived < start) arrived += 24 * 60
  }

  return Math.max(0, arrived - start)
}

/**
 * Kelish vaqti orqaga surilganmi.
 *
 * Yozuv kiritilayotgan vaqt bilan ko'rsatilgan kelish vaqti
 * orasidagi farq chegaradan katta bo'lsa — belgilanadi.
 */
export function checkArrivalTime(
  date: string,
  arrivedAt: string | null,
  now = new Date(),
): { flagged: boolean; reason: string; gapMinutes: number } {
  if (!arrivedAt) return { flagged: false, reason: '', gapMinutes: 0 }

  const day = new Date(date)
  const [h, m] = arrivedAt.split(':').map(Number)
  day.setHours(h || 0, m || 0, 0, 0)

  const gap = Math.round((now.getTime() - day.getTime()) / 60_000)

  if (gap > BACKDATE_THRESHOLD_MINUTES) {
    return { flagged: true, reason: 'backdated', gapMinutes: gap }
  }
  return { flagged: false, reason: '', gapMinutes: gap }
}

function gapMinutes(date: Date, arrivedAt: string | null, markedAt: Date): number {
  if (!arrivedAt) return 0
  const day = new Date(date)
  const [h, m] = arrivedAt.split(':').map(Number)
  day.setHours(h || 0, m || 0, 0, 0)
  return Math.round((markedAt.getTime() - day.getTime()) / 60_000)
}

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
