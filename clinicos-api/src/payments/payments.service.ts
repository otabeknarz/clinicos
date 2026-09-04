import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { paginated } from '../common/pagination'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ServicesService } from '../services/services.service'
import {
  PaymentInputDto,
  PaymentQueryDto,
  RevenueQueryDto,
} from './payments.dto'

const EXPAND = {
  patient: { select: { id: true, fullName: true } },
  doctor: { select: { id: true, fullName: true } },
  service: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude

type Expanded = Prisma.PaymentGetPayload<{ include: typeof EXPAND }>

/**
 * TO'LOVLAR.
 *
 * ENG MUHIM QOIDA: to'lov yozuvi O'ZGARMAYDI va O'CHIRILMAYDI.
 * Tahrirlash yoki o'chirish endpointi yo'q va bo'lmasligi kerak.
 * Xato bo'lsa — qaytarish (refund) yoziladi, eskisi joyida qoladi.
 *
 * NEGA: butun firibgarlikka qarshi mantiq shunga tayanadi.
 * Shifokor tashrifni yozadi, registrator pulni yozadi, tizim
 * ikkalasini solishtiradi. Yozuvni o'chirib bo'ladigan bo'lsa,
 * solishtirishning ma'nosi qolmaydi: ortiqcha olingan pulni
 * o'chirib tashlash yetarli bo'lardi.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly services: ServicesService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  private doctorScope(): Prisma.PaymentWhereInput {
    const { role, doctorId } = this.ctx.require()
    return role === 'DOCTOR' && doctorId ? { doctorId } : {}
  }

  async list(query: PaymentQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.PaymentWhereInput = {
      AND: [
        this.doctorScope(),
        query.method === 'all' ? {} : { method: toDb(query.method) },
        query.status === 'all' ? {} : { status: toDb(query.status) },
        rangeWhere('paidAt', query.from, query.to),
        search
          ? { patient: { fullName: { contains: search, mode: 'insensitive' } } }
          : {},
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.payment.findMany({
        where,
        include: EXPAND,
        orderBy: { paidAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.payment.count({ where }),
    ])

    return paginated(rows.map(toApiPayment), total, query.page, query.pageSize)
  }

  /**
   * Bugungi, haftalik va oylik tushum.
   *
   * DASTURCHIGA: haftalik va oylik summa faqat `revenue.view`
   * ruxsati bor foydalanuvchiga yuborilsin. Registratorga bugungi
   * summa yetarli — u smena yopishda shu raqamni ishlatadi.
   * Interfeysda ular yashirilgan, lekin yashirish himoya emas.
   */
  async summary() {
    const now = new Date()
    const [today, week, month] = await Promise.all([
      this.sumPaid({ gte: startOfDay(now), lte: endOfDay(now) }),
      this.sumPaid({ gte: startOfDay(addDays(now, -6)), lte: endOfDay(now) }),
      this.sumPaid({ gte: startOfDay(addDays(now, -29)), lte: endOfDay(now) }),
    ])
    return { today, week, month }
  }

  private async sumPaid(range: Prisma.DateTimeFilter) {
    const result = await this.db.payment.aggregate({
      where: { AND: [this.doctorScope(), { status: 'PAID', paidAt: range }] },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  /**
   * To'lov qabul qilish.
   *
   * Narx KATALOGDAN olinadi, mijozdan emas. Registrator yuborgan
   * `amount` faqat qisman to'lov uchun ishlatiladi va u katalog
   * narxidan OSHIB keta olmaydi.
   *
   * NEGA: aks holda registrator bemordan 200 000 olib, tizimga
   * 150 000 deb yozib, farqni o'ziga olib qolardi. Endi tizim
   * xizmat narxini biladi va yozuvda `basePrice` bilan `discountPct`
   * ham muzlatib qoladi — "chegirma qildim" degan bahonani ham
   * keyinchalik tekshirib bo'ladi.
   */
  async create(dto: PaymentInputDto) {
    const { clinicId, userId } = this.ctx.require()

    const preview = await this.services.priceFor(dto.serviceId, dto.patientId)

    if (dto.amount > preview.price) {
      throw new BadRequestException(
        `Summa katalog narxidan oshib ketdi (${preview.price} so‘m)`,
      )
    }

    if (dto.appointmentId) {
      const appointment = await this.db.appointment.findFirst({
        where: { id: dto.appointmentId },
        select: { id: true, patientId: true },
      })
      if (!appointment) throw new NotFoundException('Qabul topilmadi')
      if (appointment.patientId !== dto.patientId) {
        throw new BadRequestException('Qabul boshqa bemorga tegishli')
      }
    }

    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          clinicId,
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          serviceId: dto.serviceId,
          appointmentId: dto.appointmentId,
          amount: dto.amount,
          basePrice: preview.basePrice,
          discountPct: preview.discountPct,
          method: toDb(dto.method),
          status: toDb(dto.status),
          paidAt: new Date(),
          notes: dto.notes,
          createdById: userId,
        },
        include: EXPAND,
      })

      // Qabulning to'lov holatini yangilaymiz
      if (dto.appointmentId) {
        const paid = await tx.payment.aggregate({
          where: { appointmentId: dto.appointmentId, status: 'PAID' },
          _sum: { amount: true },
        })
        const total = paid._sum.amount ?? 0
        await tx.appointment.update({
          where: { id: dto.appointmentId },
          data: {
            paymentStatus:
              total >= preview.price ? 'PAID' : total > 0 ? 'PARTIAL' : 'UNPAID',
          },
        })
      }

      return created
    })

    return toApiPayment(row)
  }

  /**
   * Qaytarish.
   *
   * Yozuv O'CHIRILMAYDI — holati `refunded` ga o'tadi va tarixda
   * qoladi. Kim, qachon qaytarganini keyin ko'rish mumkin.
   */
  async refund(id: string) {
    const current = await this.db.payment.findFirst({
      where: { id },
      select: { id: true, status: true, appointmentId: true },
    })
    if (!current) throw new NotFoundException('To‘lov topilmadi')
    if (current.status === 'REFUNDED') {
      throw new BadRequestException('Bu to‘lov allaqachon qaytarilgan')
    }

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'REFUNDED' },
        include: EXPAND,
      })

      if (current.appointmentId) {
        const paid = await tx.payment.aggregate({
          where: { appointmentId: current.appointmentId, status: 'PAID' },
          _sum: { amount: true },
        })
        await tx.appointment.update({
          where: { id: current.appointmentId },
          data: { paymentStatus: (paid._sum.amount ?? 0) > 0 ? 'PARTIAL' : 'UNPAID' },
        })
      }

      return updated
    })

    return toApiPayment(row)
  }

  /**
   * Daromad hisoboti.
   *
   * `netRevenue` — TAXMINIY. Xarajatlar (ijara, dori, kommunal)
   * tizimda yo'q, shuning uchun u tushumning bir qismi sifatida
   * hisoblanadi. Buni haqiqiy foyda deb ko'rsatib bo'lmaydi va
   * interfeysda ham "taxminiy" deb yozilgan.
   *
   * DASTURCHIGA: xarajatlar jadvali qo'shilganda shu joy
   * haqiqiy hisobga o'tkazilsin.
   */
  async revenue(query: RevenueQueryDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))

    const rows = await this.db.payment.findMany({
      where: {
        AND: [this.doctorScope(), { status: 'PAID', paidAt: { gte: from, lte: to } }],
      },
      include: EXPAND,
    })

    const total = rows.reduce((sum, r) => sum + r.amount, 0)

    // Kun bo'yicha
    const byDay = new Map<string, number>()
    for (const row of rows) {
      const key = row.paidAt.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + row.amount)
    }
    const overTime = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }))

    return {
      totalRevenue: total,
      // Taxminiy: tushumning 68% i. Yuqoridagi izohga qarang.
      netRevenue: Math.round(total * 0.68),
      transactions: rows.length,
      averageCheck: rows.length ? Math.round(total / rows.length) : 0,
      overTime,
      byDoctor: breakdown(rows, (r) => [r.doctorId, r.doctor.fullName], total),
      byService: breakdown(rows, (r) => [r.serviceId, r.service.name], total),
      byMethod: breakdown(rows, (r) => [toApi(r.method), toApi(r.method)], total),
    }
  }
}

/* ------------------------------------------------------------------ */

function breakdown(
  rows: Expanded[],
  key: (row: Expanded) => [string, string],
  total: number,
) {
  const map = new Map<string, { label: string; value: number }>()
  for (const row of rows) {
    const [id, label] = key(row)
    const existing = map.get(id)
    if (existing) existing.value += row.amount
    else map.set(id, { label, value: row.amount })
  }

  return [...map.entries()]
    .map(([id, item]) => ({
      id,
      label: item.label,
      value: item.value,
      sharePct: total ? Math.round((item.value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function toApiPayment(row: Expanded) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    serviceId: row.serviceId,
    appointmentId: row.appointmentId,
    amount: row.amount,
    basePrice: row.basePrice,
    discountPct: row.discountPct,
    method: toApi(row.method),
    status: toApi(row.status),
    paidAt: toApiDateTime(row.paidAt)!,
    notes: row.notes,
    createdBy: row.createdById,
    createdAt: toApiDateTime(row.createdAt)!,
    patient: row.patient,
    doctor: row.doctor,
    service: row.service,
  }
}

function rangeWhere(field: 'paidAt', from?: string, to?: string) {
  if (!from && !to) return {}
  return {
    [field]: {
      ...(from ? { gte: startOfDay(new Date(from)) } : {}),
      ...(to ? { lte: endOfDay(new Date(to)) } : {}),
    },
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
