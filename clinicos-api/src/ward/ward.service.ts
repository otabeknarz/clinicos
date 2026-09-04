import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import {
  AdmissionInputDto,
  AdmissionQueryDto,
  RoomInputDto,
  WardRangeDto,
} from './ward.dto'

const ADMISSION_EXPAND = {
  patient: { select: { id: true, fullName: true, phone: true } },
  doctor: { select: { id: true, fullName: true, specialty: true } },
  room: { select: { id: true, number: true, category: true, dailyRate: true } },
  bed: { select: { id: true, label: true } },
} satisfies Prisma.AdmissionInclude

type AdmissionRow = Prisma.AdmissionGetPayload<{ include: typeof ADMISSION_EXPAND }>

@Injectable()
export class WardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ---------------- Palatalar ---------------- */

  async listRooms() {
    const rows = await this.db.room.findMany({
      include: { beds: { orderBy: { label: 'asc' } } },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    })

    return rows.map((r) => ({
      id: r.id,
      clinicId: r.clinicId,
      number: r.number,
      floor: r.floor,
      category: toApi(r.category),
      dailyRate: r.dailyRate,
      status: toApi(r.status),
      notes: r.notes,
      createdAt: toApiDateTime(r.createdAt)!,
      beds: r.beds.map((b) => ({
        id: b.id,
        clinicId: b.clinicId,
        roomId: b.roomId,
        label: b.label,
        status: toApi(b.status),
        createdAt: toApiDateTime(b.createdAt)!,
      })),
    }))
  }

  async createRoom(dto: RoomInputDto) {
    const { clinicId } = this.ctx.require()
    try {
      const row = await this.db.room.create({
        data: {
          clinicId,
          number: dto.number.trim(),
          floor: dto.floor,
          category: toDb(dto.category),
          dailyRate: dto.dailyRate,
          status: toDb(dto.status),
          notes: dto.notes,
          // Har bir palataga ko'rsatilgan sondagi joy yaratiladi
          beds: {
            create: Array.from({ length: dto.bedCount }, (_, i) => ({
              clinicId,
              label: `${dto.number.trim()}-${i + 1}`,
            })),
          },
        },
        include: { beds: true },
      })
      return { id: row.id, bedCount: row.beds.length }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu raqamli palata allaqachon bor')
      }
      throw error
    }
  }

  async updateRoom(id: string, dto: Partial<RoomInputDto>) {
    const found = await this.db.room.findFirst({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Palata topilmadi')

    /*
      `dailyRate` o'zgarishi YOTGAN bemorlarga ta'sir qilmaydi:
      ularning narxi joylashtirish paytida muzlatilgan.
    */
    const row = await this.db.room.update({
      where: { id },
      data: {
        number: dto.number?.trim(),
        floor: dto.floor,
        category: dto.category ? toDb(dto.category) : undefined,
        dailyRate: dto.dailyRate,
        status: dto.status ? toDb(dto.status) : undefined,
        notes: dto.notes,
      },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      number: row.number,
      floor: row.floor,
      category: toApi(row.category),
      dailyRate: row.dailyRate,
      status: toApi(row.status),
      notes: row.notes,
      createdAt: toApiDateTime(row.createdAt)!,
    }
  }

  /* ---------------- Joylashtirish ---------------- */

  async listAdmissions(query: AdmissionQueryDto) {
    const search = query.search?.trim() ?? ''

    const rows = await this.db.admission.findMany({
      where: {
        AND: [
          query.status === 'all' ? {} : { status: toDb(query.status) },
          search
            ? { patient: { fullName: { contains: search, mode: 'insensitive' } } }
            : {},
        ],
      },
      include: ADMISSION_EXPAND,
      orderBy: { admittedAt: 'desc' },
      take: 300,
    })

    return rows.map(toApiAdmission)
  }

  /**
   * Bemorni joylashtirish.
   *
   * Joy band bo'lsa qabul qilinmaydi. Tekshiruv va yozuv bitta
   * tranzaksiyada: ikki registrator bir vaqtda bir joyga
   * joylashtirmasin.
   */
  async admit(dto: AdmissionInputDto) {
    const { clinicId, userId } = this.ctx.require()

    const bed = await this.db.bed.findFirst({
      where: { id: dto.bedId },
      include: { room: { select: { id: true, dailyRate: true, status: true } } },
    })
    if (!bed) throw new NotFoundException('Joy topilmadi')
    if (bed.status !== 'FREE') throw new ConflictException('Bu joy band')
    if (bed.room.status !== 'ACTIVE') {
      throw new BadRequestException('Palata ta’mirda')
    }

    await this.requireOwn('patient', dto.patientId, 'Bemor topilmadi')
    await this.requireOwn('doctor', dto.doctorId, 'Shifokor topilmadi')

    const row = await this.db.$transaction(async (tx) => {
      // Joyni band qilamiz — agar oradan boshqasi ulgurgan bo'lsa, 0 qaytadi
      const taken = await tx.bed.updateMany({
        where: { id: dto.bedId, status: 'FREE' },
        data: { status: 'OCCUPIED' },
      })
      if (taken.count === 0) throw new ConflictException('Bu joy endigina band bo‘ldi')

      return tx.admission.create({
        data: {
          clinicId,
          patientId: dto.patientId,
          doctorId: dto.doctorId,
          roomId: bed.room.id,
          bedId: dto.bedId,
          admittedAt: dto.admittedAt ? new Date(dto.admittedAt) : new Date(),
          expectedDischargeAt: dto.expectedDischargeAt
            ? new Date(dto.expectedDischargeAt)
            : null,
          status: 'ACTIVE',
          diagnosis: dto.diagnosis,
          // Narx joylashtirish paytida MUZLATILADI
          dailyRate: bed.room.dailyRate,
          notes: dto.notes,
          createdById: userId,
        },
        include: ADMISSION_EXPAND,
      })
    })

    return toApiAdmission(row)
  }

  async discharge(id: string) {
    const current = await this.db.admission.findFirst({
      where: { id },
      select: { id: true, status: true, bedId: true },
    })
    if (!current) throw new NotFoundException('Yozuv topilmadi')
    if (current.status === 'DISCHARGED') {
      throw new BadRequestException('Bemor allaqachon chiqarilgan')
    }

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.admission.update({
        where: { id },
        data: { status: 'DISCHARGED', dischargedAt: new Date() },
        include: ADMISSION_EXPAND,
      })
      await tx.bed.update({ where: { id: current.bedId }, data: { status: 'FREE' } })
      return updated
    })

    return toApiAdmission(row)
  }

  /**
   * Joylar taxtasi — kalendar ko'rinishi.
   *
   * Har bir joy uchun qaysi kunlarda kim yotgani. `fromIndex` va
   * `toIndex` — kunlar massividagi o'rin, shu tufayli frontend
   * sanani qayta hisoblamaydi.
   */
  async bedBoard(query: WardRangeDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))
    const days = eachDay(from, to)

    const [beds, admissions] = await Promise.all([
      this.db.bed.findMany({
        include: { room: { select: { id: true, number: true, category: true } } },
        orderBy: { label: 'asc' },
      }),
      this.db.admission.findMany({
        where: {
          admittedAt: { lte: to },
          OR: [{ dischargedAt: null }, { dischargedAt: { gte: from } }],
        },
        include: {
          patient: { select: { id: true, fullName: true } },
          doctor: { select: { fullName: true } },
        },
      }),
    ])

    const rows = beds.map((bed) => {
      const spans = admissions
        .filter((a) => a.bedId === bed.id)
        .map((a) => {
          const start = a.admittedAt
          const end = a.dischargedAt ?? to
          const fromIndex = days.findIndex((d) => isSameDay(d, start))
          const toIndexRaw = days.findIndex((d) => isSameDay(d, end))
          return {
            admissionId: a.id,
            patientId: a.patientId,
            patientName: a.patient.fullName,
            doctorName: a.doctor.fullName,
            status: toApi(a.status),
            fromIndex: fromIndex === -1 ? 0 : fromIndex,
            toIndex: toIndexRaw === -1 ? days.length - 1 : toIndexRaw,
            continuesBefore: start < from,
            continuesAfter: a.dischargedAt === null || a.dischargedAt > to,
          }
        })

      return {
        bed: { id: bed.id, label: bed.label, status: toApi(bed.status) },
        room: {
          id: bed.room.id,
          number: bed.room.number,
          category: toApi(bed.room.category),
        },
        spans,
      }
    })

    return { days: days.map((d) => d.toISOString().slice(0, 10)), rows }
  }

  async stats(query: WardRangeDto) {
    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))
    const now = new Date()

    const [beds, active, admittedToday, dischargedToday, inRange] = await Promise.all([
      this.db.bed.findMany({
        include: { room: { select: { category: true, dailyRate: true } } },
      }),
      this.db.admission.count({ where: { status: 'ACTIVE' } }),
      this.db.admission.count({
        where: { admittedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      }),
      this.db.admission.count({
        where: { dischargedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      }),
      this.db.admission.findMany({
        where: { admittedAt: { lte: to }, OR: [{ dischargedAt: null }, { dischargedAt: { gte: from } }] },
        include: { room: { select: { category: true } } },
      }),
    ])

    const totalBeds = beds.length
    const occupancyPct = totalBeds ? Math.round((active / totalBeds) * 1000) / 10 : 0

    // O'rtacha yotish kuni va tushum
    let totalDays = 0
    let revenue = 0
    const byCategory = new Map<
      string,
      { category: string; totalBeds: number; occupiedBeds: number; revenue: number }
    >()

    for (const bed of beds) {
      const key = toApi(bed.room.category)
      const acc = byCategory.get(key) ?? {
        category: key,
        totalBeds: 0,
        occupiedBeds: 0,
        revenue: 0,
      }
      acc.totalBeds += 1
      if (bed.status === 'OCCUPIED') acc.occupiedBeds += 1
      byCategory.set(key, acc)
    }

    for (const a of inRange) {
      const days = daysBetween(a.admittedAt, a.dischargedAt ?? now)
      totalDays += days
      const amount = days * a.dailyRate
      revenue += amount
      const key = toApi(a.room.category)
      const acc = byCategory.get(key)
      if (acc) acc.revenue += amount
    }

    // Kunlik bandlik egri chizig'i
    const days = eachDay(from, to)
    const occupancySeries = days.map((day) => {
      const count = inRange.filter(
        (a) => a.admittedAt <= endOfDay(day) && (a.dischargedAt ?? now) >= startOfDay(day),
      ).length
      return {
        label: day.toISOString().slice(0, 10),
        value: totalBeds ? Math.round((count / totalBeds) * 1000) / 10 : 0,
      }
    })

    return {
      totalBeds,
      occupiedBeds: active,
      occupancyPct: { value: occupancyPct, previous: 0 },
      admittedToday,
      dischargedToday,
      averageStayDays: inRange.length
        ? Math.round((totalDays / inRange.length) * 10) / 10
        : 0,
      revenue: { value: revenue, previous: 0 },
      byCategory: [...byCategory.values()],
      occupancySeries,
    }
  }

  private async requireOwn(
    model: 'patient' | 'doctor',
    id: string,
    message: string,
  ) {
    const delegate = this.db[model] as {
      findFirst: (args: unknown) => Promise<unknown>
    }
    const row = await delegate.findFirst({ where: { id } })
    if (!row) throw new NotFoundException(message)
  }
}

/* ------------------------------------------------------------------ */

function toApiAdmission(row: AdmissionRow) {
  const now = new Date()
  const daysStayed = daysBetween(row.admittedAt, row.dischargedAt ?? now)

  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    roomId: row.roomId,
    bedId: row.bedId,
    admittedAt: toApiDateTime(row.admittedAt)!,
    expectedDischargeAt: toApiDate(row.expectedDischargeAt),
    dischargedAt: toApiDateTime(row.dischargedAt),
    status: toApi(row.status),
    diagnosis: row.diagnosis,
    dailyRate: row.dailyRate,
    notes: row.notes,
    createdBy: row.createdById,
    createdAt: toApiDateTime(row.createdAt)!,
    patient: row.patient,
    doctor: row.doctor,
    room: { ...row.room, category: toApi(row.room.category) },
    bed: row.bed,
    daysStayed,
    // Hisoblangan summa: yotgan kun × muzlatilgan kunlik narx
    accrued: daysStayed * row.dailyRate,
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  // Kirgan kunning o'zi ham hisoblanadi
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
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

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const cursor = startOfDay(from)
  const last = startOfDay(to)
  while (cursor <= last && days.length < 400) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
