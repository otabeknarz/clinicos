import { BadRequestException, Injectable } from '@nestjs/common'

import { toApiDate, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { CashRangeDto, ShiftCloseDto } from './cash-control.dto'

/**
 * KASSA NAZORATI — tizimning yuragi.
 *
 * Mantiq oddiy va shuning uchun kuchli:
 *
 *   KUTILGAN  — shifokorlar tugallangan deb belgilagan qabullar
 *               bo'yicha olinishi kerak bo'lgan summa
 *   YIG'ILGAN — registratorlar tizimga kiritgan to'lovlar
 *   FARQ      — ikkalasining ayirmasi
 *
 * Farq nolga teng bo'lmasa, kimdir yo yozuvni, yo pulni
 * o'tkazmagan. Ikki xil odam ikki xil narsani yozgani uchun
 * ularning kelishuvisiz farqni yashirib bo'lmaydi.
 *
 * Bu hisobot FAQAT egasida (`cash.view`).
 */
@Injectable()
export class CashControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async report(query: CashRangeDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))

    const [completed, payments, cancelledAfterCheckIn, closures] = await Promise.all([
      // Tugallangan qabullar — shifokor tomonidan
      this.db.appointment.findMany({
        where: { status: 'COMPLETED', startsAt: { gte: from, lte: to } },
        select: {
          id: true,
          paymentStatus: true,
          service: { select: { price: true } },
        },
      }),
      // Kiritilgan to'lovlar — registrator tomonidan
      this.db.payment.findMany({
        where: { paidAt: { gte: from, lte: to } },
        select: {
          amount: true,
          status: true,
          createdById: true,
          createdBy: { select: { fullName: true } },
        },
      }),
      /*
        Bemor kelgandan KEYIN bekor qilingan qabullar.

        Bu firibgarlikni yashirishning eng oson yo'li edi:
        bemor keldi, puli olindi, qabul esa "bekor" deb yopildi.
        Shuning uchun soni alohida ko'rsatiladi.
      */
      this.db.appointment.count({
        where: {
          status: 'CANCELLED',
          checkedInAt: { not: null },
          startsAt: { gte: from, lte: to },
        },
      }),
      this.db.shiftClosure.findMany({
        where: { date: { gte: from, lte: to } },
        include: { user: { select: { fullName: true } } },
        orderBy: { closedAt: 'desc' },
      }),
    ])

    const expected = completed.reduce((sum, a) => sum + a.service.price, 0)
    const paid = payments.filter((p) => p.status === 'PAID')
    const collected = paid.reduce((sum, p) => sum + p.amount, 0)

    const unpaid = completed.filter((a) => a.paymentStatus !== 'PAID')
    const pending = payments.filter((p) => p.status === 'PENDING')
    const refunds = payments.filter((p) => p.status === 'REFUNDED')

    // Kim qancha yig'gani
    const byUserMap = new Map<
      string,
      { userId: string; userName: string; collected: number; transactions: number }
    >()
    for (const p of paid) {
      const acc = byUserMap.get(p.createdById) ?? {
        userId: p.createdById,
        userName: p.createdBy.fullName,
        collected: 0,
        transactions: 0,
      }
      acc.collected += p.amount
      acc.transactions += 1
      byUserMap.set(p.createdById, acc)
    }

    // Smena yopishdagi kamomad — kim qancha kam topshirgani
    const shortfallByUser = new Map<string, number>()
    for (const c of closures) {
      if (c.difference < 0) {
        shortfallByUser.set(
          c.userId,
          (shortfallByUser.get(c.userId) ?? 0) + Math.abs(c.difference),
        )
      }
    }

    return {
      expected,
      collected,
      gap: expected - collected,
      unpaidVisits: {
        count: unpaid.length,
        amount: unpaid.reduce((sum, a) => sum + a.service.price, 0),
      },
      pendingPayments: {
        count: pending.length,
        amount: pending.reduce((sum, p) => sum + p.amount, 0),
      },
      refunds: {
        count: refunds.length,
        amount: refunds.reduce((sum, p) => sum + p.amount, 0),
      },
      cancelledAfterCheckIn,
      byUser: [...byUserMap.values()]
        .map((u) => ({ ...u, shortfall: shortfallByUser.get(u.userId) ?? 0 }))
        .sort((a, b) => b.collected - a.collected),
      shiftClosures: closures.map(toApiClosure),
    }
  }

  /** Bugungi kutilayotgan naqd — smenani yopishda ko'rsatiladi */
  async expectedCashToday() {
    const { userId } = this.ctx.require()
    const now = new Date()

    const result = await this.db.payment.aggregate({
      where: {
        status: 'PAID',
        method: 'CASH',
        createdById: userId,
        paidAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      _sum: { amount: true },
    })

    return { expectedCash: result._sum.amount ?? 0 }
  }

  /**
   * Smenani yopish.
   *
   * Kutilgan summa SERVERDA qayta hisoblanadi — mijozdan
   * kelganiga ishonilmaydi. Aks holda registrator "kutilgan"
   * raqamni o'zi yozib, farqni nolga tenglashtirib qo'yardi.
   *
   * Farq bo'lsa izoh MAJBURIY.
   */
  async closeShift(dto: ShiftCloseDto) {
    const { clinicId, userId } = this.ctx.require()
    const now = new Date()
    const today = startOfDay(now)

    const existing = await this.db.shiftClosure.findFirst({
      where: { userId, date: today },
      select: { id: true },
    })
    if (existing) {
      throw new BadRequestException('Bugungi smena allaqachon yopilgan')
    }

    const { expectedCash } = await this.expectedCashToday()
    const difference = dto.declaredCash - expectedCash

    if (difference !== 0 && !dto.note.trim()) {
      throw new BadRequestException(
        'Farq bor — sababini yozing. Yozuv o‘chirilmaydi.',
      )
    }

    const row = await this.db.shiftClosure.create({
      data: {
        clinicId,
        userId,
        date: today,
        expectedCash,
        declaredCash: dto.declaredCash,
        difference,
        note: dto.note.trim(),
      },
      include: { user: { select: { fullName: true } } },
    })

    return toApiClosure(row)
  }
}

/* ------------------------------------------------------------------ */

function toApiClosure(row: {
  id: string
  clinicId: string
  userId: string
  date: Date
  expectedCash: number
  declaredCash: number
  difference: number
  note: string
  closedAt: Date
  user: { fullName: string }
}) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    userId: row.userId,
    userName: row.user.fullName,
    date: toApiDate(row.date)!,
    expectedCash: row.expectedCash,
    declaredCash: row.declaredCash,
    difference: row.difference,
    note: row.note,
    closedAt: toApiDateTime(row.closedAt)!,
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
