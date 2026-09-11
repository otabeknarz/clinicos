import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { MedicineForm, Prisma, PrescriptionStatus, SaleMethod } from '@prisma/client'

import { toApiDate, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { PharmacyContextService } from './pharmacy-context.service'
import {
  BatchQueryDto,
  CreateSaleDto,
  MedicinePatchDto,
  MedicineQueryDto,
  PrescriptionQueryDto,
} from './pharmacy.dto'
import {
  EXPIRY_WARN_DAYS,
  LOW_STOCK,
  apiBatch,
  apiMedicine,
  apiPrescription,
  apiSale,
  daysAgo,
  daysLeft,
  localDate,
  saleNet,
  saleProfit,
  startOfToday,
  todayDate,
} from './pharmacy.shared'

/**
 * APTEKA: katalog, zaxira, kassa, retsept va hisobot.
 *
 * Barcha so'rov `forCurrentClinic()` orqali — ya'ni faqat shu
 * aptekaning ma'lumoti. Apteka ham ajratish nuqtai nazaridan
 * alohida mijoz: bir apteka boshqasining dorisini ko'rmaydi.
 */
@Injectable()
export class PharmacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly pctx: PharmacyContextService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ------------------------------------------------------------------ */
  /* Zaxira                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Dori bo'yicha zaxira — PARTIYALARDAN yig'iladi.
   *
   * Dorining o'zida "qancha bor" ustuni yo'q va bo'lmasligi kerak:
   * u partiyalar bilan darrov ziddiyatga tushardi.
   */
  private async stock() {
    const batches = await this.db.medicineBatch.findMany({
      where: { quantity: { gt: 0 } },
      select: { medicineId: true, quantity: true, expiresAt: true, buyPrice: true },
    })

    const byMedicine = new Map<
      string,
      { inStock: number; nearest: Date | null; expiring: number }
    >()
    for (const b of batches) {
      const acc = byMedicine.get(b.medicineId) ?? { inStock: 0, nearest: null, expiring: 0 }
      acc.inStock += b.quantity
      if (!acc.nearest || b.expiresAt < acc.nearest) acc.nearest = b.expiresAt
      if (daysLeft(b.expiresAt) <= EXPIRY_WARN_DAYS) acc.expiring += b.quantity
      byMedicine.set(b.medicineId, acc)
    }
    return { batches, byMedicine }
  }

  /* ------------------------------------------------------------------ */
  /* Katalog                                                             */
  /* ------------------------------------------------------------------ */

  async listMedicines(query: MedicineQueryDto) {
    const search = query.search?.trim()
    const where: Prisma.MedicineWhereInput = {
      status: 'ACTIVE',
      ...(query.prescriptionOnly ? { prescriptionOnly: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { manufacturer: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search } },
            ],
          }
        : {}),
    }

    const [medicines, { byMedicine }] = await Promise.all([
      this.db.medicine.findMany({ where, orderBy: { name: 'asc' } }),
      this.stock(),
    ])

    return medicines
      .map((m) => {
        const s = byMedicine.get(m.id)
        return {
          ...apiMedicine(m),
          inStock: s?.inStock ?? 0,
          nearestExpiry: s?.nearest ? toApiDate(s.nearest) : null,
          expiringSoon: s?.expiring ?? 0,
        }
      })
      .filter((row) => {
        if (query.stock === 'low') return row.inStock > 0 && row.inStock <= LOW_STOCK
        if (query.stock === 'out') return row.inStock === 0
        return true
      })
  }

  private async requireMedicine(id: string) {
    const row = await this.db.medicine.findFirst({ where: { id } })
    if (!row) throw new NotFoundException('Dori topilmadi')
    return row
  }

  /** Katalogdagi dorini tahrirlash. Partiyalarning tannarxiga TEGMAYDI. */
  async updateMedicine(id: string, dto: MedicinePatchDto) {
    await this.requireMedicine(id)

    const data: Prisma.MedicineUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name.trim()
    if (dto.form !== undefined) data.form = toDb(dto.form) as MedicineForm
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer.trim()
    if (dto.country !== undefined) data.country = dto.country.trim()
    if (dto.barcode !== undefined) data.barcode = dto.barcode.trim()
    if (dto.unit !== undefined) data.unit = dto.unit.trim() || 'dona'
    if (dto.prescriptionOnly !== undefined) data.prescriptionOnly = dto.prescriptionOnly
    if (dto.sellPrice !== undefined) data.sellPrice = dto.sellPrice

    return apiMedicine(await this.db.medicine.update({ where: { id }, data }))
  }

  /**
   * Arxivlash — O'CHIRISH EMAS: sotuv tarixi dorining nomiga
   * bog'langan, o'chirilsa o'tgan oyning hisoboti "nomsiz" bo'lardi.
   */
  async archiveMedicine(id: string) {
    await this.requireMedicine(id)
    return apiMedicine(
      await this.db.medicine.update({ where: { id }, data: { status: 'ARCHIVED' } }),
    )
  }

  /* ------------------------------------------------------------------ */
  /* Partiyalar                                                          */
  /* ------------------------------------------------------------------ */

  async listBatches(query: BatchQueryDto) {
    const filter = query.filter ?? 'all'
    const rows = await this.db.medicineBatch.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        medicine: { select: { name: true, unit: true } },
        supplier: { select: { name: true } },
      },
    })

    return rows
      .map((b) => ({
        ...apiBatch(b),
        medicineName: b.medicine.name,
        unit: b.medicine.unit,
        supplierName: b.supplier?.name ?? '',
        daysLeft: daysLeft(b.expiresAt),
      }))
      .filter((row) => {
        if (filter === 'expiring') return row.daysLeft >= 0 && row.daysLeft <= EXPIRY_WARN_DAYS
        if (filter === 'expired') return row.daysLeft < 0
        return true
      })
      /* Muddati yaqinlari tepada — aynan ular e'tibor talab qiladi */
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }

  /* ------------------------------------------------------------------ */
  /* Kassa                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Sotuvga tayyor qatorlar — har bir partiya alohida.
   *
   * FIFO emas, TANLANADI: farmatsevt qutini qo'lida ushlab turibdi va
   * aynan qaysi partiya ekanini biladi. Muddati o'tgani umuman
   * chiqmaydi — uni sotib bo'lmaydi.
   */
  async searchForSale(term?: string) {
    const search = term?.trim()
    if (!search) return []

    const medicines = await this.db.medicine.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 12,
    })
    if (medicines.length === 0) return []

    const batches = await this.db.medicineBatch.findMany({
      where: {
        medicineId: { in: medicines.map((m) => m.id) },
        quantity: { gt: 0 },
        expiresAt: { gte: todayDate() },
      },
      /* Muddati yaqinlari birinchi — ular avval sotilishi kerak */
      orderBy: { expiresAt: 'asc' },
    })

    return medicines.flatMap((medicine) =>
      batches
        .filter((b) => b.medicineId === medicine.id)
        .map((batch) => ({
          medicineId: medicine.id,
          name: medicine.name,
          batchId: batch.id,
          expiresAt: toApiDate(batch.expiresAt),
          price: medicine.sellPrice,
          quantity: 1,
          available: batch.quantity,
          prescriptionOnly: medicine.prescriptionOnly,
        })),
    )
  }

  /**
   * SOTUV.
   *
   * Uch qoida serverda, chunki interfeysni chetlab o'tish mumkin:
   *
   *   1. NARX KATALOGDAN olinadi. Mijoz yuborgan narx qabul qilinsa,
   *      sotuvchi arzon narx yozib farqni cho'ntagiga solardi.
   *   2. SMENADAGI odamgina sotadi (`assertOnDuty`).
   *   3. ZAXIRA ATOMIK kamayadi: `quantity >= n` sharti bilan bitta
   *      so'rovda. Ikki kassa bir vaqtda oxirgi qutini sotsa,
   *      ikkinchisi rad etiladi — zaxira manfiyga tushmaydi.
   *
   * Sotuv O'ZGARMAYDI va o'chirilmaydi — klinika to'lovi kabi.
   */
  async createSale(dto: CreateSaleDto) {
    const me = await this.pctx.me()
    await this.pctx.assertOnDuty(me)
    const { clinicId } = this.ctx.require()

    /* Bir partiya savatda ikki marta bo'lsa — birlashtiriladi */
    const qtyByBatch = new Map<string, number>()
    for (const line of dto.lines) {
      qtyByBatch.set(line.batchId, (qtyByBatch.get(line.batchId) ?? 0) + line.quantity)
    }

    const batches = await this.db.medicineBatch.findMany({
      where: { id: { in: [...qtyByBatch.keys()] } },
      include: { medicine: true },
    })
    if (batches.length !== qtyByBatch.size) {
      throw new NotFoundException('Partiya topilmadi — savatni qayta to‘ldiring')
    }

    const today = todayDate()
    for (const batch of batches) {
      const qty = qtyByBatch.get(batch.id) ?? 0
      if (batch.medicine.status !== 'ACTIVE') {
        throw new BadRequestException(`${batch.medicine.name} katalogdan olingan`)
      }
      if (batch.expiresAt < today) {
        throw new BadRequestException(
          `${batch.medicine.name}: muddati o‘tgan partiyani sotib bo‘lmaydi`,
        )
      }
      if (batch.quantity < qty) {
        throw new BadRequestException(
          `${batch.medicine.name}: zaxirada ${batch.quantity} ta qolgan`,
        )
      }
    }

    const total = batches.reduce(
      (sum, b) => sum + b.medicine.sellPrice * (qtyByBatch.get(b.id) ?? 0),
      0,
    )
    if (dto.discount > total) {
      throw new BadRequestException('Chegirma chek summasidan katta bo‘lolmaydi')
    }

    if (dto.prescriptionId) {
      const rx = await this.db.prescription.findFirst({ where: { id: dto.prescriptionId } })
      if (!rx) throw new NotFoundException('Retsept topilmadi')
      if (rx.status !== 'PENDING') throw new BadRequestException('Retsept allaqachon berilgan')
    }

    const sale = await this.db.$transaction(async (tx) => {
      for (const [batchId, qty] of qtyByBatch) {
        const res = await tx.medicineBatch.updateMany({
          where: { id: batchId, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        })
        if (res.count !== 1) {
          throw new ConflictException('Zaxira o‘zgardi — savatni qayta tekshiring')
        }
      }

      if (dto.prescriptionId) {
        await tx.prescription.updateMany({
          where: { id: dto.prescriptionId, status: 'PENDING' },
          data: { status: 'DISPENSED', dispensedAt: new Date(), dispensedById: me.id },
        })
      }

      return tx.sale.create({
        data: {
          clinicId,
          total,
          discount: dto.discount,
          method: toDb(dto.method) as SaleMethod,
          patientId: dto.patientId || null,
          prescriptionId: dto.prescriptionId || null,
          soldById: me.id,
          soldByName: me.fullName,
          items: {
            create: batches.map((b) => ({
              clinicId,
              medicineId: b.medicineId,
              medicineName: b.medicine.name,
              batchId: b.id,
              quantity: qtyByBatch.get(b.id) ?? 0,
              price: b.medicine.sellPrice,
              buyPrice: b.buyPrice,
            })),
          },
        },
        include: { items: true },
      })
    })

    return apiSale(sale)
  }

  async listSales(days = 7) {
    const rows = await this.db.sale.findMany({
      where: { soldAt: { gte: daysAgo(days) } },
      include: { items: true },
      orderBy: { soldAt: 'desc' },
    })
    return rows.map(apiSale)
  }

  async summary() {
    const [todaySales, { batches, byMedicine }, medicines] = await Promise.all([
      this.db.sale.findMany({
        where: { soldAt: { gte: startOfToday() } },
        include: { items: true },
      }),
      this.stock(),
      this.db.medicine.findMany({ where: { status: 'ACTIVE' }, select: { id: true } }),
    ])

    return {
      todayRevenue: todaySales.reduce((sum, s) => sum + saleNet(s), 0),
      todaySales: todaySales.length,
      todayProfit: todaySales.reduce((sum, s) => sum + saleProfit(s), 0),
      expiringBatches: batches.filter((b) => {
        const left = daysLeft(b.expiresAt)
        return left >= 0 && left <= EXPIRY_WARN_DAYS
      }).length,
      lowStock: medicines.filter((m) => {
        const qty = byMedicine.get(m.id)?.inStock ?? 0
        return qty > 0 && qty <= LOW_STOCK
      }).length,
      outOfStock: medicines.filter((m) => (byMedicine.get(m.id)?.inStock ?? 0) === 0).length,
      stockValue: batches.reduce((sum, b) => sum + b.buyPrice * b.quantity, 0),
    }
  }

  /* ------------------------------------------------------------------ */
  /* Retseptlar                                                          */
  /* ------------------------------------------------------------------ */

  async listPrescriptions(query: PrescriptionQueryDto) {
    const status = query.status ?? 'all'
    const rows = await this.db.prescription.findMany({
      where: status === 'all' ? {} : { status: toDb(status) as PrescriptionStatus },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(apiPrescription)
  }

  /** Retseptni berilgan deb belgilash — faqat smenadagi odam */
  async dispensePrescription(id: string) {
    const me = await this.pctx.me()
    await this.pctx.assertOnDuty(me)

    const row = await this.db.prescription.findFirst({ where: { id } })
    if (!row) throw new NotFoundException('Retsept topilmadi')
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Bu retsept allaqachon yopilgan')
    }

    const res = await this.db.prescription.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DISPENSED', dispensedAt: new Date(), dispensedById: me.id },
    })
    if (res.count !== 1) throw new ConflictException('Retsept holati o‘zgardi')

    return apiPrescription(await this.db.prescription.findFirstOrThrow({ where: { id } }))
  }

  /* ------------------------------------------------------------------ */
  /* Analitika                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Davr hisoboti. Foyda HAR BIR QATORDAN — sotuv narxi minus o'sha
   * partiyaning tannarxi.
   */
  async analytics(days = 30) {
    const sales = await this.db.sale.findMany({
      where: { soldAt: { gte: daysAgo(days) } },
      include: { items: true },
    })

    const revenue = sales.reduce((sum, s) => sum + saleNet(s), 0)
    const profit = sales.reduce((sum, s) => sum + saleProfit(s), 0)

    const dayMap = new Map<string, { revenue: number; profit: number; receipts: number }>()
    const topMap = new Map<
      string,
      { name: string; quantity: number; revenue: number; profit: number }
    >()

    for (const sale of sales) {
      /* Kun — server vaqti bo'yicha, UTC bo'yicha emas */
      const key = localDate(sale.soldAt)
      const day = dayMap.get(key) ?? { revenue: 0, profit: 0, receipts: 0 }
      day.revenue += saleNet(sale)
      day.profit += saleProfit(sale)
      day.receipts += 1
      dayMap.set(key, day)

      for (const item of sale.items) {
        const acc = topMap.get(item.medicineId) ?? {
          name: item.medicineName,
          quantity: 0,
          revenue: 0,
          profit: 0,
        }
        acc.quantity += item.quantity
        acc.revenue += item.price * item.quantity
        acc.profit += (item.price - item.buyPrice) * item.quantity
        topMap.set(item.medicineId, acc)
      }
    }

    /*
      HARAKATSIZ TOVAR — davr ichida bir marta ham sotilmagani.
      Pul javonda turibdi, muddati esa ketyapti.
    */
    const sold = new Set(topMap.keys())
    const batches = await this.db.medicineBatch.findMany({
      where: { quantity: { gt: 0 } },
      include: { medicine: { select: { name: true } } },
    })
    const deadMap = new Map<string, { name: string; quantity: number; value: number }>()
    for (const batch of batches) {
      if (sold.has(batch.medicineId)) continue
      const acc = deadMap.get(batch.medicineId) ?? {
        name: batch.medicine.name,
        quantity: 0,
        value: 0,
      }
      acc.quantity += batch.quantity
      acc.value += batch.quantity * batch.buyPrice
      deadMap.set(batch.medicineId, acc)
    }

    const byMethod = (['cash', 'card', 'transfer'] as const)
      .map((method) => ({
        method,
        total: sales
          .filter((s) => s.method === toDb(method))
          .reduce((sum, s) => sum + saleNet(s), 0),
      }))
      .filter((m) => m.total > 0)

    return {
      revenue,
      profit,
      receipts: sales.length,
      averageReceipt: sales.length ? Math.round(revenue / sales.length) : 0,
      marginPct: revenue ? Math.round((profit / revenue) * 100) : 0,
      byDay: [...dayMap.entries()]
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byMethod,
      top: [...topMap.entries()]
        .map(([medicineId, value]) => ({ medicineId, ...value }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      dead: [...deadMap.entries()]
        .map(([medicineId, value]) => ({ medicineId, ...value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    }
  }
}
