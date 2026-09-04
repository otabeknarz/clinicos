/**
 * Tashriflar (shifokor yozuvi) va takroriy tashrif tavsiyalari.
 *
 * MAXFIY TIBBIY MA'LUMOT.
 *
 * Serverda tekshirilishi shart:
 *   - `visits.create` ruxsati bor;
 *   - yozuvni yaratayotgan shifokor AYNAN shu qabulning shifokori;
 *   - o'qish va yozish AuditLog'ga (`view_medical`, `create`) tushadi.
 *
 * MVP doirasi: bu to'liq elektron tibbiy karta EMAS. Faqat shikoyat,
 * tashxis, davolash va izoh maydonlari.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { toISODate } from '@/lib/dates'
import type { FollowUp, ID, Visit } from '@/types/models'

export interface VisitInput {
  appointmentId: ID
  patientId: ID
  doctorId: ID
  complaint: string
  diagnosis: string
  treatment: string
  notes: string
  /** Bo'sh bo'lsa — takroriy tashrif tavsiya qilinmagan */
  followUpDate: string | null
  followUpReason: string
}

// POST /visits
export async function createVisit(input: VisitInput): Promise<Visit> {
  if (!USE_MOCK) return request<Visit>('POST', '/visits', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const now = new Date().toISOString()

  const visit: Visit = {
    id: db.visits.nextId('vis'),
    clinicId,
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    visitedAt: now,
    complaint: input.complaint,
    diagnosis: input.diagnosis,
    treatment: input.treatment,
    notes: input.notes,
    createdAt: now,
  }

  db.visits.insert(visit)

  // Qabul avtomatik yakunlangan holatga o'tadi
  db.appointments.update(
    input.appointmentId,
    { status: 'completed', completedAt: now },
    clinicId,
  )

  // Takroriy tashrif tavsiyasi
  if (input.followUpDate) {
    db.followUps.insert({
      id: db.followUps.nextId('fup'),
      clinicId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      visitId: visit.id,
      recommendedDate: input.followUpDate,
      reason: input.followUpReason,
      status: 'pending',
      appointmentId: null,
      createdAt: now,
    })
  }

  return delay(visit, 340)
}

// GET /visits/:id
export async function getVisit(id: ID): Promise<Visit | null> {
  if (!USE_MOCK) return request<Visit>('GET', `/visits/${id}`)
  return delay(getDb().visits.find(id, apiContext().clinicId))
}

// GET /appointments/:id/visit  — qabulga biriktirilgan yozuv bormi
export async function getVisitByAppointment(appointmentId: ID): Promise<Visit | null> {
  if (!USE_MOCK) return request<Visit>('GET', `/appointments/${appointmentId}/visit`)

  const found = getDb()
    .visits.all(apiContext().clinicId)
    .find((v) => v.appointmentId === appointmentId)

  return delay(found ?? null, 80)
}

/* ------------------------------------------------------------------ */
/* Takroriy tashriflar                                                 */
/* ------------------------------------------------------------------ */

export interface FollowUpDue extends FollowUp {
  patientName: string
  patientPhone: string
  doctorName: string
}

// GET /follow-ups?status=pending&dueBefore=
export async function listFollowUpsDue(daysAhead = 7): Promise<FollowUpDue[]> {
  if (!USE_MOCK) {
    return request<FollowUpDue[]>('GET', '/follow-ups', {
      query: { status: 'pending', daysAhead },
    })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const limit = new Date()
  limit.setDate(limit.getDate() + daysAhead)
  const limitIso = toISODate(limit)

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))

  const rows = db.followUps
    .all(clinicId)
    .filter((f) => f.status === 'pending')
    .filter((f) => f.recommendedDate <= limitIso)
    .filter((f) => !scopeDoctorId || f.doctorId === scopeDoctorId)
    .sort((a, b) => a.recommendedDate.localeCompare(b.recommendedDate))
    .map((f) => ({
      ...f,
      patientName: patients.get(f.patientId)?.fullName ?? '—',
      patientPhone: patients.get(f.patientId)?.phone ?? '',
      doctorName: doctors.get(f.doctorId)?.fullName ?? '—',
    }))

  return delay(rows)
}

// PATCH /follow-ups/:id
export async function updateFollowUp(id: ID, patch: Partial<FollowUp>): Promise<FollowUp> {
  if (!USE_MOCK) return request<FollowUp>('PATCH', `/follow-ups/${id}`, { body: patch })

  const updated = getDb().followUps.update(id, patch, apiContext().clinicId)
  if (!updated) throw new Error('Yozuv topilmadi')
  return delay(updated, 200)
}
