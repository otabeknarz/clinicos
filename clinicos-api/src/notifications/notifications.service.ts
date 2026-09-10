import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { RequestContext } from '../common/request-context'

/**
 * Bildirishnomalar.
 *
 * Saqlanmaydi — HAR SAFAR hisoblanadi. Sabab: ular hozirgi
 * holatni ko'rsatadi ("11 ta qabul tasdiqlanmagan"). Saqlansa,
 * qabul tasdiqlangandan keyin ham eski son turib qolardi.
 *
 * Har bir bildirishnoma foydalanuvchining ruxsatiga qarab
 * chiqadi: shifokorga kassa haqidagi eslatma kerak emas.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list() {
    const { permissions, role, doctorId } = this.ctx.require()
    const now = new Date()
    const from = startOfDay(now)
    const to = endOfDay(now)

    const mine = role === 'DOCTOR' && doctorId ? { doctorId } : {}

    const [today, unconfirmed, unpaid, followUps, noShows] = await Promise.all([
      this.db.appointment.count({ where: { ...mine, startsAt: { gte: from, lte: to } } }),
      this.db.appointment.count({
        where: { ...mine, status: 'SCHEDULED', startsAt: { gte: from, lte: to } },
      }),
      permissions.includes('payments.view')
        ? this.db.appointment.count({
            where: {
              status: 'COMPLETED',
              paymentStatus: { not: 'PAID' },
              /*
                Kechirilgan qarz sanalmaydi. Aks holda u ro'yxatdan
                tushardi-yu, bildirishnomada qolib ketardi — va u
                hech qachon o'chmasdi.
              */
              debtWaiver: { is: null },
            },
          })
        : Promise.resolve(0),
      this.db.followUp.count({
        where: { ...mine, status: 'PENDING', recommendedDate: { lte: to } },
      }),
      this.db.appointment.count({
        where: { ...mine, status: 'NO_SHOW', startsAt: { gte: from, lte: to } },
      }),
    ])

    const out: {
      id: string
      clinicId: string
      kind: string
      count: number
      href: string
      severity: 'info' | 'warn' | 'bad'
      createdAt: string
      readAt: null
    }[] = []

    const { clinicId } = this.ctx.require()
    const add = (
      kind: string,
      count: number,
      href: string,
      severity: 'info' | 'warn' | 'bad',
    ) => {
      if (count > 0) {
        out.push({
          id: kind,
          clinicId,
          kind,
          count,
          href,
          severity,
          createdAt: now.toISOString(),
          readAt: null,
        })
      }
    }

    /*
      TO'LANMAGANLAR QAYERGA OLIB BORADI.

      Ilgari hamma uchun `/payments` edi va bu noto'g'ri ish qildirardi:
      registrator o'sha sahifadan to'lovni qabulga BOG'LAMAY yozardi,
      natijada pul kassaga tushib, `appointment.paymentStatus` o'zgarmay
      qolardi — ya'ni ogohlantirish o'chmasdi.

      `/reception` degan yo'l yo'q: registratura paneli registratorning
      BOSH sahifasi. Egasi esa to'lov umuman yarata olmaydi
      (`payments.create` unda ataylab yo'q), unga ro'yxat to'g'ri keladi.
    */
    const unpaidHref = permissions.includes('payments.create') ? '/' : '/payments'

    add('appointments_today', today, '/appointments', 'info')
    add('unconfirmed', unconfirmed, '/appointments', 'warn')
    add('pending_payments', unpaid, unpaidHref, 'bad')
    add('follow_ups_due', followUps, '/patients', 'info')
    add('no_shows', noShows, '/appointments', 'warn')

    return out
  }

  /**
   * YON MENYUDAGI SONLAR.
   *
   * NEGA ALOHIDA: bildirishnomalar qo'ng'iroqcha ostida turadi va
   * ularni KO'RISH uchun bosish kerak. Amalda esa xodim shoshib
   * turganda hech narsani bosmaydi — bo'limga kiradi-yu, u yerda
   * yangi izoh borligini bilmaydi ham. Yangilik BO'LIM NOMINING
   * yonida ko'rinsa, uni ko'rmaslikning iloji yo'q.
   *
   * Hisoblanadi, saqlanmaydi — bildirishnomalar bilan bir xil
   * sababdan: son hozirgi holatni ko'rsatadi, ish bajarilgach
   * o'zi yo'qoladi.
   *
   * HAR BIR SON RUXSATGA BOG'LIQ: shifokorga o'zining bugungi
   * qabullari sanaladi, boshqasiniki emas.
   *
   * FAQAT NOLGA TUSHADIGAN SONLAR. Qarzdorlar va muddati kelgan
   * takroriy tashriflar ataylab yo'q: ular yangilik emas, to'planib
   * qolgan ish va hech qachon nolga tushmaydi. Doimiy "99+" bir
   * hafta ichida devor qog'oziga aylanadi va odam BARCHA belgilarga
   * qaramay qo'yadi — ya'ni belgilar tizimining o'zi buziladi.
   * Ular qo'ng'iroqcha ostidagi ro'yxatda ko'rinib turadi.
   */
  async badges(): Promise<Record<string, number>> {
    const { permissions, role, doctorId, userId } = this.ctx.require()
    const now = new Date()
    const to = endOfDay(now)
    const mine = role === 'DOCTOR' && doctorId ? { doctorId } : {}

    const [unconfirmed, noShows, newFeedback, unread] = await Promise.all([
      permissions.includes('appointments.view')
        ? this.db.appointment.count({
            where: { ...mine, status: 'SCHEDULED', startsAt: { gte: startOfDay(now), lte: to } },
          })
        : Promise.resolve(0),
      permissions.includes('appointments.view')
        ? this.db.appointment.count({
            where: { ...mine, status: 'NO_SHOW', startsAt: { gte: startOfDay(now), lte: to } },
          })
        : Promise.resolve(0),
      /*
        O'QILMAGAN IZOH — `status: NEW`, OXIRGI 30 KUN ICHIDA.

        Ko'rilgani bilan emas, ISH BAJARILGANI bilan o'chadi: egasi
        javob yozadi yoki "ko'rib chiqildi" deb belgilaydi. Ochib
        qarash yetarli emas — izoh e'tibor talab qiladi.

        30 KUNLIK CHEGARA SHART. Usiz bo'lim bir oy ochilmasa,
        yig'ilgan eski izohlar doimiy "99+" bo'lib qotib qolardi va
        belgining butun ma'nosi yo'qolardi — u "yangi narsa keldi"
        deyishi kerak, "qachondir ish bor edi" emas. Eski izohlar
        bo'limning o'zida va qo'ng'iroqcha ostida turaveradi.
      */
      permissions.includes('feedback.view')
        ? this.db.feedback.count({
            where: { status: 'NEW', createdAt: { gte: daysAgo(30) } },
          })
        : Promise.resolve(0),
      permissions.includes('chat.use') && userId
        ? this.unreadMessages(userId)
        : Promise.resolve(0),
    ])

    /*
      Nol qiymatlar ham qaytadi. Interfeys nolni ko'rsatmaydi,
      lekin qaytmasa "hisoblanmadi" bilan "nolga teng" bir xil
      ko'rinardi.
    */
    return {
      appointments: unconfirmed + noShows,
      feedback: newFeedback,
      chat: unread,
    }
  }

  /**
   * O'zim a'zo bo'lgan guruhlardagi o'qilmagan xabarlar.
   *
   * O'ZIMNIKI SANALMAYDI: odam o'z yozganini "o'qilmagan" deb
   * ko'rsa, son hech qachon nolga tushmasdi.
   */
  private async unreadMessages(userId: string): Promise<number> {
    const groups = await this.db.chatGroupMember.findMany({
      where: { userId },
      select: { groupId: true },
    })
    if (groups.length === 0) return 0

    return this.db.chatMessage.count({
      where: {
        groupId: { in: groups.map((g) => g.groupId) },
        authorId: { not: userId },
        isSystem: false,
        reads: { none: { userId } },
      },
    })
  }
}

/** Necha kun oldingi payt — belgilar oynasi uchun */
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
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
