import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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
    const pricing = resolvePricing(dto)

    const row = await this.db.service.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        category: dto.category.trim(),
        price: pricing.price,
        priceMode: pricing.priceMode,
        minPrice: pricing.minPrice,
        maxPrice: pricing.maxPrice,
        durationMinutes: dto.durationMinutes,
        paymentTiming: pricing.paymentTiming,
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

    const current = await this.db.service.findFirst({
      where: { id },
      select: {
        price: true,
        priceMode: true,
        minPrice: true,
        maxPrice: true,
        paymentTiming: true,
      },
    })
    if (!current) throw new NotFoundException('Xizmat topilmadi')

    /*
      NARX SOZLAMASI BUTUNLIGICHA TEKSHIRILADI.

      PATCH faqat o'zgargan maydonni yuboradi, lekin `priceMode`,
      oraliq va to'lov vaqti bir-biriga bog'liq. Shuning uchun
      bazadagi holat bilan birlashtirilib, natija tekshiriladi —
      aks holda faqat `priceMode` ni yuborib, oraliqsiz "shifokor
      belgilaydi" xizmatini yaratib olish mumkin bo'lardi.
    */
    const pricing = resolvePricing({
      priceMode: dto.priceMode ?? toApi(current.priceMode),
      price: dto.price ?? current.price,
      minPrice: dto.minPrice ?? current.minPrice ?? undefined,
      maxPrice: dto.maxPrice ?? current.maxPrice ?? undefined,
      paymentTiming: dto.paymentTiming ?? toApi(current.paymentTiming),
    })

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
          price: pricing.price,
          priceMode: pricing.priceMode,
          minPrice: pricing.minPrice,
          maxPrice: pricing.maxPrice,
          durationMinutes: dto.durationMinutes,
          paymentTiming: pricing.paymentTiming,
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
  async priceFor(serviceId: string, patientId?: string, appointmentId?: string) {
    const service = await this.db.service.findFirst({
      where: { id: serviceId },
      include: { loyaltyTiers: { orderBy: { afterVisits: 'asc' } } },
    })
    if (!service) throw new NotFoundException('Xizmat topilmadi')

    /*
      NARXNI SHIFOKOR BELGILAGAN BO'LSA — katalogda qidirmaymiz.

      Summa aynan shu qabulning ko'rigida turadi. Ko'rik hali
      yozilmagan bo'lsa `price: null` qaytadi va registrator
      "shifokor hali belgilamagan" degan holatni ko'radi.

      Sodiqlik chegirmasi bu yerda QO'LLANMAYDI: shifokor summani
      belgilaganda bemorning holatini allaqachon hisobga oladi,
      ustiga chegirma qo'yilsa ikki marta hisoblangan bo'lardi.
    */
    if (service.priceMode === 'DOCTOR_SET') {
      const visit = appointmentId
        ? await this.db.visit.findFirst({
            where: { appointmentId },
            select: { price: true },
          })
        : null

      return {
        serviceId: service.id,
        serviceName: service.name,
        basePrice: visit?.price ?? null,
        discountPct: 0,
        price: visit?.price ?? null,
        visitCount: 0,
        nextTierIn: null,
        nextTierPct: null,
        paymentTiming: toApi(service.paymentTiming),
        priceMode: toApi(service.priceMode),
        minPrice: service.minPrice,
        maxPrice: service.maxPrice,
      }
    }

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
      priceMode: toApi(service.priceMode),
      minPrice: service.minPrice,
      maxPrice: service.maxPrice,
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
 * Narx sozlamasini tekshirib, bazaga yoziladigan ko'rinishga keltiradi.
 *
 * Bitta joyda, chunki yaratish ham, tahrirlash ham xuddi shu qoidaga
 * bo'ysunishi kerak. Ikki joyda yozilsa, biri yangilanib ikkinchisi
 * eskirib qolardi — narx esa firibgarlikka qarshi asosiy cheklov.
 */
function resolvePricing(input: {
  priceMode: 'fixed' | 'doctor_set'
  price: number
  minPrice?: number
  maxPrice?: number
  paymentTiming: 'prepaid' | 'postpaid'
}) {
  if (input.priceMode === 'fixed') {
    return {
      priceMode: 'FIXED' as const,
      price: input.price,
      minPrice: null,
      maxPrice: null,
      paymentTiming: toDb(input.paymentTiming),
    }
  }

  const { minPrice, maxPrice } = input

  if (minPrice === undefined || maxPrice === undefined) {
    throw new BadRequestException(
      'Narxni shifokor belgilaydigan xizmatga eng kam va eng ko‘p narx ko‘rsatilishi shart',
    )
  }
  if (minPrice > maxPrice) {
    throw new BadRequestException('Eng kam narx eng ko‘p narxdan katta bo‘lmasin')
  }

  return {
    priceMode: 'DOCTOR_SET' as const,
    /*
      `price` ga eng kam narx yoziladi. Uni o'qiydigan eski joylar
      (prognoz, hisobot) bo'sh qiymat ko'rmasin — haqiqiy pul
      baribir `payments` dan hisoblanadi.
    */
    price: minPrice,
    minPrice,
    maxPrice,
    /*
      Summasi ko'rikdan oldin noma'lum xizmatni oldindan to'lab
      bo'lmaydi. Interfeys ham buni bloklaydi, lekin qaror shu yerda.
    */
    paymentTiming: 'POSTPAID' as const,
  }
}

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
    priceMode: toApi(row.priceMode),
    minPrice: row.minPrice,
    maxPrice: row.maxPrice,
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

