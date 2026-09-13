/**
 * ONLAYN RETSEPT.
 *
 * Shifokor dorilarni yozadi, tizim aptekalar ro'yxatini taklif
 * qiladi (har safar yangi va tasodifiy tartibda), tanlanganiga
 * yuboriladi. Bemor aptekada qisqa kodni aytadi.
 */

import { delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ID, ISODateTime } from '@/types/models'

export type RxStatus = 'sent' | 'ready' | 'dispensed' | 'cancelled'

export interface RxItem {
  name: string
  qty: number
  note: string
}

export interface RxOfferLine {
  name: string
  qty: number
  /** Aptekada shu dori bormi — yo'q bo'lsa narx ham yo'q */
  price: number | null
  total: number | null
  available: boolean
}

export interface RxOffer {
  pharmacyId: ID
  name: string
  phone: string
  address: string
  total: number
  availableCount: number
  itemCount: number
  lines: RxOfferLine[]
}

export interface Prescription {
  id: ID
  pharmacyId: ID
  pharmacyName: string
  pharmacyPhone?: string
  pharmacyAddress?: string
  patientId: ID | null
  patientName: string
  patientPhone: string
  doctorName: string
  items: RxItem[]
  /** Bemor aptekada aytadigan kod */
  code: string
  estimatedTotal: number
  status: RxStatus
  note: string
  readyAt: ISODateTime | null
  dispensedAt: ISODateTime | null
  createdAt: ISODateTime
  /** Apteka tomonida — retsept yozgan klinika */
  clinicName?: string
}

// POST /prescriptions/offers
export async function rxOffers(items: RxItem[]): Promise<RxOffer[]> {
  if (!USE_MOCK) return request<RxOffer[]>('POST', '/prescriptions/offers', { body: { items } })

  /* Demo: bazadagi aptekalar ro'yxatidan tasodifiy uchtasi */
  const pharmacies = getDb().pharmacies.allAcrossTenants().slice(0, 6)

  const shuffled = [...pharmacies].sort(() => Math.random() - 0.5).slice(0, 3)

  return delay(
    shuffled.map((pharmacy, index) => {
      const lines = items.map((item) => {
        const price = 8000 + ((index + 1) * 1500 + item.name.length * 250)
        return {
          name: item.name,
          qty: item.qty,
          price,
          total: price * item.qty,
          available: true,
        }
      })
      return {
        pharmacyId: pharmacy.id,
        name: pharmacy.name,
        phone: pharmacy.phone,
        address: pharmacy.address ?? '',
        total: lines.reduce((sum, line) => sum + (line.total ?? 0), 0),
        availableCount: lines.length,
        itemCount: lines.length,
        lines,
      }
    }),
    400,
  )
}

// POST /prescriptions
export async function createPrescription(input: {
  items: RxItem[]
  pharmacyId: ID
  offeredIds: ID[]
  patientId?: ID
  patientName?: string
  patientPhone?: string
  note?: string
}): Promise<Prescription> {
  if (!USE_MOCK) return request<Prescription>('POST', '/prescriptions', { body: input })

  return delay({
    id: `rx_${Date.now()}`,
    pharmacyId: input.pharmacyId,
    pharmacyName: '',
    patientId: input.patientId ?? null,
    patientName: input.patientName ?? '',
    patientPhone: input.patientPhone ?? '',
    doctorName: '',
    items: input.items,
    code: 'DEMO12',
    estimatedTotal: 0,
    status: 'sent' as const,
    note: input.note ?? '',
    readyAt: null,
    dispensedAt: null,
    createdAt: new Date().toISOString(),
  })
}

// GET /prescriptions?status=
export async function listPrescriptions(status: RxStatus | 'all' = 'all'): Promise<Prescription[]> {
  if (!USE_MOCK) return request<Prescription[]>('GET', '/prescriptions', { query: { status } })
  return delay([] as Prescription[])
}

// POST /prescriptions/:id/cancel
export async function cancelPrescription(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('POST', `/prescriptions/${id}/cancel`)
    return
  }
  await delay(null)
}

// GET /pharmacy/inbox?status=
export async function pharmacyInbox(status: RxStatus | 'all' = 'all'): Promise<Prescription[]> {
  if (!USE_MOCK) return request<Prescription[]>('GET', '/pharmacy/inbox', { query: { status } })
  return delay([] as Prescription[])
}

// POST /pharmacy/inbox/:id/status
export async function setInboxStatus(
  id: ID,
  status: 'ready' | 'dispensed' | 'cancelled',
): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('POST', `/pharmacy/inbox/${id}/status`, { body: { status } })
    return
  }
  await delay(null)
}
