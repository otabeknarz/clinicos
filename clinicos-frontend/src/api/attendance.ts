/**
 * Davomat.
 *
 * NEGA KERAK: farrosh, qorovul, haydovchi kabi xodimlarda tizimda
 * boshqa hech qanday o'lchanadigan ko'rsatkich yo'q. Davomat ularning
 * reytingini avtomatik hisoblash uchun yagona ishonchli manba.
 *
 * RUXSAT:
 *   `attendance.view`   — ko'rish (egasi, administratsiya)
 *   `attendance.manage` — belgilash va tuzatish
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { addDays, startOfDay, toISODate } from '@/lib/dates'
import type {
  Attendance,
  AttendanceDay,
  AttendanceFlag,
  AttendanceStatus,
  AttendanceSummary,
  DailyAttendance,
  DailyAttendanceRow,
  ID,
} from '@/types/models'

/** Kechikish uchun jarima balli: har 10 daqiqa — 1 ball */
const LATE_PENALTY_PER_10MIN = 1

/**
 * Kelish vaqti tizimga yozilgan paytdan shuncha daqiqa oldin bo'lsa,
 * yozuv shubhali deb belgilanadi.
 *
 * NEGA 120 DAQIQA: registrator odatda odam kelgan zahoti belgilaydi.
 * Ikki soatdan keyin "u ertalab kelgan edi" deb yozish — kechikishni
 * yashirishning eng oddiy usuli. Chegara ataylab keng: haqiqiy
 * sabablar ham bo'ladi (band bo'lib qolgan, tizim ishlamagan), shuning
 * uchun tizim yozuvni to'smaydi, faqat egasiga ko'rsatadi.
 */
const BACKDATE_THRESHOLD_MINUTES = 120

/**
 * Kiritilgan kelish vaqti shubhalimi.
 *
 * Ikki holat tekshiriladi:
 *   'future'    — kelajakdagi vaqt, bu xato yoki ataylab
 *   'backdated' — vaqt yozilgan paytdan ancha oldin
 *
 * MUHIM: bu tekshiruv serverda ham takrorlanishi SHART. Frontenddagi
 * hisob faqat foydalanuvchini ogohlantirish uchun — uni chetlab
 * o'tish oson.
 */
export function checkArrivalTime(
  date: string,
  arrivedAt: string,
  now = new Date(),
): { flagged: boolean; reason: string; gapMinutes: number } {
  const [h, m] = arrivedAt.split(':').map(Number)
  const arrival = new Date(date + 'T00:00:00')
  arrival.setHours(h, m, 0, 0)

  const gapMinutes = Math.round((now.getTime() - arrival.getTime()) / 60_000)

  if (gapMinutes < 0) {
    return { flagged: true, reason: 'future', gapMinutes: Math.abs(gapMinutes) }
  }
  if (gapMinutes > BACKDATE_THRESHOLD_MINUTES) {
    return { flagged: true, reason: 'backdated', gapMinutes }
  }
  return { flagged: false, reason: '', gapMinutes }
}

/**
 * Smena boshlanishiga nisbatan kechikish, daqiqada.
 *
 * TUNGI SMENA: qorovul kabi xodimlarda smena yarim tundan o'tadi
 * (20:00—08:00). Bunday smenada 00:30 da kelish — kechikish, lekin
 * oddiy ayirish manfiy son beradi. Shuning uchun smena tunligini
 * `shiftEnd` orqali aniqlab, kelish vaqtini ertasi kunga suramiz.
 */
export function lateMinutesFrom(
  shiftStart: string,
  arrivedAt: string,
  shiftEnd?: string,
): number {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }

  const start = toMinutes(shiftStart)
  let arrival = toMinutes(arrivedAt)

  const overnight = shiftEnd ? toMinutes(shiftEnd) <= start : false
  if (overnight && arrival < start) arrival += 24 * 60

  return Math.max(0, arrival - start)
}

/* ------------------------------------------------------------------ */
/* O'qish                                                              */
/* ------------------------------------------------------------------ */

// GET /attendance?staffId=&from=&to=
export async function listAttendance(
  staffId: ID,
  from: string,
  to: string,
): Promise<AttendanceDay[]> {
  if (!USE_MOCK) {
    return request<AttendanceDay[]>('GET', '/attendance', { query: { staffId, from, to } })
  }

  const rows = getDb()
    .attendance.all(apiContext().clinicId)
    .filter((a) => a.staffId === staffId && a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({ date: a.date, status: a.status, lateMinutes: a.lateMinutes }))

  return delay(rows, 120)
}

/**
 * Davomat xulosasi.
 *
 * `disciplineScore` — 0-100 ball:
 *   - kelmagan kun har biri jiddiy pasaytiradi,
 *   - kechikish har 10 daqiqasi uchun 1 ball,
 *   - sababli kelmaslik (ta'til, kasallik) jazolanmaydi.
 */
// GET /attendance/summary?staffId=&period=
export async function getAttendanceSummary(
  staffId: ID,
  days = 30,
): Promise<AttendanceSummary> {
  if (!USE_MOCK) {
    return request<AttendanceSummary>('GET', '/attendance/summary', {
      query: { staffId, days },
    })
  }

  return delay(computeSummary(staffId, days), 100)
}

/** Bir necha xodim uchun birdaniga — ro'yxat sahifasi uchun */
export function computeSummary(staffId: ID, days = 30): AttendanceSummary {
  const { clinicId } = apiContext()
  const today = startOfDay(new Date())
  const from = toISODate(addDays(today, -days))
  const period = toISODate(today).slice(0, 7)

  const rows = getDb()
    .attendance.all(clinicId)
    .filter((a) => a.staffId === staffId && a.date >= from)

  const workdayRows = rows.filter((a) => a.status !== 'day_off')

  const present = workdayRows.filter((a) => a.status === 'present').length
  const late = workdayRows.filter((a) => a.status === 'late').length
  const absent = workdayRows.filter((a) => a.status === 'absent').length
  const excused = workdayRows.filter((a) => a.status === 'excused').length
  const totalLateMinutes = workdayRows.reduce((sum, a) => sum + a.lateMinutes, 0)

  // Sababli kelmaslik hisobga olinmaydi — u xodimning aybi emas
  const countable = present + late + absent

  const attendancePct = countable ? ((present + late) / countable) * 100 : 100

  const latePenalty = (totalLateMinutes / 10) * LATE_PENALTY_PER_10MIN
  const absencePenalty = countable ? (absent / countable) * 100 : 0
  const disciplineScore = Math.max(0, Math.min(100, 100 - absencePenalty - latePenalty))

  return {
    staffId,
    period,
    workdays: workdayRows.length,
    present,
    late,
    absent,
    excused,
    totalLateMinutes,
    attendancePct,
    disciplineScore,
  }
}

/**
 * Bir kunning davomati — barcha faol xodimlar bo'yicha.
 *
 * Registratura har kuni shu ro'yxatni ochib, kim kelgan-kelmaganini
 * belgilaydi. Shuning uchun bu yerda xodimning MAOSHI yoki foizi yo'q:
 * davomat belgilash uchun ular kerak emas, ko'rsatilsa esa ortiqcha
 * moliyaviy ma'lumot tarqaladi.
 */
// GET /attendance/daily?date=
export async function getDailyAttendance(date: string): Promise<DailyAttendance> {
  if (!USE_MOCK) {
    return request<DailyAttendance>('GET', '/attendance/daily', { query: { date } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const weekday = new Date(date + 'T00:00:00').getDay()

  const records = new Map(
    db.attendance
      .all(clinicId)
      .filter((a) => a.date === date)
      .map((a) => [a.staffId, a]),
  )

  const rows: DailyAttendanceRow[] = db.staff
    .all(clinicId)
    .filter((person) => person.status === 'active')
    .map((person) => {
      const record = records.get(person.id)
      return {
        staffId: person.id,
        fullName: person.fullName,
        positionTitle: person.positionTitle,
        department: person.department,
        shiftStart: person.shiftStart,
        shiftEnd: person.shiftEnd,
        isWorkday: person.workdays.includes(weekday),
        status: record?.status ?? null,
        arrivedAt: record?.arrivedAt ?? null,
        lateMinutes: record?.lateMinutes ?? 0,
        note: record?.note ?? '',
        flagged: record?.flagged ?? false,
      }
    })
    // Belgilanmaganlar tepada — aynan ular ish talab qiladi
    .sort((a, b) => {
      if (a.isWorkday !== b.isWorkday) return a.isWorkday ? -1 : 1
      const aDone = a.status !== null
      const bDone = b.status !== null
      if (aDone !== bDone) return aDone ? 1 : -1
      return a.fullName.localeCompare(b.fullName)
    })

  const workdayRows = rows.filter((r) => r.isWorkday)
  const countOf = (status: AttendanceStatus) =>
    workdayRows.filter((r) => r.status === status).length

  return delay(
    {
      date,
      rows,
      counts: {
        expected: workdayRows.length,
        present: countOf('present'),
        late: countOf('late'),
        absent: countOf('absent'),
        excused: countOf('excused'),
        unmarked: workdayRows.filter((r) => r.status === null).length,
      },
    },
    140,
  )
}

/* ------------------------------------------------------------------ */
/* Yozish                                                              */
/* ------------------------------------------------------------------ */

export interface AttendanceInput {
  staffId: ID
  date: string
  status: AttendanceStatus
  lateMinutes: number
  note: string
  /** Qo'lda kiritilgan kelish vaqti, "HH:MM". Faqat 'late' uchun. */
  arrivedAt?: string | null
  /** Kim belgilayotgani — yozuv egasiz qolmasligi kerak */
  markedBy?: ID
  markedByName?: string
}

/**
 * Kunlik davomatni belgilash.
 *
 * Bir xodimga bir kunda bitta yozuv bo'ladi — mavjudi yangilanadi.
 */
// POST /attendance
export async function markAttendance(input: AttendanceInput): Promise<Attendance> {
  if (!USE_MOCK) return request<Attendance>('POST', '/attendance', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const now = new Date()
  const isLate = input.status === 'late'
  const arrivedAt = isLate ? (input.arrivedAt ?? null) : null

  // Shubha tekshiruvi faqat qo'lda kiritilgan vaqt bo'lganda
  const check = arrivedAt
    ? checkArrivalTime(input.date, arrivedAt, now)
    : { flagged: false, reason: '' }

  const patch = {
    status: input.status,
    arrivedAt,
    lateMinutes: isLate ? input.lateMinutes : 0,
    note: input.note,
    markedBy: input.markedBy ?? '',
    markedByName: input.markedByName ?? '',
    markedAt: now.toISOString(),
    flagged: check.flagged,
    flagReason: check.reason,
  }

  const existing = db.attendance
    .all(clinicId)
    .find((a) => a.staffId === input.staffId && a.date === input.date)

  if (existing) {
    const updated = db.attendance.update(existing.id, patch, clinicId)
    if (!updated) throw new Error('Yozuv topilmadi')
    return delay(updated, 220)
  }

  const row: Attendance = {
    id: db.attendance.nextId('att'),
    clinicId,
    staffId: input.staffId,
    date: input.date,
    checkInAt: null,
    checkOutAt: null,
    workedMinutes: 0,
    createdAt: now.toISOString(),
    ...patch,
  }

  db.attendance.insert(row)
  return delay(row, 260)
}

/* ------------------------------------------------------------------ */
/* Shubhali yozuvlar — egasi uchun                                    */
/* ------------------------------------------------------------------ */

/**
 * Kelish vaqti shubhali yozilgan davomat yozuvlari.
 *
 * Egasining davomat bo'limida tepada ogohlantirish bo'lib turadi.
 * Bu ayblov emas — e'tibor talab qiladigan yozuvlar ro'yxati:
 * ehtimol haqiqiy sabab bor, lekin egasi bundan xabardor bo'lishi kerak.
 *
 * RUXSAT: faqat `staff.manage` — registratura o'zi belgilagan
 * yozuvning bayroqlanganini ko'rmaydi.
 */
// GET /attendance/flags?limit=
export async function listAttendanceFlags(limit = 20): Promise<AttendanceFlag[]> {
  if (!USE_MOCK) {
    return request<AttendanceFlag[]>('GET', '/attendance/flags', { query: { limit } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const staff = new Map(db.staff.all(clinicId).map((p) => [p.id, p]))

  const rows = db.attendance
    .all(clinicId)
    .filter((a) => a.flagged)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((a): AttendanceFlag => {
      const person = staff.get(a.staffId)
      const gap = a.arrivedAt
        ? checkArrivalTime(a.date, a.arrivedAt, new Date(a.markedAt)).gapMinutes
        : 0

      return {
        id: a.id,
        staffId: a.staffId,
        staffName: person?.fullName ?? '—',
        positionTitle: person?.positionTitle ?? '—',
        date: a.date,
        arrivedAt: a.arrivedAt,
        lateMinutes: a.lateMinutes,
        markedByName: a.markedByName,
        markedAt: a.markedAt,
        reason: a.flagReason,
        gapMinutes: gap,
      }
    })

  return delay(rows, 130)
}
