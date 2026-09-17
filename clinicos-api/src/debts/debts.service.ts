import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { plainToInstance } from 'class-transformer'

import { toApiDateTime } from '../common/api-enum'
import { dayKeyToDb, dbDateToKey, localDayKey } from '../common/day-key'
import { RequestContext } from '../common/request-context'
import { wardBalance } from '../common/ward-revenue'
import { PaymentInputDto } from '../payments/payments.dto'
import { PaymentsService } from '../payments/payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { CollectDebtDto, SetDebtDueDto, WaiveDebtDto } from './debts.dto'

/**
 * Muddat holati: `dueDate` (YYYY-MM-DD) va bugundan necha kun o'tgani.
 * Muddat qo'yilmagan bo'lsa ikkalasi ham `null`.
 */
function dueInfo(value: Date | null) {
  if (!value) return { dueDate: null, overdueDays: null }
  const dueDate = dbDateToKey(value)
  const today = dayKeyToDb(localDayKey(new Date()))
  const overdueDays = Math.round((today.getTime() - value.getTime()) / 86_400_000)
  return { dueDate, overdueDays }
}

/**
 * QARZDORLIK.
 *
 * Qarz SAQLANMAYDI — hisoblanadi: xizmat narxi minus to'langan summa.
 *
 * NEGA: balans ustuni bo'lsa, u to'lov yozuvlari bilan ertami-kechmi
 * bir-biriga to'g'ri kelmay qoladi va qaysi biri haqiqat ekani
 * noma'lum bo'lardi. To'lovlar allaqachon o'zgarmas yozuv — qarz
 * ulardan chiqadi.
 *
 * Ikkita ro'yxat bitta so'rovda: sahifa ikkalasini birga ko'rsatadi.
 */
@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly payments: PaymentsService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /** Shifokor faqat O'Z bemorlarining qarzini ko'radi va undiradi */
  private ownDoctor(): string | null {
    const { role, doctorId } = this.ctx.require()
    return role === 'DOCTOR' ? (doctorId ?? 'none') : null
  }

  async list() {
    const [visits, ward] = await Promise.all([this.visitDebts(), this.wardDebts()])

    const visitsTotal = visits.reduce((sum, d) => sum + d.remaining, 0)
    const wardTotal = ward.reduce((sum, d) => sum + d.remaining, 0)

    return {
      visits,
      ward,
      totals: {
        visits: visitsTotal,
        ward: wardTotal,
        all: visitsTotal + wardTotal,
      },
    }
  }

  /* ---------------- Ko'rik qarzi ---------------- */

  private async visitDebts(only?: string) {
    const rows = await this.db.appointment.findMany({
      where: {
        status: 'COMPLETED',
        paymentStatus: { not: 'PAID' },
        // Kechirilgani ro'yxatda chiqmaydi
        debtWaiver: { is: null },
        ...(this.ownDoctor() ? { doctorId: this.ownDoctor()! } : {}),
        ...(only ? { id: only } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { fullName: true } },
        service: { select: { name: true, price: true, priceMode: true } },
        visit: { select: { price: true } },
      },
      // Eng eskisi tepada — u eng ko'p e'tibor talab qiladi
      orderBy: { completedAt: 'asc' },
      take: 200,
    })

    /*
      To'langan summalar bitta so'rovda. Har qabulga alohida so'rov
      yuborilsa, 200 ta qarzda 200 ta so'rov bo'lardi.
    */
    const paidRows = await this.db.payment.groupBy({
      by: ['appointmentId'],
      where: { status: 'PAID', appointmentId: { in: rows.map((r) => r.id) } },
      _sum: { amount: true },
    })
    const paidByAppointment = new Map(
      paidRows.map((r) => [r.appointmentId, r._sum.amount ?? 0]),
    )

    const now = Date.now()

    return rows
      .map((row) => {
        /*
          Narxni shifokor belgilaydigan xizmatda summa ko'rikda turadi.
          Shifokor uni hali belgilamagan bo'lsa QARZ EMAS: hech kim
          hech qancha qarzdor emas, chunki summa aytilmagan.
        */
        const total =
          row.service.priceMode === 'DOCTOR_SET' ? row.visit?.price : row.service.price
        if (total === null || total === undefined) return null

        const paid = paidByAppointment.get(row.id) ?? 0
        const remaining = total - paid
        if (remaining <= 0) return null

        const since = row.completedAt ?? row.startsAt

        return {
          appointmentId: row.id,
          patientId: row.patientId,
          patientName: row.patient.fullName,
          patientPhone: row.patient.phone,
          /*
            `doctorId` va `serviceId` ham qaytadi: "To'lov olish" tugmasi
            to'lov formasini to'ldirilgan holda ochadi. Ularsiz forma
            bo'sh ochilardi va registrator qabulni qaytadan qidirardi.
          */
          doctorId: row.doctorId,
          doctorName: row.doctor.fullName,
          serviceId: row.serviceId,
          serviceName: row.service.name,
          completedAt: toApiDateTime(since)!,
          daysOverdue: Math.max(0, Math.floor((now - since.getTime()) / 86_400_000)),
          ...dueInfo(row.debtDueDate),
          total,
          paid,
          remaining,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  }

  /* ---------------- Statsionar qarzi ---------------- */

  private async wardDebts(only?: string) {
    const rows = await this.db.admission.findMany({
      where: {
        // PLANNED kirmaydi — bemor hali yotmagan, qarz ham yo'q
        status: { in: ['ACTIVE', 'DISCHARGED'] },
        debtWaiver: { is: null },
        ...(this.ownDoctor() ? { doctorId: this.ownDoctor()! } : {}),
        ...(only ? { id: only } : {}),
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        room: { select: { number: true } },
        payments: { select: { amount: true, status: true } },
      },
      orderBy: { admittedAt: 'asc' },
      take: 200,
    })

    const now = Date.now()

    return rows
      .map((row) => {
        // Hisob `common/ward-revenue.ts` da — to'lov chegarasi ham o'sha yerdan
        const { cap, paid, remaining } = wardBalance(row)
        if (remaining <= 0) return null

        return {
          admissionId: row.id,
          patientId: row.patientId,
          patientName: row.patient.fullName,
          patientPhone: row.patient.phone,
          roomNumber: row.room.number,
          admittedAt: toApiDateTime(row.admittedAt)!,
          daysOverdue: Math.max(
            0,
            Math.floor((now - row.admittedAt.getTime()) / 86_400_000),
          ),
          ...dueInfo(row.debtDueDate),
          total: cap,
          paid,
          remaining,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  }

  /* ---------------- Muddat ---------------- */

  /**
   * Qarzni qachongacha to'lashini belgilash.
   *
   * Muddat — kelishuv, pul emas: u hech qanday summani o'zgartirmaydi,
   * shuning uchun qarzni ko'ra oladigan har kim qo'ya oladi. O'sha kuni
   * bemorga Telegramda eslatma boradi (`reminders.service`). Muddat
   * o'zgarsa eski eslatma yozuvi o'chadi — yangi kunda qayta boradi.
   */
  async setDue(dto: SetDebtDueDto) {
    if (!dto.appointmentId === !dto.admissionId) {
      throw new BadRequestException('Qabul yoki statsionar yotqizishidan bittasi ko‘rsatilishi kerak')
    }
    const own = this.ownDoctor()
    const value = dto.dueDate ? dayKeyToDb(dto.dueDate) : null

    if (dto.appointmentId) {
      const row = await this.db.appointment.findFirst({
        where: { id: dto.appointmentId, ...(own ? { doctorId: own } : {}) },
        select: { id: true },
      })
      if (!row) throw new NotFoundException('Qabul topilmadi')
      await this.db.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: row.id }, data: { debtDueDate: value } })
        await tx.patientNotice.deleteMany({ where: { appointmentId: row.id, kind: 'DEBT_DUE' } })
      })
    } else {
      const row = await this.db.admission.findFirst({
        where: { id: dto.admissionId, ...(own ? { doctorId: own } : {}) },
        select: { id: true },
      })
      if (!row) throw new NotFoundException('Yotqizish topilmadi')
      await this.db.admission.update({ where: { id: row.id }, data: { debtDueDate: value } })
    }

    return dueInfo(value)
  }

  /* ---------------- Undirish ---------------- */

  /**
   * Qarz bo'yicha to'lov olish.
   *
   * Oddiy to'lov yo'lidan (`PaymentsService.create`) o'tadi: yozuv, kassa
   * va qabulning to'lov holati bir xil hisoblanadi. Farqi — bemor, shifokor
   * va xizmat so'rovdan emas, qarzning o'zidan olinadi, summa esa QOLGAN
   * qarzdan oshmaydi. Shu sababli egasi va shifokor ham undira oladi:
   * ular "istalgan summani" emas, aniq ko'rsatilgan xizmatning qarzini
   * yopadi. Naqd pul undirgan odamning o'z kassasiga tushadi.
   */
  async collect(dto: CollectDebtDto) {
    if (!dto.appointmentId === !dto.admissionId) {
      throw new BadRequestException('Qabul yoki statsionar yotqizishidan bittasi ko‘rsatilishi kerak')
    }
    const { role } = this.ctx.require()
    const own = this.ownDoctor()

    const debt = dto.appointmentId
      ? (await this.visitDebts(dto.appointmentId)).find((d) => d.appointmentId === dto.appointmentId)
      : (await this.wardDebts(dto.admissionId)).find((d) => d.admissionId === dto.admissionId)

    if (!debt) {
      throw new NotFoundException(
        role === 'DOCTOR' ? 'Qarz topilmadi yoki bu sizning bemoringiz emas' : 'Qarz topilmadi',
      )
    }
    if (dto.amount > debt.remaining) {
      throw new BadRequestException(`Summa qolgan qarzdan oshib ketdi (${debt.remaining} so‘m)`)
    }

    let doctorId: string
    if ('doctorId' in debt) {
      doctorId = debt.doctorId
    } else {
      const admission = await this.db.admission.findFirst({
        where: { id: debt.admissionId },
        select: { doctorId: true },
      })
      if (!admission) throw new NotFoundException('Yotqizish topilmadi')
      doctorId = admission.doctorId
    }
    if (own && doctorId !== own) {
      throw new ForbiddenException('Faqat o‘z bemoringizning qarzini undira olasiz')
    }

    const input = plainToInstance(PaymentInputDto, {
      patientId: debt.patientId,
      doctorId,
      serviceId: 'serviceId' in debt ? debt.serviceId : undefined,
      admissionId: 'admissionId' in debt ? debt.admissionId : undefined,
      appointmentId: 'appointmentId' in debt ? debt.appointmentId : null,
      amount: dto.amount,
      method: dto.method,
      status: 'paid',
      notes: dto.notes,
      debtDueDate: dto.dueDate,
    })

    return this.payments.create(input)
  }

  /* ---------------- Kechirish ---------------- */

  /**
   * Umidsiz qarzni yopish.
   *
   * Qarz O'CHIRILMAYDI va `paymentStatus` ham o'zgarmaydi — u haqiqatan
   * to'lanmagan va hisobot shuni ko'rsatishi kerak. Faqat ro'yxatlar va
   * bildirishnoma kechirilganini chiqarmaydi.
   */
  async waive(dto: WaiveDebtDto) {
    const { clinicId, userId } = this.ctx.require()

    // Aynan bittasi kelishi kerak — `payments.service.create` dagi kabi
    if (!dto.appointmentId === !dto.admissionId) {
      throw new BadRequestException(
        'Qabul yoki statsionar yotqizishidan bittasi ko‘rsatilishi kerak',
      )
    }

    if (dto.appointmentId) {
      const appointment = await this.db.appointment.findFirst({
        where: { id: dto.appointmentId },
        select: { id: true, debtWaiver: { select: { id: true } } },
      })
      if (!appointment) throw new NotFoundException('Qabul topilmadi')
      if (appointment.debtWaiver) {
        throw new ConflictException('Bu qarz allaqachon kechirilgan')
      }
    } else {
      const admission = await this.db.admission.findFirst({
        where: { id: dto.admissionId },
        select: { id: true, debtWaiver: { select: { id: true } } },
      })
      if (!admission) throw new NotFoundException('Yotqizish topilmadi')
      if (admission.debtWaiver) {
        throw new ConflictException('Bu qarz allaqachon kechirilgan')
      }
    }

    const row = await this.db.debtWaiver.create({
      data: {
        clinicId,
        appointmentId: dto.appointmentId ?? null,
        admissionId: dto.admissionId ?? null,
        note: dto.note,
        createdById: userId,
      },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      appointmentId: row.appointmentId,
      admissionId: row.admissionId,
      note: row.note,
      createdBy: row.createdById,
      createdAt: toApiDateTime(row.createdAt)!,
    }
  }
}
