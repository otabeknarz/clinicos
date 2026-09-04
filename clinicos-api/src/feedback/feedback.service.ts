import { Injectable, NotFoundException } from '@nestjs/common'
import { Feedback, Prisma } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { paginated } from '../common/pagination'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import {
  FeedbackInputDto,
  FeedbackQueryDto,
  LookupDto,
  ReplyDto,
  StatsQueryDto,
} from './feedback.dto'

/** Fikr shifokorga necha kundan keyin ko'rinadi — tasodifiy oraliq */
const REVEAL_MIN_DAYS = 1
const REVEAL_MAX_DAYS = 14

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Telefon bo'yicha bemorni topish — fikr qoldirish sahifasi uchun.
   *
   * Javobda TASHXIS yo'q: bu sahifa ochiq havola orqali ochiladi
   * va uni bemorning o'zi to'ldiradi.
   */
  async lookup(dto: LookupDto) {
    const patient = await this.db.patient.findFirst({
      where: { phone: dto.phone.trim() },
      select: { id: true, fullName: true },
    })

    if (!patient) {
      return { found: false, patientId: null, patientName: '', recentVisits: [] }
    }

    const visits = await this.db.appointment.findMany({
      where: { patientId: patient.id, status: 'COMPLETED' },
      include: {
        doctor: { select: { id: true, fullName: true } },
        service: { select: { name: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 5,
    })

    const withFeedback = await this.db.feedback.findMany({
      where: { appointmentId: { in: visits.map((v) => v.id) } },
      select: { appointmentId: true },
    })
    const answered = new Set(withFeedback.map((f) => f.appointmentId))

    return {
      found: true,
      patientId: patient.id,
      patientName: patient.fullName,
      recentVisits: visits.map((v) => ({
        appointmentId: v.id,
        date: toApiDate(v.startsAt)!,
        doctorId: v.doctorId,
        doctorName: v.doctor.fullName,
        serviceName: v.service.name,
        hasFeedback: answered.has(v.id),
      })),
    }
  }

  async list(query: FeedbackQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.FeedbackWhereInput = {
      AND: [
        search ? { text: { contains: search, mode: 'insensitive' } } : {},
        query.rating === 'all' ? {} : { rating: query.rating },
        query.doctorId === 'all' ? {} : { doctorId: query.doctorId },
        query.status === 'all' ? {} : { status: toDb(query.status) },
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.feedback.count({ where }),
    ])

    return paginated(rows.map(toApiFeedback), total, query.page, query.pageSize)
  }

  /**
   * Shifokorning o'zi haqidagi fikrlar.
   *
   * IKKI QAT'IY CHEKLOV:
   *
   *   1. Ism, telefon va bemor id'si OLIB TASHLANADI.
   *   2. Fikr darhol emas, 1-14 kun KECHIKTIRIB ko'rsatiladi.
   *
   * Ikkalasi ham kerak. Faqat ismni olib tashlash yetmaydi:
   * o'sha kuni yetkazilsa, shifokor jadvalidan kim yozganini
   * bemalol topib oladi.
   */
  async forDoctor(days: number) {
    const { doctorId } = this.ctx.require()
    if (!doctorId) return []

    const from = new Date()
    from.setDate(from.getDate() - days)

    const rows = await this.db.feedback.findMany({
      where: {
        doctorId,
        createdAt: { gte: from },
        // Vaqti kelmagan fikr ko'rinmaydi
        revealAt: { lte: new Date() },
      },
      orderBy: { revealAt: 'desc' },
    })

    return rows.map((row) => {
      const api = toApiFeedback(row)
      return {
        ...api,
        // Kim yozgani shifokorga HECH QACHON ko'rinmaydi
        phone: '',
        patientId: null,
        patientName: '',
        appointmentId: null,
      }
    })
  }

  async create(dto: FeedbackInputDto) {
    const { clinicId } = this.ctx.require()

    const revealAt = new Date()
    revealAt.setDate(
      revealAt.getDate() +
        REVEAL_MIN_DAYS +
        Math.floor(Math.random() * (REVEAL_MAX_DAYS - REVEAL_MIN_DAYS + 1)),
    )

    const row = await this.db.feedback.create({
      data: {
        clinicId,
        phone: dto.phone.trim(),
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        appointmentId: dto.appointmentId,
        rating: dto.rating,
        scores: dto.scores as unknown as Prisma.InputJsonValue,
        text: dto.text,
        isAnonymous: dto.isAnonymous,
        revealAt,
      },
    })

    return toApiFeedback(row)
  }

  async reply(id: string, dto: ReplyDto) {
    const found = await this.db.feedback.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Fikr topilmadi')

    const row = await this.db.feedback.update({
      where: { id },
      data: { reply: dto.text.trim(), repliedAt: new Date(), status: 'REVIEWED' },
    })
    return toApiFeedback(row)
  }

  async setStatus(id: string, status: 'new' | 'reviewed' | 'archived') {
    const found = await this.db.feedback.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Fikr topilmadi')

    const row = await this.db.feedback.update({
      where: { id },
      data: { status: toDb(status) },
    })
    return toApiFeedback(row)
  }

  async stats(query: StatsQueryDto) {
    const from = new Date()
    from.setDate(from.getDate() - query.days)

    const rows = await this.db.feedback.findMany({
      where: { createdAt: { gte: from } },
      include: { doctor: { select: { id: true, fullName: true } } },
    })

    const total = rows.length
    const average = total
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : 0

    // 1 dan 5 gacha taqsimot
    const distribution = [1, 2, 3, 4, 5].map(
      (star) => rows.filter((r) => r.rating === star).length,
    )

    const avgScore = (key: string) => {
      const values = rows
        .map((r) => (r.scores as Record<string, number> | null)?.[key])
        .filter((v): v is number => typeof v === 'number')
      return values.length
        ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
        : 0
    }

    const byDoctorMap = new Map<string, { doctorName: string; sum: number; count: number }>()
    for (const r of rows) {
      if (!r.doctorId || !r.doctor) continue
      const acc = byDoctorMap.get(r.doctorId) ?? {
        doctorName: r.doctor.fullName,
        sum: 0,
        count: 0,
      }
      acc.sum += r.rating
      acc.count += 1
      byDoctorMap.set(r.doctorId, acc)
    }

    // Kun bo'yicha o'rtacha
    const byDay = new Map<string, { sum: number; count: number }>()
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10)
      const acc = byDay.get(key) ?? { sum: 0, count: 0 }
      acc.sum += r.rating
      acc.count += 1
      byDay.set(key, acc)
    }

    return {
      average,
      total,
      distribution,
      byScore: {
        doctor: avgScore('doctor'),
        service: avgScore('service'),
        cleanliness: avgScore('cleanliness'),
        waiting: avgScore('waiting'),
      },
      byDoctor: [...byDoctorMap.entries()]
        .map(([doctorId, a]) => ({
          doctorId,
          doctorName: a.doctorName,
          average: Math.round((a.sum / a.count) * 10) / 10,
          count: a.count,
        }))
        .sort((a, b) => b.average - a.average),
      series: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, a]) => ({
          label,
          value: Math.round((a.sum / a.count) * 10) / 10,
        })),
      unanswered: rows.filter((r) => !r.reply).length,
    }
  }
}

/* ------------------------------------------------------------------ */

function toApiFeedback(row: Feedback) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    phone: row.phone,
    patientId: row.patientId,
    patientName: '',
    doctorId: row.doctorId,
    appointmentId: row.appointmentId,
    rating: row.rating,
    scores: (row.scores as Record<string, number>) ?? {},
    text: row.text,
    isAnonymous: row.isAnonymous,
    revealAt: toApiDateTime(row.revealAt)!,
    status: toApi(row.status),
    reply: row.reply,
    repliedAt: toApiDateTime(row.repliedAt),
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
