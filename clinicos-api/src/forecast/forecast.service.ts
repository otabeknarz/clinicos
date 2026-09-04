import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

/**
 * MOLIYAVIY PROGNOZ.
 *
 * Oddiy chiziqli trend: oxirgi oylar tushumidan o'sish sur'ati
 * hisoblanadi va oldinga cho'ziladi.
 *
 * MUHIM: bu TAXMIN, va'da emas. Interfeysda ham shunday yozilgan.
 * Murakkabroq model (mavsumiylik, tashqi omillar) hozircha
 * ortiqcha: klinikada bir-ikki yillik tarix bo'lmasa, u shovqinni
 * bashorat qilib beradi, xolos.
 *
 * DASTURCHIGA: xarajatlar jadvali qo'shilgandan keyin `expenses`
 * haqiqiy raqamga o'tkazilsin — hozir u tushumning ulushi
 * sifatida taxmin qilinadi.
 */
const EXPENSE_SHARE = 0.32

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /** Oylik tarix — prognoz ham, hisobot ham shunga tayanadi */
  async monthly() {
    const from = new Date()
    from.setMonth(from.getMonth() - 17)
    from.setDate(1)
    from.setHours(0, 0, 0, 0)

    const [payments, patients, appointments] = await Promise.all([
      this.db.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: from } },
        select: { amount: true, paidAt: true },
      }),
      this.db.patient.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.db.appointment.findMany({
        where: { startsAt: { gte: from } },
        select: { startsAt: true, patientId: true },
      }),
    ])

    const months = new Map<
      string,
      { revenue: number; newPatients: number; appointments: number; patients: Set<string> }
    >()
    const bucket = (key: string) => {
      const existing = months.get(key)
      if (existing) return existing
      const created = {
        revenue: 0,
        newPatients: 0,
        appointments: 0,
        patients: new Set<string>(),
      }
      months.set(key, created)
      return created
    }

    for (const p of payments) bucket(monthKey(p.paidAt)).revenue += p.amount
    for (const p of patients) bucket(monthKey(p.createdAt)).newPatients += 1
    for (const a of appointments) {
      const b = bucket(monthKey(a.startsAt))
      b.appointments += 1
      b.patients.add(a.patientId)
    }

    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, m]) => ({
        period,
        revenue: m.revenue,
        // Taxminiy — yuqoridagi izohga qarang
        expenses: Math.round(m.revenue * EXPENSE_SHARE),
        patients: m.patients.size,
        newPatients: m.newPatients,
        appointments: m.appointments,
      }))
  }

  async forecast(horizon: number) {
    const history = await this.monthly()

    // Oxirgi olti oy trendni belgilaydi
    const growth = averageGrowth(history.slice(-6).map((h) => h.revenue))

    /*
      Uchta qator: daromad, xarajat va foyda.

      Interfeys ularni alohida chiziq qilib chizadi, shuning uchun
      bittasini qaytarish yetarli emas.
    */
    const revenue = buildSeries(
      history.map((h) => [h.period, h.revenue] as const),
      growth,
      horizon,
    )
    const expenses = buildSeries(
      history.map((h) => [h.period, h.expenses] as const),
      growth,
      horizon,
    )

    const profit: ForecastPoint[] = revenue.map((point, i) => {
      const cost = expenses[i]
      return {
        period: point.period,
        label: point.label,
        actual:
          point.actual === null || cost.actual === null
            ? null
            : point.actual - cost.actual,
        forecast:
          point.forecast === null || cost.forecast === null
            ? null
            : point.forecast - cost.forecast,
        // Eng yomon holat: daromad past, xarajat yuqori
        low: point.low === null || cost.high === null ? null : point.low - cost.high,
        high: point.high === null || cost.low === null ? null : point.high - cost.low,
      }
    })

    const futureSum = (points: ForecastPoint[]) =>
      points.reduce((sum, p) => sum + (p.forecast ?? 0), 0)

    /*
      Ishonchlilik tarix uzunligiga bog'liq: uch oylik ma'lumot
      bilan qilingan prognoz o'n sakkiz oylikdan ancha shubhali.
      Bitta raqam ko'rsatilsa, u aniqdek tuyulardi.
    */
    const confidence = Math.max(10, Math.min(90, history.length * 5))

    const firstLoss = profit.find((p) => p.forecast !== null && p.forecast < 0)

    const warnings: {
      key: string
      vars: Record<string, string | number>
      severity: 'warn' | 'bad'
    }[] = []

    if (history.length < 3) {
      warnings.push({ key: 'forecast.warn.notEnoughData', vars: {}, severity: 'warn' })
    }
    if (firstLoss) {
      warnings.push({
        key: 'forecast.warn.loss',
        vars: { period: firstLoss.period },
        severity: 'bad',
      })
    }
    if (growth < 0) {
      warnings.push({
        key: 'forecast.warn.declining',
        vars: { pct: Math.round(growth * 1000) / 10 },
        severity: 'warn',
      })
    }
    if (confidence < 40) {
      warnings.push({
        key: 'forecast.warn.lowConfidence',
        vars: { pct: confidence },
        severity: 'warn',
      })
    }

    return {
      horizon,
      basedOnMonths: history.length,
      revenue,
      expenses,
      profit,
      totals: {
        revenue: futureSum(revenue),
        expenses: futureSum(expenses),
        profit: futureSum(profit),
      },
      growthRate: Math.round(growth * 1000) / 10,
      confidence,
      risk: firstLoss ? 'alert' : growth < 0 ? 'watch' : 'ok',
      warnings,
      firstLossPeriod: firstLoss?.period ?? null,
      // Zararni yopish uchun kerakli qo'shimcha oylik tushum
      breakEvenGap: firstLoss ? Math.abs(firstLoss.forecast ?? 0) : 0,
    }
  }
}

/** Bitta oy uchun prognoz qiymati */
interface ForecastPoint {
  period: string
  label: string
  actual: number | null
  forecast: number | null
  low: number | null
  high: number | null
}

/**
 * Tarix va prognozni BITTA qatorga birlashtiradi.
 *
 * `actual` bo'lsa — bo'lib o'tgan oy, `forecast` bo'lsa — kelajak.
 * Interfeys ikkalasini uzluksiz chiziq qilib chizadi, shuning
 * uchun ular alohida emas, bir massivda keladi.
 */
function buildSeries(
  history: readonly (readonly [string, number])[],
  growth: number,
  horizon: number,
): ForecastPoint[] {
  const rows: ForecastPoint[] = history.map(([period, value]) => ({
    period,
    label: period,
    actual: value,
    forecast: null,
    low: null,
    high: null,
  }))

  const cursor = history.length
    ? new Date(history[history.length - 1][0] + '-01T00:00:00')
    : new Date()

  let value = history.length ? history[history.length - 1][1] : 0

  for (let i = 0; i < horizon; i++) {
    cursor.setMonth(cursor.getMonth() + 1)
    value = Math.round(value * (1 + growth))

    /*
      Ishonch oralig'i uzoqlashgan sari kengayadi: uch oydan
      keyingi raqam bir oydan keyingisidan ancha noaniq.
    */
    const spread = 0.08 * (i + 1)
    rows.push({
      period: monthKey(cursor),
      label: monthKey(cursor),
      actual: null,
      forecast: value,
      low: Math.round(value * (1 - spread)),
      high: Math.round(value * (1 + spread)),
    })
  }

  return rows
}

/**
 * O'rtacha oylik o'sish.
 *
 * Chegaralangan: ±20%. Bitta g'alati oy (masalan bitta yirik
 * to'lov) trendni buzib, prognozni ma'nosiz raqamga olib
 * chiqmasligi kerak.
 */
function averageGrowth(values: number[]): number {
  if (values.length < 2) return 0

  const rates: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) rates.push((values[i] - values[i - 1]) / values[i - 1])
  }
  if (rates.length === 0) return 0

  const avg = rates.reduce((s, r) => s + r, 0) / rates.length
  return Math.max(-0.2, Math.min(0.2, avg))
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}
