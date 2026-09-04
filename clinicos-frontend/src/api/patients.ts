/**
 * Bemorlar.
 *
 * MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa TIBBIY
 * ma'lumot. Serverda:
 *   - har bir so'rov klinika bo'yicha filtrlanadi;
 *   - shifokor faqat o'ziga biriktirilgan yoki qabul qilgan bemorlarni
 *     ko'radi (`scopeDoctorId` mantiqi server tomonda takrorlanadi);
 *   - tibbiy yozuvni o'qish AuditLog'ga yoziladi.
 */

import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type {
  AppointmentExpanded,
  FollowUp,
  ID,
  Paginated,
  Patient,
  PatientStats,
  PatientWithStats,
  PaymentExpanded,
  VisitExpanded,
} from '@/types/models'

export type PatientFilter = 'all' | 'new' | 'returning' | 'active' | 'inactive'

export interface PatientListQuery {
  search?: string
  filter?: PatientFilter
  page?: number
  pageSize?: number
}

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */

// GET /patients?search=&filter=&page=&pageSize=
export async function listPatients(
  query: PatientListQuery = {},
): Promise<Paginated<PatientWithStats>> {
  const { search = '', filter = 'all', page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<PatientWithStats>>('GET', '/patients', {
      query: { search, filter, page, pageSize },
    })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  let rows = db.patients.all(clinicId)

  // Shifokor faqat o'z bemorlarini ko'radi
  if (scopeDoctorId) {
    const own = new Set(
      db.appointments
        .all(clinicId)
        .filter((a) => a.doctorId === scopeDoctorId)
        .map((a) => a.patientId),
    )
    rows = rows.filter((p) => own.has(p.id) || p.primaryDoctorId === scopeDoctorId)
  }

  if (search) {
    rows = rows.filter(
      (p) => matches(p.fullName, search) || matches(p.phone.replace(/\s/g, ''), search.replace(/\s/g, '')),
    )
  }

  // Statistikani HAR BIR bemor uchun alohida hisoblash 600+ bemorda
  // millionlab amalga olib keladi. Shuning uchun indekslarni bir marta
  // quramiz va keyin har bir bemorga tayyor qiymatni biriktiramiz.
  const index = buildStatsIndex(clinicId)
  const withStats = rows.map((p) => ({ ...p, stats: statsFromIndex(p.id, index) }))

  const filtered = withStats.filter((p) => {
    switch (filter) {
      case 'new':
        return p.stats.visitCount <= 1
      case 'returning':
        return p.stats.isReturning
      case 'active':
        return p.status === 'active'
      case 'inactive':
        return p.status === 'inactive'
      default:
        return true
    }
  })

  // Eng oxirgi tashrifi yangilari tepada
  filtered.sort((a, b) => (b.stats.lastVisitAt ?? '').localeCompare(a.stats.lastVisitAt ?? ''))

  return delay(paginate(filtered, page, pageSize))
}

/* ------------------------------------------------------------------ */
/* Bitta bemor                                                         */
/* ------------------------------------------------------------------ */

// GET /patients/:id
export async function getPatient(id: ID): Promise<PatientWithStats | null> {
  if (!USE_MOCK) return request<PatientWithStats>('GET', `/patients/${id}`)

  const { clinicId } = apiContext()
  const patient = getDb().patients.find(id, clinicId)
  if (!patient) return delay(null)
  return delay(attachStats(patient, clinicId))
}

export interface CreatePatientInput {
  fullName: string
  phone: string
  birthDate: string
  gender: 'male' | 'female'
  address: string
  notes: string
  primaryDoctorId: ID | null
}

// POST /patients
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  if (!USE_MOCK) return request<Patient>('POST', '/patients', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const patient: Patient = {
    id: db.patients.nextId('pat'),
    clinicId,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    birthDate: input.birthDate,
    gender: input.gender,
    address: input.address.trim(),
    notes: input.notes.trim(),
    status: 'active',
    primaryDoctorId: input.primaryDoctorId,
    createdAt: new Date().toISOString(),
  }

  db.patients.insert(patient)
  return delay(patient, 320)
}

// PATCH /patients/:id
export async function updatePatient(id: ID, patch: Partial<CreatePatientInput>): Promise<Patient> {
  if (!USE_MOCK) return request<Patient>('PATCH', `/patients/${id}`, { body: patch })

  const { clinicId } = apiContext()
  const updated = getDb().patients.update(id, patch as Partial<Patient>, clinicId)
  if (!updated) throw new Error('Bemor topilmadi')
  return delay(updated, 280)
}

// DELETE /patients/:id
export async function deletePatient(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/patients/${id}`)
    return
  }
  const { clinicId } = apiContext()
  getDb().patients.remove(id, clinicId)
  await delay(null, 260)
}

/* ------------------------------------------------------------------ */
/* Bemor profili tablari                                               */
/* ------------------------------------------------------------------ */

// GET /patients/:id/visits   — TIBBIY MA'LUMOT, `visits.view` talab qiladi
export async function getPatientVisits(id: ID): Promise<VisitExpanded[]> {
  if (!USE_MOCK) return request<VisitExpanded[]>('GET', `/patients/${id}/visits`)

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))
  const appointments = new Map(db.appointments.all(clinicId).map((a) => [a.id, a]))

  const rows = db.visits
    .all(clinicId)
    .filter((v) => v.patientId === id)
    .filter((v) => !scopeDoctorId || v.doctorId === scopeDoctorId)
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
    .map((v) => {
      const doctor = doctors.get(v.doctorId)
      const appointment = appointments.get(v.appointmentId)
      const service = appointment ? services.get(appointment.serviceId) : undefined
      return {
        ...v,
        doctor: doctor
          ? { id: doctor.id, fullName: doctor.fullName, specialty: doctor.specialty }
          : { id: v.doctorId, fullName: '—', specialty: '' },
        service: service ? { id: service.id, name: service.name } : null,
      }
    })

  return delay(rows)
}

// GET /patients/:id/appointments
export async function getPatientAppointments(id: ID): Promise<AppointmentExpanded[]> {
  if (!USE_MOCK) return request<AppointmentExpanded[]>('GET', `/patients/${id}/appointments`)

  const { clinicId } = apiContext()
  const db = getDb()
  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  const rows = db.appointments
    .all(clinicId)
    .filter((a) => a.patientId === id)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((a) => expandAppointment(a, patients, doctors, services))

  return delay(rows)
}

// GET /patients/:id/payments
export async function getPatientPayments(id: ID): Promise<PaymentExpanded[]> {
  if (!USE_MOCK) return request<PaymentExpanded[]>('GET', `/patients/${id}/payments`)

  const { clinicId } = apiContext()
  const db = getDb()
  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  const rows = db.payments
    .all(clinicId)
    .filter((p) => p.patientId === id)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .map((p) => ({
      ...p,
      patient: pick(patients.get(p.patientId), ['id', 'fullName']) ?? { id: p.patientId, fullName: '—' },
      doctor: pick(doctors.get(p.doctorId), ['id', 'fullName']) ?? { id: p.doctorId, fullName: '—' },
      service: pick(services.get(p.serviceId), ['id', 'name']) ?? { id: p.serviceId, name: '—' },
    }))

  return delay(rows)
}

// GET /patients/:id/follow-ups
export async function getPatientFollowUps(id: ID): Promise<FollowUp[]> {
  if (!USE_MOCK) return request<FollowUp[]>('GET', `/patients/${id}/follow-ups`)

  const { clinicId } = apiContext()
  const rows = getDb()
    .followUps.all(clinicId)
    .filter((f) => f.patientId === id)
    .sort((a, b) => b.recommendedDate.localeCompare(a.recommendedDate))

  return delay(rows)
}

/* ------------------------------------------------------------------ */
/* Mock hisoblagichlari                                                */
/* ------------------------------------------------------------------ */

/**
 * Bemor statistikasi.
 *
 * Haqiqiy backendda buni SQL hisoblab beradi (agregat so'rov yoki kunlik
 * yig'ma jadval), frontendda emas. Mock rejimda esa indeks quramiz:
 * jadvallardan BIR marta o'tib, bemor id'si bo'yicha xarita tayyorlaymiz.
 */
interface StatsIndex {
  visitCount: Map<string, number>
  lastVisit: Map<string, string>
  spent: Map<string, number>
  nextFollowUp: Map<string, string>
}

function buildStatsIndex(clinicId: string): StatsIndex {
  const db = getDb()
  const index: StatsIndex = {
    visitCount: new Map(),
    lastVisit: new Map(),
    spent: new Map(),
    nextFollowUp: new Map(),
  }

  for (const a of db.appointments.all(clinicId)) {
    if (a.status !== 'completed') continue
    index.visitCount.set(a.patientId, (index.visitCount.get(a.patientId) ?? 0) + 1)
    const day = a.startsAt.slice(0, 10)
    const previous = index.lastVisit.get(a.patientId)
    if (!previous || day > previous) index.lastVisit.set(a.patientId, day)
  }

  for (const p of db.payments.all(clinicId)) {
    if (p.status !== 'paid') continue
    index.spent.set(p.patientId, (index.spent.get(p.patientId) ?? 0) + p.amount)
  }

  for (const f of db.followUps.all(clinicId)) {
    if (f.status !== 'pending') continue
    const previous = index.nextFollowUp.get(f.patientId)
    if (!previous || f.recommendedDate < previous) {
      index.nextFollowUp.set(f.patientId, f.recommendedDate)
    }
  }

  return index
}

function statsFromIndex(patientId: string, index: StatsIndex): PatientStats {
  const visitCount = index.visitCount.get(patientId) ?? 0
  return {
    visitCount,
    lastVisitAt: index.lastVisit.get(patientId) ?? null,
    totalSpent: index.spent.get(patientId) ?? 0,
    isReturning: visitCount > 1,
    nextFollowUpAt: index.nextFollowUp.get(patientId) ?? null,
  }
}

function attachStats(patient: Patient, clinicId: string): PatientWithStats {
  return { ...patient, stats: statsFromIndex(patient.id, buildStatsIndex(clinicId)) }
}

/* ------------------------------------------------------------------ */
/* Umumiy yordamchilar (boshqa api modullari ham ishlatadi)            */
/* ------------------------------------------------------------------ */

export function pick<T, K extends keyof T>(obj: T | undefined, keys: K[]): Pick<T, K> | null {
  if (!obj) return null
  const out = {} as Pick<T, K>
  for (const key of keys) out[key] = obj[key]
  return out
}

export function expandAppointment(
  a: import('@/types/models').Appointment,
  patients: Map<string, import('@/types/models').Patient>,
  doctors: Map<string, import('@/types/models').Doctor>,
  services: Map<string, import('@/types/models').Service>,
): AppointmentExpanded {
  return {
    ...a,
    patient: pick(patients.get(a.patientId), ['id', 'fullName', 'phone']) ?? {
      id: a.patientId,
      fullName: '—',
      phone: '',
    },
    doctor: pick(doctors.get(a.doctorId), ['id', 'fullName', 'specialty']) ?? {
      id: a.doctorId,
      fullName: '—',
      specialty: '',
    },
    service: pick(services.get(a.serviceId), ['id', 'name', 'price', 'durationMinutes']) ?? {
      id: a.serviceId,
      name: '—',
      price: 0,
      durationMinutes: 0,
    },
  }
}
