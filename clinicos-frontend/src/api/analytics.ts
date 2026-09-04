/**
 * Bosh sahifa ko'rsatkichlari va analitika.
 *
 * RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
 * rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
 * `analytics.view` — faqat egasi.
 *
 * Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
 * har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
 * yoki materialized view ishlatish tavsiya etiladi.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
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
  AnalyticsReport,
  Appointment,
  ClinicPerformance,
  DashboardSummary,
  DateRange,
  Metric,
  Payment,
  RevenueBreakdownItem,
  SeriesPoint,
} from '@/types/models'

export type RevenuePeriod = 'today' | 'week' | 'month'

/* ------------------------------------------------------------------ */
/* Bosh sahifa KPI                                                     */
/* ------------------------------------------------------------------ */

// GET /dashboard/summary
export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (!USE_MOCK) return request<DashboardSummary>('GET', '/dashboard/summary')

  const { appointments, payments, patients } = scopedData()
  const now = new Date()

  const todayStart = startOfDay(now).getTime()
  const todayEnd = endOfDay(now).getTime()

  // Kecha bilan solishtirganda TO'LIQ kunni emas, kechagi SHU VAQTGACHA
  // bo'lgan qismini olamiz. Aks holda ertalab soat 10 da har bir
  // ko'rsatkich qizil bo'lib chiqadi — bu noto'g'ri xulosa beradi.
  const yStart = startOfDay(addDays(now, -1)).getTime()
  const yEnd = yStart + (now.getTime() - todayStart)

  const inWindow = (iso: string, from: number, to: number) => {
    const t = new Date(iso).getTime()
    return t >= from && t <= to
  }

  const todayAppts = appointments.filter((a) => inWindow(a.startsAt, todayStart, todayEnd))
  const yAppts = appointments.filter((a) => inWindow(a.startsAt, yStart, yEnd))

  const seenToday = todayAppts.filter((a) => a.status === 'completed')
  const seenYesterday = yAppts.filter((a) => a.status === 'completed')

  const revToday = payments
    .filter((p) => p.status === 'paid' && inWindow(p.paidAt, todayStart, todayEnd))
    .reduce((sum, p) => sum + p.amount, 0)
  const revYesterday = payments
    .filter((p) => p.status === 'paid' && inWindow(p.paidAt, yStart, yEnd))
    .reduce((sum, p) => sum + p.amount, 0)

  // Yangi bemor — bugun ro'yxatdan o'tgan
  const newToday = patients.filter((p) => inWindow(p.createdAt, todayStart, todayEnd)).length
  const newYesterday = patients.filter((p) => inWindow(p.createdAt, yStart, yEnd)).length

  // Qaytgan — bugun kelganlar ichida avval ham tashrifi bo'lganlar
  const priorPatients = new Set(
    appointments
      .filter((a) => a.status === 'completed' && new Date(a.startsAt).getTime() < todayStart)
      .map((a) => a.patientId),
  )
  const returningToday = seenToday.filter((a) => priorPatients.has(a.patientId)).length
  const returningYesterday = seenYesterday.filter((a) => priorPatients.has(a.patientId)).length

  const noShowToday = todayAppts.filter((a) => a.status === 'no_show').length
  const noShowYesterday = yAppts.filter((a) => a.status === 'no_show').length

  const remaining = todayAppts.filter(
    (a) => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'checked_in',
  ).length

  return delay({
    patientsToday: metric(seenToday.length, seenYesterday.length),
    revenueToday: metric(revToday, revYesterday),
    appointmentsToday: metric(todayAppts.length, yAppts.length),
    appointmentsRemaining: remaining,
    newPatients: metric(newToday, newYesterday),
    returningPatients: metric(returningToday, returningYesterday),
    noShows: metric(noShowToday, noShowYesterday),
  })
}

/* ------------------------------------------------------------------ */
/* Daromad grafigi (bosh sahifa)                                       */
/* ------------------------------------------------------------------ */

// GET /dashboard/revenue?period=today|week|month
export async function getRevenueSeries(period: RevenuePeriod): Promise<SeriesPoint[]> {
  if (!USE_MOCK) {
    return request<SeriesPoint[]>('GET', '/dashboard/revenue', { query: { period } })
  }

  const { payments } = scopedData()
  const paid = payments.filter((p) => p.status === 'paid')
  const now = new Date()

  if (period === 'today') {
    // Soatlar bo'yicha, klinika ish vaqti
    const points: SeriesPoint[] = []
    for (let hour = 8; hour <= 19; hour++) {
      const value = paid
        .filter((p) => {
          const d = new Date(p.paidAt)
          return startOfDay(d).getTime() === startOfDay(now).getTime() && d.getHours() === hour
        })
        .reduce((sum, p) => sum + p.amount, 0)
      points.push({ label: `${String(hour).padStart(2, '0')}:00`, value })
    }
    return delay(points, 140)
  }

  const days = period === 'week' ? 7 : 30
  const points = eachDay(addDays(now, -(days - 1)), now).map((day) => ({
    label: dateCompact(day),
    value: paid
      .filter((p) => toISODate(new Date(p.paidAt)) === toISODate(day))
      .reduce((sum, p) => sum + p.amount, 0),
  }))

  return delay(points, 140)
}

/* ------------------------------------------------------------------ */
/* Klinika ko'rsatkichlari                                             */
/* ------------------------------------------------------------------ */

// GET /dashboard/performance
export async function getClinicPerformance(): Promise<ClinicPerformance> {
  if (!USE_MOCK) return request<ClinicPerformance>('GET', '/dashboard/performance')

  const { appointments, payments } = scopedData()
  const monthStart = startOfDay(addDays(new Date(), -29)).getTime()

  const monthly = appointments.filter((a) => new Date(a.startsAt).getTime() >= monthStart)
  const completed = monthly.filter((a) => a.status === 'completed')
  const noShow = monthly.filter((a) => a.status === 'no_show')

  const revenue = payments
    .filter((p) => p.status === 'paid' && new Date(p.paidAt).getTime() >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0)

  const patientIds = completed.map((a) => a.patientId)
  const uniquePatients = new Set(patientIds).size
  const returning = patientIds.length - uniquePatients

  const averageCheck = completed.length ? Math.round(revenue / completed.length) : 0

  return delay({
    patients: uniquePatients,
    revenue,
    appointments: monthly.length,
    averageCheck,
    returningRate: patientIds.length ? (returning / patientIds.length) * 100 : 0,
    noShowRate: monthly.length ? (noShow.length / monthly.length) * 100 : 0,
    // Maqsadlar — demo uchun statik. Haqiqiy tizimda egasi sozlamalarda belgilaydi.
    targets: {
      patients: 900,
      revenue: 320_000_000,
      appointments: 1200,
      averageCheck: 200_000,
      returningRate: 45,
      noShowRate: 5,
    },
  })
}

/* ------------------------------------------------------------------ */
/* To'liq analitika hisoboti                                           */
/* ------------------------------------------------------------------ */

// GET /reports/analytics?from=&to=
export async function getAnalyticsReport(range: DateRange): Promise<AnalyticsReport> {
  if (!USE_MOCK) {
    return request<AnalyticsReport>('GET', '/reports/analytics', {
      query: { from: range.from, to: range.to },
    })
  }

  const { appointments, payments, patients } = scopedData()
  const db = getDb()
  const { clinicId } = apiContext()

  const from = startOfDay(fromISODate(range.from)).getTime()
  const to = endOfDay(fromISODate(range.to)).getTime()
  const spanDays = Math.max(1, Math.round((to - from) / 86_400_000))

  const prevFrom = from - spanDays * 86_400_000
  const prevTo = from - 1

  const inRange = (iso: string, a: number, b: number) => {
    const t = new Date(iso).getTime()
    return t >= a && t <= b
  }

  const apptsNow = appointments.filter((a) => inRange(a.startsAt, from, to))
  const apptsPrev = appointments.filter((a) => inRange(a.startsAt, prevFrom, prevTo))

  const paidNow = payments.filter((p) => p.status === 'paid' && inRange(p.paidAt, from, to))
  const paidPrev = payments.filter((p) => p.status === 'paid' && inRange(p.paidAt, prevFrom, prevTo))

  const revenueNow = paidNow.reduce((s, p) => s + p.amount, 0)
  const revenuePrev = paidPrev.reduce((s, p) => s + p.amount, 0)

  const completedNow = apptsNow.filter((a) => a.status === 'completed')
  const completedPrev = apptsPrev.filter((a) => a.status === 'completed')

  const newNow = patients.filter((p) => inRange(p.createdAt, from, to)).length
  const newPrev = patients.filter((p) => inRange(p.createdAt, prevFrom, prevTo)).length

  const returningNow = countReturning(completedNow, from)
  const returningPrev = countReturning(completedPrev, prevFrom)

  const noShowNow = apptsNow.filter((a) => a.status === 'no_show').length
  const noShowPrev = apptsPrev.filter((a) => a.status === 'no_show').length

  const noShowRateNow = apptsNow.length ? (noShowNow / apptsNow.length) * 100 : 0
  const noShowRatePrev = apptsPrev.length ? (noShowPrev / apptsPrev.length) * 100 : 0

  const conversionNow = apptsNow.length ? (completedNow.length / apptsNow.length) * 100 : 0
  const conversionPrev = apptsPrev.length ? (completedPrev.length / apptsPrev.length) * 100 : 0

  const avgNow = completedNow.length ? revenueNow / completedNow.length : 0
  const avgPrev = completedPrev.length ? revenuePrev / completedPrev.length : 0

  /* --- Vaqt qatorlari --- */
  const days = eachDay(fromISODate(range.from), fromISODate(range.to))
  const weekly = days.length > 45

  const bucketLabel = (d: Date) => (weekly ? dateCompact(startOfWeek(d)) : dateCompact(d))
  const bucketKey = (d: Date) => (weekly ? toISODate(startOfWeek(d)) : toISODate(d))

  const buckets = new Map<string, string>()
  for (const day of days) buckets.set(bucketKey(day), bucketLabel(day))

  const series = (rows: { date: string }[]): SeriesPoint[] => {
    const counts = new Map<string, number>()
    for (const key of buckets.keys()) counts.set(key, 0)
    for (const row of rows) {
      const key = bucketKey(new Date(row.date))
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: buckets.get(key) ?? key, value }))
  }

  const revenueSeries: SeriesPoint[] = (() => {
    const sums = new Map<string, number>()
    for (const key of buckets.keys()) sums.set(key, 0)
    for (const p of paidNow) {
      const key = bucketKey(new Date(p.paidAt))
      if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + p.amount)
    }
    return [...sums.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: buckets.get(key) ?? key, value }))
  })()

  /* --- Ushlab qolish: har bucketda takroriy bemorlar ulushi --- */
  const retentionSeries: SeriesPoint[] = (() => {
    const totals = new Map<string, { total: number; repeat: number }>()
    for (const key of buckets.keys()) totals.set(key, { total: 0, repeat: 0 })

    const seen = new Set<string>()
    for (const a of [...completedNow].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
      const key = bucketKey(new Date(a.startsAt))
      const bucket = totals.get(key)
      if (!bucket) continue
      bucket.total++
      if (seen.has(a.patientId)) bucket.repeat++
      seen.add(a.patientId)
    }

    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        label: buckets.get(key) ?? key,
        value: v.total ? Math.round((v.repeat / v.total) * 100) : 0,
      }))
  })()

  const doctorNames = new Map(db.doctors.all(clinicId).map((d) => [d.id, d.fullName]))
  const serviceNames = new Map(db.services.all(clinicId).map((s) => [s.id, s.name]))

  return delay({
    patientGrowth: series(patients.map((p) => ({ date: p.createdAt }))),
    revenueGrowth: revenueSeries,
    appointmentsSeries: series(apptsNow.map((a) => ({ date: a.startsAt }))),
    retentionSeries,
    newPatients: metric(newNow, newPrev),
    returningPatients: metric(returningNow, returningPrev),
    conversionRate: metric(conversionNow, conversionPrev),
    noShowRate: metric(noShowRateNow, noShowRatePrev),
    averageCheck: metric(Math.round(avgNow), Math.round(avgPrev)),
    revenue: metric(revenueNow, revenuePrev),
    revenuePerDoctor: share(paidNow, (p) => p.doctorId, doctorNames, revenueNow),
    revenuePerService: share(paidNow, (p) => p.serviceId, serviceNames, revenueNow),
  })
}

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */

/** Rolga qarab cheklangan ma'lumot to'plami */
function scopedData() {
  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const appointments = db.appointments
    .all(clinicId)
    .filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)

  const payments = db.payments
    .all(clinicId)
    .filter((p) => !scopeDoctorId || p.doctorId === scopeDoctorId)

  const patients = db.patients.all(clinicId)

  return { appointments, payments, patients }
}

function metric(current: number, previous: number): Metric {
  if (previous === 0) return { value: current, changePct: current === 0 ? 0 : null }
  return { value: current, changePct: ((current - previous) / previous) * 100 }
}

function countReturning(completed: Appointment[], since: number): number {
  const seen = new Set<string>()
  let repeat = 0
  for (const a of [...completed].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    if (new Date(a.startsAt).getTime() < since) continue
    if (seen.has(a.patientId)) repeat++
    seen.add(a.patientId)
  }
  return repeat
}

function share(
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
