/**
 * ============================================================
 *  MOLIYAVIY PROGNOZ
 * ============================================================
 *
 * Savol: "Keyingi 3 / 6 / 12 oyda klinika qancha ishlaydi va zarar
 * xavfi bormi?"
 *
 * USUL: eng kichik kvadratlar usuli bilan chiziqli tendensiya + oylik
 * mavsumiylik koeffitsienti. Bu murakkab model emas, lekin klinika
 * uchun yetarli va — muhimi — TUSHUNARLI. Egasi raqam qayerdan
 * chiqqanini tushunishi kerak.
 *
 * OCHIQ AYTAMIZ: bu bashorat, kafolat emas. Yangi raqobatchi, epidemiya
 * yoki narx o'zgarishi prognozni buzadi. Shuning uchun interfeysda
 * ishonch oralig'i va "taxminiy" belgisi doim ko'rsatiladi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { monthsShort } from '@/lib/format'
import type {
  Forecast,
  ForecastHorizon,
  ForecastPoint,
  ForecastRisk,
  MonthlyStat,
} from '@/types/models'

/** Prognozda ko'rsatiladigan o'tgan oylar soni */
const HISTORY_SHOWN = 6

// GET /forecast?horizon=3|6|12
export async function getForecast(horizon: ForecastHorizon): Promise<Forecast> {
  if (!USE_MOCK) return request<Forecast>('GET', '/forecast', { query: { horizon } })

  const { clinicId } = apiContext()
  const db = getDb()

  const history = db.monthlyStats
    .all(clinicId)
    .sort((a, b) => a.period.localeCompare(b.period))

  if (history.length < 3) {
    return delay(emptyForecast(horizon))
  }

  /* --- Tendensiya --- */

  const revenueTrend = fitTrend(history.map((m) => m.revenue))
  const expenseTrend = fitTrend(history.map((m) => m.expenses))

  /* --- Mavsumiylik --- */
  // Har bir oy uchun o'rtacha nisbat: shu oy / tendensiya qiymati
  const seasonal = computeSeasonality(history, revenueTrend)

  /* --- Qatorlarni yig'amiz --- */

  const shown = history.slice(-HISTORY_SHOWN)
  const revenue: ForecastPoint[] = []
  const expenses: ForecastPoint[] = []
  const profit: ForecastPoint[] = []

  for (const month of shown) {
    revenue.push(actualPoint(month.period, month.revenue))
    expenses.push(actualPoint(month.period, month.expenses))
    profit.push(actualPoint(month.period, month.revenue - month.expenses))
  }

  /**
   * Prognoz aniqligi tarix uzunligiga va tarqoqligiga bog'liq.
   * Qanchalik uzoqroq bashorat qilsak, oraliq shuncha keng.
   */
  const spread = residualSpread(history.map((m) => m.revenue), revenueTrend)

  const lastIndex = history.length - 1
  let totalRevenue = 0
  let totalExpenses = 0
  let firstLossPeriod: string | null = null
  let worstMonthlyLoss = 0

  for (let step = 1; step <= horizon; step++) {
    const index = lastIndex + step
    const period = shiftPeriod(history[lastIndex].period, step)
    const monthIndex = Number(period.slice(5, 7)) - 1

    const season = seasonal[monthIndex] ?? 1
    const projectedRevenue = Math.max(0, Math.round(revenueTrend.at(index) * season))
    const projectedExpenses = Math.max(0, Math.round(expenseTrend.at(index)))
    const projectedProfit = projectedRevenue - projectedExpenses

    // Noaniqlik uzoqlashgan sari kengayadi
    const margin = Math.round(spread * Math.sqrt(step))

    revenue.push(forecastPoint(period, projectedRevenue, margin))
    expenses.push(forecastPoint(period, projectedExpenses, Math.round(margin * 0.4)))
    profit.push(forecastPoint(period, projectedProfit, margin))

    totalRevenue += projectedRevenue
    totalExpenses += projectedExpenses

    if (projectedProfit < 0) {
      if (!firstLossPeriod) firstLossPeriod = period
      worstMonthlyLoss = Math.min(worstMonthlyLoss, projectedProfit)
    }
  }

  /* --- O'sish sur'ati --- */

  /**
   * MUHIM: o'sishni oxirgi 3 oyni oldingi 3 oy bilan solishtirib
   * hisoblash MUMKIN EMAS - yozda klinika har doim bo'sh bo'ladi va
   * tizim har yozda "daromad kamayyapti" deb yolg'on ogohlantiradi.
   *
   * Shuning uchun tendensiya qiyaligidan foydalanamiz: u mavsumiylikdan
   * tozalangan, ya'ni haqiqiy o'sishni ko'rsatadi.
   */
  const meanRevenue = history.reduce((sum, m) => sum + m.revenue, 0) / history.length
  const growthRate = meanRevenue > 0 ? (revenueTrend.slope / meanRevenue) * 100 : 0

  // Oxirgi 3 oy - ishonchlilik hisobi uchun kerak
  const recent = history.slice(-3).reduce((sum, m) => sum + m.revenue, 0) / 3

  /* --- Ishonch darajasi --- */

  const historyScore = Math.min(1, history.length / 12)
  const stabilityScore = Math.max(0, 1 - spread / Math.max(1, recent))
  const horizonPenalty = horizon === 3 ? 1 : horizon === 6 ? 0.85 : 0.7
  const confidence = Math.round(historyScore * stabilityScore * horizonPenalty * 100)

  /* --- Ogohlantirishlar --- */

  const warnings: Forecast['warnings'] = []
  let risk: ForecastRisk = 'ok'

  if (firstLossPeriod) {
    risk = 'alert'
    warnings.push({
      key: 'forecast.warn.loss',
      vars: { period: humanPeriod(firstLossPeriod) },
      severity: 'bad',
    })
  }

  if (growthRate < 0) {
    risk = risk === 'alert' ? 'alert' : 'watch'
    warnings.push({
      key: 'forecast.warn.declining',
      vars: { pct: Math.abs(growthRate).toFixed(1) },
      severity: 'bad',
    })
  }

  const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
  if (margin < 15 && margin >= 0) {
    risk = risk === 'alert' ? 'alert' : 'watch'
    warnings.push({
      key: 'forecast.warn.thinMargin',
      vars: { pct: margin.toFixed(1) },
      severity: 'warn',
    })
  }

  if (confidence < 45) {
    warnings.push({
      key: 'forecast.warn.lowConfidence',
      vars: { months: history.length },
      severity: 'warn',
    })
  }

  /* --- Zarardan chiqish uchun kerakli tushum --- */

  const breakEvenGap = worstMonthlyLoss < 0 ? Math.abs(worstMonthlyLoss) : 0

  return delay(
    {
      horizon,
      basedOnMonths: history.length,
      revenue,
      expenses,
      profit,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
      },
      growthRate,
      confidence,
      risk,
      warnings,
      firstLossPeriod,
      breakEvenGap,
    },
    250,
  )
}

/* ------------------------------------------------------------------ */
/* Matematik yordamchilar                                              */
/* ------------------------------------------------------------------ */

interface Trend {
  slope: number
  intercept: number
  at: (index: number) => number
}

/**
 * Eng kichik kvadratlar usuli bilan to'g'ri chiziq.
 *
 * y = slope * x + intercept
 */
function fitTrend(values: number[]): Trend {
  const n = values.length
  const sumX = values.reduce((sum, _, i) => sum + i, 0)
  const sumY = values.reduce((sum, v) => sum + v, 0)
  const sumXY = values.reduce((sum, v, i) => sum + i * v, 0)
  const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0)

  const denominator = n * sumX2 - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept, at: (index: number) => slope * index + intercept }
}

/**
 * Mavsumiylik koeffitsientlari.
 *
 * Har bir kalendar oyi uchun: haqiqiy qiymat tendensiyadan necha baravar
 * farq qiladi. Yozda 0.85, qishda 1.15 kabi.
 */
function computeSeasonality(history: MonthlyStat[], trend: Trend): number[] {
  const sums = new Array(12).fill(0)
  const counts = new Array(12).fill(0)

  history.forEach((month, index) => {
    const expected = trend.at(index)
    if (expected <= 0) return
    const monthIndex = Number(month.period.slice(5, 7)) - 1
    sums[monthIndex] += month.revenue / expected
    counts[monthIndex] += 1
  })

  return sums.map((sum, i) => (counts[i] > 0 ? sum / counts[i] : 1))
}

/** Tendensiyadan o'rtacha chetlanish — ishonch oralig'i uchun */
function residualSpread(values: number[], trend: Trend): number {
  if (values.length < 2) return 0
  const squared = values.reduce((sum, v, i) => sum + Math.pow(v - trend.at(i), 2), 0)
  return Math.sqrt(squared / values.length)
}

function actualPoint(period: string, value: number): ForecastPoint {
  return { period, label: humanPeriod(period), actual: value, forecast: null, low: null, high: null }
}

function forecastPoint(period: string, value: number, margin: number): ForecastPoint {
  return {
    period,
    label: humanPeriod(period),
    actual: null,
    forecast: value,
    low: Math.max(0, value - margin),
    high: value + margin,
  }
}

/** "2026-09" -> "sen 26" */
function humanPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return `${monthsShort()[month - 1]} ${String(year).slice(2)}`
}

/** Davrni n oyga surish */
function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function emptyForecast(horizon: ForecastHorizon): Forecast {
  return {
    horizon,
    basedOnMonths: 0,
    revenue: [],
    expenses: [],
    profit: [],
    totals: { revenue: 0, expenses: 0, profit: 0 },
    growthRate: 0,
    confidence: 0,
    risk: 'ok',
    warnings: [
      { key: 'forecast.warn.notEnoughData', vars: {}, severity: 'warn' },
    ],
    firstLossPeriod: null,
    breakEvenGap: 0,
  }
}

/* ------------------------------------------------------------------ */
/* Oylik tarix                                                         */
/* ------------------------------------------------------------------ */

// GET /reports/monthly
export async function getMonthlyStats(): Promise<MonthlyStat[]> {
  if (!USE_MOCK) return request<MonthlyStat[]>('GET', '/reports/monthly')

  return delay(
    getDb()
      .monthlyStats.all(apiContext().clinicId)
      .sort((a, b) => a.period.localeCompare(b.period)),
  )
}

/** Prognoz jadvalini CSV uchun tayyorlash */
export function forecastToRows(forecast: Forecast): (string | number)[][] {
  const rows: (string | number)[][] = [
    ['Davr', 'Daromad', 'Xarajat', 'Foyda', 'Turi'],
  ]

  forecast.revenue.forEach((point, index) => {
    const expense = forecast.expenses[index]
    const profit = forecast.profit[index]
    const isActual = point.actual !== null

    rows.push([
      point.label,
      (isActual ? point.actual : point.forecast) ?? 0,
      (isActual ? expense.actual : expense.forecast) ?? 0,
      (isActual ? profit.actual : profit.forecast) ?? 0,
      isActual ? 'haqiqiy' : 'prognoz',
    ])
  })

  return rows
}
