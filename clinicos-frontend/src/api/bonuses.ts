/**
 * Bonuslar.
 *
 * Uch xil yo'l bilan beriladi:
 *
 *   1. QO'LDA      — egasi summa va sababni o'zi yozadi.
 *   2. TAKLIF      — tizim ko'rsatkichlarga qarab kimga qancha berish
 *                    mumkinligini taklif qiladi, egasi tasdiqlaydi.
 *   3. QOIDA       — egasi bir marta qoida yozadi ("reja 100% dan oshsa —
 *                    maoshning 10%i"), tizim uni har oy qo'llaydi.
 *
 * RUXSAT: `bonus.manage` — faqat egasi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { computeStaffPerformance } from './staff'
import { getDb } from '@/mock/db'
import type {
  Bonus,
  BonusRule,
  BonusRewardType,
  BonusSuggestion,
  ID,
  StaffPosition,
  UZS,
} from '@/types/models'
import { effectiveSalary } from '@/types/models'

/** Joriy davr: "2026-09" */
export function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Bonuslar                                                            */
/* ------------------------------------------------------------------ */

// GET /bonuses?period=&staffId=
export async function listBonuses(period?: string, staffId?: ID): Promise<Bonus[]> {
  if (!USE_MOCK) return request<Bonus[]>('GET', '/bonuses', { query: { period, staffId } })

  const rows = getDb()
    .bonuses.all(apiContext().clinicId)
    .filter((b) => !period || b.period === period)
    .filter((b) => !staffId || b.staffId === staffId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return delay(rows)
}

export interface BonusInput {
  staffId: ID
  staffName: string
  period: string
  amount: UZS
  reason: string
  source: Bonus['source']
  ruleId: ID | null
}

// POST /bonuses
export async function createBonus(input: BonusInput): Promise<Bonus> {
  if (!USE_MOCK) return request<Bonus>('POST', '/bonuses', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const bonus: Bonus = {
    id: db.bonuses.nextId('bns'),
    clinicId,
    status: 'planned',
    createdBy: 'usr_owner',
    createdAt: new Date().toISOString(),
    paidAt: null,
    ...input,
  }

  db.bonuses.insert(bonus)
  return delay(bonus, 300)
}

// POST /bonuses/:id/pay
export async function payBonus(id: ID): Promise<Bonus> {
  if (!USE_MOCK) return request<Bonus>('POST', `/bonuses/${id}/pay`)

  const updated = getDb().bonuses.update(
    id,
    { status: 'paid', paidAt: new Date().toISOString() },
    apiContext().clinicId,
  )
  if (!updated) throw new Error('Bonus topilmadi')
  return delay(updated, 260)
}

// DELETE /bonuses/:id
export async function deleteBonus(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/bonuses/${id}`)
    return
  }
  getDb().bonuses.remove(id, apiContext().clinicId)
  await delay(null, 220)
}

/* ------------------------------------------------------------------ */
/* Qoidalar                                                            */
/* ------------------------------------------------------------------ */

// GET /bonus-rules
export async function listBonusRules(): Promise<BonusRule[]> {
  if (!USE_MOCK) return request<BonusRule[]>('GET', '/bonus-rules')
  return delay(getDb().bonusRules.all(apiContext().clinicId))
}

export interface BonusRuleInput {
  name: string
  positions: StaffPosition[]
  minPerformance: number
  minRating: number
  rewardType: BonusRewardType
  rewardValue: number
  isActive: boolean
}

// POST /bonus-rules
export async function createBonusRule(input: BonusRuleInput): Promise<BonusRule> {
  if (!USE_MOCK) return request<BonusRule>('POST', '/bonus-rules', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const rule: BonusRule = {
    id: db.bonusRules.nextId('brl'),
    clinicId,
    createdAt: new Date().toISOString(),
    ...input,
  }
  db.bonusRules.insert(rule)
  return delay(rule, 280)
}

// PATCH /bonus-rules/:id
export async function updateBonusRule(
  id: ID,
  patch: Partial<BonusRuleInput>,
): Promise<BonusRule> {
  if (!USE_MOCK) return request<BonusRule>('PATCH', `/bonus-rules/${id}`, { body: patch })

  const updated = getDb().bonusRules.update(id, patch as Partial<BonusRule>, apiContext().clinicId)
  if (!updated) throw new Error('Qoida topilmadi')
  return delay(updated, 240)
}

// DELETE /bonus-rules/:id
export async function deleteBonusRule(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/bonus-rules/${id}`)
    return
  }
  getDb().bonusRules.remove(id, apiContext().clinicId)
  await delay(null, 220)
}

/* ------------------------------------------------------------------ */
/* Takliflar                                                           */
/* ------------------------------------------------------------------ */

/**
 * Tizim taklif qiladigan bonuslar.
 *
 * Faol qoidalar har bir xodimga qo'llanadi. Shart bajarilsa — summa
 * hisoblanadi. Egasi ro'yxatni ko'rib, kerakligini tasdiqlaydi yoki
 * summani o'zgartiradi. Avtomatik to'lov YO'Q — oxirgi qaror egasida.
 */
// GET /bonuses/suggestions?period=
export async function getBonusSuggestions(period: string): Promise<BonusSuggestion[]> {
  if (!USE_MOCK) {
    return request<BonusSuggestion[]>('GET', '/bonuses/suggestions', { query: { period } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const rules = db.bonusRules.all(clinicId).filter((r) => r.isActive)
  const staff = db.staff
    .all(clinicId)
    .filter((s) => s.status === 'active')
    // Egasining o'ziga bonus taklif qilish ma'nosiz - u bonusni beruvchi
    .filter((s) => s.role !== 'owner')

  // Shu davrda allaqachon bonus berilganlarni ikkinchi marta taklif qilmaymiz
  const alreadyGiven = new Set(
    db.bonuses
      .all(clinicId)
      .filter((b) => b.period === period)
      .map((b) => b.staffId),
  )

  const suggestions: BonusSuggestion[] = []

  for (const person of staff) {
    if (alreadyGiven.has(person.id)) continue

    const performance = computeStaffPerformance(person)

    for (const rule of rules) {
      // Lavozim mos kelmasa — o'tkazamiz
      if (rule.positions.length > 0 && !rule.positions.includes(person.position)) continue

      // Samaradorlik sharti
      if (rule.minPerformance > 0) {
        if (performance.performancePct === null) continue
        if (performance.performancePct < rule.minPerformance) continue
      }

      // Reyting sharti
      if (rule.minRating > 0) {
        if (performance.rating === null) continue
        if (performance.rating < rule.minRating) continue
      }

      const amount =
        rule.rewardType === 'fixed'
          ? rule.rewardValue
          : Math.round((effectiveSalary(person) * rule.rewardValue) / 100)

      if (amount <= 0) continue

      suggestions.push({
        staffId: person.id,
        staffName: person.fullName,
        position: person.position,
        performancePct: performance.performancePct,
        rating: performance.rating,
        amount,
        ruleId: rule.id,
        ruleName: rule.name,
        reason: rule.name,
      })

      // Bir xodimga bir qoidadan ortiq taklif bermaymiz
      break
    }
  }

  suggestions.sort((a, b) => b.amount - a.amount)
  return delay(suggestions, 200)
}

/** Taklifni qabul qilish — bonus yozuvi yaratiladi */
export async function acceptSuggestion(
  suggestion: BonusSuggestion,
  period: string,
  amount?: UZS,
): Promise<Bonus> {
  return createBonus({
    staffId: suggestion.staffId,
    staffName: suggestion.staffName,
    period,
    amount: amount ?? suggestion.amount,
    reason: suggestion.reason,
    source: suggestion.ruleId ? 'rule' : 'suggested',
    ruleId: suggestion.ruleId,
  })
}
