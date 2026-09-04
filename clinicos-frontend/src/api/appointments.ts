/**
 * Qabullar.
 *
 * Registratura ish oqimining markazi:
 *   yaratish → tasdiqlash → kelgan (check-in) → yakunlash → to'lov
 *
 * Holat o'zgarishi serverda tekshirilishi kerak: masalan `completed`
 * holatidan `scheduled`ga qaytish mumkin emas.
 */

import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { expandAppointment } from './patients'
import { getDb } from '@/mock/db'
import { addMinutes, eachDay, endOfDay, isSameDay, startOfDay, toISODate } from '@/lib/dates'
import type {
  Appointment,
  AppointmentExpanded,
  AppointmentStatus,
  DoctorLoad,
  DoctorLoadRow,
  ID,
  Paginated,
} from '@/types/models'

export interface AppointmentQuery {
  /** ISO sana-vaqt yoki sana */
  from?: string
  to?: string
  doctorId?: ID | 'all'
  status?: AppointmentStatus | 'all'
  search?: string
  page?: number
  pageSize?: number
}

/* ------------------------------------------------------------------ */

// GET /appointments?from=&to=&doctorId=&status=&search=&page=
export async function listAppointments(
  query: AppointmentQuery = {},
): Promise<Paginated<AppointmentExpanded>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<AppointmentExpanded>>('GET', '/appointments', {
      query: { ...query, page, pageSize },
    })
  }

  const rows = mockFiltered(query)
  rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return delay(paginate(rows, page, pageSize))
}

/** Kalendar uchun — sahifalashsiz, bir kunlik yoki haftalik oraliq */
// GET /appointments/range?from=&to=&doctorId=
export async function listAppointmentsRange(
  from: Date,
  to: Date,
  doctorId: ID | 'all' = 'all',
): Promise<AppointmentExpanded[]> {
  if (!USE_MOCK) {
    /*
      ALOHIDA yo'l: `/appointments` sahifalangan obyekt qaytaradi
      ({ items, total, ... }), bu yerda esa TO'LIQ massiv kerak —
      kalendar barcha qabullarni bir vaqtda chizadi.

      Ilgari ikkalasi bitta yo'lga murojaat qilardi va server
      qaysi shaklni qaytarishni bilmasdi.
    */
    return request<AppointmentExpanded[]>('GET', '/appointments/range', {
      query: { from: from.toISOString(), to: to.toISOString(), doctorId },
    })
  }

  const rows = mockFiltered({
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
    doctorId,
  })
  rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return delay(rows, 140)
}

/** Bugungi jadval — bosh sahifadagi o'ng ustun */
// GET /appointments/today
export async function listTodayAppointments(): Promise<AppointmentExpanded[]> {
  if (!USE_MOCK) return request<AppointmentExpanded[]>('GET', '/appointments/today')

  const now = new Date()
  return listAppointmentsRange(now, now, apiContext().scopeDoctorId ?? 'all')
}

// GET /appointments/:id
export async function getAppointment(id: ID): Promise<AppointmentExpanded | null> {
  if (!USE_MOCK) return request<AppointmentExpanded>('GET', `/appointments/${id}`)

  const { clinicId } = apiContext()
  const db = getDb()
  const row = db.appointments.find(id, clinicId)
  if (!row) return delay(null)

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))
  return delay(expandAppointment(row, patients, doctors, services))
}

export interface AppointmentInput {
  patientId: ID
  doctorId: ID
  serviceId: ID
  /** ISO sana-vaqt */
  startsAt: string
  notes: string
}

// POST /appointments
export async function createAppointment(input: AppointmentInput): Promise<Appointment> {
  if (!USE_MOCK) return request<Appointment>('POST', '/appointments', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const service = db.services.find(input.serviceId, clinicId)

  const appointment: Appointment = {
    id: db.appointments.nextId('apt'),
    clinicId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    serviceId: input.serviceId,
    startsAt: input.startsAt,
    durationMinutes: service?.durationMinutes ?? 30,
    status: 'scheduled',
    paymentStatus: 'unpaid',
    notes: input.notes,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdBy: 'usr_reception_1',
    createdAt: new Date().toISOString(),
  }

  db.appointments.insert(appointment)
  return delay(appointment, 320)
}

// PATCH /appointments/:id
export async function updateAppointment(
  id: ID,
  patch: Partial<AppointmentInput>,
): Promise<Appointment> {
  if (!USE_MOCK) return request<Appointment>('PATCH', `/appointments/${id}`, { body: patch })

  const updated = getDb().appointments.update(
    id,
    patch as Partial<Appointment>,
    apiContext().clinicId,
  )
  if (!updated) throw new Error('Qabul topilmadi')
  return delay(updated, 260)
}

/**
 * Holatni o'zgartirish — registratura eng ko'p ishlatadigan amal.
 * Bir bosishda: tasdiqlash, kelgan deb belgilash, yakunlash.
 */
// POST /appointments/:id/status  { status, reason? }
export async function setAppointmentStatus(
  id: ID,
  status: AppointmentStatus,
  reason?: string,
): Promise<Appointment> {
  if (!USE_MOCK) {
    return request<Appointment>('POST', `/appointments/${id}/status`, {
      body: { status, reason },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()
  const current = db.appointments.find(id, clinicId)
  if (!current) throw new Error('Qabul topilmadi')

  const now = new Date()
  const patch: Partial<Appointment> = { status }

  if (status === 'checked_in') patch.checkedInAt = now.toISOString()
  if (status === 'completed') {
    patch.completedAt = now.toISOString()
    if (!current.checkedInAt) patch.checkedInAt = addMinutes(now, -5).toISOString()
  }
  if (status === 'cancelled') {
    patch.cancelledAt = now.toISOString()
    patch.cancelReason = reason ?? null
  }

  const updated = db.appointments.update(id, patch, clinicId)
  if (!updated) throw new Error('Qabul topilmadi')
  return delay(updated, 200)
}

// DELETE /appointments/:id
export async function deleteAppointment(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/appointments/${id}`)
    return
  }
  getDb().appointments.remove(id, apiContext().clinicId)
  await delay(null, 220)
}

/* ------------------------------------------------------------------ */
/* Mock filtri                                                         */
/* ------------------------------------------------------------------ */

function mockFiltered(query: AppointmentQuery): AppointmentExpanded[] {
  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  // Shifokor faqat o'z qabullarini ko'radi
  const forcedDoctor = scopeDoctorId ?? undefined
  const doctorFilter =
    forcedDoctor ?? (query.doctorId && query.doctorId !== 'all' ? query.doctorId : undefined)

  return db.appointments
    .all(clinicId)
    .filter((a) => !doctorFilter || a.doctorId === doctorFilter)
    .filter((a) => !query.from || a.startsAt >= query.from)
    .filter((a) => !query.to || a.startsAt <= query.to)
    .filter((a) => !query.status || query.status === 'all' || a.status === query.status)
    .map((a) => expandAppointment(a, patients, doctors, services))
    .filter(
      (a) =>
        !query.search ||
        matches(a.patient.fullName, query.search) ||
        matches(a.doctor.fullName, query.search) ||
        matches(a.patient.phone, query.search),
    )
}

/* ------------------------------------------------------------------ */
/* Shifokorlar yuklamasi                                               */
/* ------------------------------------------------------------------ */

/**
 * Kalendarning "yuklama" ko'rinishi uchun ma'lumot.
 *
 * Egasi qabul yozmaydi — unga kerak bo'lgani boshqa manzara: qaysi
 * shifokor to'la band, qayerda bo'sh soat qolyapti. Bo'sh soat —
 * yo'qotilgan daromad, shuning uchun bu eng foydali kesim.
 */
// GET /appointments/load?from=&to=
export async function getDoctorLoad(from: Date, to: Date): Promise<DoctorLoad> {
  if (!USE_MOCK) {
    return request<DoctorLoad>('GET', '/appointments/load', {
      query: { from: toISODate(from), to: toISODate(to) },
    })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const days = eachDay(from, to)
  const dayKeys = days.map(toISODate)

  const doctors = db.doctors
    .all(clinicId)
    .filter((d) => !scopeDoctorId || d.id === scopeDoctorId)
    .filter((d) => d.status !== 'inactive')

  const appointments = db.appointments
    .all(clinicId)
    .filter((a) => a.status !== 'cancelled')
    .filter((a) => {
      const t = new Date(a.startsAt).getTime()
      return t >= startOfDay(from).getTime() && t <= endOfDay(to).getTime()
    })

  let maxCount = 0

  const rows: DoctorLoadRow[] = doctors.map((doctor) => {
    const counts: number[] = []
    const utilization: number[] = []

    // Shifokorning bir kunlik ish vaqti, daqiqada
    const shiftMinutes =
      timeToMin(doctor.shiftEnd) - timeToMin(doctor.shiftStart) || 480

    for (const day of days) {
      const dayRows = appointments.filter(
        (a) => a.doctorId === doctor.id && isSameDay(new Date(a.startsAt), day),
      )

      const count = dayRows.length
      counts.push(count)
      maxCount = Math.max(maxCount, count)

      // Dam olish kunida ishlamasa — bandlik hisoblanmaydi
      const worksToday = doctor.workdays.includes(day.getDay())
      const busyMinutes = dayRows.reduce((sum, a) => sum + a.durationMinutes, 0)
      utilization.push(worksToday ? Math.min(100, (busyMinutes / shiftMinutes) * 100) : 0)
    }

    const workdayCount = days.filter((d) => doctor.workdays.includes(d.getDay())).length

    return {
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      specialty: doctor.specialty,
      counts,
      utilization,
      total: counts.reduce((sum, c) => sum + c, 0),
      averageUtilization: workdayCount
        ? utilization.reduce((sum, u) => sum + u, 0) / workdayCount
        : 0,
    }
  })

  rows.sort((a, b) => b.total - a.total)

  return delay({ days: dayKeys, rows, maxCount: Math.max(1, maxCount) }, 160)
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
