/**
 * Oylik yig'ma tarix — prognoz uchun.
 *
 * Batafsil qabullar faqat oxirgi 120 kun uchun saqlanadi. Prognozga esa
 * 12-18 oylik tarix kerak, shuning uchun eski oylar yig'ma ko'rinishda
 * yaratiladi.
 *
 * Haqiqiy tizimda bu jadvalni tunda ishlaydigan vazifa to'ldiradi —
 * `docs/DATABASE.md` dagi "rollup" bo'limiga qarang.
 */

import type { Random } from './random'
import type { MonthlyStat } from '@/types/models'

/** Nechta oylik tarix yaratiladi */
const HISTORY_MONTHS = 18

/**
 * Mavsumiylik koeffitsienti.
 *
 * Klinikada qish oylari eng band (shamollash, gripp), yoz — eng bo'sh
 * (ta'til, issiq). Bu O'zbekiston sharoitida yaqqol ko'rinadigan naqsh.
 */
const SEASONALITY = [
  1.15, // yanvar
  1.12, // fevral
  1.05, // mart
  0.98, // aprel
  0.95, // may
  0.86, // iyun
  0.8, // iyul
  0.82, // avgust
  0.98, // sentabr
  1.08, // oktabr
  1.12, // noyabr
  1.1, // dekabr
]

export function generateMonthlyStats(
  r: Random,
  clinicId: string,
  today: Date,
  /** Joriy oydagi haqiqiy daromad — tarix shunga moslashtiriladi */
  currentMonthRevenue: number,
): MonthlyStat[] {
  const rows: MonthlyStat[] = []

  /**
   * Bazaviy daromad.
   *
   * Joriy oyning haqiqiy raqamidan teskari hisoblaymiz, shunda yig'ma
   * tarix batafsil ma'lumot bilan bir chiziqda turadi.
   */
  const currentMonthIndex = today.getMonth()
  const base = currentMonthRevenue / (SEASONALITY[currentMonthIndex] || 1)

  for (let back = HISTORY_MONTHS; back >= 1; back--) {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    // Klinika o'smoqda: har oy ~2.2% o'sish
    const growth = Math.pow(1.022, -back)
    const season = SEASONALITY[date.getMonth()]
    // Tasodifiy tebranish ±6%
    const noise = 0.94 + r.next() * 0.12

    const revenue = Math.round(base * growth * season * noise)

    /**
     * Xarajatlar tuzilishi:
     *   - doimiy qism (ijara, kommunal, ma'muriyat maoshi) — 42 mln
     *   - o'zgaruvchi qism (shifokorlar foizi, materiallar) — tushumning 38%
     */
    const fixedCosts = Math.round(42_000_000 * growth)
    const variableCosts = Math.round(revenue * 0.38)
    const expenses = fixedCosts + variableCosts

    const appointments = Math.round((revenue / 175_000) * (0.95 + r.next() * 0.1))

    rows.push({
      clinicId,
      period,
      revenue,
      expenses,
      patients: Math.round(appointments * 0.72),
      newPatients: Math.round(appointments * 0.14),
      appointments,
    })
  }

  return rows
}
