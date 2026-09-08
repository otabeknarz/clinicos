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
            priceMode: true,
          },
        },
        /*
          Narxni shifokor belgilaydigan xizmatda to'lanadigan summa
          katalogda emas, ko'rikda turadi. Ko'rik hali yozilmagan
          bo'lsa registrator "shifokor belgilamagan" holatini ko'radi.
        */
        visit: { select: { price: true } },
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

    /**
     * Xizmatning to'liq summasi.
     *
     * Narxni shifokor belgilaydigan xizmatda — ko'rikdagi summa.
     * Ko'rik yozilmagan bo'lsa 0: registrator hali pul ololmaydi,
     * chunki qancha olishini hech kim aytmagan.
     */
    const fullPrice = (a: (typeof appointments)[number]) =>
      a.service.priceMode === 'DOCTOR_SET' ? (a.visit?.price ?? 0) : a.service.price

    /*
      To'langan summa QAYSI jadvaldan olinishi chaqiruvchidan keladi.

      Navbat bugungi qabullarnikini ishlatadi, qarz ro'yxati esa
      o'zinikini — ular boshqa-boshqa so'rovdan keladi. Ilgari bitta
      jadval edi va eski qarzga "hech narsa to'lanmagan" deb qarardi.
    */
    const toQueueItem = (
      a: (typeof appointments)[number],
      paidMap: Map<string | null, number> = paidByAppointment,
    ) => {
      const prepaid = a.service.paymentTiming === 'PREPAID'
      const paid = paidMap.get(a.id) ?? 0
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
        price: Math.max(0, fullPrice(a) - paid),
        /** Summani shifokor belgilaganmi — interfeys shunga qarab yozadi */
        priceSetByDoctor: a.service.priceMode === 'DOCTOR_SET',
      }
    }

    const waiting = appointments
      .filter((a) => a.status === 'CHECKED_IN')
      // Eng uzoq kutgan tepada — registrator "kim keyingi" deb o'ylamasin
      .sort((x, y) => (x.checkedInAt?.getTime() ?? 0) - (y.checkedInAt?.getTime() ?? 0))
      .map((a) => toQueueItem(a))

    const upcoming = appointments
      .filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED')
      .map((a) => toQueueItem(a))

    /* --- E'tibor talab qiladiganlar --- */

    /*
      QARZ BUGUNGI KUN BILAN CHEKLANMAYDI.

      Yuqoridagi so'rov faqat BUGUNGI qabullarni oladi va u shunday
      bo'lib qolishi kerak: "bugun 47 qabul", navbat va kassa —
      hammasi bugungi. Qarz esa boshqa savol: kechagi ham, o'tgan
      haftadagi ham to'lanmagan bo'lishi mumkin.

      Ilgari bu ro'yxat ham bugungi qabullardan yig'ilardi, bildirishnoma
      esa hamma vaqtni sanardi — kechagi qarz bildirishnomada turib,
      panelda ko'rinmasdi.

      Shuning uchun ALOHIDA so'rov. Ikkalasini birlashtirmang: bitta
      so'rovga yig'ilsa, kunlik raqamlar buziladi.
    */
    const outstanding = await this.db.appointment.findMany({
      where: {
        status: 'COMPLETED',
        paymentStatus: { not: 'PAID' },
        debtWaiver: { is: null },
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            paymentTiming: true,
            priceMode: true,
          },
        },
        visit: { select: { price: true } },
      },
      // Eng eskisi tepada
      orderBy: { completedAt: 'asc' },
      take: 200,
    })

    const outstandingPaidRows = await this.db.payment.groupBy({
      by: ['appointmentId'],
      where: {
        status: 'PAID',
        appointmentId: { in: outstanding.map((a) => a.id) },
      },
      _sum: { amount: true },
    })
    const outstandingPaid = new Map(
      outstandingPaidRows.map((r) => [r.appointmentId, r._sum.amount ?? 0]),
    )

    /*
      Shifokor summani belgilamagan bo'lsa qarz emas — hech kim hech
      qancha qarzdor emas, chunki summa aytilmagan.
    */
    const unpaidRows = outstanding.filter((a) => {
      const total =
        a.service.priceMode === 'DOCTOR_SET' ? a.visit?.price : a.service.price
      if (total === null || total === undefined) return false
      return total - (outstandingPaid.get(a.id) ?? 0) > 0
    })
    const prepaidUnpaidRows = appointments.filter(
      (a) =>
        a.service.paymentTiming === 'PREPAID' &&
        a.checkedInAt !== null &&
        a.status !== 'COMPLETED' &&
        a.status !== 'CANCELLED' &&
        a.paymentStatus !== 'PAID',
    )

    const owed = (
      a: (typeof appointments)[number],
      paidMap: Map<string | null, number> = paidByAppointment,
    ) => Math.max(0, fullPrice(a) - (paidMap.get(a.id) ?? 0))

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
        /*
          Qabullarning O'ZI ham qaytadi, faqat soni emas.

          Ilgari faqat son kelardi va "To'lov olish" tugmasi
          BO'SH forma ochardi. Registrator to'lovni qo'lda
          yozar, to'lov esa hech qaysi qabulga bog'lanmasdi —
          natijada `appointment.paymentStatus` o'zgarmay,
          ogohlantirish o'sha joyda turaverardi.
        */
        /*
          `count` — jami nechta qarz bor, `items` esa faqat birinchi
          beshtasi. Interfeys qolganini "Hammasi" havolasi bilan
          Qarzdorlar sahifasiga uzatadi.
        */
        unpaid: {
          count: unpaidRows.length,
          amount: unpaidRows.reduce((sum, a) => sum + owed(a, outstandingPaid), 0),
          items: unpaidRows.slice(0, 5).map((a) => toQueueItem(a, outstandingPaid)),
        },
        prepaidUnpaid: {
          count: prepaidUnpaidRows.length,
          amount: prepaidUnpaidRows.reduce((sum, a) => sum + owed(a), 0),
          items: prepaidUnpaidRows.map((a) => toQueueItem(a)),
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
