/**
 * Jarimalar.
 *
 * G'OYA: klinika egasi qoida yozadi ("kechikkan kunga 50 000 so'm"),
 * tizim esa uni avtomatik qo'llaydi. Xodim jarimani o'z profilida
 * ko'radi va nima uchun berilganini aniq biladi.
 *
 * NEGA AVTOMATIK: qo'lda yoziladigan jarima har doim shaxsiy
 * munosabatga aylanadi — kimdir kechirilib, kimdir kechirilmaydi.
 * Qoida hamma uchun bir xil ishlasa, bahs qoidaning o'zi haqida
 * bo'ladi, odam haqida emas.
 *
 * NEGA FAQAT O'LCHANADIGAN SABABLAR: jarima asosi tizim
 * tekshiradigan ma'lumotdan kelib chiqadi (davomat, kassa yopilishi).
 * "Yomon ishladi" kabi sub'ektiv sabab yo'q — aks holda tizim
 * kayfiyatni rasmiylashtirgan bo'lardi.
 *
 * RUXSAT:
 *   `staff.manage`  — qoidalarni yozish, jarimani kechirish
 *   xodimning o'zi  — faqat O'Z jarimalarini ko'rish
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { toISODate } from '@/lib/dates'
import type {
  ID,
  Penalty,
  PenaltyRule,
  PenaltySummary,
  Staff,
  UZS,
} from '@/types/models'

/* ------------------------------------------------------------------ */
/* Qoidalar                                                            */
/* ------------------------------------------------------------------ */

// GET /penalty-rules
export async function listPenaltyRules(): Promise<PenaltyRule[]> {
  if (!USE_MOCK) return request<PenaltyRule[]>('GET', '/penalty-rules')
  return delay(getDb().penaltyRules.all(apiContext().clinicId), 120)
}

export interface PenaltyRuleInput {
  name: string
  trigger: PenaltyRule['trigger']
  threshold: number
  amountType: PenaltyRule['amountType']
  amountValue: number
  positions: PenaltyRule['positions']
  isActive: boolean
}

// POST /penalty-rules
export async function createPenaltyRule(input: PenaltyRuleInput): Promise<PenaltyRule> {
  if (!USE_MOCK) return request<PenaltyRule>('POST', '/penalty-rules', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const rule: PenaltyRule = {
    id: db.penaltyRules.nextId('prl'),
    clinicId,
    createdAt: new Date().toISOString(),
    ...input,
  }

  db.penaltyRules.insert(rule)
  return delay(rule, 260)
}

// PATCH /penalty-rules/:id
export async function updatePenaltyRule(
  id: ID,
  patch: Partial<PenaltyRuleInput>,
): Promise<PenaltyRule> {
  if (!USE_MOCK) return request<PenaltyRule>('PATCH', `/penalty-rules/${id}`, { body: patch })

  const updated = getDb().penaltyRules.update(id, patch, apiContext().clinicId)
  if (!updated) throw new Error('Qoida topilmadi')
  return delay(updated, 220)
}

// DELETE /penalty-rules/:id
export async function deletePenaltyRule(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/penalty-rules/${id}`)
    return
  }
  getDb().penaltyRules.remove(id, apiContext().clinicId)
  await delay(null, 200)
}

/* ------------------------------------------------------------------ */
/* Avtomatik hisoblash                                                 */
/* ------------------------------------------------------------------ */

/**
 * Jarima summasi.
 *
 * `percent_of_daily_salary` uchun kunlik maosh oyni 26 ish kuniga
 * bo'lish orqali olinadi — O'zbekistondagi odatiy oylik ish kunlari
 * soni. Aniq kalendar kunlari bo'yicha hisoblash ham mumkin, lekin
 * u holda bir xil qoida turli oylarda turlicha summa berardi.
 */
const WORKDAYS_PER_MONTH = 26

function computeAmount(rule: PenaltyRule, staff: Staff, basis: UZS): UZS {
  switch (rule.amountType) {
    case 'fixed':
      return Math.round(rule.amountValue)

    case 'percent_of_shortfall':
      return Math.round((basis * rule.amountValue) / 100)

    case 'percent_of_daily_salary': {
      const daily = (staff.salary * staff.workRate) / WORKDAYS_PER_MONTH
      return Math.round((daily * rule.amountValue) / 100)
    }
  }
}

/** Qoida shu lavozimga tegishlimi */
function appliesTo(rule: PenaltyRule, staff: Staff): boolean {
  if (!rule.isActive) return false
  if (rule.positions.length === 0) return true
  return rule.positions.includes(staff.position)
}

/**
 * Bir oy uchun jarimalarni hisoblash.
 *
 * Natija SAQLANMAYDI — har safar qaytadan hisoblanadi. Sababi: qoida
 * o'zgarsa yoki davomat tuzatilsa, jarima ham darhol to'g'rilanishi
 * kerak. Saqlangan jarima esa eskirgan qoidaning izi bo'lib qolardi.
 *
 * Istisno — kechirilgan jarimalar: ular alohida saqlanadi, chunki
 * bu egasining qarori va uni qayta hisoblab bo'lmaydi.
 *
 * DASTURCHIGA: haqiqiy backendda buni har kecha bir marta hisoblab,
 * natijani jadvalga yozish tejamliroq. Muhimi — qayta hisoblanganda
 * bir xil natija chiqishi (idempotent) va kechirilganlar saqlanishi.
 */
function computePenalties(period: string, staffFilter?: ID): Penalty[] {
  const { clinicId } = apiContext()
  const db = getDb()

  const rules = db.penaltyRules.all(clinicId).filter((r) => r.isActive)
  if (rules.length === 0) return []

  const waived = new Set(
    db.penaltyWaivers.all(clinicId).map((w) => w.penaltyId),
  )

  const staffList = db.staff
    .all(clinicId)
    .filter((s) => s.status === 'active')
    .filter((s) => !staffFilter || s.id === staffFilter)

  const users = new Map(db.users.all(clinicId).map((u) => [u.email.toLowerCase(), u]))
  const result: Penalty[] = []

  for (const staff of staffList) {
    const applicable = rules.filter((rule) => appliesTo(rule, staff))
    if (applicable.length === 0) continue

    const attendance = db.attendance
      .all(clinicId)
      .filter((a) => a.staffId === staff.id && a.date.slice(0, 7) === period)

    const user = users.get(staff.email.toLowerCase())
    const closures = user
      ? db.shiftClosures
          .all(clinicId)
          .filter((c) => c.userId === user.id && c.date.slice(0, 7) === period)
      : []

    for (const rule of applicable) {
      const push = (date: string, amount: UZS, reason: string, key: string) => {
        if (amount <= 0) return
        const id = `pen_${rule.id}_${staff.id}_${key}`
        result.push({
          id,
          clinicId,
          staffId: staff.id,
          staffName: staff.fullName,
          positionTitle: staff.positionTitle,
          period,
          date,
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: rule.trigger,
          amount,
          reason,
          status: waived.has(id) ? 'waived' : 'applied',
        })
      }

      switch (rule.trigger) {
        /* --- Kechikish: har bir kun uchun --- */
        case 'late': {
          const lateDays = attendance
            .filter((a) => a.status === 'late')
            .sort((a, b) => a.date.localeCompare(b.date))

          // `threshold` — oyiga nechta kechikish kechiriladi
          lateDays.slice(rule.threshold).forEach((a) => {
            push(
              a.date,
              computeAmount(rule, staff, 0),
              `${a.date} · ${a.lateMinutes} daq`,
              a.date,
            )
          })
          break
        }

        /* --- Kechikish: daqiqasiga --- */
        case 'late_minutes': {
          const totalLate = attendance
            .filter((a) => a.status === 'late')
            .reduce((sum, a) => sum + a.lateMinutes, 0)

          if (totalLate > rule.threshold) {
            const billable = totalLate - rule.threshold
            const units = Math.ceil(billable / 10)
            push(
              `${period}-01`,
              computeAmount(rule, staff, 0) * units,
              `${totalLate} daq · ${units} × 10 daq`,
              'total',
            )
          }
          break
        }

        /* --- Sababsiz kelmagan kun --- */
        case 'absent': {
          attendance
            .filter((a) => a.status === 'absent')
            .forEach((a) => {
              push(a.date, computeAmount(rule, staff, 0), a.date, a.date)
            })
          break
        }

        /* --- Kassa kamomadi --- */
        case 'cash_shortfall': {
          closures
            .filter((c) => c.difference < 0)
            .filter((c) => Math.abs(c.difference) > rule.threshold)
            .forEach((c) => {
              const shortfall = Math.abs(c.difference)
              push(
                c.date,
                computeAmount(rule, staff, shortfall),
                `${c.date} · ${shortfall.toLocaleString('ru-RU')} so'm`,
                c.date,
              )
            })
          break
        }

        /* --- Davomat vaqti orqaga surilgan --- */
        case 'backdated_attendance': {
          const flagged = db.attendance
            .all(clinicId)
            .filter((a) => a.flagged && a.date.slice(0, 7) === period)
            // Jarima YOZUVNI KIRITGANGA tushadi, davomati belgilangan
            // xodimga emas — buzilish aynan yozuvni kiritishda bo'lgan
            .filter((a) => user && a.markedBy === user.id)

          flagged.forEach((a) => {
            push(a.date, computeAmount(rule, staff, 0), a.date, `flag_${a.id}`)
          })
          break
        }

        /* --- Intizom balli past --- */
        case 'discipline_below': {
          const workdays = attendance.filter((a) => a.status !== 'day_off')
          if (workdays.length < 5) break // ma'lumot yetarli emas

          const bad = workdays.filter(
            (a) => a.status === 'absent' || a.status === 'late',
          ).length
          const score = Math.round(((workdays.length - bad) / workdays.length) * 100)

          if (score < rule.threshold) {
            push(
              `${period}-01`,
              computeAmount(rule, staff, 0),
              `${score}% < ${rule.threshold}%`,
              'score',
            )
          }
          break
        }
      }
    }
  }

  return result.sort((a, b) => b.date.localeCompare(a.date))
}

// GET /penalties?period=
export async function listPenalties(period: string): Promise<Penalty[]> {
  if (!USE_MOCK) return request<Penalty[]>('GET', '/penalties', { query: { period } })
  return delay(computePenalties(period), 200)
}

/**
 * Xodimning o'z jarimalari.
 *
 * DASTURCHIGA: server bu so'rovda xodimni TOKENDAN aniqlashi shart.
 * `staffId` ni mijozdan qabul qilib, uni tekshirmaslik — boshqa
 * xodimning jarimalarini o'qish imkonini beradi.
 */
// GET /me/penalties?period=
export async function getMyPenalties(
  staffId: ID,
  period: string,
): Promise<PenaltySummary> {
  if (!USE_MOCK) {
    return request<PenaltySummary>('GET', '/me/penalties', { query: { period } })
  }

  const items = computePenalties(period, staffId)

  return delay(
    {
      staffId,
      period,
      items,
      total: items
        .filter((p) => p.status === 'applied')
        .reduce((sum, p) => sum + p.amount, 0),
      waivedTotal: items
        .filter((p) => p.status === 'waived')
        .reduce((sum, p) => sum + p.amount, 0),
    },
    200,
  )
}

/* ------------------------------------------------------------------ */
/* Kechirish                                                           */
/* ------------------------------------------------------------------ */

/**
 * Jarimani kechirish.
 *
 * Egasi faqat KECHIRA oladi — summani qo'lda oshirish yoki yangi
 * jarima yozish imkoni yo'q. Aks holda "avtomatik qoida" degani
 * ma'nosini yo'qotardi: har qanday summa qo'lda qo'yilishi mumkin
 * bo'lsa, qoida shunchaki bezak bo'lib qoladi.
 */
// POST /penalties/:id/waive
export async function waivePenalty(penaltyId: ID, note: string): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('POST', `/penalties/${penaltyId}/waive`, { body: { note } })
    return
  }

  const { clinicId } = apiContext()
  const db = getDb()

  if (db.penaltyWaivers.all(clinicId).some((w) => w.penaltyId === penaltyId)) {
    await delay(null, 120)
    return
  }

  db.penaltyWaivers.insert({
    id: db.penaltyWaivers.nextId('pwv'),
    clinicId,
    penaltyId,
    note,
    createdAt: new Date().toISOString(),
  })

  await delay(null, 220)
}

// DELETE /penalties/:id/waive
export async function unwaivePenalty(penaltyId: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/penalties/${penaltyId}/waive`)
    return
  }

  const { clinicId } = apiContext()
  const db = getDb()
  const waiver = db.penaltyWaivers.all(clinicId).find((w) => w.penaltyId === penaltyId)
  if (waiver) db.penaltyWaivers.remove(waiver.id, clinicId)

  await delay(null, 200)
}

/** Joriy oy kaliti, "2026-09" */
export function currentPeriod(): string {
  return toISODate(new Date()).slice(0, 7)
}
