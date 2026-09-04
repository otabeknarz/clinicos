import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, Visit } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { FollowUpPatchDto, VisitInputDto } from './visits.dto'

/**
 * TASHRIFLAR — TIBBIY YOZUV.
 *
 * Bu tizimning ikkinchi yarmi. Shifokor tashrifni yozadi,
 * registrator pulni yozadi, egasi ikkalasini solishtiradi.
 * Shuning uchun tashrifni FAQAT shifokor yozadi va faqat
 * o'z qabuliga.
 *
 * MAXFIYLIK: tashxis registratorga ko'rinmaydi. Ruxsat
 * `visits.view`, u registratorda yo'q.
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Tashrif yozish.
   *
   * Qabul bir vaqtning o'zida TUGALLANGAN deb belgilanadi:
   * shifokor tashrifni yozdi — demak bemorni ko'rdi. Ikkita
   * alohida amal bo'lsa, biri bajarilib ikkinchisi unutilardi
   * va solishtiruv noto'g'ri chiqardi.
   */
  async create(dto: VisitInputDto) {
    const { clinicId, role, doctorId } = this.ctx.require()

    const appointment = await this.db.appointment.findFirst({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        status: true,
        checkedInAt: true,
      },
    })
    if (!appointment) throw new NotFoundException('Qabul topilmadi')

    /*
      Shifokor faqat O'Z qabuliga tashrif yoza oladi.

      Aks holda bir shifokor boshqasining nomidan yozuv qoldirib,
      daromadni o'ziga yozdirib olishi mumkin bo'lardi.
    */
    if (role === 'DOCTOR' && appointment.doctorId !== doctorId) {
      throw new ForbiddenException('Bu qabul boshqa shifokorga tegishli')
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Bekor qilingan qabulga tashrif yozib bo‘lmaydi')
    }

    const existing = await this.db.visit.findFirst({
      where: { appointmentId: dto.appointmentId },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Bu qabulga tashrif allaqachon yozilgan')
    }

    const now = new Date()

    const visit = await this.db.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: {
          clinicId,
          appointmentId: dto.appointmentId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          visitedAt: now,
          complaint: dto.complaint,
          diagnosis: dto.diagnosis,
          treatment: dto.treatment,
          notes: dto.notes,
        },
      })

      await tx.appointment.update({
        where: { id: dto.appointmentId },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          // Kelgani belgilanmagan bo'lsa — kutish vaqti manfiy chiqmasin
          checkedInAt: appointment.checkedInAt ?? new Date(now.getTime() - 5 * 60_000),
        },
      })

      // Takroriy tashrif tavsiya qilingan bo'lsa
      if (dto.followUpDate) {
        await tx.followUp.create({
          data: {
            clinicId,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            visitId: created.id,
            recommendedDate: new Date(dto.followUpDate),
            reason: dto.followUpReason,
          },
        })
      }

      return created
    })

    return toApiVisit(visit)
  }

  async get(id: string) {
    const row = await this.db.visit.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
    })
    if (!row) throw new NotFoundException('Tashrif topilmadi')
    return toApiVisit(row)
  }

  async byAppointment(appointmentId: string) {
    const row = await this.db.visit.findFirst({
      where: { AND: [{ appointmentId }, this.doctorScope()] },
    })
    return row ? toApiVisit(row) : null
  }

  /**
   * Muddati kelayotgan takroriy tashriflar.
   *
   * Registratura shu ro'yxat bo'yicha qo'ng'iroq qiladi, shuning
   * uchun unga tashxis chiqmaydi — faqat kim, qachon va sababi.
   */
  async followUpsDue(daysAhead: number) {
    const until = new Date()
    until.setDate(until.getDate() + daysAhead)
    until.setHours(23, 59, 59, 999)

    const rows = await this.db.followUp.findMany({
      where: {
        AND: [
          { status: 'PENDING', recommendedDate: { lte: until } },
          this.followUpDoctorScope(),
        ],
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
      orderBy: { recommendedDate: 'asc' },
      take: 200,
    })

    return rows.map((f) => ({
      id: f.id,
      clinicId: f.clinicId,
      patientId: f.patientId,
      doctorId: f.doctorId,
      visitId: f.visitId,
      recommendedDate: toApiDate(f.recommendedDate)!,
      reason: f.reason,
      status: toApi(f.status),
      appointmentId: f.appointmentId,
      createdAt: toApiDateTime(f.createdAt)!,
      patient: f.patient,
      doctor: f.doctor,
    }))
  }

  async updateFollowUp(id: string, dto: FollowUpPatchDto) {
    const current = await this.db.followUp.findFirst({
      where: { AND: [{ id }, this.followUpDoctorScope()] },
      select: { id: true },
    })
    if (!current) throw new NotFoundException('Takroriy tashrif topilmadi')

    const row = await this.db.followUp.update({
      where: { id },
      data: {
        status: dto.status
          ? (dto.status.toUpperCase() as 'PENDING' | 'SCHEDULED' | 'DONE' | 'MISSED')
          : undefined,
        recommendedDate: dto.recommendedDate ? new Date(dto.recommendedDate) : undefined,
        reason: dto.reason,
        appointmentId: dto.appointmentId,
      },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      patientId: row.patientId,
      doctorId: row.doctorId,
      visitId: row.visitId,
      recommendedDate: toApiDate(row.recommendedDate)!,
      reason: row.reason,
      status: toApi(row.status),
      appointmentId: row.appointmentId,
      createdAt: toApiDateTime(row.createdAt)!,
    }
  }

  private doctorScope(): Prisma.VisitWhereInput {
    const { role, doctorId } = this.ctx.require()
    return role === 'DOCTOR' && doctorId ? { doctorId } : {}
  }

  private followUpDoctorScope(): Prisma.FollowUpWhereInput {
    const { role, doctorId } = this.ctx.require()
    return role === 'DOCTOR' && doctorId ? { doctorId } : {}
  }
}

function toApiVisit(row: Visit) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    visitedAt: toApiDateTime(row.visitedAt)!,
    complaint: row.complaint,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    notes: row.notes,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
