/**
 * Global qidiruv (yuqori paneldagi maydon).
 *
 * Haqiqiy backendda bu bitta endpoint bo'lishi kerak — to'rt jadvalga
 * alohida so'rov yubormang. Katta bazada `pg_trgm` indeksi yoki
 * to'liq matnli qidiruv (tsvector) tavsiya etiladi.
 */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { dateTime } from '@/lib/format'
import type { SearchHit } from '@/types/models'

const LIMIT_PER_ENTITY = 4

// GET /search?q=
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  if (!USE_MOCK) return request<SearchHit[]>('GET', '/search', { query: { q } })

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()
  const hits: SearchHit[] = []

  /* --- Bemorlar --- */
  let patients = db.patients.all(clinicId)
  if (scopeDoctorId) {
    const own = new Set(
      db.appointments
        .all(clinicId)
        .filter((a) => a.doctorId === scopeDoctorId)
        .map((a) => a.patientId),
    )
    patients = patients.filter((p) => own.has(p.id))
  }

  for (const p of patients) {
    if (hits.filter((h) => h.entity === 'patient').length >= LIMIT_PER_ENTITY) break
    const phoneDigits = p.phone.replace(/\D/g, '')
    if (matches(p.fullName, q) || phoneDigits.includes(q.replace(/\D/g, ''))) {
      hits.push({
        id: p.id,
        entity: 'patient',
        title: p.fullName,
        subtitle: p.phone,
        href: `/patients/${p.id}`,
      })
    }
  }

  /* --- Shifokorlar --- */
  for (const d of db.doctors.all(clinicId)) {
    if (hits.filter((h) => h.entity === 'doctor').length >= LIMIT_PER_ENTITY) break
    if (matches(d.fullName, q)) {
      hits.push({
        id: d.id,
        entity: 'doctor',
        title: d.fullName,
        // Mutaxassislik kaliti — interfeys uni `tSpecialty()` bilan tarjima qiladi
        subtitle: d.specialty,
        href: `/doctors/${d.id}`,
      })
    }
  }

  /* --- Xizmatlar --- */
  for (const s of db.services.all(clinicId)) {
    if (hits.filter((h) => h.entity === 'service').length >= LIMIT_PER_ENTITY) break
    if (matches(s.name, q)) {
      hits.push({
        id: s.id,
        entity: 'service',
        title: s.name,
        subtitle: s.category,
        href: `/services?highlight=${s.id}`,
      })
    }
  }

  /* --- Qabullar (bemor ismi bo'yicha) --- */
  const patientNames = new Map(patients.map((p) => [p.id, p.fullName]))
  const upcoming = db.appointments
    .all(clinicId)
    .filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)
    .filter((a) => new Date(a.startsAt).getTime() >= Date.now() - 86_400_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  for (const a of upcoming) {
    if (hits.filter((h) => h.entity === 'appointment').length >= LIMIT_PER_ENTITY) break
    const name = patientNames.get(a.patientId)
    if (name && matches(name, q)) {
      hits.push({
        id: a.id,
        entity: 'appointment',
        title: name,
        subtitle: dateTime(a.startsAt),
        href: `/appointments?highlight=${a.id}`,
      })
    }
  }

  return delay(hits, 90)
}
