import { Injectable } from '@nestjs/common'

import { toApi, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'

/**
 * REGISTRATURA PANELI.
 *
 * Bitta so'rovda butun ish kuni: kim kutyapti, kimga qo'ng'iroq
 * qilish kerak, kimdan pul olinmagan, kassada qancha bor.
 *
 * NEGA BITTA SO'ROV: registrator sahifasi har necha daqiqada
 * yangilanadi. O'nta alohida so'rov bo'lsa, klinika internetida
 * bu sezilarli kechikish beradi.
 */
@Injectable()
export class ReceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async summary() {
    const { userId } = this.ctx.require()
    const now = new Date()
    const from = startOfDay(now)
    const to = endOfDay(now)

    const appointments = await this.db.appointment.findMany({
      where: { startsAt: { gte: from, lte: to } },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            paymentTiming: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    })

    /*
      To'langan summalar bir so'rovda olinadi.

      Har bir qabul uchun alohida so'rov yuborilsa, 60 ta qabulda
      60 ta so'rov bo'lardi — panel har yangilanganda.
    */
    const paidRows = await this.db.payment.groupBy({
      by: ['appointmentId'],
      where: {
        status: 'PAID',
        appointmentId: { in: appointments.map((a) => a.id) },
      },
      _sum: { amount: true },
    })
    const paidByAppointment = new Map(
      paidRows.map((r) => [r.appointmentId, r._sum.amount ?? 0]),
    )

    const toQueueItem = (a: (typeof appointments)[number]) => {
      const prepaid = a.service.paymentTiming === 'PREPAID'
      const paid = paidByAppointment.get(a.id) ?? 0
      return {
        appointmentId: a.id,
        patientId: a.patientId,
        patientName: a.patient.fullName,
        patientPhone: a.patient.phone,
        doctorId: a.doctorId,
        doctorName: a.doctor.fullName,
        serviceId: a.serviceId,
        serviceName: a.service.name,
        startsAt: toApiDateTime(a.startsAt)!,
        checkedInAt: toApiDateTime(a.checkedInAt),
        waitingMinutes: a.checkedInAt
          ? Math.max(0, Math.round((now.getTime() - a.checkedInAt.getTime()) / 60_000))
          : 0,
        delayMinutes: Math.round((now.getTime() - a.startsAt.getTime()) / 60_000),
        status: toApi(a.status),
        paymentStatus: toApi(a.paymentStatus),
        prepaid,
        // Ko'rsatiladigan summa — hali to'lanmagan qismi
        price: Math.max(0, a.service.price - paid),
      }
    }

    const waiting = appointments
      .filter((a) => a.status === 'CHECKED_IN')
      // Eng uzoq kutgan tepada — registrator "kim keyingi" deb o'ylamasin
      .sort((x, y) => (x.checkedInAt?.getTime() ?? 0) - (y.checkedInAt?.getTime() ?? 0))
      .map(toQueueItem)

    const upcoming = appointments
      .filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
      .map(toQueueItem)

    /* --- E'tibor talab qiladiganlar --- */

    const unpaidRows = appointments.filter(
      (a) => a.status === 'COMPLETED' && a.paymentStatus !== 'PAID',
    )
    const prepaidUnpaidRows = appointments.filter(
      (a) =>
        a.service.paymentTiming === 'PREPAID' &&
        a.checkedInAt !== null &&
        a.status !== 'COMPLETED' &&
        a.status !== 'CANCELLED' &&
        a.paymentStatus !== 'PAID',
    )

    const owed = (a: (typeof appointments)[number]) =>
      Math.max(0, a.service.price - (paidByAppointment.get(a.id) ?? 0))

    const [followUps, staffTotal, markedToday, shift, cashRows] = await Promise.all([
      this.db.followUp.count({
        where: { status: 'PENDING', recommendedDate: { lte: to } },
      }),
      this.db.staff.count({ where: { status: 'ACTIVE' } }),
      this.db.attendance.count({ where: { date: from } }),
      this.db.shiftClosure.findFirst({
        where: { userId, date: from },
        select: { id: true },
      }),
      this.db.payment.groupBy({
        by: ['method'],
        where: { status: 'PAID', paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ])

    const cashByMethod = new Map(cashRows.map((r) => [r.method, r._sum.amount ?? 0]))
    const cash = cashByMethod.get('CASH') ?? 0
    const card = cashByMethod.get('CARD') ?? 0
    const transfer = cashByMethod.get('TRANSFER') ?? 0

    return {
      waiting,
      upcoming,
      today: {
        total: appointments.length,
        completed: appointments.filter((a) => a.status === 'COMPLETED').length,
        remaining: appointments.filter(
          (a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED' || a.status === 'CHECKED_IN',
        ).length,
        noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
        cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      },
      attention: {
        unconfirmed: appointments.filter((a) => a.status === 'SCHEDULED').length,
        unpaid: {
          count: unpaidRows.length,
          amount: unpaidRows.reduce((sum, a) => sum + owed(a), 0),
        },
        prepaidUnpaid: {
          count: prepaidUnpaidRows.length,
          amount: prepaidUnpaidRows.reduce((sum, a) => sum + owed(a), 0),
        },
        unmarkedAttendance: Math.max(0, staffTotal - markedToday),
        followUps,
      },
      cash: {
        cash,
        card,
        transfer,
        total: cash + card + transfer,
        shiftClosed: shift !== null,
      },
    }
  }
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
