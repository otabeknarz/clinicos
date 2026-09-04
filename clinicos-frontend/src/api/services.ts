/** Xizmatlar katalogi. */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ID, LoyaltyTier, PaymentTiming, PricePreview, Service } from '@/types/models'
import { resolveServicePrice } from '@/types/models'

// GET /services?search=&category=&status=
export async function listServices(
  search = '',
  category = 'all',
  status: 'all' | 'active' | 'archived' = 'all',
): Promise<Service[]> {
  if (!USE_MOCK) {
    return request<Service[]>('GET', '/services', { query: { search, category, status } })
  }

  const rows = getDb()
    .services.all(apiContext().clinicId)
    .filter((s) => matches(s.name, search))
    .filter((s) => category === 'all' || s.category === category)
    .filter((s) => status === 'all' || s.status === status)

  rows.sort((a, b) => a.category.localeCompare(b.category) || b.price - a.price)
  return delay(rows)
}

export interface ServiceInput {
  name: string
  category: string
  price: number
  durationMinutes: number
  paymentTiming: PaymentTiming
  loyaltyTiers: LoyaltyTier[]
  status: Service['status']
}

// POST /services
export async function createService(input: ServiceInput): Promise<Service> {
  if (!USE_MOCK) return request<Service>('POST', '/services', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const service: Service = {
    id: db.services.nextId('svc'),
    clinicId,
    createdAt: new Date().toISOString(),
    ...input,
  }
  db.services.insert(service)
  return delay(service, 280)
}

// PATCH /services/:id
export async function updateService(id: ID, patch: Partial<ServiceInput>): Promise<Service> {
  if (!USE_MOCK) return request<Service>('PATCH', `/services/${id}`, { body: patch })

  const updated = getDb().services.update(id, patch as Partial<Service>, apiContext().clinicId)
  if (!updated) throw new Error('Xizmat topilmadi')
  return delay(updated, 240)
}

// DELETE /services/:id
export async function deleteService(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/services/${id}`)
    return
  }
  getDb().services.remove(id, apiContext().clinicId)
  await delay(null, 220)
}

/* ------------------------------------------------------------------ */
/* Bemor uchun narx                                                    */
/* ------------------------------------------------------------------ */

/**
 * Aniq bemorga aniq xizmat qancha turishini hisoblaydi.
 *
 * Sodiqlik chegirmasi bemorning SHU XIZMATDAN necha marta
 * foydalanganiga qarab qo'llanadi. Masalan "5 tashrifdan keyin 15%"
 * degani: 6-martadan boshlab arzon.
 *
 * SERVERDA: chegirmani mijoz hisoblamasligi kerak. To'lov yaratilganda
 * server narxni qaytadan hisoblab, mijoz yuborgan summani tekshirishi
 * shart — aks holda registrator summani o'zgartirib yuborishi mumkin.
 */
// GET /services/:id/price?patientId=
export async function resolvePriceForPatient(
  serviceId: ID,
  patientId: ID | null,
): Promise<PricePreview | null> {
  if (!USE_MOCK) {
    return request<PricePreview>('GET', `/services/${serviceId}/price`, {
      query: { patientId },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const service = db.services.find(serviceId, clinicId)
  if (!service) return delay(null, 60)

  // Bemor shu xizmatdan necha marta foydalangan
  const visitCount = patientId
    ? db.appointments
        .all(clinicId)
        .filter(
          (a) =>
            a.patientId === patientId &&
            a.serviceId === serviceId &&
            a.status === 'completed',
        ).length
    : 0

  const resolved = resolveServicePrice(service, visitCount)

  // Keyingi pog'ona — "yana 2 tashrifdan keyin 20%" deb ko'rsatish uchun
  const nextTier = [...service.loyaltyTiers]
    .filter((tier) => tier.afterVisits > visitCount)
    .sort((a, b) => a.afterVisits - b.afterVisits)[0]

  return delay(
    {
      serviceId,
      serviceName: service.name,
      basePrice: resolved.basePrice,
      discountPct: resolved.discountPct,
      price: resolved.price,
      visitCount,
      nextTierIn: nextTier ? nextTier.afterVisits - visitCount : null,
      nextTierPct: nextTier ? nextTier.discountPct : null,
      paymentTiming: service.paymentTiming,
    },
    120,
  )
}
