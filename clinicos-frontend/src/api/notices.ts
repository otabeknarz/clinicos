/**
 * BEMORLARGA XABAR.
 *
 * Xodim tomoni: qabulga yozilganlarga yoki tanlangan bemorlarga
 * bitta xabar. Bemor tomoni: kabinetdagi xabarlar ro'yxati.
 *
 * Xabar bemorga IKKI YO'L bilan yetadi — Telegram boti va kabinet.
 * Bot ochilmagan bo'lsa, xabar baribir kabinetda turadi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ID, ISODateTime } from '@/types/models'

export interface BroadcastAudience {
  total: number
  telegram: number
}

export interface BroadcastInput {
  text: string
  scope: 'appointments' | 'patients'
  from?: string
  to?: string
  patientIds?: ID[]
}

export interface BroadcastRecord {
  text: string
  sentAt: ISODateTime
  sentBy: string
  total: number
  delivered: number
}

export interface CabinetNotice {
  id: ID
  text: string
  kind: 'broadcast' | 'reminder'
  read: boolean
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Xodim                                                               */
/* ------------------------------------------------------------------ */

// GET /patient-notices/audience?scope=&from=&to=
export async function broadcastAudience(
  scope: 'appointments' | 'patients',
  range: { from?: string; to?: string } = {},
): Promise<BroadcastAudience> {
  if (!USE_MOCK) {
    return request<BroadcastAudience>('GET', '/patient-notices/audience', {
      query: { scope, from: range.from, to: range.to },
    })
  }

  const patients = mockTargets(range)
  return delay({
    total: patients.length,
    /* Demoda har uchinchi bemor botga ulangan deb hisoblanadi */
    telegram: Math.round(patients.length / 3),
  })
}

// POST /patient-notices
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastAudience> {
  if (!USE_MOCK) return request<BroadcastAudience>('POST', '/patient-notices', { body: input })

  const patients =
    input.scope === 'patients' ? (input.patientIds ?? []) : mockTargets(input).map((p) => p.id)

  const record: BroadcastRecord = {
    text: input.text,
    sentAt: new Date().toISOString(),
    sentBy: 'Demo',
    total: patients.length,
    delivered: Math.round(patients.length / 3),
  }
  mockHistory = [record, ...mockHistory]
  return delay({ total: record.total, telegram: record.delivered })
}

// GET /patient-notices
export async function listBroadcasts(): Promise<BroadcastRecord[]> {
  if (!USE_MOCK) return request<BroadcastRecord[]>('GET', '/patient-notices')
  return delay(mockHistory)
}

/* ------------------------------------------------------------------ */
/* Bemor kabineti                                                      */
/* ------------------------------------------------------------------ */

// GET /patient/notices
export async function listCabinetNotices(): Promise<CabinetNotice[]> {
  if (!USE_MOCK) {
    return request<CabinetNotice[]>('GET', '/patient/notices', { session: 'patient' })
  }
  return delay(mockCabinet)
}

// POST /patient/notices/:id/read
export async function markNoticeRead(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('POST', `/patient/notices/${id}/read`, { session: 'patient' })
    return
  }
  mockCabinet = mockCabinet.map((notice) =>
    notice.id === id ? { ...notice, read: true } : notice,
  )
  await delay(null)
}

/* ------------------------------------------------------------------ */
/* Demo ma'lumot                                                       */
/* ------------------------------------------------------------------ */

/** Qabulga yozilgan bemorlar (demo) */
function mockTargets(range: { from?: string; to?: string }) {
  const { clinicId } = apiContext()
  const db = getDb()

  const from = range.from ? new Date(range.from) : new Date()
  if (!range.from) from.setHours(0, 0, 0, 0)
  const to = range.to ? new Date(range.to) : new Date(from.getTime() + 7 * 86_400_000)
  to.setHours(23, 59, 59, 999)

  const seen = new Map<string, { id: string }>()
  for (const appointment of db.appointments.all(clinicId)) {
    const at = new Date(appointment.startsAt)
    if (at < from || at > to) continue
    if (['cancelled', 'no_show', 'completed'].includes(appointment.status)) continue
    seen.set(appointment.patientId, { id: appointment.patientId })
  }
  return [...seen.values()]
}

let mockHistory: BroadcastRecord[] = []

let mockCabinet: CabinetNotice[] = [
  {
    id: 'ntc_1',
    text: 'Eslatma: payshanba kuni, soat 14:00 qabulingiz bor.\nKardiolog qabuli — Anvar Hakimov',
    kind: 'reminder',
    read: false,
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    id: 'ntc_2',
    text: 'Hurmatli bemor, 15-sentabr kuni klinika 09:00 dan 14:00 gacha ishlaydi.',
    kind: 'broadcast',
    read: true,
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]
