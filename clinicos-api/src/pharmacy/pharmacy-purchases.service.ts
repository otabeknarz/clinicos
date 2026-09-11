import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { MedicineForm, Purchase, PurchaseItem, PurchasePayment } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { PharmacyContextService } from './pharmacy-context.service'
import { CreatePurchaseDto, SupplierCreateDto } from './pharmacy.dto'
import { apiSupplier, dateOnly, daysAgo, localDate } from './pharmacy.shared'

/**
 * APTEKA: ta'minotchilar va kirim — tovar bazaga faqat shu yerdan tushadi.
 */
@Injectable()
export class PharmacyPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly pctx: PharmacyContextService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ------------------------------------------------------------------ */
  /* Ta'minotchilar                                                      */
  /* ------------------------------------------------------------------ */

  async listSuppliers() {
    const rows = await this.db.supplier.findMany({ orderBy: { name: 'asc' } })
    return rows.map(apiSupplier)
  }

  async createSupplier(dto: SupplierCreateDto) {
    const { clinicId } = this.ctx.require()
    const row = await this.db.supplier.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() ?? '',
        inn: dto.inn?.trim() ?? '',
        note: dto.note?.trim() ?? '',
      },
    })
    return apiSupplier(row)
  }

  /**
   * Ta'minotchilarga qarz — HISOBLANADI, saqlanmaydi: saqlangan qoldiq
   * kirimlar bilan ziddiyatga tushardi. Klinikadagi bemor qarzi ham shunday.
   */
  async supplierDebts() {
    const purchases = await this.db.purchase.findMany({
      where: { payment: { in: ['PARTIAL', 'CREDIT'] } },
      select: { supplierId: true, supplierName: true, total: true, paidAmount: true, dueDate: true },
    })

    const map = new Map<
      string,
      { supplierId: string; supplierName: string; remaining: number; invoices: number; oldestDue: Date | null }
    >()
    for (const p of purchases) {
      const remaining = p.total - p.paidAmount
      if (remaining <= 0) continue
      const key = p.supplierId ?? 'none'
      const acc = map.get(key) ?? {
        supplierId: key,
        supplierName: p.supplierName,
        remaining: 0,
        invoices: 0,
        oldestDue: null,
      }
      acc.remaining += remaining
      acc.invoices += 1
      if (p.dueDate && (!acc.oldestDue || p.dueDate < acc.oldestDue)) acc.oldestDue = p.dueDate
      map.set(key, acc)
    }

    return [...map.values()]
      .sort((a, b) => b.remaining - a.remaining)
      .map((row) => ({ ...row, oldestDue: toApiDate(row.oldestDue) }))
  }

  /* ------------------------------------------------------------------ */
  /* Kirim                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Hujjat rasmlari bazada KALIT bo'lib turadi, javobda esa 15 daqiqalik
   * imzolangan havolaga aylanadi. Umumiy interseptor bu yerga yetmaydi:
   * u faqat `*Url` nomli BITTA qatorni imzolaydi, ro'yxatni emas.
   */
  private async apiPurchase(p: Purchase & { items: PurchaseItem[] }) {
    const documents = (
      await Promise.all(p.documents.map((key) => this.storage.signedUrl(key)))
    ).filter((url): url is string => Boolean(url))

    return {
      id: p.id,
      clinicId: p.clinicId,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      invoiceNumber: p.invoiceNumber,
      receivedAt: toApiDate(p.receivedAt),
      items: p.items.map((it) => ({
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        batchCode: it.batchCode,
        expiresAt: toApiDate(it.expiresAt),
        quantity: it.quantity,
        buyPrice: it.buyPrice,
        sellPrice: it.sellPrice,
      })),
      total: p.total,
      payment: toApi(p.payment),
      paidAmount: p.paidAmount,
      dueDate: toApiDate(p.dueDate),
      documents,
      receivedById: p.receivedById,
      receivedByName: p.receivedByName,
      note: p.note,
      createdAt: toApiDateTime(p.createdAt),
    }
  }

  async listPurchases(days = 90) {
    const rows = await this.db.purchase.findMany({
      where: { receivedAt: { gte: dateOnly(localDate(daysAgo(days))) } },
      include: { items: true },
      orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return Promise.all(rows.map((row) => this.apiPurchase(row)))
  }

  /**
   * KIRIMNI QABUL QILISH — bitta tranzaksiyada:
   *
   *   1. katalogda yo'q dorilar OCHILADI;
   *   2. har bir qator uchun PARTIYA yaratiladi;
   *   3. sotuv narxi o'zgargan bo'lsa katalogda yangilanadi.
   *
   * Eski partiyalarning tannarxi O'ZGARMAYDI — sotilgan tovarning
   * foydasi qanday hisoblangan bo'lsa, shunday qoladi.
   *
   * Qabul qilgan odam TOKENDAN — mijoz "falonchi qabul qildi" deb
   * yozib qo'ya olmaydi.
   */
  async createPurchase(dto: CreatePurchaseDto) {
    const me = await this.pctx.me()
    const { clinicId } = this.ctx.require()

    const supplier = dto.supplierId
      ? await this.db.supplier.findFirst({ where: { id: dto.supplierId } })
      : null
    if (dto.supplierId && !supplier) throw new NotFoundException('Ta’minotchi topilmadi')

    /*
      Hujjat — faqat SHU aptekaga yuklangan rasm. Aks holda kalitni
      bilgan odam boshqa biznesning faylini o'z kirimiga ilib,
      imzolangan havola orqali ochib olardi.
    */
    const keyPattern = new RegExp(
      `^clinics/${clinicId}/(pharmacy|visits)/[0-9a-fA-F-]{36}\\.(jpg|png|webp)$`,
    )
    for (const key of dto.documents) {
      if (!keyPattern.test(key)) {
        throw new BadRequestException('Hujjat rasmi avval yuklanishi kerak')
      }
    }

    const knownIds = dto.lines.map((l) => l.medicineId).filter((id): id is string => Boolean(id))
    const known = await this.db.medicine.findMany({ where: { id: { in: knownIds } } })
    const byId = new Map(known.map((m) => [m.id, m]))

    for (const line of dto.lines) {
      if (line.medicineId) {
        if (!byId.has(line.medicineId)) throw new NotFoundException('Dori katalogda topilmadi')
      } else if (!line.medicine) {
        throw new BadRequestException('Yangi dori ma’lumoti yetishmayapti')
      }
    }

    const receivedAt = dateOnly(dto.receivedAt)
    const total = dto.lines.reduce((sum, l) => sum + l.buyPrice * l.quantity, 0)
    const paidAmount =
      dto.payment === 'paid' ? total : dto.payment === 'credit' ? 0 : Math.min(dto.paidAmount, total)
    const dueDate = dto.payment === 'paid' || !dto.dueDate ? null : dateOnly(dto.dueDate)
    const stamp = Date.now().toString().slice(-6)

    const purchase = await this.db.$transaction(async (tx) => {
      const items: Omit<PurchaseItem, 'id' | 'purchaseId'>[] = []

      for (const [index, line] of dto.lines.entries()) {
        let medicineId: string
        let medicineName: string

        const existing = line.medicineId ? byId.get(line.medicineId) : undefined
        if (existing) {
          medicineId = existing.id
          medicineName = existing.name
          /* Narx o'zgargan yoki dori arxivda bo'lsa — katalog yangilanadi */
          if (existing.sellPrice !== line.sellPrice || existing.status !== 'ACTIVE') {
            /*
              `updateMany` — tranzaksiya ichida klinika filtrining tashqi
              egalik tekshiruvisiz (izohi `pharmacy-staff.service.ts` da).
            */
            await tx.medicine.updateMany({
              where: { id: existing.id },
              data: { sellPrice: line.sellPrice, status: 'ACTIVE' },
            })
          }
        } else {
          const input = line.medicine!
          const created = await tx.medicine.create({
            data: {
              clinicId,
              name: input.name.trim(),
              form: toDb(input.form) as MedicineForm,
              manufacturer: input.manufacturer?.trim() ?? '',
              country: input.country?.trim() ?? '',
              barcode: input.barcode?.trim() ?? '',
              unit: input.unit?.trim() || 'dona',
              prescriptionOnly: input.prescriptionOnly ?? false,
              sellPrice: line.sellPrice,
            },
          })
          medicineId = created.id
          medicineName = created.name
        }

        items.push({
          clinicId,
          medicineId,
          medicineName,
          batchCode: line.batchCode?.trim() || `P-${stamp}-${index + 1}`,
          expiresAt: dateOnly(line.expiresAt),
          quantity: line.quantity,
          buyPrice: line.buyPrice,
          sellPrice: line.sellPrice,
        })
      }

      const created = await tx.purchase.create({
        data: {
          clinicId,
          supplierId: supplier?.id ?? null,
          supplierName: supplier?.name ?? '',
          invoiceNumber: dto.invoiceNumber?.trim() ?? '',
          receivedAt,
          total,
          payment: toDb(dto.payment) as PurchasePayment,
          paidAmount,
          dueDate,
          documents: dto.documents,
          receivedById: me.id,
          receivedByName: me.fullName,
          note: dto.note?.trim() ?? '',
          items: { create: items },
        },
        include: { items: true },
      })

      await tx.medicineBatch.createMany({
        data: items.map((it) => ({
          clinicId,
          medicineId: it.medicineId,
          code: it.batchCode,
          expiresAt: it.expiresAt,
          quantity: it.quantity,
          buyPrice: it.buyPrice,
          supplierId: supplier?.id ?? null,
          purchaseId: created.id,
          receivedAt,
        })),
      })

      return created
    })

    return this.apiPurchase(purchase)
  }
}
