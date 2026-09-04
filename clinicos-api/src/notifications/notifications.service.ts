import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { RequestContext } from '../common/request-context'

/**
 * Bildirishnomalar.
 *
 * Saqlanmaydi — HAR SAFAR hisoblanadi. Sabab: ular hozirgi
 * holatni ko'rsatadi ("11 ta qabul tasdiqlanmagan"). Saqlansa,
 * qabul tasdiqlangandan keyin ham eski son turib qolardi.
 *
 * Har bir bildirishnoma foydalanuvchining ruxsatiga qarab
 * chiqadi: shifokorga kassa haqidagi eslatma kerak emas.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async list() {
    const { permissions, role, doctorId } = this.ctx.require()
    const now = new Date()
    const from = startOfDay(now)
    const to = endOfDay(now)

    const mine = role === 'DOCTOR' && doctorId ? { doctorId } : {}

    const [today, unconfirmed, unpaid, followUps, noShows] = await Promise.all([
      this.db.appointment.count({ where: { ...mine, startsAt: { gte: from, lte: to } } }),
      this.db.appointment.count({
        where: { ...mine, status: 'SCHEDULED', startsAt: { gte: from, lte: to } },
      }),
      permissions.includes('payments.view')
        ? this.db.appointment.count({
            where: { status: 'COMPLETED', paymentStatus: { not: 'PAID' } },
          })
        : Promise.resolve(0),
      this.db.followUp.count({
        where: { ...mine, status: 'PENDING', recommendedDate: { lte: to } },
      }),
      this.db.appointment.count({
        where: { ...mine, status: 'NO_SHOW', startsAt: { gte: from, lte: to } },
      }),
    ])

    const out: {
      id: string
      clinicId: string
      kind: string
      count: number
      href: string
      severity: 'info' | 'warn' | 'bad'
      createdAt: string
      readAt: null
    }[] = []

    const { clinicId } = this.ctx.require()
    const add = (
      kind: string,
      count: number,
      href: string,
      severity: 'info' | 'warn' | 'bad',
    ) => {
      if (count > 0) {
        out.push({
          id: kind,
          clinicId,
          kind,
          count,
          href,
          severity,
          createdAt: now.toISOString(),
          readAt: null,
        })
      }
    }

    add('appointments_today', today, '/appointments', 'info')
    add('unconfirmed', unconfirmed, '/appointments', 'warn')
    add('pending_payments', unpaid, '/payments', 'bad')
    add('follow_ups_due', followUps, '/patients', 'info')
    add('no_shows', noShows, '/appointments', 'warn')

    return out
  }
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
