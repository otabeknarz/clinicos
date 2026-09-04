/**
 * Registratura paneli.
 *
 * Bitta so'rovda kun davomida kerak bo'ladigan hamma narsa qaytadi:
 * navbat, bugungi hisob, e'tibor talab qiladigan ishlar va kassa.
 *
 * NEGA BITTA SO'ROV: registratura paneli har 30-60 soniyada yangilanib
 * turadi. Beshta alohida so'rov o'rniga bitta so'rov serverga ham,
 * tarmoqqa ham yengilroq.
 *
 * RUXSAT: `dashboard.view` + `appointments.view`.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { endOfDay, startOfDay, toISODate } from '@/lib/dates'
import type { ReceptionQueueItem, ReceptionSummary } from '@/types/models'

// GET /reception/summary
export async function getReceptionSummary(userId: string): Promise<ReceptionSummary> {
  if (!USE_MOCK) return request<ReceptionSummary>('GET', '/reception/summary')

  const { clinicId } = apiContext()
  const db = getDb()

  const now = new Date()
  const dayStart = startOfDay(now).getTime()
  const dayEnd = endOfDay(now).getTime()
  const todayKey = toISODate(now)

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))

  const todayAppointments = db.appointments.all(clinicId).filter((a) => {
    const t = new Date(a.startsAt).getTime()
    return t >= dayStart && t <= dayEnd
  })

  /** Qabulni panel uchun qatorga aylantirish */
  const toItem = (a: (typeof todayAppointments)[number]): ReceptionQueueItem => {
    const patient = patients.get(a.patientId)
    const startsAt = new Date(a.startsAt)

    return {
      appointmentId: a.id,
      patientId: a.patientId,
      patientName: patient?.fullName ?? '—',
      patientPhone: patient?.phone ?? '',
      doctorId: a.doctorId,
      doctorName: doctors.get(a.doctorId)?.fullName ?? '—',
      serviceId: a.serviceId,
      serviceName: services.get(a.serviceId)?.name ?? '—',
      startsAt: a.startsAt,
      checkedInAt: a.checkedInAt,
      waitingMinutes: a.checkedInAt
        ? Math.max(0, Math.round((now.getTime() - new Date(a.checkedInAt).getTime()) / 60_000))
        : 0,
      delayMinutes: Math.round((now.getTime() - startsAt.getTime()) / 60_000),
      status: a.status,
      paymentStatus: a.paymentStatus,
      prepaid: services.get(a.serviceId)?.paymentTiming === 'prepaid',
      price: services.get(a.serviceId)?.price ?? 0,
    }
  }

  /* --- Navbat: kelgan va shifokorni kutayotganlar --- */

  const waiting = todayAppointments
    .filter((a) => a.status === 'checked_in')
    .map(toItem)
    // Eng uzoq kutgan tepada — u birinchi kirishi kerak
    .sort((a, b) => b.waitingMinutes - a.waitingMinutes)

  /* --- Keyingi qabullar --- */

  const upcoming = todayAppointments
    .filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
    .map(toItem)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 12)

  /* --- Bugungi hisob --- */

  const completed = todayAppointments.filter((a) => a.status === 'completed').length
  const noShow = todayAppointments.filter((a) => a.status === 'no_show').length
  const cancelled = todayAppointments.filter((a) => a.status === 'cancelled').length

  /* --- E'tibor talab qiladiganlar --- */

  const unconfirmed = todayAppointments.filter((a) => a.status === 'scheduled').length

  const unpaidRows = todayAppointments.filter(
    (a) => a.status === 'completed' && a.paymentStatus !== 'paid',
  )
  const unpaidAmount = unpaidRows.reduce(
    (sum, a) => sum + (services.get(a.serviceId)?.price ?? 0),
    0,
  )

  /**
   * Oldindan to'lanadigan xizmatga kelgan, lekin to'lamagan bemorlar.
   *
   * Bu eng shoshilinch holat: bemor allaqachon klinikada, shifokorga
   * kirishi mumkin, lekin pul olinmagan.
   */
  const prepaidUnpaidRows = todayAppointments
    .filter((a) => a.status === 'checked_in' && a.paymentStatus !== 'paid')
    .filter((a) => services.get(a.serviceId)?.paymentTiming === 'prepaid')

  const prepaidUnpaidAmount = prepaidUnpaidRows.reduce(
    (sum, a) => sum + (services.get(a.serviceId)?.price ?? 0),
    0,
  )

  const followUps = db.followUps
    .all(clinicId)
    .filter((f) => f.status === 'pending' && f.recommendedDate <= todayKey).length

  /* --- Davomat: bugun ishlashi kerak, lekin belgilanmaganlar --- */

  const markedToday = new Set(
    db.attendance
      .all(clinicId)
      .filter((a) => a.date === todayKey)
      .map((a) => a.staffId),
  )

  const weekday = now.getDay()
  const unmarkedAttendance = db.staff
    .all(clinicId)
    .filter((person) => person.status === 'active')
    .filter((person) => person.workdays.includes(weekday))
    .filter((person) => !markedToday.has(person.id)).length

  /* --- Kassa --- */

  const todayPayments = db.payments
    .all(clinicId)
    .filter((p) => p.status === 'paid' && p.paidAt.slice(0, 10) === todayKey)
    // Faqat shu xodim qabul qilgan pul — smenani u topshiradi
    .filter((p) => p.createdBy === userId)

  const sumBy = (method: 'cash' | 'card' | 'transfer') =>
    todayPayments.filter((p) => p.method === method).reduce((sum, p) => sum + p.amount, 0)

  const cash = sumBy('cash')
  const card = sumBy('card')
  const transfer = sumBy('transfer')

  const shiftClosed = db.shiftClosures
    .all(clinicId)
    .some((c) => c.userId === userId && c.date === todayKey)

  return delay({
    waiting,
    upcoming,
    today: {
      total: todayAppointments.length,
      completed,
      remaining: todayAppointments.length - completed - noShow - cancelled,
      noShow,
      cancelled,
    },
    attention: {
      unconfirmed,
      unpaid: { count: unpaidRows.length, amount: unpaidAmount },
      prepaidUnpaid: { count: prepaidUnpaidRows.length, amount: prepaidUnpaidAmount },
      unmarkedAttendance,
      followUps,
    },
    cash: {
      cash,
      card,
      transfer,
      total: cash + card + transfer,
      shiftClosed,
    },
  })
}
