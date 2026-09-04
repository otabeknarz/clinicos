/** Shifokorlar va ularning ko'rsatkichlari. */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { expandAppointment, pick } from './patients'
import { getDb } from '@/mock/db'
import { addDays, startOfDay } from '@/lib/dates'
import type {
  AppointmentExpanded,
  Doctor,
  DoctorStats,
  DoctorWithStats,
  ID,
  PatientWithStats,
  Bonus,
  DoctorEarnings,
} from '@/types/models'

// GET /doctors?search=
export async function listDoctors(search = ''): Promise<DoctorWithStats[]> {
  if (!USE_MOCK) return request<DoctorWithStats[]>('GET', '/doctors', { query: { search } })

  const { clinicId } = apiContext()
  const db = getDb()

  const rows = db.doctors
    .all(clinicId)
    .filter((d) => matches(d.fullName, search) || matches(d.specialty, search))
    .map((d) => ({ ...d, stats: computeDoctorStats(d.id, clinicId) }))

  rows.sort((a, b) => b.stats.revenueThisMonth - a.stats.revenueThisMonth)
  return delay(rows)
}

/** Tanlagichlar (select) uchun yengil ro'yxat */
// GET /doctors?fields=short
export async function listDoctorsShort(): Promise<Doctor[]> {
  if (!USE_MOCK) return request<Doctor[]>('GET', '/doctors', { query: { fields: 'short' } })
  return delay(getDb().doctors.all(apiContext().clinicId), 60)
}

// GET /doctors/:id
export async function getDoctor(id: ID): Promise<DoctorWithStats | null> {
  if (!USE_MOCK) return request<DoctorWithStats>('GET', `/doctors/${id}`)

  const { clinicId } = apiContext()
  const doctor = getDb().doctors.find(id, clinicId)
  if (!doctor) return delay(null)
  return delay({ ...doctor, stats: computeDoctorStats(id, clinicId) })
}

// GET /doctors/:id/appointments?from=&to=
export async function getDoctorAppointments(
  id: ID,
  from?: string,
  to?: string,
): Promise<AppointmentExpanded[]> {
  if (!USE_MOCK) {
    return request<AppointmentExpanded[]>('GET', `/doctors/${id}/appointments`, {
      query: { from, to },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()
  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  const rows = db.appointments
    .all(clinicId)
    .filter((a) => a.doctorId === id)
    .filter((a) => (!from || a.startsAt >= from) && (!to || a.startsAt <= to))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((a) => expandAppointment(a, patients, doctors, services))

  return delay(rows)
}

// GET /doctors/:id/patients
export async function getDoctorPatients(id: ID): Promise<PatientWithStats[]> {
  if (!USE_MOCK) return request<PatientWithStats[]>('GET', `/doctors/${id}/patients`)

  const { clinicId } = apiContext()
  const db = getDb()

  const patientIds = new Set(
    db.appointments
      .all(clinicId)
      .filter((a) => a.doctorId === id)
      .map((a) => a.patientId),
  )

  const payments = db.payments.all(clinicId).filter((p) => p.status === 'paid')
  const appointments = db.appointments.all(clinicId).filter((a) => a.status === 'completed')

  const rows = db.patients
    .all(clinicId)
    .filter((p) => patientIds.has(p.id))
    .map((p) => {
      const own = appointments
        .filter((a) => a.patientId === p.id)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      return {
        ...p,
        stats: {
          visitCount: own.length,
          lastVisitAt: own.length ? own[own.length - 1].startsAt.slice(0, 10) : null,
          totalSpent: payments
            .filter((x) => x.patientId === p.id)
            .reduce((sum, x) => sum + x.amount, 0),
          isReturning: own.length > 1,
          nextFollowUpAt: null,
        },
      }
    })

  rows.sort((a, b) => (b.stats.lastVisitAt ?? '').localeCompare(a.stats.lastVisitAt ?? ''))
  return delay(rows)
}

export interface DoctorInput {
  fullName: string
  specialty: string
  phone: string
  email: string
  consultationFee: number
  workdays: number[]
  shiftStart: string
  shiftEnd: string
  status: Doctor['status']
}

// POST /doctors
export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  if (!USE_MOCK) return request<Doctor>('POST', '/doctors', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const doctor: Doctor = {
    id: db.doctors.nextId('doc'),
    clinicId,
    avatarUrl: null,
    hiredAt: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    ...input,
  }
  db.doctors.insert(doctor)
  return delay(doctor, 300)
}

// PATCH /doctors/:id
export async function updateDoctor(id: ID, patch: Partial<DoctorInput>): Promise<Doctor> {
  if (!USE_MOCK) return request<Doctor>('PATCH', `/doctors/${id}`, { body: patch })

  const updated = getDb().doctors.update(id, patch as Partial<Doctor>, apiContext().clinicId)
  if (!updated) throw new Error('Shifokor topilmadi')
  return delay(updated, 260)
}

// DELETE /doctors/:id
export async function deleteDoctor(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/doctors/${id}`)
    return
  }
  getDb().doctors.remove(id, apiContext().clinicId)
  await delay(null, 240)
}

/* ------------------------------------------------------------------ */

function computeDoctorStats(doctorId: ID, clinicId: string): DoctorStats {
  const db = getDb()
  const today = startOfDay(new Date()).getTime()
  const tomorrow = today + 86_400_000
  // Oyning 1-sanasida "shu oy" bitta kunni bildiradi va barcha raqam
  // nolga yaqin chiqadi. Shuning uchun aylanma 30 kunlik oyna olamiz.
  const monthStart = startOfDay(addDays(new Date(), -29)).getTime()

  const appts = db.appointments.all(clinicId).filter((a) => a.doctorId === doctorId)

  const todays = appts.filter((a) => {
    const t = new Date(a.startsAt).getTime()
    return t >= today && t < tomorrow && a.status !== 'cancelled'
  })

  const monthly = appts.filter((a) => new Date(a.startsAt).getTime() >= monthStart)
  const monthlyDone = monthly.filter((a) => a.status === 'completed')
  const monthlyNoShow = monthly.filter((a) => a.status === 'no_show')

  const revenue = db.payments
    .all(clinicId)
    .filter(
      (p) =>
        p.doctorId === doctorId && p.status === 'paid' && new Date(p.paidAt).getTime() >= monthStart,
    )
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    appointmentsToday: todays.length,
    patientsThisMonth: new Set(monthlyDone.map((a) => a.patientId)).size,
    revenueThisMonth: revenue,
    completedThisMonth: monthlyDone.length,
    noShowRate: monthly.length ? (monthlyNoShow.length / monthly.length) * 100 : 0,
    averageCheck: monthlyDone.length ? Math.round(revenue / monthlyDone.length) : 0,
  }
}

export { pick }

/* ------------------------------------------------------------------ */
/* Shifokorning shaxsiy moliyasi                                       */
/* ------------------------------------------------------------------ */

/**
 * Shifokorning bir oylik daromadi: maosh + foiz + bonus.
 *
 * NEGA KERAK: foizli modelda ishlaydigan shifokor o'z pulini o'zi
 * hisoblab yura olmaydi — buning uchun u qancha bemor qabul
 * qilgani va har biridan qancha tushum bo'lgani kerak. Bu ma'lumot
 * tizimda bor, shuning uchun uni shifokorga ko'rsatish adolatli va
 * bahsni oldini oladi.
 *
 * BU KLINIKA DAROMADI EMAS: bu yerda faqat shu shifokorga tegishli
 * summalar. Klinikaning umumiy tushumi, boshqa shifokorlar, xarajatlar
 * — hech biri yo'q.
 *
 * RUXSAT (SERVERDA MAJBURIY): so'rovni faqat shu shifokorning o'zi
 * yoki `staff.manage` ruxsatiga ega foydalanuvchi yubora oladi.
 * Frontenddagi tekshiruv — faqat ko'rsatma, himoya emas.
 */
// GET /doctors/:id/earnings?period=
export async function getDoctorEarnings(
  doctorId: ID,
  period: string,
): Promise<DoctorEarnings | null> {
  if (!USE_MOCK) {
    return request<DoctorEarnings>('GET', `/doctors/${doctorId}/earnings`, {
      query: { period },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const doctor = db.doctors.find(doctorId, clinicId)
  if (!doctor) return delay(null, 80)

  // Shartnoma shartlari xodim kartasida turadi
  const staff = db.staff.all(clinicId).find((p) => p.doctorId === doctorId)

  /* --- Shu oydagi ish hajmi va tushum --- */

  const completed = db.appointments
    .all(clinicId)
    .filter(
      (a) =>
        a.doctorId === doctorId &&
        a.status === 'completed' &&
        a.startsAt.slice(0, 7) === period,
    )

  /*
    Tushum to'lovlardan olinadi, qabullardan emas: xizmat ko'rsatilgan,
    lekin puli olinmagan qabul shifokorning foiziga kirmasligi kerak.
    Aks holda foiz olinmagan puldan hisoblanadi.
  */
  const generatedRevenue = db.payments
    .all(clinicId)
    .filter(
      (x) =>
        x.doctorId === doctorId &&
        x.status === 'paid' &&
        x.paidAt.slice(0, 7) === period,
    )
    .reduce((sum, x) => sum + x.amount, 0)

  /* --- Shartnoma bo'yicha hisob --- */

  const payType = staff?.payType ?? 'salary'
  const salary = staff?.salary ?? 0
  const workRate = staff?.workRate ?? 1
  const percentRate = staff?.percentRate ?? 0

  const baseSalary = payType === 'percent' ? 0 : Math.round(salary * workRate)
  const percentEarnings =
    payType === 'salary' ? 0 : Math.round((generatedRevenue * percentRate) / 100)

  const bonuses: Bonus[] = staff
    ? db.bonuses
        .all(clinicId)
        .filter((b) => b.staffId === staff.id && b.period === period)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

  const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0)

  const paidCount = completed.length

  return delay(
    {
      doctorId,
      period,
      payType,
      salary,
      workRate,
      percentRate,
      baseSalary,
      generatedRevenue,
      percentEarnings,
      bonuses,
      bonusTotal,
      total: baseSalary + percentEarnings + bonusTotal,
      completedAppointments: paidCount,
      averageCheck: paidCount > 0 ? Math.round(generatedRevenue / paidCount) : 0,
    },
    180,
  )
}
