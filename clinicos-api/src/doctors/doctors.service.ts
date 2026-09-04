import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Doctor } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { DoctorInputDto, DoctorRangeQueryDto, EarningsQueryDto } from './doctors.dto'

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Qisqa ro'yxat — formalardagi tanlov uchun.
   *
   * FAQAT ism va mutaxassislik qaytadi: telefon, email va qabul
   * narxi bu yerda kerak emas. Shu sababli u `doctors.view`
   * talab qilmaydi — kalendar filtri va qabul formasi har bir
   * xodimga kerak, lekin ularga hamkasbning maoshi yoki
   * kontakti kerak emas.
   */
  async listShort() {
    const rows = await this.db.doctor.findMany({
      where: { status: { not: 'INACTIVE' } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, specialty: true, status: true },
    })

    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      specialty: row.specialty,
      status: toApi(row.status),
    }))
  }

  async list(search: string) {
    const needle = search.trim()
    const rows = await this.db.doctor.findMany({
      where: needle
        ? {
            OR: [
              { fullName: { contains: needle, mode: 'insensitive' } },
              { specialty: { contains: needle, mode: 'insensitive' } },
              { phone: { contains: needle } },
            ],
          }
        : {},
      orderBy: { fullName: 'asc' },
    })

    const stats = await this.statsFor(rows.map((r) => r.id))
    return rows.map((row) => ({ ...toApiDoctor(row), stats: stats[row.id] }))
  }

  async get(id: string) {
    const row = await this.db.doctor.findFirst({ where: { id } })
    if (!row) throw new NotFoundException('Shifokor topilmadi')
    const stats = await this.statsFor([id])
    return { ...toApiDoctor(row), stats: stats[id] }
  }

  /**
   * Shifokorlar statistikasi.
   *
   * Bir nechta guruh so'rovi bilan olinadi — har bir shifokor
   * uchun alohida so'rov yuborilsa, 20 ta shifokorda 100 dan
   * ortiq so'rov bo'lardi.
   */
  private async statsFor(ids: string[]) {
    const empty = {
      appointmentsToday: 0,
      patientsThisMonth: 0,
      revenueThisMonth: 0,
      completedThisMonth: 0,
      noShowRate: 0,
      averageCheck: 0,
    }
    const out: Record<string, typeof empty> = {}
    for (const id of ids) out[id] = { ...empty }
    if (ids.length === 0) return out

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [today, month, revenue] = await Promise.all([
      this.db.appointment.groupBy({
        by: ['doctorId'],
        where: {
          doctorId: { in: ids },
          startsAt: { gte: startOfDay(now), lte: endOfDay(now) },
        },
        _count: { _all: true },
      }),
      this.db.appointment.groupBy({
        by: ['doctorId', 'status'],
        where: { doctorId: { in: ids }, startsAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      this.db.payment.groupBy({
        by: ['doctorId'],
        where: {
          doctorId: { in: ids },
          status: 'PAID',
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    for (const row of today) {
      out[row.doctorId].appointmentsToday = row._count._all
    }

    // Oylik: tugallangan, kelmagan va jami
    const monthTotals = new Map<string, { total: number; completed: number; noShow: number }>()
    for (const row of month) {
      const acc = monthTotals.get(row.doctorId) ?? { total: 0, completed: 0, noShow: 0 }
      acc.total += row._count._all
      if (row.status === 'COMPLETED') acc.completed += row._count._all
      if (row.status === 'NO_SHOW') acc.noShow += row._count._all
      monthTotals.set(row.doctorId, acc)
    }
    for (const [id, acc] of monthTotals) {
      out[id].completedThisMonth = acc.completed
      out[id].patientsThisMonth = acc.completed
      out[id].noShowRate = acc.total ? Math.round((acc.noShow / acc.total) * 1000) / 10 : 0
    }

    for (const row of revenue) {
      const sum = row._sum.amount ?? 0
      out[row.doctorId].revenueThisMonth = sum
      out[row.doctorId].averageCheck = row._count._all
        ? Math.round(sum / row._count._all)
        : 0
    }

    return out
  }

  async appointments(id: string, query: DoctorRangeQueryDto) {
    await this.assertExists(id)
    const rows = await this.db.appointment.findMany({
      where: {
        doctorId: id,
        ...(query.from || query.to
          ? {
              startsAt: {
                ...(query.from ? { gte: startOfDay(new Date(query.from)) } : {}),
                ...(query.to ? { lte: endOfDay(new Date(query.to)) } : {}),
              },
            }
          : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true, specialty: true } },
        service: { select: { id: true, name: true, price: true, durationMinutes: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 500,
    })

    return rows.map((a) => ({
      id: a.id,
      clinicId: a.clinicId,
      patientId: a.patientId,
      doctorId: a.doctorId,
      serviceId: a.serviceId,
      startsAt: toApiDateTime(a.startsAt)!,
      durationMinutes: a.durationMinutes,
      status: toApi(a.status),
      paymentStatus: toApi(a.paymentStatus),
      notes: a.notes,
      checkedInAt: toApiDateTime(a.checkedInAt),
      completedAt: toApiDateTime(a.completedAt),
      cancelledAt: toApiDateTime(a.cancelledAt),
      cancelReason: a.cancelReason,
      createdBy: a.createdById,
      createdAt: toApiDateTime(a.createdAt)!,
      patient: a.patient,
      doctor: a.doctor,
      service: a.service,
    }))
  }

  async patients(id: string) {
    await this.assertExists(id)
    const rows = await this.db.patient.findMany({
      where: {
        OR: [{ primaryDoctorId: id }, { appointments: { some: { doctorId: id } } }],
      },
      orderBy: { fullName: 'asc' },
      take: 500,
    })

    return rows.map((p) => ({
      id: p.id,
      clinicId: p.clinicId,
      fullName: p.fullName,
      phone: p.phone,
      birthDate: toApiDate(p.birthDate)!,
      gender: toApi(p.gender),
      address: p.address,
      notes: p.notes,
      status: toApi(p.status),
      primaryDoctorId: p.primaryDoctorId,
      createdAt: toApiDateTime(p.createdAt)!,
    }))
  }

  async create(dto: DoctorInputDto) {
    const { clinicId } = this.ctx.require()
    const row = await this.db.doctor.create({
      data: {
        clinicId,
        fullName: dto.fullName.trim(),
        specialty: dto.specialty,
        phone: dto.phone.trim(),
        email: dto.email.trim(),
        consultationFee: dto.consultationFee,
        workdays: dto.workdays,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
        status: toDb(dto.status),
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : new Date(),
      },
    })
    return toApiDoctor(row)
  }

  async update(id: string, dto: Partial<DoctorInputDto>) {
    await this.assertExists(id)
    const row = await this.db.doctor.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        specialty: dto.specialty,
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        consultationFee: dto.consultationFee,
        workdays: dto.workdays,
        shiftStart: dto.shiftStart,
        shiftEnd: dto.shiftEnd,
        status: dto.status ? toDb(dto.status) : undefined,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
      },
    })
    return toApiDoctor(row)
  }

  /**
   * Shifokorni o'chirish.
   *
   * Qabul yoki to'lov bo'lgan bo'lsa — o'chirilmaydi, `inactive`
   * ga o'tadi. Aks holda eski qabullar "qaysi shifokor" degan
   * savolga javobsiz qolardi.
   */
  async remove(id: string) {
    await this.assertExists(id)
    const used =
      (await this.db.appointment.count({ where: { doctorId: id } })) +
      (await this.db.payment.count({ where: { doctorId: id } }))

    if (used > 0) {
      await this.db.doctor.update({ where: { id }, data: { status: 'INACTIVE' } })
      return { archived: true }
    }

    await this.db.doctor.delete({ where: { id } })
    return { archived: false }
  }

  /**
   * Shifokor daromadi.
   *
   * MAXFIYLIK: shifokor faqat O'Z daromadini ko'radi. Boshqa
   * shifokorniki — faqat egasida.
   */
  async earnings(doctorId: string, query: EarningsQueryDto) {
    const { role, doctorId: ownId, permissions } = this.ctx.require()

    if (role === 'DOCTOR' && doctorId !== ownId) {
      throw new ForbiddenException('Faqat o‘z daromadingizni ko‘rasiz')
    }
    if (role !== 'DOCTOR' && !permissions.includes('staff.manage')) {
      throw new ForbiddenException('Bu amalga ruxsatingiz yo‘q')
    }

    await this.assertExists(doctorId)

    // "2026-09" → o'sha oyning boshi va oxiri
    const [year, month] = query.period.split('-').map(Number)
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0, 23, 59, 59, 999)

    const staff = await this.db.staff.findFirst({ where: { doctorId } })

    const [revenue, completed, bonuses] = await Promise.all([
      this.db.payment.aggregate({
        where: { doctorId, status: 'PAID', paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.db.appointment.count({
        where: { doctorId, status: 'COMPLETED', startsAt: { gte: from, lte: to } },
      }),
      staff
        ? this.db.bonus.findMany({
            where: { staffId: staff.id, period: query.period },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    const generatedRevenue = revenue._sum.amount ?? 0
    const salary = staff?.salary ?? 0
    const workRate = staff?.workRate ?? 100
    const percentRate = staff?.percentRate ?? 0
    const payType = staff ? toApi(staff.payType) : 'salary'

    // Yarim stavkada oylik ham yarim
    const baseSalary =
      payType === 'percent' ? 0 : Math.round((salary * workRate) / 100)
    const percentEarnings =
      payType === 'salary' ? 0 : Math.round((generatedRevenue * percentRate) / 100)

    const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0)

    return {
      doctorId,
      period: query.period,
      payType,
      salary,
      workRate,
      percentRate,
      baseSalary,
      generatedRevenue,
      percentEarnings,
      bonuses: bonuses.map((b) => ({
        id: b.id,
        clinicId: b.clinicId,
        staffId: b.staffId,
        staffName: '',
        period: b.period,
        amount: b.amount,
        reason: b.reason,
        source: toApi(b.source),
        ruleId: b.ruleId,
        status: toApi(b.status),
        createdBy: b.createdById,
        createdAt: toApiDateTime(b.createdAt)!,
        paidAt: toApiDateTime(b.paidAt),
      })),
      bonusTotal,
      total: baseSalary + percentEarnings + bonusTotal,
      completedAppointments: completed,
      averageCheck: revenue._count._all
        ? Math.round(generatedRevenue / revenue._count._all)
        : 0,
    }
  }

  private async assertExists(id: string) {
    const found = await this.db.doctor.findFirst({
      where: { id },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Shifokor topilmadi')
  }
}

/* ------------------------------------------------------------------ */

function toApiDoctor(row: Doctor) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fullName: row.fullName,
    specialty: row.specialty,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatarUrl,
    consultationFee: row.consultationFee,
    status: toApi(row.status),
    workdays: row.workdays,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    hiredAt: toApiDate(row.hiredAt)!,
    createdAt: toApiDateTime(row.createdAt)!,
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

