import { createHash, randomBytes } from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { ExportLink } from '@prisma/client'

import { toApiDateTime } from '../common/api-enum'
import { isPermissionBlocked } from '../common/modules'
import { RequestContext } from '../common/request-context'
import type { RequestUser } from '../common/request-context'
import { DebtsService } from '../debts/debts.service'
import { PrismaService } from '../prisma/prisma.service'
import { toCsv } from './csv'
import { DATASETS, findDataset } from './export.datasets'
import type { ExportDataset, ExportRange, TenantDb } from './export.datasets'
import { CreateExportLinkDto, ExportQueryDto } from './export.dto'

const DEFAULT_LINK_DAYS = 90
const MAX_LINK_DAYS = 180

/**
 * MA'LUMOTNI TASHQARIGA CHIQARISH.
 *
 * Ikki yo'l bor va ikkalasi ham `data.export` ruxsatini talab qiladi:
 *
 *   1. FAYL — bir martalik yuklab olish (Excel).
 *   2. HAVOLA — Google Sheets uchun. Jadval o'zi yangilanib turadi:
 *      `=IMPORTDATA("...")` har safar shu manzildan o'qiydi.
 *
 * Havola parolsiz ochiladi, ya'ni uni bilgan har kim ko'radi.
 * Shuning uchun: token 256 bit, bazada faqat XESHI turadi, muddati
 * bor, egasi istalgan payt bekor qiladi, har ochilishi yoziladi —
 * va u faqat moliya/boshqaruv ro'yxatlariga beriladi
 * (`export.datasets.ts` dagi `sheet` bayrog'i).
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly debts: DebtsService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ------------------------------------------------------------------ */
  /* Bo'limlar                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Shu odam eksport qila oladigan bo'limlar.
   *
   * Ro'yxat SERVERDAN keladi: interfeys o'zi qaror qilsa, ruxsati
   * yo'q bo'lim tugmasi ko'rinib, bosilganda xato chiqardi.
   */
  list() {
    const user = this.ctx.require()
    return DATASETS.filter((dataset) => this.canUse(dataset, user)).map((dataset) => ({
      key: dataset.key,
      sheet: dataset.sheet,
      platform: dataset.platform ?? false,
    }))
  }

  private canUse(dataset: ExportDataset, user: RequestUser): boolean {
    if (!user.permissions.includes('data.export')) return false
    if (!user.permissions.includes(dataset.permission)) return false
    /* Modul o'chirilgan bo'lsa, bo'lim yo'q — fayl orqali ham chiqmaydi */
    return !isPermissionBlocked(dataset.permission, user.disabledModules)
  }

  private requireDataset(key: string): ExportDataset {
    const dataset = findDataset(key)
    if (!dataset) throw new NotFoundException('Bunday bo‘lim yo‘q')
    if (!this.canUse(dataset, this.ctx.require())) {
      throw new ForbiddenException('Bu bo‘limni eksport qila olmaysiz')
    }
    return dataset
  }

  async csv(key: string, query: ExportQueryDto) {
    const dataset = this.requireDataset(key)
    return this.render(dataset, this.db, parseRange(query))
  }

  private async render(dataset: ExportDataset, db: TenantDb, range: ExportRange) {
    const rows = await dataset.rows({
      db,
      all: this.prisma.acrossAllClinics(),
      debts: this.debts,
      range,
    })
    return {
      filename: `${dataset.file}-${today()}.csv`,
      body: toCsv(dataset.headers, rows),
    }
  }

  /* ------------------------------------------------------------------ */
  /* Google Sheets havolalari                                            */
  /* ------------------------------------------------------------------ */

  async links() {
    const rows = await this.db.exportLink.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(apiLink)
  }

  async createLink(dto: CreateExportLinkDto) {
    const dataset = this.requireDataset(dto.dataset)
    if (!dataset.sheet) {
      throw new BadRequestException(
        'Bu bo‘limga havola berilmaydi — uni faqat fayl qilib yuklash mumkin',
      )
    }

    const user = this.ctx.require()
    const me = await this.db.user.findFirst({
      where: { id: user.userId },
      select: { fullName: true },
    })

    const days = Math.min(dto.days ?? DEFAULT_LINK_DAYS, MAX_LINK_DAYS)
    const expiresAt = new Date(Date.now() + days * 86_400_000)

    /* Token FAQAT shu javobda ko'rinadi — bazada xeshi saqlanadi */
    const token = randomBytes(32).toString('base64url')
    const row = await this.db.exportLink.create({
      data: {
        clinicId: user.clinicId,
        dataset: dataset.key,
        tokenHash: sha256(token),
        createdById: user.userId,
        createdByName: me?.fullName ?? '',
        expiresAt,
      },
    })

    return { ...apiLink(row), path: `/export/sheet/${token}` }
  }

  async revokeLink(id: string) {
    const done = await this.db.exportLink.updateMany({
      where: { id },
      data: { revokedAt: new Date() },
    })
    if (done.count === 0) throw new NotFoundException('Havola topilmadi')
    return { ok: true }
  }

  /**
   * Havola bo'yicha CSV — TOKENSIZ, ochiq marshrut.
   *
   * So'rovda foydalanuvchi yo'q, lekin klinika filtri baribir
   * ishlashi kerak. Shuning uchun kontekst SHU HAVOLA nomidan
   * to'ldiriladi: faqat o'sha klinika va faqat o'sha bo'limning
   * ruxsati. Ya'ni havola o'g'irlansa ham, undan boshqa bo'limni
   * o'qib bo'lmaydi.
   */
  async csvByToken(token: string) {
    const link = await this.prisma.acrossAllClinics().exportLink.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        clinic: {
          select: { id: true, isActive: true, deletedAt: true, disabledModules: true },
        },
      },
    })

    const dataset = link ? findDataset(link.dataset) : undefined
    const dead =
      !link ||
      !dataset ||
      !dataset.sheet ||
      link.revokedAt !== null ||
      link.expiresAt.getTime() < Date.now() ||
      !link.clinic.isActive ||
      link.clinic.deletedAt !== null

    /* Sabab aytilmaydi: havola bor-yo'qligini bilish ham ma'lumot */
    if (dead || !link || !dataset) throw new NotFoundException('Havola ishlamaydi')

    this.ctx.set({
      userId: link.createdById,
      clinicId: link.clinicId,
      role: 'OWNER',
      doctorId: null,
      permissions: ['data.export', dataset.permission],
      disabledModules: link.clinic.disabledModules,
      impersonationId: null,
    })

    await this.prisma.acrossAllClinics().exportLink.update({
      where: { id: link.id },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    })

    return this.render(dataset, this.prisma.forCurrentClinic(), {})
  }
}

/* ------------------------------------------------------------------ */

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function apiLink(row: ExportLink) {
  return {
    id: row.id,
    dataset: row.dataset,
    createdByName: row.createdByName,
    createdAt: toApiDateTime(row.createdAt),
    expiresAt: toApiDateTime(row.expiresAt),
    lastUsedAt: toApiDateTime(row.lastUsedAt),
    useCount: row.useCount,
    revoked: row.revokedAt !== null,
  }
}

function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Oraliqni Date'ga o'giradi.
 *
 * `to` — SHU KUN BILAN BIRGA. "01.09 dan 30.09 gacha" degan odam
 * 30-sentabrni ham kutadi; sana sifatida olinsa, o'sha kun
 * yarim tundan boshlanib, butun kun tushib qolardi.
 */
function parseRange(query: ExportQueryDto): ExportRange {
  const from = query.from ? new Date(query.from) : undefined
  let to: Date | undefined
  if (query.to) {
    to = new Date(query.to)
    if (query.to.length === 10) to.setHours(23, 59, 59, 999)
  }
  return { from, to }
}
