/**
 * Xodimlar — klinikaning butun shtati.
 *
 * Shifokordan farrosh va qorovulgacha hammasi shu yerda. Ko'pchiligiga
 * tizimga kirish kerak emas — ular kadr yozuvi sifatida turadi.
 *
 * RUXSAT: `staff.view` / `staff.manage` — faqat egasi.
 *
 * MUHIM: tizimga kirish huquqini va parolni FAQAT egasi bera oladi.
 * Bu yagona joy — boshqa hech qayerdan foydalanuvchi yaratilmaydi.
 * Serverda ham shu tekshiruv takrorlanishi shart.
 */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { computeSummary } from './attendance'
import { getDb } from '@/mock/db'
import { addDays, eachDay, startOfDay, toISODate } from '@/lib/dates'
import { money, percent } from '@/lib/format'
import type {
  ID,
  PayType,
  RatingFactor,
  Role,
  Staff,
  StaffPerformance,
  StaffPosition,
  StaffStatus,
  StaffWithPerformance,
  WorkSchedule,
  WorkScheduleDay,
} from '@/types/models'
import { effectiveSalary, percentEarnings } from '@/types/models'

export interface StaffQuery {
  search?: string
  position?: StaffPosition | 'all'
  status?: StaffStatus | 'all'
  /** Faqat tizimga kira oladiganlar */
  withAccess?: boolean
}

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */

// GET /staff?search=&position=&status=
export async function listStaff(query: StaffQuery = {}): Promise<StaffWithPerformance[]> {
  if (!USE_MOCK) {
    return request<StaffWithPerformance[]>('GET', '/staff', {
      query: {
        search: query.search,
        position: query.position,
        status: query.status,
        withAccess: query.withAccess,
      },
    })
  }

  const rows = getDb()
    .staff.all(apiContext().clinicId)
    .filter(
      (s) =>
        !query.search ||
        matches(s.fullName, query.search) ||
        matches(s.positionTitle, query.search),
    )
    .filter((s) => !query.position || query.position === 'all' || s.position === query.position)
    .filter((s) => !query.status || query.status === 'all' || s.status === query.status)
    .filter((s) => !query.withAccess || s.hasSystemAccess)
    .map((s) => ({ ...s, performance: computeStaffPerformance(s) }))

  // Reytingi yuqorilari tepada, reytingsizlar oxirida
  rows.sort((a, b) => (b.performance.rating ?? -1) - (a.performance.rating ?? -1))

  return delay(rows)
}

// GET /staff/:id
export async function getStaff(id: ID): Promise<StaffWithPerformance | null> {
  if (!USE_MOCK) return request<StaffWithPerformance>('GET', `/staff/${id}`)

  const row = getDb().staff.find(id, apiContext().clinicId)
  if (!row) return delay(null)
  return delay({ ...row, performance: computeStaffPerformance(row) })
}

/* ------------------------------------------------------------------ */
/* Yaratish va tahrirlash                                              */
/* ------------------------------------------------------------------ */

export interface StaffInput {
  fullName: string
  phone: string
  email: string
  position: StaffPosition
  positionTitle: string
  department: string
  workdays: number[]
  shiftStart: string
  shiftEnd: string
  workRate: number
  payType: PayType
  percentRate: number
  salary: number
  hiredAt: string
  status: StaffStatus
  hasSystemAccess: boolean
  role: Role | null
  login: string
  /**
   * Boshlang'ich parol.
   *
   * Faqat SO'ROVDA yuboriladi va hech qayerda saqlanmaydi. Server uni
   * bcrypt/argon2 bilan xeshlaydi va javobda QAYTARMAYDI.
   */
  password?: string
  mustChangePassword: boolean
  notes: string
}

// POST /staff
export async function createStaff(input: StaffInput): Promise<Staff> {
  if (!USE_MOCK) return request<Staff>('POST', '/staff', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  // Parolni mock bazaga YOZMAYMIZ — faqat belgilangan vaqtini qayd etamiz
  const { password, ...rest } = input
  const now = new Date().toISOString()

  const staff: Staff = {
    id: db.staff.nextId('stf'),
    clinicId,
    doctorId: null,
    avatarUrl: null,
    createdAt: now,
    ...rest,
    role: input.hasSystemAccess ? input.role : null,
    login: input.hasSystemAccess ? input.login.trim() : '',
    credentialsSetAt: input.hasSystemAccess && password ? now : null,
  }

  db.staff.insert(staff)

  // Kirish huquqi berilsa — foydalanuvchi yozuvi ham yaratiladi
  if (staff.hasSystemAccess && staff.role) {
    db.users.insert({
      id: db.users.nextId('usr'),
      clinicId,
      fullName: staff.fullName,
      email: staff.login || staff.email,
      phone: staff.phone,
      role: staff.role,
      avatarUrl: null,
      extraPermissions: [],
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      doctorId: staff.doctorId,
    })
  }

  return delay(staff, 320)
}

// PATCH /staff/:id
export async function updateStaff(id: ID, patch: Partial<StaffInput>): Promise<Staff> {
  if (!USE_MOCK) return request<Staff>('PATCH', `/staff/${id}`, { body: patch })

  const { password, ...rest } = patch
  const next: Partial<Staff> = { ...rest }

  if (next.hasSystemAccess === false) {
    next.role = null
    next.login = ''
  }
  if (password) {
    next.credentialsSetAt = new Date().toISOString()
  }

  const updated = getDb().staff.update(id, next, apiContext().clinicId)
  if (!updated) throw new Error('Xodim topilmadi')
  return delay(updated, 260)
}

// DELETE /staff/:id
export async function deleteStaff(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/staff/${id}`)
    return
  }
  getDb().staff.remove(id, apiContext().clinicId)
  await delay(null, 240)
}

/**
 * Parolni qayta belgilash.
 *
 * Alohida endpoint: bu oddiy tahrirlash emas, xavfsizlik o'zgarishi.
 * Serverda audit yozuvi qoldirilishi va xodimga xabar yuborilishi kerak.
 * Egasi MAVJUD parolni ko'ra olmaydi — faqat yangisini belgilay oladi.
 */
// POST /staff/:id/password  { password, mustChangePassword }
export async function resetStaffPassword(
  id: ID,
  _password: string,
  mustChangePassword: boolean,
): Promise<Staff> {
  if (!USE_MOCK) {
    return request<Staff>('POST', `/staff/${id}/password`, {
      body: { password: _password, mustChangePassword },
    })
  }

  const updated = getDb().staff.update(
    id,
    { credentialsSetAt: new Date().toISOString(), mustChangePassword },
    apiContext().clinicId,
  )
  if (!updated) throw new Error('Xodim topilmadi')
  return delay(updated, 280)
}

/* ------------------------------------------------------------------ */
/* Reyting va samaradorlik                                             */
/* ------------------------------------------------------------------ */
/* Ish jadvali                                                         */
/* ------------------------------------------------------------------ */

/**
 * Xodimning bir oylik ish jadvali.
 *
 * NEGA KERAK: ish kunlarini klinika egasi belgilaydi, lekin xodim
 * ularni bilishi kerak. Og'zaki aytish o'rniga xodim o'z profilida
 * kalendarni ochib ko'radi — nizolar shu bilan kamayadi.
 *
 * O'tgan kunlarga davomat natijasi ham qo'shiladi, shuning uchun
 * xodim o'z intizomini ham shu yerda ko'radi.
 */
// GET /staff/:id/schedule?month=
export async function getWorkSchedule(
  staffId: ID,
  month: string,
): Promise<WorkSchedule | null> {
  if (!USE_MOCK) {
    return request<WorkSchedule>('GET', `/staff/${staffId}/schedule`, { query: { month } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const person = db.staff.find(staffId, clinicId)
  if (!person) return delay(null, 80)

  const [year, monthIndex] = month.split('-').map(Number)
  const first = new Date(year, monthIndex - 1, 1)
  const last = new Date(year, monthIndex, 0)

  const records = new Map(
    db.attendance
      .all(clinicId)
      .filter((a) => a.staffId === staffId && a.date.slice(0, 7) === month)
      .map((a) => [a.date, a]),
  )

  const days: WorkScheduleDay[] = eachDay(first, last).map((date) => {
    const key = toISODate(date)
    const record = records.get(key)
    return {
      date: key,
      planned: person.workdays.includes(date.getDay()),
      status: record?.status ?? null,
      lateMinutes: record?.lateMinutes ?? 0,
    }
  })

  return delay(
    {
      staffId: person.id,
      fullName: person.fullName,
      positionTitle: person.positionTitle,
      month,
      workdays: person.workdays,
      shiftStart: person.shiftStart,
      shiftEnd: person.shiftEnd,
      workRate: person.workRate,
      days,
      plannedDays: days.filter((d) => d.planned).length,
      workedDays: days.filter((d) => d.status === 'present' || d.status === 'late').length,
    },
    160,
  )
}

/**
 * Kirgan xodimning o'z kartasi — ko'rsatkichlari bilan.
 *
 * NEGA KERAK: xodim o'zi haqidagi bahoni ko'rishi kerak. Reyting
 * tizim tomonidan avtomatik hisoblanadi; agar u yopiq bo'lsa, xodim
 * uchun bu "boshliq shunday deb o'ylaydi" bo'lib qoladi. Ochiq
 * bo'lsa — tuzatish mumkin bo'lgan aniq ko'rsatkichga aylanadi.
 *
 * DASTURCHIGA: haqiqiy backendda bu `GET /me/profile` bo'ladi va
 * xodim token orqali aniqlanadi. Mock rejimda bog'lanish email
 * bo'yicha topiladi, chunki `User` da `staffId` maydoni yo'q.
 */
// GET /me/profile
export async function getMyStaffProfile(
  email: string,
): Promise<StaffWithPerformance | null> {
  if (!USE_MOCK) return request<StaffWithPerformance>('GET', '/me/profile')

  const { clinicId } = apiContext()
  const row = getDb()
    .staff.all(clinicId)
    .find((p) => p.email.toLowerCase() === email.toLowerCase())

  if (!row) return delay(null, 80)
  return delay({ ...row, performance: computeStaffPerformance(row) }, 180)
}

/**
 * Shifokorning ish jadvali.
 *
 * Shifokor ham shtatda turadi — xodim kartasi `doctorId` orqali
 * bog'langan. Davomat va intizom shu karta bo'yicha yuritiladi,
 * shuning uchun jadval ham o'sha manbadan olinadi.
 *
 * AGAR XODIM KARTASI BO'LMASA: shifokorning o'z yozuvidagi ish
 * kunlaridan jadval yig'iladi. Davomat bo'lmaydi (uni belgilashga
 * karta kerak), lekin ish kunlari baribir ko'rinadi — shifokor
 * "qaysi kuni ishlayman" degan savolga javob olishi kerak.
 */
// GET /doctors/:id/schedule?month=
export async function getDoctorWorkSchedule(
  doctorId: ID,
  month: string,
): Promise<WorkSchedule | null> {
  if (!USE_MOCK) {
    return request<WorkSchedule>('GET', `/doctors/${doctorId}/schedule`, {
      query: { month },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const staffRow = db.staff.all(clinicId).find((p) => p.doctorId === doctorId)
  if (staffRow) return getWorkSchedule(staffRow.id, month)

  const doctor = db.doctors.find(doctorId, clinicId)
  if (!doctor) return delay(null, 80)

  const [year, monthIndex] = month.split('-').map(Number)
  const days: WorkScheduleDay[] = eachDay(
    new Date(year, monthIndex - 1, 1),
    new Date(year, monthIndex, 0),
  ).map((date) => ({
    date: toISODate(date),
    planned: doctor.workdays.includes(date.getDay()),
    status: null,
    lateMinutes: 0,
  }))

  return delay(
    {
      staffId: doctor.id,
      fullName: doctor.fullName,
      positionTitle: doctor.specialty,
      month,
      workdays: doctor.workdays,
      shiftStart: doctor.shiftStart,
      shiftEnd: doctor.shiftEnd,
      workRate: 1,
      days,
      plannedDays: days.filter((d) => d.planned).length,
      workedDays: 0,
    },
    150,
  )
}

/**
 * Kirgan foydalanuvchining o'z jadvali.
 *
 * DASTURCHIGA: haqiqiy backendda bu `GET /me/schedule` bo'ladi va
 * xodim token orqali aniqlanadi. Mock rejimda bog'lanish email
 * bo'yicha topiladi, chunki `User` da `staffId` maydoni yo'q.
 */
// GET /me/schedule?month=
export async function getMyWorkSchedule(
  email: string,
  month: string,
): Promise<WorkSchedule | null> {
  if (!USE_MOCK) return request<WorkSchedule>('GET', '/me/schedule', { query: { month } })

  const { clinicId } = apiContext()
  const person = getDb()
    .staff.all(clinicId)
    .find((p) => p.email.toLowerCase() === email.toLowerCase())

  if (!person) return delay(null, 80)
  return getWorkSchedule(person.id, month)
}

/* ------------------------------------------------------------------ */

/**
 * Xodim reytingi — AVTOMATIK hisoblanadi, hech kim qo'lda qo'ymaydi.
 *
 * Har bir lavozim uchun o'lchanadigan narsa boshqacha:
 *
 *   SHIFOKOR     — qabullarni yakunlash, kelmaganlar ulushi, bemor
 *                  oqimi rejaga nisbatan, davomat
 *   ADMINISTRATOR— kassa aniqligi (kamomad yo'qligi), qayta ishlangan
 *                  to'lovlar hajmi, davomat
 *   QOLGANLAR    — davomat va intizom
 *
 * Reyting 0–5 shkalada. Har bir omil qanday ta'sir qilgani `factors`da
 * ko'rinadi, ya'ni xodim "nega menga 3.8?" degan savolga javob oladi.
 */
export function computeStaffPerformance(staff: Staff): StaffPerformance {
  const { clinicId } = apiContext()
  const db = getDb()

  const attendance = computeSummary(staff.id, 30)
  const factors: RatingFactor[] = []
  const metrics: { labelKey: string; value: string }[] = []
  let performancePct: number | null = null

  /**
   * Xodim keltirgan tushum.
   *
   * Hozircha faqat shifokorga aniq bog'lash mumkin - to'lov yozuvida
   * `doctorId` bor. Boshqa lavozimlarda tushumni xodimga bog'lash uchun
   * qo'shimcha ma'lumot kerak (masalan, laborant qaysi tahlilni bajargani).
   */
  let generatedRevenue: number | null = null

  const periodStart = startOfDay(addDays(new Date(), -29)).getTime()

  /* --- Davomat: hamma uchun umumiy omil --- */
  const hasAttendanceData = attendance.workdays > 0
  if (hasAttendanceData) {
    factors.push({
      labelKey: 'staff.factor.discipline',
      score: attendance.disciplineScore,
      weight: staff.position === 'doctor' || staff.position === 'receptionist' ? 0.3 : 1,
      display: percent(attendance.attendancePct),
    })

    metrics.push({ labelKey: 'staff.metric.attendance', value: percent(attendance.attendancePct) })
    if (attendance.late > 0) {
      metrics.push({
        labelKey: 'staff.metric.late',
        value: `${attendance.late} (${attendance.totalLateMinutes} daq)`,
      })
    }
    if (attendance.absent > 0) {
      metrics.push({ labelKey: 'staff.metric.absent', value: String(attendance.absent) })
    }
  }

  /* --- Shifokor --- */
  if (staff.position === 'doctor' && staff.doctorId) {
    const appts = db.appointments
      .all(clinicId)
      .filter((a) => a.doctorId === staff.doctorId)
      .filter((a) => new Date(a.startsAt).getTime() >= periodStart)

    const completed = appts.filter((a) => a.status === 'completed')
    const noShows = appts.filter((a) => a.status === 'no_show')

    if (appts.length > 0) {
      const completionRate = (completed.length / appts.length) * 100
      const noShowRate = (noShows.length / appts.length) * 100

      factors.push({
        labelKey: 'staff.factor.completion',
        score: completionRate,
        weight: 0.4,
        display: percent(completionRate),
      })
      factors.push({
        labelKey: 'staff.factor.noShow',
        score: Math.max(0, 100 - noShowRate * 8),
        weight: 0.3,
        display: percent(noShowRate, 1),
      })

      // Reja: ish kunida 8 ta bemor, stavkaga ko'paytiriladi
      const workdayCount = countWorkdays(staff.workdays, 30)
      const plan = Math.max(1, Math.round(workdayCount * 8 * staff.workRate))
      performancePct = (completed.length / plan) * 100

      metrics.push({ labelKey: 'staff.metric.completed', value: String(completed.length) })
      metrics.push({ labelKey: 'staff.metric.plan', value: String(plan) })

      const revenue = db.payments
        .all(clinicId)
        .filter((p) => p.doctorId === staff.doctorId && p.status === 'paid')
        .filter((p) => new Date(p.paidAt).getTime() >= periodStart)
        .reduce((sum, p) => sum + p.amount, 0)

      generatedRevenue = revenue
      metrics.push({ labelKey: 'staff.metric.revenue', value: money(revenue) })
    }
  }

  /* --- Administrator --- */
  if (staff.position === 'receptionist') {
    const user = db.users.all(clinicId).find((u) => u.email === staff.email)

    if (user) {
      const closures = db.shiftClosures
        .all(clinicId)
        .filter((c) => c.userId === user.id)
        .filter((c) => new Date(c.date).getTime() >= periodStart)

      const clean = closures.filter((c) => c.difference === 0).length
      const accuracy = closures.length ? (clean / closures.length) * 100 : 100

      factors.push({
        labelKey: 'staff.factor.cashAccuracy',
        score: accuracy,
        weight: 0.5,
        display: percent(accuracy),
      })

      const payments = db.payments
        .all(clinicId)
        .filter((p) => p.createdBy === user.id && p.status === 'paid')
        .filter((p) => new Date(p.paidAt).getTime() >= periodStart)

      const workdayCount = countWorkdays(staff.workdays, 30)
      const plan = Math.max(1, Math.round(workdayCount * 18 * staff.workRate))
      performancePct = (payments.length / plan) * 100

      const shortfall = closures
        .filter((c) => c.difference < 0)
        .reduce((sum, c) => sum + Math.abs(c.difference), 0)

      factors.push({
        labelKey: 'staff.factor.volume',
        score: Math.min(100, performancePct),
        weight: 0.2,
        display: String(payments.length),
      })

      metrics.push({ labelKey: 'staff.metric.payments', value: String(payments.length) })
      metrics.push({ labelKey: 'staff.metric.cashAccuracy', value: percent(accuracy) })
      if (shortfall > 0) {
        metrics.push({ labelKey: 'staff.metric.shortfall', value: money(shortfall) })
      }
    }
  }

  /* --- Qolgan lavozimlar: samaradorlik = davomat --- */
  if (performancePct === null && hasAttendanceData) {
    performancePct = attendance.attendancePct
  }

  /* --- Yakuniy ball --- */
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  const rating =
    totalWeight > 0
      ? Math.round(
          (factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight / 20) * 10,
        ) / 10
      : null

  /* --- Shu oydagi bonuslar --- */
  const period = toISODate(new Date()).slice(0, 7)
  const bonusThisPeriod = db.bonuses
    .all(clinicId)
    .filter((b) => b.staffId === staff.id && b.period === period)
    .reduce((sum, b) => sum + b.amount, 0)

  /* --- Daromad: maosh + foiz + bonus --- */

  const earnedByPercent = percentEarnings(staff, generatedRevenue ?? 0)
  const base = effectiveSalary(staff)

  if (earnedByPercent > 0) {
    metrics.push({ labelKey: 'staff.metric.percentEarnings', value: money(earnedByPercent) })
  }

  return {
    staffId: staff.id,
    rating,
    factors,
    performancePct,
    metrics,
    bonusThisPeriod,
    attendance: hasAttendanceData ? attendance : null,
    generatedRevenue,
    percentEarnings: earnedByPercent,
    totalEarnings: base + earnedByPercent + bonusThisPeriod,
  }
}

/** Oxirgi `days` kun ichida nechta ish kuni bo'lgan */
function countWorkdays(workdays: number[], days: number): number {
  let count = 0
  const today = startOfDay(new Date())
  for (let i = 0; i < days; i++) {
    if (workdays.includes(addDays(today, -i).getDay())) count++
  }
  return count
}

/* ------------------------------------------------------------------ */
/* Ma'lumotnomalar                                                     */
/* ------------------------------------------------------------------ */

export const STAFF_POSITIONS: StaffPosition[] = [
  'doctor',
  'nurse',
  'receptionist',
  'manager',
  'accountant',
  'lab_tech',
  'pharmacist',
  'cleaner',
  'security',
  'driver',
  'other',
]

/** Odatda tizimga kirish kerak bo'ladigan lavozimlar (forma uchun taklif) */
export const POSITIONS_WITH_ACCESS: StaffPosition[] = ['doctor', 'receptionist', 'manager']

/** Stavka variantlari */
export const WORK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

/** To'lov modellari */
export const PAY_TYPES: PayType[] = ['salary', 'percent', 'salary_percent']

/** Ko'p uchraydigan foiz nisbatlari */
export const PERCENT_PRESETS = [20, 25, 30, 35, 40, 50]

/**
 * Kuchli parol yaratish.
 *
 * Chalkashtiradigan belgilar (0/O, 1/l/I) chiqarib tashlangan — egasi
 * parolni xodimga og'zaki aytishi mumkin.
 */
export function generatePassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => alphabet[v % alphabet.length]).join('')
}

/** Parol yetarlicha kuchlimi */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  return hasLetter && hasDigit
}
