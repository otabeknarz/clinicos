/**
 * ============================================================
 *  KIRIM-CHIQIM
 * ============================================================
 *
 * Bemor to'lovidan TASHQARI pul: xarid, ijara, maosh, kommunal va
 * bemordan boshqa kirim. Bemor to'lovlari `payments` da qoladi —
 * hisobot ikkalasini qo'shib o'qiydi.
 *
 * Ruxsatlar:
 *   `finance.view`   — butun hisobot (egasi, buxgalter)
 *   `finance.create` — yozish va O'Z yozuvlari (kassadan pul beradigan xodim)
 *   `finance.void`   — bekor qilish, faqat egasi
 *
 * Yozuv O'ZGARMAYDI: tahrir va o'chirish yo'q, faqat bekor qilish.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { endOfDay, startOfDay, toISODate } from '@/lib/dates'
import type {
  DateRange,
  FinanceEntry,
  FinanceEntryType,
  FinanceSummary,
  ID,
  PaymentMethod,
} from '@/types/models'

type TypeFilter = 'all' | FinanceEntryType

export interface FinanceEntryInput {
  type: FinanceEntryType
  category: string
  amount: number
  method: PaymentMethod
  /** Bo'sh — hozir */
  occurredAt?: string
  counterparty: string
  note: string
  /** Yuklangan rasmlarning kalitlari */
  receipts: string[]
}

/* ------------------------------------------------------------------ */

function mockRange(range: DateRange) {
  const from = startOfDay(new Date(range.from)).getTime()
  const to = endOfDay(new Date(range.to)).getTime()
  return (iso: string) => {
    const t = new Date(iso).getTime()
    return t >= from && t <= to
  }
}

/** Demoda kim yozgani — serverda bu tokendan olinadi */
function mockMe() {
  const { clinicId, userEmail } = apiContext()
  const user = getDb()
    .users.all(clinicId)
    .find((u) => u.email === userEmail)
  return { id: user?.id ?? 'usr_owner', name: user?.fullName ?? '—' }
}

function mockEntries(range: DateRange, type: TypeFilter, onlyMine: boolean): FinanceEntry[] {
  const { clinicId } = apiContext()
  const inRange = mockRange(range)
  const me = mockMe()
  return getDb()
    .financeEntries.all(clinicId)
    .filter((e) => inRange(e.occurredAt))
    .filter((e) => type === 'all' || e.type === type)
    .filter((e) => !onlyMine || e.createdById === me.id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

// GET /finance/summary?from=&to=
export async function getFinanceSummary(range: DateRange): Promise<FinanceSummary> {
  if (!USE_MOCK) {
    return request<FinanceSummary>('GET', '/finance/summary', {
      query: { from: range.from, to: range.to },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()
  const inRange = mockRange(range)

  const payments = db.payments.all(clinicId).filter((p) => p.status === 'paid' && inRange(p.paidAt))
  const entries = db.financeEntries.all(clinicId).filter((e) => inRange(e.occurredAt))
  const active = entries.filter((e) => !e.voidedAt)
  const expenses = active.filter((e) => e.type === 'expense')
  const incomes = active.filter((e) => e.type === 'income')
  const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0)

  const byCategory = new Map<string, FinanceSummary['byCategory'][number]>()
  for (const e of active) {
    const key = `${e.type}:${e.category}`
    const row = byCategory.get(key) ?? { type: e.type, category: e.category, amount: 0, count: 0 }
    row.amount += e.amount
    row.count += 1
    byCategory.set(key, row)
  }

  const daily = new Map<string, { date: string; income: number; expense: number }>()
  for (let d = new Date(range.from); toISODate(d) <= range.to; d.setDate(d.getDate() + 1)) {
    daily.set(toISODate(d), { date: toISODate(d), income: 0, expense: 0 })
  }
  for (const p of payments) {
    const row = daily.get(toISODate(new Date(p.paidAt)))
    if (row) row.income += p.amount
  }
  for (const e of active) {
    const row = daily.get(toISODate(new Date(e.occurredAt)))
    if (!row) continue
    if (e.type === 'income') row.income += e.amount
    else row.expense += e.amount
  }

  const patients = sum(payments)
  const other = sum(incomes)
  const expense = sum(expenses)

  return delay({
    from: range.from,
    to: range.to,
    income: { patients, other, total: patients + other },
    expense: { total: expense, cash: sum(expenses.filter((e) => e.method === 'cash')) },
    net: patients + other - expense,
    patientsByMethod: {
      cash: sum(payments.filter((p) => p.method === 'cash')),
      card: sum(payments.filter((p) => p.method === 'card')),
      transfer: sum(payments.filter((p) => p.method === 'transfer')),
    },
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    daily: [...daily.values()],
    voidedCount: entries.length - active.length,
  })
}

// GET /finance/entries?from=&to=&type=
export async function listFinanceEntries(range: DateRange, type: TypeFilter = 'all'): Promise<FinanceEntry[]> {
  if (!USE_MOCK) {
    return request<FinanceEntry[]>('GET', '/finance/entries', {
      query: { from: range.from, to: range.to, type },
    })
  }
  return delay(mockEntries(range, type, false))
}

/**
 * Faqat O'ZI yozganlari — `finance.create` bor, `finance.view` yo'q xodim
 * uchun (kassadan xaridga pul beradigan registrator).
 */
// GET /finance/my-entries?from=&to=&type=
export async function listMyFinanceEntries(range: DateRange, type: TypeFilter = 'all'): Promise<FinanceEntry[]> {
  if (!USE_MOCK) {
    return request<FinanceEntry[]>('GET', '/finance/my-entries', {
      query: { from: range.from, to: range.to, type },
    })
  }
  return delay(mockEntries(range, type, true))
}

// POST /finance/entries
export async function createFinanceEntry(input: FinanceEntryInput): Promise<FinanceEntry> {
  if (!USE_MOCK) return request<FinanceEntry>('POST', '/finance/entries', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const me = mockMe()
  const now = new Date().toISOString()

  const entry = {
    id: db.financeEntries.nextId('fin'),
    clinicId,
    type: input.type,
    category: input.category,
    amount: input.amount,
    method: input.method,
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
    counterparty: input.counterparty.trim(),
    note: input.note.trim(),
    receipts: input.receipts,
    createdById: me.id,
    createdByName: me.name,
    createdAt: now,
    voidedAt: null,
    voidedByName: null,
    voidReason: '',
  }
  db.financeEntries.insert(entry)
  return delay(entry, 300)
}

// POST /finance/entries/:id/void
export async function voidFinanceEntry(id: ID, reason: string): Promise<FinanceEntry> {
  if (!USE_MOCK) {
    return request<FinanceEntry>('POST', `/finance/entries/${id}/void`, { body: { reason } })
  }

  const { clinicId } = apiContext()
  const db = getDb()
  const current = db.financeEntries.find(id, clinicId)
  if (!current) throw new Error('Yozuv topilmadi')
  if (current.voidedAt) throw new Error('Yozuv allaqachon bekor qilingan')

  const next = db.financeEntries.update(
    id,
    { voidedAt: new Date().toISOString(), voidedByName: mockMe().name, voidReason: reason.trim() },
    clinicId,
  )
  return delay(next!, 300)
}
