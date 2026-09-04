/**
 * ============================================================
 *  KASSA NAZORATI
 * ============================================================
 *
 * Muammo: kassada naqd pul aylanadi. Administrator pulni olib, to'lovni
 * yozmasligi yoki kamroq yozishi mumkin.
 *
 * Yechim — vazifalarni ajratish:
 *
 *   SHIFOKOR   xizmat ko'rsatilganini qayd qiladi (tashrif yozuvi)
 *   ADMIN      pulni qayd qiladi (to'lov yozuvi)
 *
 * Ikki yozuvni turli odam kiritadi, demak ularni solishtirish mumkin:
 *
 *   Yakunlangan tashriflar summasi − Kassaga tushgan pul = FARQ
 *
 * Bu hisobotni FAQAT egasi ko'radi (`cashcontrol.view`).
 *
 * Qo'shimcha nazorat nuqtalari:
 *   - to'lov yozuvi o'chirilmaydi/tahrirlanmaydi (faqat qaytarish yoziladi)
 *   - chegirmalar alohida ko'rinadi
 *   - bemor "kelgan" deb belgilangandan keyin bekor qilingan qabullar
 *   - smena yopishdagi kamomadlar (xodim nomi bilan)
 *
 * SERVERDA: bu endpointlar `cashcontrol.view` talab qiladi va
 * administrator roliga HECH QACHON ochilmaydi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { endOfDay, fromISODate, startOfDay, toISODate } from '@/lib/dates'
import type {
  CashControlReport,
  DateRange,
  ID,
  ShiftClosure,
  UZS,
} from '@/types/models'

// GET /cash-control?from=&to=
export async function getCashControlReport(range: DateRange): Promise<CashControlReport> {
  if (!USE_MOCK) {
    return request<CashControlReport>('GET', '/cash-control', {
      query: { from: range.from, to: range.to },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const from = startOfDay(new Date(range.from)).getTime()
  const to = endOfDay(new Date(range.to)).getTime()
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= from && t <= to
  }

  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))
  const users = new Map(db.users.all(clinicId).map((u) => [u.id, u]))

  /* --- Kutilgan summa: yakunlangan qabullar --- */

  const completed = db.appointments
    .all(clinicId)
    .filter((a) => a.status === 'completed')
    .filter((a) => inRange(a.completedAt ?? a.startsAt))

  const expected = completed.reduce(
    (sum, a) => sum + (services.get(a.serviceId)?.price ?? 0),
    0,
  )

  /* --- Haqiqatda tushgan --- */

  const payments = db.payments.all(clinicId).filter((p) => inRange(p.paidAt))
  const paid = payments.filter((p) => p.status === 'paid')
  const collected = paid.reduce((sum, p) => sum + p.amount, 0)

  /* --- To'lanmagan yakunlangan tashriflar --- */

  const unpaid = completed.filter((a) => a.paymentStatus !== 'paid')
  const unpaidAmount = unpaid.reduce(
    (sum, a) => sum + (services.get(a.serviceId)?.price ?? 0),
    0,
  )

  /* --- Kutilayotgan va qaytarilgan to'lovlar --- */

  const pending = payments.filter((p) => p.status === 'pending')
  const refunds = payments.filter((p) => p.status === 'refunded')

  /* --- Shubhali holat: bemor kelgandan KEYIN bekor qilingan --- */

  const cancelledAfterCheckIn = db.appointments
    .all(clinicId)
    .filter((a) => a.status === 'cancelled' && a.checkedInAt !== null)
    .filter((a) => inRange(a.cancelledAt ?? a.startsAt)).length

  /* --- Smena yopishlari --- */

  const shiftClosures = db.shiftClosures
    .all(clinicId)
    .filter((c) => {
      const t = fromISODate(c.date).getTime()
      return t >= from && t <= to
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  /* --- Xodimlar kesimida --- */

  const byUserMap = new Map<ID, { collected: UZS; transactions: number; shortfall: UZS }>()

  for (const payment of paid) {
    const entry = byUserMap.get(payment.createdBy) ?? {
      collected: 0,
      transactions: 0,
      shortfall: 0,
    }
    entry.collected += payment.amount
    entry.transactions += 1
    byUserMap.set(payment.createdBy, entry)
  }

  for (const closure of shiftClosures) {
    if (closure.difference >= 0) continue
    const entry = byUserMap.get(closure.userId) ?? {
      collected: 0,
      transactions: 0,
      shortfall: 0,
    }
    entry.shortfall += Math.abs(closure.difference)
    byUserMap.set(closure.userId, entry)
  }

  const byUser = [...byUserMap.entries()]
    .map(([userId, value]) => ({
      userId,
      userName: users.get(userId)?.fullName ?? '—',
      ...value,
    }))
    .sort((a, b) => b.collected - a.collected)

  return delay({
    expected,
    collected,
    gap: expected - collected,
    unpaidVisits: { count: unpaid.length, amount: unpaidAmount },
    pendingPayments: {
      count: pending.length,
      amount: pending.reduce((sum, p) => sum + p.amount, 0),
    },
    refunds: {
      count: refunds.length,
      amount: refunds.reduce((sum, p) => sum + p.amount, 0),
    },
    cancelledAfterCheckIn,
    byUser,
    shiftClosures,
  })
}

/* ------------------------------------------------------------------ */
/* Smena yopish (administratsiya)                                      */
/* ------------------------------------------------------------------ */

/**
 * Kun oxirida administrator kassadagi jismoniy naqd pulni sanaydi va
 * kiritadi. Tizim o'zidagi summa bilan solishtiradi.
 *
 * Farq bo'lsa — u yo'qolmaydi, xodim nomi bilan qayd etiladi va egasining
 * hisobotiga tushadi. Halol xodim uchun bu bir daqiqalik ish, lekin
 * pulni olib qolish imkonini yopadi.
 */
// GET /shifts/current  →  bugungi kutilayotgan naqd summa
export async function getExpectedCashToday(userId: ID): Promise<UZS> {
  if (!USE_MOCK) return request<UZS>('GET', '/shifts/current')

  const { clinicId } = apiContext()
  const todayKey = toISODate(new Date())

  return delay(
    getDb()
      .payments.all(clinicId)
      .filter(
        (p) =>
          p.method === 'cash' &&
          p.status === 'paid' &&
          p.createdBy === userId &&
          p.paidAt.slice(0, 10) === todayKey,
      )
      .reduce((sum, p) => sum + p.amount, 0),
    100,
  )
}

export interface ShiftCloseInput {
  userId: ID
  userName: string
  expectedCash: UZS
  declaredCash: UZS
  note: string
}

// POST /shifts/close
export async function closeShift(input: ShiftCloseInput): Promise<ShiftClosure> {
  if (!USE_MOCK) return request<ShiftClosure>('POST', '/shifts/close', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const closure: ShiftClosure = {
    id: db.shiftClosures.nextId('shc'),
    clinicId,
    userId: input.userId,
    userName: input.userName,
    date: toISODate(new Date()),
    expectedCash: input.expectedCash,
    declaredCash: input.declaredCash,
    difference: input.declaredCash - input.expectedCash,
    note: input.note,
    closedAt: new Date().toISOString(),
  }

  db.shiftClosures.insert(closure)
  return delay(closure, 320)
}
