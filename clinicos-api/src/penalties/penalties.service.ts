import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Penalty, PenaltyRule } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { PenaltyRuleInputDto, WaiveDto } from './penalties.dto'

/**
 * JARIMALAR.
 *
 * ASOSIY QOIDA: egasi jarimani QO'LDA sola olmaydi. U faqat
 * qoida yozadi, tizim qoidani qo'llaydi. Solingan jarimani
 * kechira oladi, lekin o'chira olmaydi.
 *
 * NEGA: qo'lda solish mumkin bo'lsa, jarima shaxsiy munosabat
 * vositasiga aylanadi va xodimlar tizimga ishonmay qo'yadi.
 * Qoida esa hammaga bir xil qo'llanadi va oldindan ma'lum.
 */
@Injectable()
export class PenaltiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ---------------- Qoidalar ---------------- */

  async listRules() {
    const rows = await this.db.penaltyRule.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(toApiRule)
  }

  async createRule(dto: PenaltyRuleInputDto) {
    const { clinicId } = this.ctx.require()
    const row = await this.db.penaltyRule.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        trigger: toDb(dto.trigger),
        threshold: dto.threshold,
        amountType: toDb(dto.amountType),
        amountValue: dto.amountValue,
        positions: dto.positions.map((p) => toDb(p)),
        isActive: dto.isActive,
      },
    })
    return toApiRule(row)
  }

  async updateRule(id: string, dto: Partial<PenaltyRuleInputDto>) {
    const found = await this.db.penaltyRule.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Qoida topilmadi')

    const row = await this.db.penaltyRule.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        trigger: dto.trigger ? toDb(dto.trigger) : undefined,
        threshold: dto.threshold,
        amountType: dto.amountType ? toDb(dto.amountType) : undefined,
        amountValue: dto.amountValue,
        positions: dto.positions?.map((p) => toDb(p)),
        isActive: dto.isActive,
      },
    })
    return toApiRule(row)
  }

  async removeRule(id: string) {
    const found = await this.db.penaltyRule.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Qoida topilmadi')

    const applied = await this.db.penalty.count({ where: { ruleId: id } })
    if (applied > 0) {
      /*
        Qoida bo'yicha jarima solingan bo'lsa — o'chirilmaydi,
        o'chiriladi (isActive: false). Aks holda solingan jarima
        "qaysi qoida bo'yicha" degan savolga javobsiz qolardi.
      */
      await this.db.penaltyRule.update({ where: { id }, data: { isActive: false } })
      return { deactivated: true }
    }

    await this.db.penaltyRule.delete({ where: { id } })
    return { deactivated: false }
  }

  /* ---------------- Jarimalar ---------------- */

  async list(period: string) {
    const rows = await this.db.penalty.findMany({
      where: { period },
      include: {
        staff: { select: { fullName: true, positionTitle: true } },
        waiver: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    })
    return rows.map(toApiPenalty)
  }

  /** Xodimning o'z jarimalari — o'z profilida ko'rinadi */
  async mine(period: string) {
    const { userId } = this.ctx.require()

    const staff = await this.db.staff.findFirst({
      where: { userId },
      select: { id: true },
    })

    /*
      Xodim yozuvi bo'lmasa — BO'SH ro'yxat, xato emas.

      "Jarimam yo'q" va "yozuvim yo'q" foydalanuvchi uchun bir xil
      natija. 404 qaytarilsa, hali xodimlar ro'yxatiga kiritilmagan
      odamda sahifa buzilib ko'rinardi.
    */
    if (!staff) {
      return { staffId: '', period, items: [], total: 0, waivedTotal: 0 }
    }

    return this.summaryFor(staff.id, period)
  }

  async summaryFor(staffId: string, period: string) {
    const rows = await this.db.penalty.findMany({
      where: { staffId, period },
      include: {
        staff: { select: { fullName: true, positionTitle: true } },
        waiver: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    })

    const items = rows.map(toApiPenalty)
    return {
      staffId,
      period,
      items,
      // Kechirilgan jarima oylikdan ushlanmaydi
      total: rows
        .filter((r) => r.status === 'APPLIED')
        .reduce((sum, r) => sum + r.amount, 0),
      waivedTotal: rows
        .filter((r) => r.status === 'WAIVED')
        .reduce((sum, r) => sum + r.amount, 0),
    }
  }

  /**
   * Jarimani kechirish.
   *
   * Jarima O'CHIRILMAYDI — holati `waived` ga o'tadi va kechirish
   * yozuvi izoh bilan qoladi. Kim, qachon, nima uchun kechirgani
   * ko'rinib turadi.
   */
  async waive(penaltyId: string, dto: WaiveDto) {
    const { clinicId, userId } = this.ctx.require()

    const current = await this.db.penalty.findFirst({
      where: { id: penaltyId },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Jarima topilmadi')
    if (current.status === 'WAIVED') {
      throw new BadRequestException('Bu jarima allaqachon kechirilgan')
    }

    await this.db.$transaction(async (tx) => {
      await tx.penalty.update({
        where: { id: penaltyId },
        data: { status: 'WAIVED' },
      })
      await tx.penaltyWaiver.create({
        data: {
          clinicId,
          penaltyId,
          note: dto.note.trim(),
          createdById: userId,
        },
      })
    })

    return { ok: true }
  }

  /** Kechirishni bekor qilish — jarima yana qo'llanadi */
  async unwaive(penaltyId: string) {
    const current = await this.db.penalty.findFirst({
      where: { id: penaltyId },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Jarima topilmadi')
    if (current.status !== 'WAIVED') {
      throw new BadRequestException('Bu jarima kechirilmagan')
    }

    await this.db.$transaction(async (tx) => {
      await tx.penaltyWaiver.deleteMany({ where: { penaltyId } })
      await tx.penalty.update({
        where: { id: penaltyId },
        data: { status: 'APPLIED' },
      })
    })

    return { ok: true }
  }
}

/* ------------------------------------------------------------------ */

function toApiPenalty(
  row: Penalty & {
    staff: { fullName: string; positionTitle: string }
    waiver: { id: string } | null
  },
) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    staffId: row.staffId,
    staffName: row.staff.fullName,
    positionTitle: row.staff.positionTitle,
    period: row.period,
    date: toApiDate(row.date)!,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    trigger: toApi(row.trigger),
    amount: row.amount,
    reason: row.reason,
    status: toApi(row.status),
  }
}

function toApiRule(row: PenaltyRule) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    trigger: toApi(row.trigger),
    threshold: row.threshold,
    amountType: toApi(row.amountType),
    amountValue: row.amountValue,
    positions: row.positions.map((p) => toApi(p)),
    isActive: row.isActive,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
