import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Staff } from '@prisma/client'
import * as argon2 from 'argon2'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ResetPasswordDto, StaffInputDto, StaffQueryDto } from './staff.dto'

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list(query: StaffQueryDto) {
    const search = query.search?.trim() ?? ''

    const rows = await this.db.staff.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                  { positionTitle: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
          query.position === 'all' ? {} : { position: toDb(query.position) },
          query.status === 'all' ? {} : { status: toDb(query.status) },
          query.withAccess === undefined ? {} : { hasSystemAccess: query.withAccess },
        ],
      },
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { fullName: 'asc' },
    })

    const performance = await this.performanceFor(rows)
    return rows.map((row) => ({
      ...toApiStaff(row),
      performance: performance[row.id],
    }))
  }

  async get(id: string) {
    const row = await this.db.staff.findFirst({
      where: { id },
      include: { user: { select: { id: true, email: true, role: true } } },
    })
    if (!row) throw new NotFoundException('Xodim topilmadi')
    const performance = await this.performanceFor([row])
    return { ...toApiStaff(row), performance: performance[id] }
  }

  /** Xodimning o'z profili — tokendagi foydalanuvchi bo'yicha */
  async myProfile() {
    const { userId } = this.ctx.require()
    const row = await this.db.staff.findFirst({
      where: { userId },
      include: { user: { select: { id: true, email: true, role: true } } },
    })
    if (!row) throw new NotFoundException('Sizning xodim yozuvingiz topilmadi')
    const performance = await this.performanceFor([row])
    return { ...toApiStaff(row), performance: performance[row.id] }
  }

  /**
   * Xodimlar ko'rsatkichlari.
   *
   * Hozircha davomat, bonus va shifokorlar uchun tushum
   * hisoblanadi. Reyting bemor fikridan keladi va u modul
   * qo'shilgandan keyin ulanadi.
   */
  private async performanceFor(rows: Staff[]) {
    const out: Record<string, unknown> = {}
    if (rows.length === 0) return out

    const ids = rows.map((r) => r.id)
    const period = new Date().toISOString().slice(0, 7)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const doctorIds = rows.map((r) => r.doctorId).filter((x): x is string => x !== null)

    const [attendance, bonuses, revenue] = await Promise.all([
      this.db.attendance.groupBy({
        by: ['staffId', 'status'],
        where: { staffId: { in: ids }, date: { gte: monthStart } },
        _count: { _all: true },
        _sum: { lateMinutes: true },
      }),
      this.db.bonus.groupBy({
        by: ['staffId'],
        where: { staffId: { in: ids }, period },
        _sum: { amount: true },
      }),
      doctorIds.length
        ? this.db.payment.groupBy({
            by: ['doctorId'],
            where: {
              doctorId: { in: doctorIds },
              status: 'PAID',
              paidAt: { gte: monthStart },
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ])

    const bonusByStaff = new Map(bonuses.map((b) => [b.staffId, b._sum.amount ?? 0]))
    const revenueByDoctor = new Map(revenue.map((r) => [r.doctorId, r._sum.amount ?? 0]))

    const attByStaff = new Map<
      string,
      { present: number; late: number; absent: number; excused: number; lateMinutes: number }
    >()
    for (const a of attendance) {
      const acc = attByStaff.get(a.staffId) ?? {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        lateMinutes: 0,
      }
      const count = a._count._all
      if (a.status === 'PRESENT') acc.present += count
      if (a.status === 'LATE') {
        acc.late += count
        acc.lateMinutes += a._sum.lateMinutes ?? 0
      }
      if (a.status === 'ABSENT') acc.absent += count
      if (a.status === 'EXCUSED') acc.excused += count
      attByStaff.set(a.staffId, acc)
    }

    for (const staff of rows) {
      const att = attByStaff.get(staff.id)
      const workdays = att
        ? att.present + att.late + att.absent + att.excused
        : 0
      const attended = att ? att.present + att.late : 0
      const attendancePct = workdays ? Math.round((attended / workdays) * 100) : 0

      /*
        Intizom bahosi: davomat foizidan kechikishlar chegiriladi.
        Har 60 daqiqa kechikish — bir ball.
      */
      const disciplineScore = att
        ? Math.max(0, Math.min(100, attendancePct - Math.round(att.lateMinutes / 60)))
        : 0

      const generatedRevenue = staff.doctorId
        ? (revenueByDoctor.get(staff.doctorId) ?? 0)
        : null

      const payType = toApi(staff.payType)
      const baseSalary =
        payType === 'percent' ? 0 : Math.round((staff.salary * staff.workRate) / 100)
      const percentEarnings =
        payType === 'salary' || generatedRevenue === null
          ? 0
          : Math.round((generatedRevenue * staff.percentRate) / 100)
      const bonusThisPeriod = bonusByStaff.get(staff.id) ?? 0

      out[staff.id] = {
        staffId: staff.id,
        // Reyting bemor fikridan keladi — fikr moduli ulanmaguncha null
        rating: null,
        factors: [],
        performancePct: workdays ? disciplineScore : null,
        metrics: [],
        bonusThisPeriod,
        attendance: att
          ? {
              staffId: staff.id,
              period,
              workdays,
              present: att.present,
              late: att.late,
              absent: att.absent,
              excused: att.excused,
              totalLateMinutes: att.lateMinutes,
              attendancePct,
              disciplineScore,
            }
          : null,
        generatedRevenue,
        percentEarnings,
        totalEarnings: baseSalary + percentEarnings + bonusThisPeriod,
      }
    }

    return out
  }

  async create(dto: StaffInputDto) {
    const { clinicId } = this.ctx.require()

    if (dto.hasSystemAccess && (!dto.login || !dto.password || !dto.role)) {
      throw new BadRequestException(
        'Tizimga kirish uchun login, parol va rol kerak',
      )
    }

    const row = await this.db.$transaction(async (tx) => {
      let userId: string | null = null

      if (dto.hasSystemAccess && dto.login && dto.password && dto.role) {
        const user = await tx.user.create({
          data: {
            clinicId,
            fullName: dto.fullName.trim(),
            email: dto.login.trim().toLowerCase(),
            phone: dto.phone.trim(),
            passwordHash: await argon2.hash(dto.password),
            role: toDb(dto.role),
          },
        })
        userId = user.id
      }

      return tx.staff.create({
        data: {
          clinicId,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          email: dto.email.trim(),
          position: toDb(dto.position),
          positionTitle: dto.positionTitle.trim(),
          department: dto.department,
          workdays: dto.workdays,
          shiftStart: dto.shiftStart,
          shiftEnd: dto.shiftEnd,
          workRate: dto.workRate,
          payType: toDb(dto.payType),
          percentRate: dto.percentRate,
          salary: dto.salary,
          hiredAt: new Date(dto.hiredAt),
          status: toDb(dto.status),
          hasSystemAccess: dto.hasSystemAccess,
          userId,
          notes: dto.notes,
        },
        include: { user: { select: { id: true, email: true, role: true } } },
      })
    })

    return toApiStaff(row)
  }

  async update(id: string, dto: Partial<StaffInputDto>) {
    await this.assertExists(id)

    const row = await this.db.staff.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        position: dto.position ? toDb(dto.position) : undefined,
        positionTitle: dto.positionTitle?.trim(),
        department: dto.department,
        workdays: dto.workdays,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
        workRate: dto.workRate,
        payType: dto.payType ? toDb(dto.payType) : undefined,
        percentRate: dto.percentRate,
        salary: dto.salary,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        status: dto.status ? toDb(dto.status) : undefined,
        notes: dto.notes,
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    })

    return toApiStaff(row)
  }

  /**
   * Xodimni o'chirish.
   *
   * Davomat, bonus yoki jarima bo'lsa — o'chirilmaydi, `fired`
   * ga o'tadi. Oylik tarixi yo'qolmasligi kerak.
   */
  async remove(id: string) {
    await this.assertExists(id)

    const used =
      (await this.db.attendance.count({ where: { staffId: id } })) +
      (await this.db.bonus.count({ where: { staffId: id } })) +
      (await this.db.penalty.count({ where: { staffId: id } }))

    if (used > 0) {
      await this.db.staff.update({ where: { id }, data: { status: 'FIRED' } })
      return { archived: true }
    }

    await this.db.staff.delete({ where: { id } })
    return { archived: false }
  }

  /**
   * Parolni almashtirish.
   *
   * Eski parol SAQLANMAYDI va tiklanmaydi — faqat xeshi bor.
   * Shuning uchun "eski parolni ko'rsating" degan imkoniyat yo'q
   * va bo'lishi ham kerak emas.
   */
  async resetPassword(id: string, dto: ResetPasswordDto) {
    const staff = await this.db.staff.findFirst({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!staff) throw new NotFoundException('Xodim topilmadi')
    if (!staff.userId) {
      throw new BadRequestException('Bu xodimda tizimga kirish yo‘q')
    }

    await this.db.user.update({
      where: { id: staff.userId },
      data: { passwordHash: await argon2.hash(dto.password) },
    })

    return { ok: true }
  }

  /**
   * Oylik ish jadvali.
   *
   * Har bir xodim O'Z jadvalini ko'radi — CEO belgilagan ish
   * kunlarini bilishi uchun. Boshqasinikini ko'rish `staff.view`
   * talab qiladi.
   */
  async schedule(staffId: string, month: string) {
    const { userId, permissions } = this.ctx.require()

    const staff = await this.db.staff.findFirst({ where: { id: staffId } })
    if (!staff) throw new NotFoundException('Xodim topilmadi')

    const isSelf = staff.userId === userId
    if (!isSelf && !permissions.includes('staff.view')) {
      throw new ForbiddenException('Faqat o‘z jadvalingizni ko‘rasiz')
    }

    return this.buildSchedule(staff, month)
  }

  async myScheduleFor(month: string) {
    const { userId } = this.ctx.require()
    const staff = await this.db.staff.findFirst({ where: { userId } })
    if (!staff) throw new NotFoundException('Sizning xodim yozuvingiz topilmadi')
    return this.buildSchedule(staff, month)
  }

  async doctorSchedule(doctorId: string, month: string) {
    const staff = await this.db.staff.findFirst({ where: { doctorId } })
    if (!staff) throw new NotFoundException('Shifokorning xodim yozuvi topilmadi')
    return this.schedule(staff.id, month)
  }

  private async buildSchedule(staff: Staff, month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    const from = new Date(year, monthNumber - 1, 1)
    const to = new Date(year, monthNumber, 0, 23, 59, 59, 999)

    const marks = await this.db.attendance.findMany({
      where: { staffId: staff.id, date: { gte: from, lte: to } },
      select: { date: true, status: true, lateMinutes: true },
    })
    const byDate = new Map(
      marks.map((m) => [m.date.toISOString().slice(0, 10), m]),
    )

    const days: {
      date: string
      planned: boolean
      status: string | null
      lateMinutes: number
    }[] = []

    for (let d = 1; d <= to.getDate(); d++) {
      const date = new Date(year, monthNumber - 1, d)
      const key = date.toISOString().slice(0, 10)
      const mark = byDate.get(key)
      days.push({
        date: key,
        planned: staff.workdays.includes(date.getDay()),
        status: mark ? toApi(mark.status) : null,
        lateMinutes: mark?.lateMinutes ?? 0,
      })
    }

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      positionTitle: staff.positionTitle,
      month,
      workdays: staff.workdays,
      shiftStart: staff.shiftStart,
      shiftEnd: staff.shiftEnd,
      workRate: staff.workRate,
      days,
      plannedDays: days.filter((d) => d.planned).length,
      workedDays: days.filter((d) => d.status === 'present' || d.status === 'late').length,
    }
  }

  private async assertExists(id: string) {
    const found = await this.db.staff.findFirst({
      where: { id },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Xodim topilmadi')
  }
}

/* ------------------------------------------------------------------ */

type StaffRow = Staff & { user: { id: string; email: string; role: string } | null }

function toApiStaff(row: StaffRow) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    position: toApi(row.position),
    positionTitle: row.positionTitle,
    department: row.department,
    workdays: row.workdays,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    workRate: row.workRate,
    payType: toApi(row.payType),
    percentRate: row.percentRate,
    salary: row.salary,
    hiredAt: toApiDate(row.hiredAt)!,
    status: toApi(row.status),
    hasSystemAccess: row.hasSystemAccess,
    role: row.user ? row.user.role.toLowerCase() : null,
    login: row.user?.email ?? '',
    // Parolning o'zi HECH QACHON javobga tushmaydi
    credentialsSetAt: row.user ? toApiDateTime(row.updatedAt) : null,
    mustChangePassword: false,
    doctorId: row.doctorId,
    avatarUrl: row.avatarUrl,
    notes: row.notes,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

