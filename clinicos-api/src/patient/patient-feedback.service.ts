import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { feedbackRevealDate } from '../feedback/feedback.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { CabinetFeedbackDto } from './patient.dto'

/**
 * BEMORNING KO'RIK HAQIDAGI FIKRI.
 *
 * Ilgari fikr qoldirish yo'li OCHIQ havola orqali edi va aynan
 * shuning uchun yopib qo'yilgan: telefon raqami bo'yicha
 * qidiriladigan sahifa raqamlarni birma-bir sinab, klinikaning
 * butun bemorlar bazasini aniqlab olish imkonini berardi.
 *
 * Kabinetda bu muammo YO'Q: bemor kim ekani tokendan ma'lum,
 * ya'ni qidiruv ham, telefon ham kerak emas.
 *
 * FIKR ANONIM. Bemor id saqlanadi — bir ko'rikka ikki marta fikr
 * yozilmasligi uchun — lekin javoblarning birortasida qaytmaydi.
 * Shifokor "kim yozdi" degan savolga javob topa olmasligi kerak,
 * aks holda fikrning rostligi yo'qoladi.
 */
@Injectable()
export class PatientFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  private get patientId(): string {
    const { patientId } = this.ctx.require()
    if (!patientId) throw new NotFoundException('Bemor topilmadi')
    return patientId
  }

  /**
   * Fikr yozish mumkin bo'lgan ko'riklar.
   *
   * Faqat TUGALLANGAN qabullar: bo'lmagan ko'rik haqida fikr
   * yozishning ma'nosi yo'q. Yozilganlari ham qaytadi — bemor
   * o'z fikrini qayta o'qiy olsin.
   */
  async list() {
    const patientId = this.patientId

    const rows = await this.db.appointment.findMany({
      where: { patientId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        completedAt: true,
        startsAt: true,
        doctor: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    })

    const given = await this.db.feedback.findMany({
      where: { appointmentId: { in: rows.map((r) => r.id) } },
      select: {
        appointmentId: true,
        rating: true,
        text: true,
        reply: true,
        createdAt: true,
        images: { select: { id: true, imageUrl: true } },
      },
    })
    const byAppointment = new Map(given.map((f) => [f.appointmentId, f]))

    return rows.map((row) => {
      const feedback = byAppointment.get(row.id)
      return {
        appointmentId: row.id,
        visitedAt: toApiDateTime(row.completedAt ?? row.startsAt)!,
        doctorName: row.doctor.fullName,
        serviceName: row.service.name,
        feedback: feedback
          ? {
              rating: feedback.rating,
              text: feedback.text,
              /* Klinikaning javobi — bo'lsa bemor ko'radi */
              reply: feedback.reply,
              images: feedback.images,
              createdAt: toApiDateTime(feedback.createdAt)!,
            }
          : null,
      }
    })
  }

  async create(dto: CabinetFeedbackDto) {
    const patientId = this.patientId
    const { clinicId } = this.ctx.require()

    const appointment = await this.db.appointment.findFirst({
      where: { id: dto.appointmentId, patientId },
      select: { id: true, doctorId: true, status: true },
    })
    /*
      "Topilmadi" — boshqa bemorning qabuli uchun ham SHU javob.
      Aks holda id ni almashtirib, qaysi qabul mavjudligini
      bilib olish mumkin bo'lardi.
    */
    if (!appointment) throw new NotFoundException('Qabul topilmadi')

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Bu ko‘rik hali yakunlanmagan')
    }

    const existing = await this.db.feedback.findFirst({
      where: { appointmentId: appointment.id },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Bu ko‘rikka fikr allaqachon yozilgan')
    }

    /*
      Kalit shakli DTO da tekshirilgan, lekin shakl to'g'ri bo'la
      turib boshqa klinikanikini yuborish mumkin. Bazada begona
      kalit yotishining o'zi xato.
    */
    for (const key of dto.imageKeys) {
      this.storage.assertOwnKey(key)
    }

    const patient = await this.db.patient.findFirst({
      where: { id: patientId },
      select: { phone: true },
    })

    const row = await this.db.feedback.create({
      data: {
        clinicId,
        phone: patient?.phone ?? '',
        patientId,
        /* Fikr AYNAN o'sha ko'rikni o'tkazgan shifokorga tegishli */
        doctorId: appointment.doctorId,
        appointmentId: appointment.id,
        rating: dto.rating,
        text: dto.text.trim(),
        /*
          KABINETDAN KELGAN FIKR DOIM ANONIM. Bemor tanlab
          o'tirmaydi: tanlov bo'lsa, ismini ochganlar bilan
          ochmaganlar ajralib qolardi va anonimlikning ma'nosi
          yo'qolardi.
        */
        isAnonymous: true,
        revealAt: feedbackRevealDate(),
        images: {
          create: dto.imageKeys.map((key) => ({ clinicId, imageUrl: key })),
        },
      },
      select: { id: true, rating: true, createdAt: true },
    })

    return { id: row.id, rating: row.rating, createdAt: toApiDateTime(row.createdAt)! }
  }
}
