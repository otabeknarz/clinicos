import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { wardBalance } from '../common/ward-revenue'
import { PrismaService } from '../prisma/prisma.service'
import { WaiveDebtDto } from './debts.dto'

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
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
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

  private async visitDebts() {
    const rows = await this.db.appointment.findMany({
      where: {
        status: 'COMPLETED',
        paymentStatus: { not: 'PAID' },
        // Kechirilgani ro'yxatda chiqmaydi
        debtWaiver: { is: null },
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
          total,
          paid,
          remaining,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  }

  /* ---------------- Statsionar qarzi ---------------- */

  private async wardDebts() {
    const rows = await this.db.admission.findMany({
      where: {
        // PLANNED kirmaydi — bemor hali yotmagan, qarz ham yo'q
        status: { in: ['ACTIVE', 'DISCHARGED'] },
        debtWaiver: { is: null },
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
          total: cap,
          paid,
          remaining,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
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
