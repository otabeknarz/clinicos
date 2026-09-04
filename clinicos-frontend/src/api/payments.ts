/**
 * To'lovlar va daromad hisobotlari.
 *
 * RUXSAT: `payments.view` — registratura ham ko'radi (kunlik kassa).
 * `revenue.view` — faqat egasi (yoki egasi ruxsat bergan xodim).
 * Bu ikki ruxsat ATAYLAB ajratilgan: registrator kunlik to'lovlarni
 * kiritadi, lekin klinikaning umumiy moliyaviy hisobotini ko'rmaydi.
 */

import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { pick } from './patients'
import { getDb } from '@/mock/db'
import {
  addDays,
  eachDay,
  endOfDay,
  fromISODate,
  startOfDay,
  startOfWeek,
  toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
  DateRange,
  ID,
  Paginated,
  Payment,
  PaymentExpanded,
  PaymentMethod,
  PaymentStatus,
  RevenueBreakdownItem,
  RevenueReport,
  SeriesPoint,
} from '@/types/models'

export interface PaymentQuery {
  search?: string
  method?: PaymentMethod | 'all'
  status?: PaymentStatus | 'all'
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface PaymentSummary {
  /** Bugungi tushum — registratorga ham ko'rinadi */
  today: number
  /*
    DASTURCHIGA: haftalik va oylik summa faqat `revenue.view` ruxsati
    bor foydalanuvchiga yuborilsin. Interfeysda ular yashirilgan,
    lekin YASHIRISH HIMOYA EMAS — so'rovni brauzerdan ham yuborsa
    bo'ladi. Ruxsat yo'q bo'lsa bu maydonlar javobga umuman
    qo'shilmasin (null yoki yo'q bo'lsin).
  */
  week: number
  month: number
}

/* ------------------------------------------------------------------ */

// GET /payments?search=&method=&status=&from=&to=&page=
export async function listPayments(
  query: PaymentQuery = {},
): Promise<Paginated<PaymentExpanded>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<PaymentExpanded>>('GET', '/payments', {
      query: { ...query, page, pageSize },
    })
  }

  const rows = expandPayments()
    .filter((p) => !query.method || query.method === 'all' || p.method === query.method)
    .filter((p) => !query.status || query.status === 'all' || p.status === query.status)
    .filter((p) => !query.from || p.paidAt >= query.from)
    .filter((p) => !query.to || p.paidAt <= query.to)
    .filter(
      (p) =>
        !query.search ||
        matches(p.patient.fullName, query.search) ||
        matches(p.doctor.fullName, query.search),
    )

  rows.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  return delay(paginate(rows, page, pageSize))
}

// GET /payments/summary  →  bugungi / haftalik / oylik daromad
export async function getPaymentSummary(): Promise<PaymentSummary> {
  if (!USE_MOCK) return request<PaymentSummary>('GET', '/payments/summary')

  const { clinicId } = apiContext()
  const paid = getDb()
    .payments.all(clinicId)
    .filter((p) => p.status === 'paid')

  const now = new Date()
  const dayStart = startOfDay(now).getTime()
  const weekStart = startOfWeek(now).getTime()
  // Oyning boshida "shu oy" bir kunni bildiradi — shuning uchun
  // uchinchi ko'rsatkich aylanma 30 kunlik oyna.
  const monthStart = startOfDay(addDays(now, -29)).getTime()

  const sum = (since: number) =>
    paid
      .filter((p) => new Date(p.paidAt).getTime() >= since)
      .reduce((total, p) => total + p.amount, 0)

  return delay({ today: sum(dayStart), week: sum(weekStart), month: sum(monthStart) })
}

export interface PaymentInput {
  patientId: ID
  doctorId: ID
  serviceId: ID
  appointmentId: ID | null
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  notes: string
}

// POST /payments
export async function createPayment(input: PaymentInput): Promise<Payment> {
  if (!USE_MOCK) return request<Payment>('POST', '/payments', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const now = new Date().toISOString()

  const payment: Payment = {
    id: db.payments.nextId('pay'),
    clinicId,
    paidAt: now,
    createdBy: 'usr_reception_1',
    createdAt: now,
    ...input,
  }

  db.payments.insert(payment)

  // To'lov kiritilsa — bog'liq qabulning to'lov holati ham yangilanadi
  if (input.appointmentId && input.status === 'paid') {
    db.appointments.update(input.appointmentId, { paymentStatus: 'paid' }, clinicId)
  }

  return delay(payment, 300)
}

// POST /payments/:id/refund
export async function refundPayment(id: ID): Promise<Payment> {
  if (!USE_MOCK) return request<Payment>('POST', `/payments/${id}/refund`)

  const updated = getDb().payments.update(id, { status: 'refunded' }, apiContext().clinicId)
  if (!updated) throw new Error("To'lov topilmadi")
  return delay(updated, 260)
}

/* ------------------------------------------------------------------ */
/* Daromad hisoboti                                                    */
/* ------------------------------------------------------------------ */

// GET /reports/revenue?from=&to=
export async function getRevenueReport(range: DateRange): Promise<RevenueReport> {
  if (!USE_MOCK) {
    return request<RevenueReport>('GET', '/reports/revenue', {
      query: { from: range.from, to: range.to },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const from = startOfDay(fromISODate(range.from)).getTime()
  const to = endOfDay(fromISODate(range.to)).getTime()

  const paid = db.payments
    .all(clinicId)
    .filter((p) => p.status === 'paid')
    .filter((p) => {
      const t = new Date(p.paidAt).getTime()
      return t >= from && t <= to
    })

  const total = paid.reduce((sum, p) => sum + p.amount, 0)
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d.fullName]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s.name]))

  /* --- Vaqt bo'yicha --- */
  const days = eachDay(fromISODate(range.from), fromISODate(range.to))
  // Uzoq davrda kunlik nuqta juda ko'p bo'ladi — haftaga guruhlaymiz
  const groupByWeek = days.length > 45

  const overTime: SeriesPoint[] = groupByWeek
    ? groupWeekly(paid, days)
    : days.map((day) => ({
        label: dateCompact(day),
        value: paid
          .filter((p) => toISODate(new Date(p.paidAt)) === toISODate(day))
          .reduce((sum, p) => sum + p.amount, 0),
      }))

  return delay({
    totalRevenue: total,
    // Sof daromad — demo uchun 68% (xarajatlar chegirilgan).
    // Haqiqiy backendda bu xarajatlar jadvalidan hisoblanadi.
    netRevenue: Math.round(total * 0.68),
    transactions: paid.length,
    averageCheck: paid.length ? Math.round(total / paid.length) : 0,
    overTime,
    byDoctor: breakdown(paid, (p) => p.doctorId, doctors, total),
    byService: breakdown(paid, (p) => p.serviceId, services, total),
    byMethod: breakdown(
      paid,
      (p) => p.method,
      new Map([
        ['cash', 'cash'],
        ['card', 'card'],
        ['transfer', 'transfer'],
      ]),
      total,
    ),
  })
}

/* ------------------------------------------------------------------ */

function expandPayments(): PaymentExpanded[] {
  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  return db.payments
    .all(clinicId)
    .filter((p) => !scopeDoctorId || p.doctorId === scopeDoctorId)
    .map((p) => ({
      ...p,
      patient: pick(patients.get(p.patientId), ['id', 'fullName']) ?? {
        id: p.patientId,
        fullName: '—',
      },
      doctor: pick(doctors.get(p.doctorId), ['id', 'fullName']) ?? {
        id: p.doctorId,
        fullName: '—',
      },
      service: pick(services.get(p.serviceId), ['id', 'name']) ?? { id: p.serviceId, name: '—' },
    }))
}

function breakdown(
  rows: Payment[],
  keyOf: (p: Payment) => string,
  labels: Map<string, string>,
  total: number,
): RevenueBreakdownItem[] {
  const sums = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    sums.set(key, (sums.get(key) ?? 0) + row.amount)
  }

  return [...sums.entries()]
    .map(([id, value]) => ({
      id,
      label: labels.get(id) ?? id,
      value,
      sharePct: total ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function groupWeekly(rows: Payment[], days: Date[]): SeriesPoint[] {
  const buckets = new Map<string, { label: string; value: number }>()

  for (const day of days) {
    const key = toISODate(startOfWeek(day))
    if (!buckets.has(key)) buckets.set(key, { label: dateCompact(startOfWeek(day)), value: 0 })
  }

  for (const row of rows) {
    const key = toISODate(startOfWeek(new Date(row.paidAt)))
    const bucket = buckets.get(key)
    if (bucket) bucket.value += row.amount
  }

  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}
