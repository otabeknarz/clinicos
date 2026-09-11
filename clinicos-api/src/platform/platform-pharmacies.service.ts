import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Clinic } from '@prisma/client'
import * as argon2 from 'argon2'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'
import { generatePassword } from '../common/password'
import {
  EXPIRY_WARN_DAYS,
  LOW_STOCK,
  dateOnly,
  daysAgo,
  daysLeft,
  localDate,
  saleNet,
  saleProfit,
  startOfToday,
  todayDate,
} from '../pharmacy/pharmacy.shared'
import { PrismaService } from '../prisma/prisma.service'
import { PharmacyCreateDto, PharmacyUpdateDto } from './platform-pharmacies.dto'

/** Kuzatuv oynasi — ro'yxat ham, karta ham shu davrni oladi */
const WATCH_DAYS = 30

/**
 * PLATFORMA: APTEKALAR.
 *
 * Apteka — platformaning ALOHIDA mijozi (`Clinic.kind = PHARMACY`).
 * Klinikalar ro'yxati va statistikasiga aralashmaydi.
 *
 * PLATFORMA EGASI APTEKANING ICHIGA KIRMAYDI: dori nomlari, kimga
 * nima sotilgani, retseptdagi bemor — hech biri bu yerdan chiqmaydi.
 * Faqat sonlar: tushum, cheklar, kassa farqi, zaxira holati.
 *
 * `acrossAllClinics()` — faqat `platform/` ichida, butun kontroller
 * `platform.view` bilan yopilgan.
 */
@Injectable()
export class PlatformPharmaciesService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.acrossAllClinics()
  }

  private async requirePharmacy(id: string) {
    const row = await this.db.clinic.findFirst({ where: { id, kind: 'PHARMACY' } })
    if (!row) throw new NotFoundException('Apteka topilmadi')
    return row
  }

  private owner(clinicId: string) {
    return this.db.user.findFirst({
      where: { clinicId, role: 'PHARMACY_OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true, email: true, phone: true },
    })
  }

  private apiPharmacy(c: Clinic, ownerUserId: string | null) {
    return {
      id: c.id,
      name: c.name,
      city: c.city,
      address: c.address,
      phone: c.phone,
      status: c.isActive ? ('active' as const) : ('suspended' as const),
      suspendReason: c.suspendReason,
      ownerUserId,
      createdAt: toApiDateTime(c.createdAt),
    }
  }

  private async overview(c: Clinic) {
    const since = daysAgo(WATCH_DAYS)
    const where = { clinicId: c.id }

    const [owner, staffCount, month, today, shifts, batches, medicines, lastSale] =
      await Promise.all([
        this.owner(c.id),
        this.db.pharmacyStaff.count({ where: { ...where, status: 'ACTIVE' } }),
        this.db.sale.aggregate({
          where: { ...where, soldAt: { gte: since } },
          _sum: { total: true, discount: true },
          _count: { _all: true },
        }),
        this.db.sale.aggregate({
          where: { ...where, soldAt: { gte: startOfToday() } },
          _sum: { total: true, discount: true },
        }),
        this.db.pharmacyShift.findMany({
          where: { ...where, date: { gte: dateOnly(localDate(since)) } },
          select: { flagged: true, difference: true },
        }),
        this.db.medicineBatch.findMany({
          where: { ...where, quantity: { gt: 0 } },
          select: { medicineId: true, quantity: true, expiresAt: true },
        }),
        this.db.medicine.findMany({
          where: { ...where, status: 'ACTIVE' },
          select: { id: true },
        }),
        this.db.sale.findFirst({
          where,
          orderBy: { soldAt: 'desc' },
          select: { soldAt: true },
        }),
      ])

    const stock = new Map<string, number>()
    for (const b of batches) stock.set(b.medicineId, (stock.get(b.medicineId) ?? 0) + b.quantity)

    return {
      ...this.apiPharmacy(c, owner?.id ?? null),
      ownerName: owner?.fullName ?? '',
      ownerEmail: owner?.email ?? '',
      ownerPhone: owner?.phone ?? '',
      staffCount,
      revenue: (month._sum.total ?? 0) - (month._sum.discount ?? 0),
      receipts: month._count._all,
      todayRevenue: (today._sum.total ?? 0) - (today._sum.discount ?? 0),
      flaggedShifts: shifts.filter((s) => s.flagged).length,
      cashShort: shifts.filter((s) => s.difference < 0).reduce((sum, s) => sum - s.difference, 0),
      expiringBatches: batches.filter((b) => {
        const left = daysLeft(b.expiresAt)
        return left >= 0 && left <= EXPIRY_WARN_DAYS
      }).length,
      expiredBatches: batches.filter((b) => daysLeft(b.expiresAt) < 0).length,
      lowStock: medicines.filter((m) => {
        const qty = stock.get(m.id) ?? 0
        return qty > 0 && qty <= LOW_STOCK
      }).length,
      lastSaleAt: toApiDateTime(lastSale?.soldAt ?? null),
    }
  }

  /* ------------------------------------------------------------------ */
  /* O'qish                                                              */
  /* ------------------------------------------------------------------ */

  async list() {
    const rows = await this.db.clinic.findMany({
      where: { kind: 'PHARMACY', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    const out = await Promise.all(rows.map((row) => this.overview(row)))
    return out.sort((a, b) => b.revenue - a.revenue)
  }

  async get(id: string) {
    const c = await this.requirePharmacy(id)
    const base = await this.overview(c)
    const where = { clinicId: c.id }
    const since = daysAgo(WATCH_DAYS)

    const [sales, batches, medicines, pendingPrescriptions, staff, shifts] = await Promise.all([
      this.db.sale.findMany({
        where: { ...where, soldAt: { gte: since } },
        include: { items: true },
      }),
      this.db.medicineBatch.findMany({
        where: { ...where, quantity: { gt: 0 } },
        select: { medicineId: true, quantity: true, buyPrice: true },
      }),
      this.db.medicine.findMany({ where: { ...where, status: 'ACTIVE' }, select: { id: true } }),
      this.db.prescription.count({ where: { ...where, status: 'PENDING' } }),
      this.db.pharmacyStaff.findMany({
        where,
        include: { user: { select: { lastLoginAt: true } } },
      }),
      this.db.pharmacyShift.findMany({
        where: { ...where, date: { gte: dateOnly(localDate(since)) } },
        orderBy: [{ date: 'desc' }, { closedAt: 'desc' }],
      }),
    ])

    /* Har bir kun bo'sh bo'lsa ham qator bo'ladi — grafikda teshik qolmasin */
    const byDay = new Map<string, number>()
    for (let i = WATCH_DAYS - 1; i >= 0; i--) byDay.set(localDate(daysAgo(i)), 0)
    for (const sale of sales) {
      const key = localDate(sale.soldAt)
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + saleNet(sale))
    }

    const inStock = new Set(batches.map((b) => b.medicineId))

    return {
      ...base,
      profit: sales.reduce((sum, s) => sum + saleProfit(s), 0),
      avgReceipt: sales.length ? Math.round(base.revenue / sales.length) : 0,
      daily: [...byDay].map(([date, revenue]) => ({ date, revenue })),
      medicines: medicines.length,
      outOfStock: medicines.filter((m) => !inStock.has(m.id)).length,
      stockValue: batches.reduce((sum, b) => sum + b.buyPrice * b.quantity, 0),
      pendingPrescriptions,
      staff: staff
        .map((s) => ({
          id: s.id,
          fullName: s.fullName,
          role: s.role === 'PHARMACY_OWNER' ? ('pharmacy_owner' as const) : ('pharmacist' as const),
          login: s.login,
          status: toApi(s.status),
          shiftStart: s.shiftStart,
          shiftEnd: s.shiftEnd,
          lastLoginAt: toApiDateTime(s.user?.lastLoginAt ?? null),
        }))
        /* Ishlayotganlar tepada, rahbar birinchi */
        .sort(
          (a, b) =>
            Number(a.status === 'fired') - Number(b.status === 'fired') ||
            Number(b.role === 'pharmacy_owner') - Number(a.role === 'pharmacy_owner'),
        ),
      shifts: shifts.map((s) => ({
        id: s.id,
        date: toApiDate(s.date),
        sellerName: s.sellerName,
        handedToName: s.handedToName,
        difference: s.difference,
        flagged: s.flagged,
      })),
    }
  }

  /* ------------------------------------------------------------------ */
  /* Yozish                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Apteka ochish — uch narsa BITTA tranzaksiyada: apteka yozuvi,
   * rahbarning kirish hisobi va uning xodim yozuvi. Xodim yozuvisiz
   * rahbar "Xodimlar" ro'yxatida ko'rinmasdi.
   *
   * Login butun platformada band bo'lmasligi kerak — klinika ochishdagi
   * sababdan: bir xil login ikki joyda bo'lsa, yangi parol eski hisobga
   * tekshirilib, "parol noto'g'ri" chiqardi va sababi ko'rinmasdi.
   */
  async create(dto: PharmacyCreateDto) {
    const email = dto.ownerEmail.trim().toLowerCase()

    const taken = await this.db.user.findFirst({
      where: { email, isActive: true },
      select: { clinic: { select: { name: true } } },
    })
    if (taken) {
      throw new BadRequestException(`Bu login "${taken.clinic.name}" da allaqachon ishlatilgan`)
    }

    const password = generatePassword()
    const passwordHash = await argon2.hash(password)
    const fullName = dto.ownerName.trim()
    const ownerPhone = dto.ownerPhone?.trim() ?? ''

    const { clinic, owner } = await this.db.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          kind: 'PHARMACY',
          name: dto.name.trim(),
          city: dto.city?.trim() ?? '',
          address: dto.address.trim(),
          phone: dto.phone?.trim() ?? '',
        },
      })

      const owner = await tx.user.create({
        data: {
          clinicId: clinic.id,
          fullName,
          email,
          phone: ownerPhone,
          passwordHash,
          role: 'PHARMACY_OWNER',
          mustChangePassword: true,
        },
      })

      await tx.pharmacyStaff.create({
        data: {
          clinicId: clinic.id,
          fullName,
          phone: ownerPhone,
          login: email,
          role: 'PHARMACY_OWNER',
          salary: 0,
          workdays: [1, 2, 3, 4, 5],
          shiftStart: '09:00',
          shiftEnd: '18:00',
          hiredAt: todayDate(),
          canReceive: true,
          userId: owner.id,
        },
      })

      return { clinic, owner }
    })

    return {
      pharmacy: this.apiPharmacy(clinic, owner.id),
      ownerEmail: email,
      /* Parol FAQAT shu javobda — bazada xeshi saqlanadi */
      ownerPassword: password,
    }
  }

  async update(id: string, dto: PharmacyUpdateDto) {
    await this.requirePharmacy(id)
    const row = await this.db.clinic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      },
    })
    const owner = await this.owner(id)
    return this.apiPharmacy(row, owner?.id ?? null)
  }

  /**
   * To'xtatish — MA'LUMOT O'CHIRILMAYDI. Xodimlar kira olmaydi va
   * qo'ldagi tokenlari ham darhol ishlamay qoladi (`jwt.strategy.ts`
   * har so'rovda tekshiradi). Yoqilganda ish shu joydan davom etadi.
   */
  async suspend(id: string, reason: string) {
    await this.requirePharmacy(id)
    const row = await this.db.clinic.update({
      where: { id },
      data: { isActive: false, suspendReason: reason.trim() },
    })
    const owner = await this.owner(id)
    return this.apiPharmacy(row, owner?.id ?? null)
  }

  async activate(id: string) {
    await this.requirePharmacy(id)
    const row = await this.db.clinic.update({
      where: { id },
      data: { isActive: true, suspendReason: '' },
    })
    const owner = await this.owner(id)
    return this.apiPharmacy(row, owner?.id ?? null)
  }

  /**
   * Rahbar parolini tiklash — pochta xizmati yo'q, rahbar parolini
   * unutsa boshqa yo'l qolmaydi. Sessiyalari uziladi, kirgach
   * almashtirish so'raladi. Parol FAQAT shu javobda.
   */
  async resetOwnerPassword(id: string) {
    await this.requirePharmacy(id)
    const owner = await this.db.user.findFirst({
      where: { clinicId: id, role: 'PHARMACY_OWNER', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, fullName: true },
    })
    if (!owner) throw new NotFoundException('Bu aptekada faol rahbar topilmadi')

    const password = generatePassword()
    await this.db.user.update({
      where: { id: owner.id },
      data: {
        passwordHash: await argon2.hash(password),
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    })

    return { ownerName: owner.fullName, ownerEmail: owner.email, password }
  }
}
