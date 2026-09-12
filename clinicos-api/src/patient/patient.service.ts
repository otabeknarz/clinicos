import { Injectable, NotFoundException } from '@nestjs/common'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'

/**
 * BEMOR KABINETI — FAQAT O'QISH.
 *
 * Bemor o'z tashriflarini, tashxislarini va qarzini ko'radi.
 * Yozadigan hech narsa yo'q va bo'lmasligi kerak:
 *
 *   qabulga yozilish — navbat va jadvalga tegadi, alohida ish;
 *   to'lov          — pulni registrator oladi va yozadi.
 *
 * BEMOR ID SO'ROVDAN OLINMAYDI. U tokendan keladi (`PatientGuard`),
 * ya'ni bemor id ni almashtirib qo'shnisining tashxisini o'qib
 * ololmaydi. Klinika ham tokendan — ijara ajratish odatdagi
 * `forCurrentClinic()` orqali ishlaydi.
 */
@Injectable()
export class PatientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  private get patientId(): string {
    const { patientId } = this.ctx.require()
    if (!patientId) throw new NotFoundException('Bemor topilmadi')
    return patientId
  }

  /** Kabinet bosh sahifasi */
  async card() {
    const patientId = this.patientId

    const patient = await this.db.patient.findFirst({
      where: { id: patientId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        clinic: { select: { name: true } },
      },
    })
    if (!patient) throw new NotFoundException('Bemor topilmadi')

    const visitCount = await this.db.visit.count({ where: { patientId } })

    const last = await this.db.visit.findFirst({
      where: { patientId },
      orderBy: { visitedAt: 'desc' },
      select: { visitedAt: true },
    })

    /*
      Keyingi qabul — FAQAT KELAJAKDAGI va bekor qilinmagani.
      O'tib ketgani "keyingi" emas, tugallangani ham.
    */
    const next = await this.db.appointment.findFirst({
      where: {
        patientId,
        startsAt: { gt: new Date() },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        doctor: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    })

    const debt = await this.debt()

    return {
      patientId: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      clinicName: patient.clinic.name,
      visitCount,
      lastVisitAt: last ? toApiDate(last.visitedAt) : null,
      nextAppointment: next
        ? {
            id: next.id,
            startsAt: toApiDateTime(next.startsAt)!,
            doctorName: next.doctor.fullName,
            serviceName: next.service.name,
          }
        : null,
      debtTotal: debt.total,
    }
  }

  /**
   * Tashriflar tarixi.
   *
   * `Visit.notes` ATAYLAB QAYTMAYDI. U shifokorning ichki
   * eslatmasi — "bemor bilan gaplashish qiyin", "qarzini so'rash
   * kerak" kabi narsalar yoziladigan joy. Bemorga ochilsa,
   * shifokor u yerga rostini yozishni to'xtatadi va yozuvning
   * ma'nosi qolmaydi.
   */
  async visits() {
    const rows = await this.db.visit.findMany({
      where: { patientId: this.patientId },
      orderBy: { visitedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        visitedAt: true,
        complaint: true,
        diagnosis: true,
        treatment: true,
        doctor: { select: { fullName: true } },
        appointment: { select: { service: { select: { name: true } } } },
        images: {
          select: { id: true, imageUrl: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      visitedAt: toApiDateTime(row.visitedAt)!,
      doctorName: row.doctor.fullName,
      serviceName: row.appointment?.service.name ?? null,
      complaint: row.complaint,
      diagnosis: row.diagnosis,
      treatment: row.treatment,
      /* `imageUrl` ni `SignedUrlInterceptor` 15 daqiqalik havolaga aylantiradi */
      images: row.images,
    }))
  }

  /**
   * Qarzdorlik.
   *
   * Summa `GET /debts` BILAN BIR XIL formula bo'yicha: narxni
   * shifokor belgilaydigan xizmatda ko'rikdan, qolganida
   * katalogdan, olingan to'lovlar ayiriladi. Ikki joyda ikki xil
   * hisoblansa, bemor kabinetda bir raqamni, kassada boshqasini
   * ko'rardi.
   *
   * Kechirilgan qarz ko'rinmaydi — u kechirilgan.
   */
  async debt() {
    const patientId = this.patientId

    const rows = await this.db.appointment.findMany({
      where: {
        patientId,
        status: 'COMPLETED',
        paymentStatus: { not: 'PAID' },
        debtWaiver: { is: null },
      },
      orderBy: { completedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        completedAt: true,
        startsAt: true,
        doctor: { select: { fullName: true } },
        service: { select: { name: true, price: true, priceMode: true } },
        visit: { select: { price: true } },
      },
    })

    const paidRows = await this.db.payment.groupBy({
      by: ['appointmentId'],
      where: { status: 'PAID', appointmentId: { in: rows.map((r) => r.id) } },
      _sum: { amount: true },
    })
    const paidBy = new Map(paidRows.map((r) => [r.appointmentId, r._sum.amount ?? 0]))

    const items = rows
      .map((row) => {
        const total =
          row.service.priceMode === 'DOCTOR_SET' ? row.visit?.price : row.service.price
        if (total === null || total === undefined) return null

        const paid = paidBy.get(row.id) ?? 0
        const remaining = total - paid
        if (remaining <= 0) return null

        return {
          appointmentId: row.id,
          serviceName: row.service.name,
          doctorName: row.doctor.fullName,
          completedAt: toApiDateTime(row.completedAt ?? row.startsAt)!,
          total,
          paid,
          remaining,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return {
      items,
      total: items.reduce((sum, item) => sum + item.remaining, 0),
    }
  }

  /**
   * KABINETDAGI XABARLAR.
   *
   * Klinika yuborgan umumiy xabar va qabuldan ikki kun oldingi
   * eslatma shu yerda turadi. Bemor botni ochmagan yoki bloklagan
   * bo'lsa ham ularni ko'radi: Telegram — yetkazish yo'li, xabarning
   * o'zi esa yozuv.
   */
  async notices() {
    const rows = await this.db.patientNotice.findMany({
      where: { patientId: this.patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, text: true, kind: true, readAt: true, createdAt: true },
    })

    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      kind: toApi(row.kind),
      read: row.readAt !== null,
      createdAt: toApiDateTime(row.createdAt),
    }))
  }

  /** O'qildi — kabinetda ochilganda */
  async markNoticeRead(id: string) {
    const done = await this.db.patientNotice.updateMany({
      where: { id, patientId: this.patientId, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: done.count > 0 }
  }

}
