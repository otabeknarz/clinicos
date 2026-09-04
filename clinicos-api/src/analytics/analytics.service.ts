import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { RangeDto, RevenuePeriodDto } from './analytics.dto'

/**
 * TAHLIL.
 *
 * Barcha raqamlar HAR SAFAR bazadan hisoblanadi. Saqlangan
 * yig'ma jadval yo'q: u eskirib qolsa, egasi noto'g'ri raqamga
 * qarab qaror qabul qilardi va buni sezmasdi ham.
 *
 * DASTURCHIGA: klinika kattalashib, bu so'rovlar sekinlashsa —
 * `docs/DATABASE.md` dagi `DailyStat` jadvalini qo'shing va uni
 * tunda to'ldiring. Hozircha kerak emas.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async dashboard() {
    const now = new Date()
    const todayFrom = startOfDay(now)
    const todayTo = endOfDay(now)
    const yFrom = startOfDay(addDays(now, -1))
    const yTo = endOfDay(addDays(now, -1))

    const [today, yesterday, revToday, revYesterday, patients] = await Promise.all([
      this.db.appointment.findMany({
        where: { startsAt: { gte: todayFrom, lte: todayTo } },
        select: { status: true, patientId: true },
      }),
      this.db.appointment.findMany({
        where: { startsAt: { gte: yFrom, lte: yTo } },
        select: { status: true, patientId: true },
      }),
      this.sumPaid(todayFrom, todayTo),
      this.sumPaid(yFrom, yTo),
      this.db.patient.findMany({
        where: { createdAt: { gte: todayFrom, lte: todayTo } },
        select: { id: true },
      }),
    ])

    const uniq = (rows: { patientId: string }[]) =>
      new Set(rows.map((r) => r.patientId)).size

    const remaining = today.filter(
      (a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED' || a.status === 'CHECKED_IN',
    ).length

    // Bugun kelganlardan qaysilari ilgari ham bo'lgan
    const todayPatientIds = [...new Set(today.map((a) => a.patientId))]
    const returningCount = todayPatientIds.length
      ? await this.db.visit.groupBy({
          by: ['patientId'],
          where: { patientId: { in: todayPatientIds }, visitedAt: { lt: todayFrom } },
        })
      : []

    return {
      patientsToday: metric(uniq(today), uniq(yesterday)),
      revenueToday: metric(revToday, revYesterday),
      appointmentsToday: metric(today.length, yesterday.length),
      appointmentsRemaining: remaining,
      newPatients: metric(patients.length, 0),
      returningPatients: metric(returningCount.length, 0),
      noShows: metric(
        today.filter((a) => a.status === 'NO_SHOW').length,
        yesterday.filter((a) => a.status === 'NO_SHOW').length,
      ),
    }
  }

  async revenueSeries(query: RevenuePeriodDto) {
    const now = new Date()
    const days = query.period === 'today' ? 1 : query.period === 'week' ? 7 : 30
    const from = startOfDay(addDays(now, -(days - 1)))

    const rows = await this.db.payment.findMany({
      where: { status: 'PAID', paidAt: { gte: from, lte: endOfDay(now) } },
      select: { amount: true, paidAt: true },
    })

    const byDay = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      byDay.set(addDays(from, i).toISOString().slice(0, 10), 0)
    }
    for (const r of rows) {
      const key = r.paidAt.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + r.amount)
    }

    return [...byDay.entries()].map(([label, value]) => ({ label, value }))
  }

  /**
   * Klinika ko'rsatkichlari va maqsadlar.
   *
   * DASTURCHIGA: maqsadlar hozircha oxirgi 30 kun natijasidan
   * kelib chiqib qo'yilyapti. Egasi ularni o'zi belgilaydigan
   * bo'lsa, `Clinic` jadvaliga maydon qo'shing.
   */
  async performance() {
    const now = new Date()
    const from = startOfDay(addDays(now, -29))
    const to = endOfDay(now)

    const [appointments, payments] = await Promise.all([
      this.db.appointment.findMany({
        where: { startsAt: { gte: from, lte: to } },
        select: { status: true, patientId: true },
      }),
      this.db.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: from, lte: to } },
        select: { amount: true },
      }),
    ])

    const revenue = payments.reduce((s, p) => s + p.amount, 0)
    const patients = new Set(appointments.map((a) => a.patientId)).size
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length

    const counts = new Map<string, number>()
    for (const a of appointments) {
      counts.set(a.patientId, (counts.get(a.patientId) ?? 0) + 1)
    }
    const returning = [...counts.values()].filter((c) => c > 1).length

    const noShowRate = appointments.length
      ? Math.round((noShow / appointments.length) * 1000) / 10
      : 0
    const returningRate = patients ? Math.round((returning / patients) * 1000) / 10 : 0
    const averageCheck = payments.length ? Math.round(revenue / payments.length) : 0

    return {
      patients,
      revenue,
      appointments: appointments.length,
      averageCheck,
      returningRate,
      noShowRate,
      targets: {
        // Maqsad: hozirgidan 10% yaxshiroq
        patients: Math.round(patients * 1.1),
        revenue: Math.round(revenue * 1.1),
        appointments: Math.round(appointments.length * 1.1),
        averageCheck: Math.round(averageCheck * 1.1),
        returningRate: Math.min(100, Math.round(returningRate * 1.1)),
        // Kelmaganlar kamaysin
        noShowRate: Math.round(noShowRate * 0.9 * 10) / 10,
      },
    }
  }

  async report(query: RangeDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))
    const spanDays = Math.max(
      1,
      Math.round((to.getTime() - from.getTime()) / 86_400_000),
    )
    const prevFrom = addDays(from, -spanDays)
    const prevTo = addDays(to, -spanDays)

    const [appointments, payments, prevPayments, patients, prevPatients] =
      await Promise.all([
        this.db.appointment.findMany({
          where: { startsAt: { gte: from, lte: to } },
          select: { status: true, patientId: true, startsAt: true },
        }),
        this.db.payment.findMany({
          where: { status: 'PAID', paidAt: { gte: from, lte: to } },
          include: {
            doctor: { select: { id: true, fullName: true } },
            service: { select: { id: true, name: true } },
          },
        }),
        this.db.payment.findMany({
          where: { status: 'PAID', paidAt: { gte: prevFrom, lte: prevTo } },
          select: { amount: true },
        }),
        this.db.patient.findMany({
          where: { createdAt: { gte: from, lte: to } },
          select: { createdAt: true },
        }),
        this.db.patient.count({
          where: { createdAt: { gte: prevFrom, lte: prevTo } },
        }),
      ])

    const revenue = payments.reduce((s, p) => s + p.amount, 0)
    const prevRevenue = prevPayments.reduce((s, p) => s + p.amount, 0)

    const counts = new Map<string, number>()
    for (const a of appointments) {
      counts.set(a.patientId, (counts.get(a.patientId) ?? 0) + 1)
    }
    const returning = [...counts.values()].filter((c) => c > 1).length
    const completed = appointments.filter((a) => a.status === 'COMPLETED').length
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length

    return {
      patientGrowth: series(patients.map((p) => p.createdAt), from, to, () => 1),
      revenueGrowth: series(
        payments.map((p) => p.paidAt),
        from,
        to,
        (i) => payments[i].amount,
      ),
      appointmentsSeries: series(
        appointments.map((a) => a.startsAt),
        from,
        to,
        () => 1,
      ),
      retentionSeries: [],
      newPatients: metric(patients.length, prevPatients),
      returningPatients: metric(returning, 0),
      conversionRate: metric(
        appointments.length ? Math.round((completed / appointments.length) * 1000) / 10 : 0,
        0,
      ),
      noShowRate: metric(
        appointments.length ? Math.round((noShow / appointments.length) * 1000) / 10 : 0,
        0,
      ),
      averageCheck: metric(
        payments.length ? Math.round(revenue / payments.length) : 0,
        prevPayments.length ? Math.round(prevRevenue / prevPayments.length) : 0,
      ),
      revenue: metric(revenue, prevRevenue),
      revenuePerDoctor: breakdown(
        payments.map((p) => [p.doctorId, p.doctor.fullName, p.amount] as const),
        revenue,
      ),
      revenuePerService: breakdown(
        payments.map((p) => [p.serviceId, p.service.name, p.amount] as const),
        revenue,
      ),
    }
  }

  private async sumPaid(from: Date, to: Date) {
    const r = await this.db.payment.aggregate({
      where: { status: 'PAID', paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    })
    return r._sum.amount ?? 0
  }
}

/* ------------------------------------------------------------------ */

function metric(value: number, previous: number) {
  return {
    value,
    // Oldingi davr nol bo'lsa foiz o'zgarish ma'nosiz — null
    changePct: previous > 0 ? Math.round(((value - previous) / previous) * 1000) / 10 : null,
  }
}

function series(
  dates: Date[],
  from: Date,
  to: Date,
  valueAt: (index: number) => number,
) {
  const byDay = new Map<string, number>()
  const cursor = startOfDay(from)
  while (cursor <= to && byDay.size < 400) {
    byDay.set(cursor.toISOString().slice(0, 10), 0)
    cursor.setDate(cursor.getDate() + 1)
  }
  dates.forEach((d, i) => {
    const key = d.toISOString().slice(0, 10)
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + valueAt(i))
  })
  return [...byDay.entries()].map(([label, value]) => ({ label, value }))
}

function breakdown(rows: readonly (readonly [string, string, number])[], total: number) {
  const map = new Map<string, { label: string; value: number }>()
  for (const [id, label, amount] of rows) {
    const acc = map.get(id) ?? { label, value: 0 }
    acc.value += amount
    map.set(id, acc)
  }
  return [...map.entries()]
    .map(([id, a]) => ({
      id,
      label: a.label,
      value: a.value,
      sharePct: total ? Math.round((a.value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
