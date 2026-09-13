import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { FinanceEntryType, PaymentMethod, Prisma } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { escapeHtml, money } from '../common/telegram-text'
import { OwnerAlertsService } from '../telegram/owner-alerts.service'
import { TelegramService } from '../telegram/telegram.service'
import {
  CreateFinanceEntryDto,
  EXPENSE_CATEGORIES,
  FinanceRangeDto,
  INCOME_CATEGORIES,
  VoidFinanceEntryDto,
} from './finance.dto'

/**
 * KIRIM-CHIQIM.
 *
 * Klinikaning butun puli ikki jurnalda:
 *
 *   `Payment`       — bemor to'lovlari (registrator yozadi)
 *   `FinanceEntry`  — qolgan hammasi: xarid, ijara, maosh, soliq va
 *                     bemordan tashqari kirim
 *
 * Hisobot ikkalasini QO'SHIB o'qiydi, lekin bemor to'lovini bu yerga
 * ko'chirmaydi: bitta pul ikki joyda yozilsa, ertami-kechmi ikki xil
 * summa ko'rsatadi va qaysi biri to'g'ri ekanini hech kim ayta olmaydi.
 *
 * YOZUV O'ZGARMAYDI. Tahrir va o'chirish yo'q — faqat bekor qilish,
 * sababi bilan. Kassadan olingan pulning izi bir bosishda yo'qolmasligi
 * kerak.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly storage: StorageService,
    private readonly owners: OwnerAlertsService,
    private readonly telegram: TelegramService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Davr hisoboti — `finance.view`.
   *
   * Bekor qilingan yozuvlar summaga QO'SHILMAYDI, lekin soni alohida
   * qaytadi: egasi "nimalar bekor qilingan" deb ko'ra olishi kerak.
   */
  async summary(query: FinanceRangeDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))

    const [payments, entries] = await Promise.all([
      this.db.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: from, lte: to } },
        select: { amount: true, method: true, paidAt: true },
      }),
      this.db.financeEntry.findMany({
        where: { occurredAt: { gte: from, lte: to } },
        select: {
          type: true,
          category: true,
          amount: true,
          method: true,
          occurredAt: true,
          voidedAt: true,
        },
      }),
    ])

    const active = entries.filter((e) => !e.voidedAt)
    const expenses = active.filter((e) => e.type === 'EXPENSE')
    const incomes = active.filter((e) => e.type === 'INCOME')

    const patientIncome = sum(payments)
    const otherIncome = sum(incomes)
    const expenseTotal = sum(expenses)

    /* Turlar bo'yicha — eng kattasi tepada */
    const byCategory = new Map<string, { type: 'expense' | 'income'; category: string; amount: number; count: number }>()
    for (const e of active) {
      const key = `${e.type}:${e.category}`
      const row = byCategory.get(key) ?? {
        type: toApi(e.type) as 'expense' | 'income',
        category: e.category,
        amount: 0,
        count: 0,
      }
      row.amount += e.amount
      row.count += 1
      byCategory.set(key, row)
    }

    /* Kunlar bo'yicha — grafik uchun. Kun serverning mahalliy yarim tuni. */
    const daily = new Map<string, { date: string; income: number; expense: number }>()
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = localDateKey(d)
      daily.set(key, { date: key, income: 0, expense: 0 })
    }
    for (const p of payments) {
      const row = daily.get(localDateKey(p.paidAt))
      if (row) row.income += p.amount
    }
    for (const e of active) {
      const row = daily.get(localDateKey(e.occurredAt))
      if (!row) continue
      if (e.type === 'INCOME') row.income += e.amount
      else row.expense += e.amount
    }

    return {
      from: localDateKey(from),
      to: localDateKey(to),
      income: {
        patients: patientIncome,
        other: otherIncome,
        total: patientIncome + otherIncome,
      },
      expense: {
        total: expenseTotal,
        /* Kassadan NAQD chiqqan — kassa nazorati bilan solishtirish uchun */
        cash: sum(expenses.filter((e) => e.method === 'CASH')),
      },
      net: patientIncome + otherIncome - expenseTotal,
      /* Bemor to'lovi usul bo'yicha: naqd/karta/o'tkazma */
      patientsByMethod: {
        cash: sum(payments.filter((p) => p.method === 'CASH')),
        card: sum(payments.filter((p) => p.method === 'CARD')),
        transfer: sum(payments.filter((p) => p.method === 'TRANSFER')),
      },
      byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
      daily: [...daily.values()],
      voidedCount: entries.length - active.length,
    }
  }

  /** Davrdagi BARCHA yozuvlar — `finance.view` */
  async list(query: FinanceRangeDto) {
    return this.findEntries(query, {})
  }

  /**
   * Faqat O'ZI yozganlari — `finance.create`.
   *
   * Registrator yoki kassirga chiqim yozish berilganda u butun klinika
   * pulini ko'rmasligi kerak: unga o'z yozuvlari yetadi (kassadan nima
   * bergani), hisobot esa egasida.
   */
  async mine(query: FinanceRangeDto) {
    const { userId } = this.ctx.require()
    return this.findEntries(query, { createdById: userId })
  }

  private async findEntries(query: FinanceRangeDto, extra: Prisma.FinanceEntryWhereInput) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))

    const rows = await this.db.financeEntry.findMany({
      where: {
        ...extra,
        occurredAt: { gte: from, lte: to },
        ...(query.type !== 'all' ? { type: toDb(query.type) as FinanceEntryType } : {}),
      },
      include: {
        createdBy: { select: { fullName: true } },
        voidedBy: { select: { fullName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    })

    return Promise.all(rows.map((row) => this.toApiEntry(row)))
  }

  async create(dto: CreateFinanceEntryDto) {
    const { clinicId, userId } = this.ctx.require()

    const allowed: readonly string[] = dto.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    if (!allowed.includes(dto.category)) {
      throw new BadRequestException('Bu tur tanlangan yo‘nalishga mos emas')
    }

    /*
      Sana kelajakda bo'lmaydi: "ertaga beriladigan" pul hali pul emas.
      O'tmishga esa ruxsat — chek kechikib yozilishi odatiy hol.
    */
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Kelajakdagi sana bilan yozib bo‘lmaydi')
    }

    /*
      Chek — faqat SHU klinikaga yuklangan rasm. Aks holda kalitni
      bilgan odam boshqa klinikaning faylini o'z yozuviga ilib,
      imzolangan havola orqali ochib olardi.
    */
    const receipts = [...new Set(dto.receipts.map((key) => key.trim()).filter(Boolean))]
    const pattern = new RegExp(`^clinics/${clinicId}/finance/[0-9a-fA-F-]{36}\\.(jpg|png|webp)$`)
    if (receipts.some((key) => !pattern.test(key))) {
      throw new BadRequestException('Chek rasmi avval yuklanishi kerak')
    }

    const row = await this.db.financeEntry.create({
      data: {
        clinicId,
        type: toDb(dto.type) as FinanceEntryType,
        category: dto.category,
        amount: dto.amount,
        method: toDb(dto.method) as PaymentMethod,
        occurredAt,
        counterparty: dto.counterparty.trim(),
        note: dto.note.trim(),
        receipts,
        createdById: userId,
      },
      include: {
        createdBy: { select: { fullName: true } },
        voidedBy: { select: { fullName: true } },
      },
    })

    /* Egasiga botdan — kutilmaydi, yozuvni to'xtatmaydi */
    void this.notifyOwners(row, userId)

    return this.toApiEntry(row)
  }

  /**
   * HAR BIR KIRIM-CHIQIM EGASIGA BOTDAN.
   *
   * Ega klinikada har kuni bo'lmaydi, lekin kassadan kim, qancha va
   * nimaga pul berganini o'sha zahoti bilishi kerak — oy oxirida
   * hisobotda ko'rish kech. Egasining O'ZI yozgan yozuv yuborilmaydi.
   */
  private async notifyOwners(row: EntryRow & { clinicId: string }, authorId: string) {
    const expense = row.type === 'EXPENSE'
    const lines = [
      `<b>${expense ? 'Chiqim' : 'Kirim'}: ${expense ? '−' : '+'}${escapeHtml(money(row.amount))}</b>`,
      '',
      `<b>Turi:</b> ${escapeHtml(CATEGORY_LABEL[row.category] ?? row.category)}`,
      `<b>Usul:</b> ${METHOD_LABEL[row.method]}${row.method === 'CASH' ? (expense ? ' — kassadan' : ' — kassaga') : ''}`,
    ]
    if (row.counterparty) lines.push(`<b>${expense ? 'Kimga' : 'Kimdan'}:</b> ${escapeHtml(row.counterparty)}`)
    if (row.note) lines.push(`<b>Izoh:</b> ${escapeHtml(row.note)}`)
    lines.push(`<b>Yozdi:</b> ${escapeHtml(row.createdBy.fullName)}`)
    if (row.receipts.length > 0) lines.push(`📎 ${row.receipts.length} ta rasm biriktirilgan`)

    await this.owners.send(row.clinicId, lines.join('\n'), {
      skipUserId: authorId,
      buttons: [[{ text: 'Kirim-chiqimni ochish', web_app: { url: this.telegram.appLink('/finance') } }]],
    })
  }

  /**
   * Bekor qilish — `finance.void`, faqat egasida.
   *
   * Yozuv o'chmaydi: summadan chiqadi, ro'yxatda esa kim, qachon va nega
   * bekor qilgani bilan qoladi.
   */
  async void(id: string, dto: VoidFinanceEntryDto) {
    const { userId } = this.ctx.require()

    const current = await this.db.financeEntry.findFirst({ where: { id }, select: { voidedAt: true } })
    if (!current) throw new NotFoundException('Yozuv topilmadi')
    if (current.voidedAt) throw new BadRequestException('Yozuv allaqachon bekor qilingan')

    const row = await this.db.financeEntry.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: dto.reason.trim() },
      include: {
        createdBy: { select: { fullName: true } },
        voidedBy: { select: { fullName: true } },
      },
    })

    return this.toApiEntry(row)
  }

  /**
   * Javob shakli. Chek kalitlari 15 daqiqalik imzolangan havolaga
   * aylanadi — umumiy interseptor faqat `*Url` nomli BITTA qatorni
   * imzolaydi, ro'yxatni emas (xuddi apteka kirim hujjatlaridagidek).
   */
  private async toApiEntry(row: EntryRow) {
    const receipts = (
      await Promise.all(row.receipts.map((key) => this.storage.signedUrl(key)))
    ).filter((url): url is string => Boolean(url))

    return {
      id: row.id,
      type: toApi(row.type),
      category: row.category,
      amount: row.amount,
      method: toApi(row.method),
      occurredAt: toApiDateTime(row.occurredAt)!,
      counterparty: row.counterparty,
      note: row.note,
      receipts,
      createdById: row.createdById,
      createdByName: row.createdBy.fullName,
      createdAt: toApiDateTime(row.createdAt)!,
      voidedAt: toApiDateTime(row.voidedAt),
      voidedByName: row.voidedBy?.fullName ?? null,
      voidReason: row.voidReason,
    }
  }
}

/* ------------------------------------------------------------------ */

/** Botdagi xabar uchun — interfeysdagi nomlar bilan bir xil */
const CATEGORY_LABEL: Record<string, string> = {
  purchase: 'Xarid va buyurtma',
  supplies: 'Dori va sarf materiallari',
  salary: 'Maosh va avans',
  rent: 'Ijara',
  utilities: 'Kommunal va internet',
  repair: 'Ta’mirlash va jihoz',
  marketing: 'Reklama',
  taxes: 'Soliq va to‘lovlar',
  transport: 'Transport',
  food: 'Oziq-ovqat',
  other: 'Boshqa chiqim',
  rent_income: 'Ijaradan kirim',
  investment: 'Egasi qo‘shgan pul',
  insurance: 'Sug‘urta',
  partner: 'Hamkordan ulush',
  other_income: 'Boshqa kirim',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Naqd',
  CARD: 'Karta',
  TRANSFER: 'O‘tkazma',
}

interface EntryRow {
  id: string
  type: FinanceEntryType
  category: string
  amount: number
  method: PaymentMethod
  occurredAt: Date
  counterparty: string
  note: string
  receipts: string[]
  createdById: string
  createdAt: Date
  voidedAt: Date | null
  voidReason: string
  createdBy: { fullName: string }
  voidedBy: { fullName: string } | null
}

function sum(rows: { amount: number }[]): number {
  return rows.reduce((total, row) => total + row.amount, 0)
}

/** Serverning mahalliy kuni — `toISOString` UTC beradi va 19:00 dan keyin adashadi */
function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
