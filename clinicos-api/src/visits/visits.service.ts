import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { FollowUpPatchDto, UpdateVisitDto, VisitInputDto } from './visits.dto'

/**
 * Rasmlar har doim yozuv bilan birga qaytadi.
 *
 * Alohida so’rov qilinmaydi: bitta tashrifda o’n tadan oshmaydi va
 * ular yozuvning bir qismi — tashxis matni bilan bir xil maxfiylikda.
 */
const VISIT_EXPAND = {
  images: { select: { id: true, imageUrl: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.VisitInclude

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
    private readonly storage: StorageService,
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
        service: {
          select: { priceMode: true, minPrice: true, maxPrice: true },
        },
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

    /*
      BEKOR QILINGAN VA KELMAGAN QABULGA TASHRIF YOZILMAYDI.

      Bekor qilingani ravshan: qabul bo'lmagan.

      "Kelmagan" esa jiddiyroq. Tashrif yozilsa, u qabulni
      `COMPLETED` ga o'tkazadi — ya'ni kelmagan bemor "kelgan"
      bo'lib qoladi va kelmaganlar ulushi jimgina pasayadi. Bu
      ko'rsatkich esa shifokorning ish sifatini o'lchaydi, ya'ni
      uni o'chirish imkoniyati bo'lmasligi kerak.

      Bemor haqiqatan kech kelgan bo'lsa, registrator uni qaytadan
      navbatga qo'yadi — o'shanda tashrif yoziladi.
    */
    if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') {
      throw new BadRequestException(
        appointment.status === 'CANCELLED'
          ? 'Bekor qilingan qabulga tashrif yozib bo‘lmaydi'
          : 'Kelmagan deb belgilangan qabulga tashrif yozib bo‘lmaydi',
      )
    }

    const existing = await this.db.visit.findFirst({
      where: { appointmentId: dto.appointmentId },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Bu qabulga tashrif allaqachon yozilgan')
    }

    const price = resolveVisitPrice(appointment.service, dto.price)

    /*
      Kalit shakli DTO da tekshirilgan, lekin shakl to'g'ri bo'la
      turib boshqa klinikanikini yuborish mumkin. Bazada begona
      kalit yotishining o'zi xato — shuning uchun bu yerda.
    */
    for (const key of dto.imageKeys) {
      this.storage.assertOwnKey(key)
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
          price,
          complaint: dto.complaint,
          diagnosis: dto.diagnosis,
          treatment: dto.treatment,
          notes: dto.notes,
          images: {
            create: dto.imageKeys.map((key) => ({ clinicId, imageUrl: key })),
          },
        },
        include: VISIT_EXPAND,
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
      include: VISIT_EXPAND,
    })
    if (!row) throw new NotFoundException('Tashrif topilmadi')
    return toApiVisit(row)
  }

  /**
   * Yozilgan tashrifni TUZATISH.
   *
   * FAQAT O'Z YOZUVI. Boshqa shifokorning tashxisini tahrirlash
   * yozuvni ishonchsiz qiladi: kartochkada kimning fikri turganini
   * aytib bo'lmay qoladi.
   *
   * NARX ALOHIDA QOIDA BILAN. Summa — registratorning to'lov
   * shiftosi. To'lov allaqachon olingan bo'lsa u o'zgarmaydi: aks
   * holda "qancha olindi" va "qancha bo'lishi kerak edi" bir-biriga
   * mos kelmay qolardi va kassa nazorati ma'nosini yo'qotardi.
   *
   * IZ QOLADI: marshrut `@Audit` bilan belgilangan.
   */
  async update(id: string, dto: UpdateVisitDto) {
    const { role, doctorId, clinicId } = this.ctx.require()

    const current = await this.db.visit.findFirst({
      where: { id },
      include: { appointment: { include: { service: true } } },
    })
    if (!current) throw new NotFoundException('Tashrif topilmadi')

    if (role === 'DOCTOR' && current.doctorId !== doctorId) {
      throw new ForbiddenException('Bu tashrif boshqa shifokorniki')
    }

    let price: number | null | undefined
    if (dto.price !== undefined) {
      const paid = await this.db.payment.count({
        where: { appointmentId: current.appointmentId, status: 'PAID' },
      })
      if (paid > 0) {
        throw new BadRequestException(
          'To‘lov olingan tashrifning summasi o‘zgartirilmaydi',
        )
      }
      price = resolveVisitPrice(current.appointment.service, dto.price)
    }

    /*
      Rasmlar TO'LIQ ALMASHTIRILADI: forma barcha kalitni yuboradi,
      ya'ni ro'yxatdan chiqarilgani o'chirilishi kerak. Qo'shish
      bilan cheklansa, xato biriktirilgan rasmni olib tashlab
      bo'lmasdi.
    */
    const images =
      dto.imageKeys === undefined
        ? undefined
        : {
            deleteMany: {},
            create: dto.imageKeys.map((key) => {
              this.storage.assertOwnKey(key)
              return { clinicId, imageUrl: key }
            }),
          }

    const row = await this.db.visit.update({
      where: { id },
      data: {
        complaint: dto.complaint,
        diagnosis: dto.diagnosis,
        treatment: dto.treatment,
        notes: dto.notes,
        price,
        images,
      },
      include: VISIT_EXPAND,
    })

    return toApiVisit(row)
  }

  async byAppointment(appointmentId: string) {
    const row = await this.db.visit.findFirst({
      where: { AND: [{ appointmentId }, this.doctorScope()] },
      include: VISIT_EXPAND,
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

/**
 * Shifokor belgilagan summani tekshiradi.
 *
 * Chegara XIZMATDAN olinadi, so'rovdan emas: aks holda shifokor
 * o'zi oraliqni ham, summani ham yuborib, egasi qo'ygan chegarani
 * chetlab o'tardi.
 */
function resolveVisitPrice(
  service: { priceMode: string; minPrice: number | null; maxPrice: number | null },
  price: number | undefined,
): number | null {
  if (service.priceMode !== 'DOCTOR_SET') {
    if (price !== undefined) {
      throw new BadRequestException('Bu xizmatning narxi katalogda belgilangan')
    }
    return null
  }

  if (price === undefined) {
    throw new BadRequestException('Bu xizmatga to‘lov summasini kiritish shart')
  }

  const min = service.minPrice ?? 1
  const max = service.maxPrice ?? Number.MAX_SAFE_INTEGER
  if (price < min || price > max) {
    throw new BadRequestException(
      `Summa ${min} va ${max} so‘m oralig‘ida bo‘lishi kerak`,
    )
  }

  return price
}

type VisitRow = Prisma.VisitGetPayload<{ include: typeof VISIT_EXPAND }>

function toApiVisit(row: VisitRow) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    visitedAt: toApiDateTime(row.visitedAt)!,
    price: row.price,
    complaint: row.complaint,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    notes: row.notes,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
