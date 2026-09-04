import { Injectable, NotFoundException } from '@nestjs/common'
import { Service, ServiceLoyaltyTier } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceInputDto, ServiceListQueryDto } from './services.dto'

type ServiceWithTiers = Service & { loyaltyTiers: ServiceLoyaltyTier[] }

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list(query: ServiceListQueryDto) {
    const search = query.search?.trim() ?? ''

    const rows = await this.db.service.findMany({
      where: {
        AND: [
          search ? { name: { contains: search, mode: 'insensitive' } } : {},
          query.category === 'all' ? {} : { category: query.category },
          query.status === 'all' ? {} : { status: toDb(query.status) },
        ],
      },
      include: { loyaltyTiers: { orderBy: { afterVisits: 'asc' } } },
      // Turkum bo'yicha, ichida qimmatdan arzonga — frontenddagi tartib
      orderBy: [{ category: 'asc' }, { price: 'desc' }],
    })

    return rows.map(toApiService)
  }

  async create(dto: ServiceInputDto) {
    const { clinicId } = this.ctx.require()

    const row = await this.db.service.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        category: dto.category.trim(),
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        paymentTiming: toDb(dto.paymentTiming),
        status: toDb(dto.status),
        loyaltyTiers: {
          create: dedupeTiers(dto.loyaltyTiers).map((tier) => ({
            clinicId,
            afterVisits: tier.afterVisits,
            discountPct: tier.discountPct,
          })),
        },
      },
      include: { loyaltyTiers: { orderBy: { afterVisits: 'asc' } } },
    })

    return toApiService(row)
  }

  async update(id: string, dto: Partial<ServiceInputDto>) {
    const { clinicId } = this.ctx.require()
    await this.assertExists(id)

    /*
      Pog'onalar butunlay almashtiriladi, bittalab tahrirlanmaydi.

      NEGA: forma foydalanuvchiga to'liq ro'yxatni ko'rsatadi va
      to'liq ro'yxatni qaytaradi. Farqni hisoblab o'tirish ortiqcha
      murakkablik bo'lardi, pog'onalar esa har bir xizmatda o'ntadan
      oshmaydi.
    */
    const row = await this.db.$transaction(async (tx) => {
      if (dto.loyaltyTiers) {
        await tx.serviceLoyaltyTier.deleteMany({ where: { serviceId: id } })
      }

      return tx.service.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          category: dto.category?.trim(),
          price: dto.price,
          durationMinutes: dto.durationMinutes,
          paymentTiming: dto.paymentTiming ? toDb(dto.paymentTiming) : undefined,
          status: dto.status ? toDb(dto.status) : undefined,
          loyaltyTiers: dto.loyaltyTiers
            ? {
                create: dedupeTiers(dto.loyaltyTiers).map((tier) => ({
                  clinicId,
                  afterVisits: tier.afterVisits,
                  discountPct: tier.discountPct,
                })),
              }
            : undefined,
        },
        include: { loyaltyTiers: { orderBy: { afterVisits: 'asc' } } },
      })
    })

    return toApiService(row)
  }

  /**
   * Xizmatni o'chirish.
   *
   * MUHIM: agar xizmat bo'yicha to'lov yoki qabul bo'lgan bo'lsa,
   * u O'CHIRILMAYDI — arxivga o'tkaziladi. Aks holda eski to'lov
   * "qaysi xizmat uchun edi" degan savolga javobsiz qolardi va
   * moliyaviy hisobot buzilardi.
   */
  async remove(id: string) {
    await this.assertExists(id)

    const used = await this.db.payment.count({ where: { serviceId: id } })
    const booked = await this.db.appointment.count({ where: { serviceId: id } })

    if (used > 0 || booked > 0) {
      await this.db.service.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      })
      return { archived: true }
    }

    await this.db.service.delete({ where: { id } })
    return { archived: false }
  }

  /**
   * Bemor uchun amaldagi narx.
   *
   * Chegirma bemorning SHU XIZMATDAN necha marta foydalanganiga
   * qarab beriladi. Tugallangan qabullar sanaladi — yozilgan,
   * lekin kelmagan qabul chegirma bermasligi kerak.
   */
  async priceFor(serviceId: string, patientId?: string) {
    const service = await this.db.service.findFirst({
      where: { id: serviceId },
      include: { loyaltyTiers: { orderBy: { afterVisits: 'asc' } } },
    })
    if (!service) throw new NotFoundException('Xizmat topilmadi')

    const visitCount = patientId
      ? await this.db.appointment.count({
          where: { patientId, serviceId, status: 'COMPLETED' },
        })
      : 0

    const tiers = service.loyaltyTiers

    // Mos keladiganlar orasidan ENG YUQORI chegirma
    const earned = tiers
      .filter((t) => visitCount >= t.afterVisits)
      .sort((a, b) => b.discountPct - a.discountPct)[0]

    const discountPct = earned?.discountPct ?? 0

    // Keyingi pog'ona — "yana 2 tashrifdan keyin 20%" deb ko'rsatish uchun
    const next = tiers
      .filter((t) => t.afterVisits > visitCount)
      .sort((a, b) => a.afterVisits - b.afterVisits)[0]

    return {
      serviceId: service.id,
      serviceName: service.name,
      basePrice: service.price,
      discountPct,
      price: Math.round((service.price * (100 - discountPct)) / 100),
      visitCount,
      nextTierIn: next ? next.afterVisits - visitCount : null,
      nextTierPct: next ? next.discountPct : null,
      paymentTiming: toApi(service.paymentTiming),
    }
  }

  /** Qabul va to'lov modullari xizmatni tekshirish uchun ishlatadi */
  async requireService(id: string) {
    const row = await this.db.service.findFirst({ where: { id } })
    if (!row) throw new NotFoundException('Xizmat topilmadi')
    return row
  }

  private async assertExists(id: string) {
    const found = await this.db.service.findFirst({
      where: { id },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Xizmat topilmadi')
  }
}

/* ------------------------------------------------------------------ */

/**
 * Bir xil `afterVisits` ikki marta kelsa — kattaroq chegirma qoladi.
 *
 * Bazada `@@unique([serviceId, afterVisits])` turibdi, ya'ni takror
 * baribir o'tmaydi. Lekin bu yerda oldindan tozalanmasa, foydalanuvchi
 * tushunarsiz baza xatosini ko'rardi.
 */
function dedupeTiers<T extends { afterVisits: number; discountPct: number }>(
  tiers: T[],
): T[] {
  const best = new Map<number, T>()
  for (const tier of tiers) {
    const existing = best.get(tier.afterVisits)
    if (!existing || tier.discountPct > existing.discountPct) {
      best.set(tier.afterVisits, tier)
    }
  }
  return [...best.values()].sort((a, b) => a.afterVisits - b.afterVisits)
}

function toApiService(row: ServiceWithTiers) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    category: row.category,
    price: row.price,
    durationMinutes: row.durationMinutes,
    paymentTiming: toApi(row.paymentTiming),
    loyaltyTiers: row.loyaltyTiers.map((t) => ({
      afterVisits: t.afterVisits,
      discountPct: t.discountPct,
    })),
    status: toApi(row.status),
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

