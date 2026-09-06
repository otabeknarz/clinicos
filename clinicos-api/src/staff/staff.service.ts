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
      include: STAFF_EXPAND,
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
      include: STAFF_EXPAND,
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
      include: STAFF_EXPAND,
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

      /*
        SHIFOKOR XODIM — `Doctor` YOZUVI HAM YARATILADI.

        Klinikada shifokor faqat shu yerdan qo'shiladi, ya'ni
        "Shifokorlar" bo'limi o'z-o'zidan to'lmaydi. Yozuv
        bo'lmasa: registrator qabulga shifokor biriktira olmaydi,
        shifokorning o'zi tashrif yoza olmaydi (`visits.service`
        qabulni shifokor bilan solishtiradi) va foizli maosh
        nol tushumdan hisoblanadi.
      */
      const doctorId =
        dto.position === 'doctor'
          ? (
              await tx.doctor.create({
                data: { clinicId, ...doctorDataFrom(dto) },
                select: { id: true },
              })
            ).id
          : null

      if (dto.hasSystemAccess && dto.login && dto.password && dto.role) {
        const user = await tx.user.create({
          data: {
            clinicId,
            fullName: dto.fullName.trim(),
            email: dto.login.trim().toLowerCase(),
            phone: dto.phone.trim(),
            passwordHash: await argon2.hash(dto.password),
            role: toDb(dto.role),
            // Shifokor o'z bemorlarini shu bog'lanish orqali ko'radi
            doctorId,
          },
        })
        userId = user.id
      }

      return tx.staff.create({
        data: {
          clinicId,
          doctorId,
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
        include: STAFF_EXPAND,
      })
    })

    return toApiStaff(row)
  }

  async update(id: string, dto: Partial<StaffInputDto>) {
    const current = await this.db.staff.findFirst({
      where: { id },
      select: {
        id: true,
        userId: true,
        doctorId: true,
        position: true,
        status: true,
        fullName: true,
        phone: true,
        email: true,
        positionTitle: true,
        workdays: true,
        shiftStart: true,
        shiftEnd: true,
        hiredAt: true,
      },
    })
    if (!current) throw new NotFoundException('Xodim topilmadi')

    /*
      Shifokor yozuvini XODIM BILAN BIRGA yuritamiz. Ism yoki
      smena faqat bitta joyda o'zgarsa, registrator ko'rayotgan
      ro'yxat bilan kadrlar ro'yxati bir-biridan uzilib qolardi.
    */
    const position = dto.position ?? toApi(current.position)
    const { clinicId } = this.ctx.require()

    const row = await this.db.$transaction(async (tx) => {
      const doctorId = await syncDoctor(tx, clinicId, current, dto, position)

      return tx.staff.update({
        where: { id },
        data: {
          doctorId,
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
        include: STAFF_EXPAND,
      })
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

    const staff = await this.db.staff.findFirst({
      where: { id },
      select: { doctorId: true },
    })

    const used =
      (await this.db.attendance.count({ where: { staffId: id } })) +
      (await this.db.bonus.count({ where: { staffId: id } })) +
      (await this.db.penalty.count({ where: { staffId: id } }))

    if (used > 0) {
      await this.db.staff.update({ where: { id }, data: { status: 'FIRED' } })
      // Ro'yxatlarda ko'rinmasin, lekin tashrif tarixi joyida qolsin
      await this.deactivateDoctor(staff?.doctorId ?? null)
      return { archived: true }
    }

    await this.db.staff.delete({ where: { id } })

    /*
      Shifokor yozuvi xodim bilan birga ketadi — lekin faqat
      unga hech narsa bog'lanmagan bo'lsa. Qabuli yoki to'lovi
      bo'lsa, o'chirish tarixni uzib qo'yardi.
    */
    if (staff?.doctorId) {
      const doctorId = staff.doctorId
      const attached =
        (await this.db.appointment.count({ where: { doctorId } })) +
        (await this.db.payment.count({ where: { doctorId } }))

      if (attached > 0) await this.deactivateDoctor(doctorId)
      else await this.db.doctor.delete({ where: { id: doctorId } })
    }

    return { archived: false }
  }

  private async deactivateDoctor(doctorId: string | null) {
    if (!doctorId) return
    await this.db.doctor.update({
      where: { id: doctorId },
      data: { status: 'INACTIVE' },
    })
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

    /*
      `passwordChangedAt` — xodimning qo'lidagi eski token darhol
      yaroqsiz bo'lsin. Egasi parolni odatda BEJIZ almashtirmaydi:
      xodim ishdan bo'shadi yoki parol sizib chiqdi. Eski sessiya
      qolib ketsa, qayta belgilashning ma'nosi bo'lmasdi.

      `mustChangePassword` ilgari DTO da qabul qilinardi, lekin
      hech qayerga yozilmasdi — sxemada bunday ustun yo'q edi.
      Endi saqlanadi va xodim kirgach interfeys almashtirishni
      so'raydi.
    */
    await this.db.user.update({
      where: { id: staff.userId },
      data: {
        passwordHash: await argon2.hash(dto.password),
        passwordChangedAt: new Date(),
        mustChangePassword: dto.mustChangePassword,
      },
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

/**
 * Xodim yozuvi bilan birga har doim tortiladigan bog'lanishlar.
 *
 * `doctor` shuning uchun kerak: shifokor xodimning mutaxassisligi
 * va qabul narxi shu yerda turadi — `Staff` da bunday ustun yo'q
 * va bo'lishi ham kerak emas (hamshirada mutaxassislik bo'lmaydi).
 */
const STAFF_EXPAND = {
  user: { select: { id: true, email: true, role: true } },
  doctor: { select: { specialty: true, consultationFee: true } },
} as const

/** `$transaction` ichidagi mijoz — bu yerda ikki jadval yetarli */
type DoctorSyncTx = Pick<
  ReturnType<PrismaService['forCurrentClinic']>,
  'doctor' | 'user'
>

/** Xodim holatini shifokor holatiga o'giradi */
function doctorStatusOf(status: string) {
  if (status === 'fired') return 'INACTIVE' as const
  if (status === 'on_leave') return 'ON_LEAVE' as const
  return 'ACTIVE' as const
}

/**
 * Xodim ma'lumotidan shifokor yozuvi.
 *
 * Ikkalasida bir xil bo'lgan maydonlar (ism, telefon, smena)
 * XODIMDAN olinadi — u yagona manba. Mutaxassislik ko'rsatilmasa
 * lavozim nomi ishlatiladi: "Stomatolog" deb yozilgan bo'lsa,
 * uni yana alohida so'rashning ma'nosi yo'q.
 */
function doctorDataFrom(dto: {
  fullName: string
  phone: string
  email: string
  positionTitle: string
  specialty?: string
  consultationFee?: number
  workdays: number[]
  shiftStart: string
  shiftEnd: string
  hiredAt: string | Date
  status?: string
}) {
  return {
    fullName: dto.fullName.trim(),
    specialty: (dto.specialty?.trim() || dto.positionTitle.trim()).slice(0, 60),
    phone: dto.phone.trim(),
    email: dto.email.trim(),
    consultationFee: dto.consultationFee ?? 0,
    workdays: dto.workdays,
    shiftStart: dto.shiftStart,
    shiftEnd: dto.shiftEnd,
    hiredAt: new Date(dto.hiredAt),
    status: doctorStatusOf(dto.status ?? 'active'),
  }
}

/**
 * Xodim tahrirlanganda shifokor yozuvini moslash.
 *
 * Uch holat bor:
 *
 *   lavozim shifokor, yozuv yo'q  → yaratiladi (eski xodimlar shu yo'ldan o'tadi)
 *   lavozim shifokor, yozuv bor   → umumiy maydonlar ko'chiriladi
 *   lavozim boshqa                → yozuv qoladi, lekin `inactive`
 *
 * Oxirgisida O'CHIRMAYMIZ: tashrif, to'lov va qabul tarixi shu
 * yozuvga bog'langan.
 */
async function syncDoctor(
  tx: DoctorSyncTx,
  clinicId: string,
  current: {
    userId: string | null
    doctorId: string | null
    fullName: string
    phone: string
    email: string
    positionTitle: string
    workdays: number[]
    shiftStart: string
    shiftEnd: string
    hiredAt: Date
    status: string
  },
  dto: Partial<StaffInputDto>,
  position: string,
) {
  if (position !== 'doctor') {
    if (current.doctorId) {
      await tx.doctor.update({
        where: { id: current.doctorId },
        data: { status: 'INACTIVE' },
      })
    }
    return current.doctorId
  }

  const status = doctorStatusOf(dto.status ?? toApi(current.status))

  if (!current.doctorId) {
    const doctor = await tx.doctor.create({
      data: {
        clinicId,
        ...doctorDataFrom({
          fullName: dto.fullName ?? current.fullName,
          phone: dto.phone ?? current.phone,
          email: dto.email ?? current.email,
          positionTitle: dto.positionTitle ?? current.positionTitle,
          specialty: dto.specialty,
          consultationFee: dto.consultationFee,
          workdays: dto.workdays ?? current.workdays,
          shiftStart: dto.shiftStart ?? current.shiftStart,
          shiftEnd: dto.shiftEnd ?? current.shiftEnd,
          hiredAt: dto.hiredAt ?? current.hiredAt,
          status: dto.status ?? toApi(current.status),
        }),
      },
      select: { id: true },
    })

    if (current.userId) {
      await tx.user.update({
        where: { id: current.userId },
        data: { doctorId: doctor.id },
      })
    }
    return doctor.id
  }

  await tx.doctor.update({
    where: { id: current.doctorId },
    data: {
      fullName: dto.fullName?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.trim(),
      specialty: (dto.specialty?.trim() || dto.positionTitle?.trim()) || undefined,
      consultationFee: dto.consultationFee,
      workdays: dto.workdays,
      shiftStart: dto.shiftStart,
      shiftEnd: dto.shiftEnd,
      hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
      status,
    },
  })

  /*
    Bog'lanish faqat XODIMDA bo'lib, foydalanuvchida qolib
    ketgan bo'lishi mumkin (eski yozuvlar). Shifokor o'z
    bemorlarini ko'rishi shu ustunga bog'liq — to'g'rilaymiz.
  */
  if (current.userId) {
    await tx.user.updateMany({
      where: { id: current.userId, doctorId: null },
      data: { doctorId: current.doctorId },
    })
  }

  return current.doctorId
}

type StaffRow = Staff & {
  user: { id: string; email: string; role: string } | null
  doctor: { specialty: string; consultationFee: number } | null
}

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
    specialty: row.doctor?.specialty ?? '',
    consultationFee: row.doctor?.consultationFee ?? 0,
    avatarUrl: row.avatarUrl,
    notes: row.notes,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

