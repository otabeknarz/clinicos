/**
 * DAM OLISH KUNLARI.
 *
 * Butun klinika (bayram) yoki bitta shifokor (kasal, ta'til). Belgilangan
 * kunga yangi qabul yozilmaydi; allaqachon yozilganlari o'z-o'zidan
 * ko'chmaydi — ularni kalendardagi "Ko'chirish" oynasi o'tkazadi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { DayOff, DayOffResult, ID } from '@/types/models'

export interface DayOffInput {
  from: string
  to: string
  /** Bo'sh — butun klinika */
  doctorId?: ID
  reason: string
}

function mockDays(from: string, to: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function mockList(from: string, to: string): DayOff[] {
  const { clinicId } = apiContext()
  const db = getDb()
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d.fullName]))
  return db.daysOff
    .all(clinicId)
    .filter((row) => row.date >= from && row.date <= to)
    .map((row) => ({ ...row, doctorName: row.doctorId ? (doctors.get(row.doctorId) ?? null) : null }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// GET /days-off?from=&to=
export async function listDaysOff(from: string, to: string): Promise<DayOff[]> {
  if (!USE_MOCK) return request<DayOff[]>('GET', '/days-off', { query: { from, to } })
  return delay(mockList(from, to), 80)
}

// POST /days-off
export async function createDayOff(input: DayOffInput): Promise<DayOffResult> {
  if (!USE_MOCK) return request<DayOffResult>('POST', '/days-off', { body: input })

  if (input.from > input.to) throw new Error('Boshlanish sanasi tugashidan keyin')
  const { clinicId } = apiContext()
  const db = getDb()
  const doctorId = input.doctorId ?? null
  const keys = mockDays(input.from, input.to)
  if (keys.length > 62) throw new Error('Bir yo‘la ko‘pi bilan 62 kun belgilanadi')

  const existing = new Set(
    db.daysOff.all(clinicId).filter((row) => row.doctorId === doctorId).map((row) => row.date),
  )
  const fresh = keys.filter((key) => !existing.has(key))
  for (const date of fresh) {
    db.daysOff.insert({
      id: db.daysOff.nextId('doff'),
      clinicId,
      date,
      doctorId,
      doctorName: null,
      reason: input.reason.trim(),
    })
  }

  const affected = db.appointments
    .all(clinicId)
    .filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
    .filter((a) => !doctorId || a.doctorId === doctorId)
    .filter((a) => {
      const d = new Date(a.startsAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return key >= input.from && key <= input.to
    })
  const affectedDays = [
    ...new Set(
      affected.map((a) => {
        const d = new Date(a.startsAt)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }),
    ),
  ].sort()

  return delay(
    {
      created: fresh.length,
      affectedAppointments: affected.length,
      affectedDays,
      items: mockList(input.from, input.to),
    },
    250,
  )
}

// DELETE /days-off/:id
export async function deleteDayOff(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request('DELETE', `/days-off/${id}`)
    return
  }
  getDb().daysOff.remove(id, apiContext().clinicId)
  await delay(null, 150)
}
