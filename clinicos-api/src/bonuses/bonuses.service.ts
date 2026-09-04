import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Bonus, BonusRule } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { BonusInputDto, BonusRuleInputDto, PeriodQueryDto } from './bonuses.dto'

@Injectable()
export class BonusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ---------------- Bonuslar ---------------- */

  async list(query: PeriodQueryDto) {
    const rows = await this.db.bonus.findMany({
      where: {
        ...(query.period ? { period: query.period } : {}),
        ...(query.staffId ? { staffId: query.staffId } : {}),
      },
      include: { staff: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toApiBonus)
  }

  async create(dto: BonusInputDto) {
    const { clinicId, userId } = this.ctx.require()

    const staff = await this.db.staff.findFirst({ where: { id: dto.staffId } })
    if (!staff) throw new NotFoundException('Xodim topilmadi')

    const row = await this.db.bonus.create({
      data: {
        clinicId,
        staffId: dto.staffId,
        period: dto.period,
        amount: dto.amount,
        reason: dto.reason,
        source: toDb(dto.source),
        ruleId: dto.ruleId,
        createdById: userId,
      },
      include: { staff: { select: { fullName: true } } },
    })
    return toApiBonus(row)
  }

  /**
   * Bonusni to'langan deb belgilash.
   *
   * To'langandan keyin o'zgartirib bo'lmaydi — oylik hisobotining
   * bir qismi bo'lib qoladi.
   */
  async pay(id: string) {
    const current = await this.db.bonus.findFirst({
      where: { id },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Bonus topilmadi')
    if (current.status === 'PAID') {
      throw new BadRequestException('Bu bonus allaqachon to‘langan')
    }

    const row = await this.db.bonus.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: { staff: { select: { fullName: true } } },
    })
    return toApiBonus(row)
  }

  async remove(id: string) {
    const current = await this.db.bonus.findFirst({
      where: { id },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Bonus topilmadi')

    // To'langan bonus o'chirilmaydi — oylik tarixi buzilmasin
    if (current.status === 'PAID') {
      throw new BadRequestException('To‘langan bonusni o‘chirib bo‘lmaydi')
    }

    await this.db.bonus.delete({ where: { id } })
  }

  /* ---------------- Qoidalar ---------------- */

  async listRules() {
    const rows = await this.db.bonusRule.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(toApiRule)
  }

  async createRule(dto: BonusRuleInputDto) {
    const { clinicId } = this.ctx.require()
    const row = await this.db.bonusRule.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        positions: dto.positions.map((p) => toDb(p)),
        minPerformance: dto.minPerformance,
        minRating: dto.minRating,
        rewardType: toDb(dto.rewardType),
        rewardValue: dto.rewardValue,
        isActive: dto.isActive,
      },
    })
    return toApiRule(row)
  }

  async updateRule(id: string, dto: Partial<BonusRuleInputDto>) {
    const found = await this.db.bonusRule.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Qoida topilmadi')

    const row = await this.db.bonusRule.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        positions: dto.positions?.map((p) => toDb(p)),
        minPerformance: dto.minPerformance,
        minRating: dto.minRating,
        rewardType: dto.rewardType ? toDb(dto.rewardType) : undefined,
        rewardValue: dto.rewardValue,
        isActive: dto.isActive,
      },
    })
    return toApiRule(row)
  }

  async removeRule(id: string) {
    const found = await this.db.bonusRule.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Qoida topilmadi')
    // Berilgan bonuslar qoidaga bog'langan — bog'lanish uziladi, bonus qoladi
    await this.db.bonusRule.delete({ where: { id } })
  }

  /**
   * Bonus takliflari.
   *
   * Qoidalarga mos keladigan xodimlarni topadi. TAKLIF, avtomatik
   * berish emas: egasi ko'rib chiqib tasdiqlaydi. Avtomatik
   * berilsa, noto'g'ri hisoblangan ko'rsatkich sababli haqiqiy
   * pul ketib qolardi.
   */
  async suggestions(period: string) {
    const [rules, staff] = await Promise.all([
      this.db.bonusRule.findMany({ where: { isActive: true } }),
      this.db.staff.findMany({ where: { status: 'ACTIVE' } }),
    ])

    if (rules.length === 0) return []

    const monthStart = new Date(`${period}-01T00:00:00`)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const attendance = await this.db.attendance.groupBy({
      by: ['staffId', 'status'],
      where: {
        staffId: { in: staff.map((s) => s.id) },
        date: { gte: monthStart, lt: monthEnd },
      },
      _count: { _all: true },
      _sum: { lateMinutes: true },
    })

    // Allaqachon berilgan bonuslar — takrorlanmasin
    const existing = await this.db.bonus.findMany({
      where: { period },
      select: { staffId: true, ruleId: true },
    })
    const already = new Set(existing.map((e) => `${e.staffId}:${e.ruleId ?? ''}`))

    const perf = new Map<string, number>()
    const acc = new Map<string, { ok: number; total: number; late: number }>()
    for (const a of attendance) {
      const cur = acc.get(a.staffId) ?? { ok: 0, total: 0, late: 0 }
      cur.total += a._count._all
      if (a.status === 'PRESENT' || a.status === 'LATE') cur.ok += a._count._all
      if (a.status === 'LATE') cur.late += a._sum.lateMinutes ?? 0
      acc.set(a.staffId, cur)
    }
    for (const [id, a] of acc) {
      const pct = a.total ? Math.round((a.ok / a.total) * 100) : 0
      perf.set(id, Math.max(0, Math.min(100, pct - Math.round(a.late / 60))))
    }

    const out: unknown[] = []
    for (const rule of rules) {
      for (const person of staff) {
        if (!rule.positions.includes(person.position)) continue
        if (already.has(`${person.id}:${rule.id}`)) continue

        const performancePct = perf.get(person.id) ?? null
        if (performancePct === null || performancePct < rule.minPerformance) continue

        const amount =
          rule.rewardType === 'PERCENT_OF_SALARY'
            ? Math.round((person.salary * rule.rewardValue) / 100)
            : rule.rewardValue

        if (amount <= 0) continue

        out.push({
          staffId: person.id,
          staffName: person.fullName,
          position: toApi(person.position),
          performancePct,
          rating: null,
          amount,
          ruleId: rule.id,
          ruleName: rule.name,
          reason: `${rule.name}: ko‘rsatkich ${performancePct}%`,
        })
      }
    }

    return out
  }
}

/* ------------------------------------------------------------------ */

function toApiBonus(row: Bonus & { staff: { fullName: string } }) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    staffId: row.staffId,
    staffName: row.staff.fullName,
    period: row.period,
    amount: row.amount,
    reason: row.reason,
    source: toApi(row.source),
    ruleId: row.ruleId,
    status: toApi(row.status),
    createdBy: row.createdById,
    createdAt: toApiDateTime(row.createdAt)!,
    paidAt: toApiDateTime(row.paidAt),
  }
}

function toApiRule(row: BonusRule) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    positions: row.positions.map((p) => toApi(p)),
    minPerformance: row.minPerformance,
    minRating: row.minRating,
    rewardType: toApi(row.rewardType),
    rewardValue: row.rewardValue,
    isActive: row.isActive,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
