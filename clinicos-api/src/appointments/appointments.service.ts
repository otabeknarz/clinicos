import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { paginated } from '../common/pagination'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import {
  AppointmentInputDto,
  AppointmentQueryDto,
  AppointmentRangeDto,
  DoctorLoadQueryDto,
  SetStatusDto,
  UpdateAppointmentDto,
} from './appointments.dto'

const EXPAND = {
  patient: { select: { id: true, fullName: true, phone: true } },
  doctor: { select: { id: true, fullName: true, specialty: true } },
  service: {
    select: {
      id: true,
      name: true,
      price: true,
      durationMinutes: true,
      // Shifokor ko'rikda summani shu oraliqda kiritadi
      priceMode: true,
      minPrice: true,
      maxPrice: true,
    },
  },
} satisfies Prisma.AppointmentInclude

type Expanded = Prisma.AppointmentGetPayload<{ include: typeof EXPAND }>

/** Shifokor ish vaqti berilmagan bo'lsa — sakkiz soat */
const DEFAULT_SHIFT_MINUTES = 480

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly telegram: TelegramService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /** Shifokor faqat o'z qabullarini ko'radi */
  private doctorScope(): Prisma.AppointmentWhereInput {
    const { role, doctorId } = this.ctx.require()
    return role === 'DOCTOR' && doctorId ? { doctorId } : {}
  }

  async list(query: AppointmentQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.AppointmentWhereInput = {
      AND: [
        this.doctorScope(),
        query.doctorId === 'all' ? {} : { doctorId: query.doctorId },
        query.status === 'all' ? {} : { status: toDb(query.status) },
        this.rangeWhere(query.from, query.to),
        search
          ? {
              OR: [
                { patient: { fullName: { contains: search, mode: 'insensitive' } } },
                { patient: { phone: { contains: search } } },
              ],
            }
          : {},
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.appointment.findMany({
        where,
        include: EXPAND,
        orderBy: { startsAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.appointment.count({ where }),
    ])

    return paginated(rows.map(toApiAppointment), total, query.page, query.pageSize)
  }

  /** Kalendar uchun: sahifalashsiz, lekin davr bilan cheklangan */
  async range(query: AppointmentRangeDto) {
    const rows = await this.db.appointment.findMany({
      where: {
        AND: [
          this.doctorScope(),
          query.doctorId === 'all' ? {} : { doctorId: query.doctorId },
          this.rangeWhere(query.from, query.to),
        ],
      },
      include: EXPAND,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(toApiAppointment)
  }

  async today() {
    const now = new Date()
    const rows = await this.db.appointment.findMany({
      where: {
        AND: [
          this.doctorScope(),
          { startsAt: { gte: startOfDay(now), lte: endOfDay(now) } },
        ],
      },
      include: EXPAND,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(toApiAppointment)
  }

  async get(id: string) {
    const row = await this.db.appointment.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
      include: EXPAND,
    })
    if (!row) throw new NotFoundException('Qabul topilmadi')
    return toApiAppointment(row)
  }

  async create(dto: AppointmentInputDto) {
    const { clinicId, userId } = this.ctx.require()

    /*
      Bemor, shifokor va xizmat SHU klinikaniki ekanini tekshiramiz.

      Filtr o'zi ham begona id'ni o'tkazmaydi, lekin u holda Prisma
      "foreign key" xatosi bilan 500 qaytarardi. Bu yerda tushunarli
      xabar beriladi.
    */
    const service = await this.requireOwn('service', dto.serviceId, 'Xizmat topilmadi')
    await this.requireOwn('patient', dto.patientId, 'Bemor topilmadi')
    await this.requireOwn('doctor', dto.doctorId, 'Shifokor topilmadi')

    const row = await this.db.appointment.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        serviceId: dto.serviceId,
        startsAt: new Date(dto.startsAt),
        // Davomiylik xizmatdan olinadi — mijoz uni o'zgartira olmasin
        durationMinutes: (service as { durationMinutes: number }).durationMinutes,
        notes: dto.notes,
        createdById: userId,
      },
      include: EXPAND,
    })

    /*
      SHIFOKORNING TELEFONIGA XABAR.

      KUTILMAYDI (`void`): xabar yuborish qabul yaratilishini
      to'xtatib qo'ymasligi kerak. Telegram sekinlashsa yoki yiqilsa,
      registrator bemorni yozolmay qolishi — xabar kelmasligidan
      ancha yomon. `notifyDoctor` ichida ham hech qanday xato
      tashlanmaydi.
    */
    void this.notifyDoctor(row)

    return toApiAppointment(row)
  }

  /**
   * Yangi qabul haqida shifokorga Telegram xabari.
   *
   * FAQAT BUGUN VA ERTAGA. Band shifokorga kuniga o'nlab qabul
   * yoziladi va har biriga xabar kelsa, u xabarlarni o'qishni
   * butunlay to'xtatadi — ya'ni muhimi ham ko'zdan qoladi. Bugungi
   * va ertangi qabul esa shifokorning rejasini haqiqatan
   * o'zgartiradi.
   *
   * O'ZIGA O'ZI XABAR YUBORMAYDI: shifokor o'z qabulini yozgan
   * bo'lsa (bunday holat kam, lekin bor), telefoni bekorga
   * jiringlamasin.
   */
  private async notifyDoctor(row: {
    doctorId: string
    startsAt: Date
    patient: { fullName: string }
    service: { name: string }
  }) {
    if (!this.telegram.enabled) return

    const { userId } = this.ctx.require()

    const cutoff = endOfTomorrow()
    if (row.startsAt > cutoff) return

    const doctorUser = await this.db.user.findFirst({
      where: { doctorId: row.doctorId, isActive: true },
      select: { id: true, telegramUserId: true },
    })
    if (!doctorUser?.telegramUserId || doctorUser.id === userId) return

    const when = row.startsAt.toLocaleString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

    await this.telegram.send(
      doctorUser.telegramUserId,
      [
        '<b>Yangi qabul</b>',
        escapeHtml(row.patient.fullName),
        escapeHtml(row.service.name),
        escapeHtml(when),
      ].join('\n'),
    )
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const current = await this.db.appointment.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
    })
    if (!current) throw new NotFoundException('Qabul topilmadi')

    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new BadRequestException(
        'Tugallangan yoki bekor qilingan qabulni o‘zgartirib bo‘lmaydi',
      )
    }

    let durationMinutes: number | undefined
    if (dto.serviceId) {
      const service = await this.requireOwn('service', dto.serviceId, 'Xizmat topilmadi')
      durationMinutes = (service as { durationMinutes: number }).durationMinutes
    }
    if (dto.patientId) await this.requireOwn('patient', dto.patientId, 'Bemor topilmadi')
    if (dto.doctorId) await this.requireOwn('doctor', dto.doctorId, 'Shifokor topilmadi')

    const row = await this.db.appointment.update({
      where: { id },
      data: {
        patientId: dto.patientId,
        doctorId: dto.doctorId,
        serviceId: dto.serviceId,
        durationMinutes,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        notes: dto.notes,
      },
      include: EXPAND,
    })

    return toApiAppointment(row)
  }

  /**
   * Holatni o'zgartirish.
   *
   * FIRIBGARLIKKA QARSHI: bemor kelib bo'lgandan keyin bekor
   * qilinsa, sabab majburiy va yozuv qoladi. Bu eng oson
   * yashirish yo'li edi — bemor keldi, puli olindi, qabul esa
   * "bekor qilindi" deb yopildi va tizimda hech narsa qolmadi.
   */
  async setStatus(id: string, dto: SetStatusDto) {
    const current = await this.db.appointment.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
    })
    if (!current) throw new NotFoundException('Qabul topilmadi')

    /*
      Bekor qilish alohida ruxsat talab qiladi.

      Kontrollerda `appointments.edit` tekshiriladi, lekin bekor
      qilish undan og'irroq amal: u bemor kelgan-kelmaganini
      yashirishi mumkin. Shifokorda bu ruxsat yo'q.
    */
    if (dto.status === 'cancelled') {
      const { permissions } = this.ctx.require()
      if (!permissions.includes('appointments.cancel')) {
        throw new ForbiddenException('Qabulni bekor qilishga ruxsatingiz yo‘q')
      }
    }

    if (dto.status === 'cancelled' && current.checkedInAt && !dto.reason?.trim()) {
      throw new BadRequestException(
        'Bemor kelgandan keyin bekor qilish uchun sabab yozilishi shart',
      )
    }

    /*
      TASHRIFSIZ YAKUNLANMAYDI.

      Qabul "tugallangan" bo'lsa-yu, tibbiy yozuv bo'lmasa — bemor
      kelgan, ko'rilgan, lekin kartochkasida hech narsa qolmagan
      degani. Keyingi safar shifokor o'tgan safar nima bo'lganini
      bilmaydi va bemor tarixi teshik bo'lib qoladi.

      Yozuv YAGONA yo'l bilan tugaydi: shifokor tashrifni yozadi va
      `visits.service` qabulni o'zi `COMPLETED` ga o'tkazadi. Bu
      yerdagi tekshiruv esa o'sha yo'lni chetlab o'tishga yo'l
      qo'ymaydi — registrator ham, egasi ham qabulni "tugallandi"
      deb yopib qo'ya olmaydi.
    */
    if (dto.status === 'completed') {
      const visit = await this.db.visit.findFirst({
        where: { appointmentId: id },
        select: { id: true },
      })
      if (!visit) {
        throw new BadRequestException(
          'Avval tashrif yozilishi kerak — tashrifsiz qabul yakunlanmaydi',
        )
      }
    }

    const now = new Date()
    const data: Prisma.AppointmentUpdateInput = { status: toDb(dto.status) }

    if (dto.status === 'checked_in') data.checkedInAt = now
    if (dto.status === 'completed') {
      data.completedAt = now
      /*
        Kelgani belgilanmagan bo'lsa ham tugallangan deb yozilyapti —
        demak registrator "keldi" tugmasini bosishni unutgan. Vaqtni
        biroz orqaga surib qo'yamiz, aks holda kutish vaqti manfiy
        chiqadi va hisobot buziladi.
      */
      if (!current.checkedInAt) data.checkedInAt = new Date(now.getTime() - 5 * 60_000)
    }
    if (dto.status === 'cancelled') {
      data.cancelledAt = now
      data.cancelReason = dto.reason?.trim() ?? null
    }

    const row = await this.db.appointment.update({
      where: { id },
      data,
      include: EXPAND,
    })

    return toApiAppointment(row)
  }

  async remove(id: string) {
    const current = await this.db.appointment.findFirst({
      where: { AND: [{ id }, this.doctorScope()] },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Qabul topilmadi')

    /*
      To'langan yoki tugallangan qabul O'CHIRILMAYDI.

      To'lov unga bog'langan bo'lishi mumkin va yozuvni o'chirish
      pulni "havoda" qoldirardi. Kerak bo'lsa bekor qilinadi —
      u holda sabab bilan tarixda qoladi.
    */
    const paid = await this.db.payment.count({ where: { appointmentId: id } })
    if (paid > 0 || current.status === 'COMPLETED') {
      throw new BadRequestException(
        'To‘lov bog‘langan qabulni o‘chirib bo‘lmaydi — bekor qiling',
      )
    }

    await this.db.appointment.delete({ where: { id } })
  }

  /**
   * Shifokorlar bandligi.
   *
   * Har kun uchun ikkita raqam: qabullar soni va bandlik foizi.
   * Bandlik — band daqiqalarning ish smenasiga nisbati. Dam olish
   * kunida nol: shifokor ishlamagan kunni "bo'sh" deb ko'rsatish
   * noto'g'ri xulosaga olib boradi.
   */
  async doctorLoad(query: DoctorLoadQueryDto) {
    const { role, doctorId } = this.ctx.require()

    const from = startOfDay(new Date(query.from))
    const to = endOfDay(new Date(query.to))
    const days = eachDay(from, to)

    const doctors = await this.db.doctor.findMany({
      where: {
        AND: [
          { status: { not: 'INACTIVE' } },
          role === 'DOCTOR' && doctorId ? { id: doctorId } : {},
        ],
      },
      select: {
        id: true,
        fullName: true,
        specialty: true,
        workdays: true,
        shiftStart: true,
        shiftEnd: true,
      },
    })

    const appointments = await this.db.appointment.findMany({
      where: {
        status: { not: 'CANCELLED' },
        startsAt: { gte: from, lte: to },
      },
      select: { doctorId: true, startsAt: true, durationMinutes: true },
    })

    let maxCount = 1

    const rows = doctors.map((doctor) => {
      const shiftMinutes =
        timeToMinutes(doctor.shiftEnd) - timeToMinutes(doctor.shiftStart) ||
        DEFAULT_SHIFT_MINUTES

      const counts: number[] = []
      const utilization: number[] = []

      for (const day of days) {
        const dayRows = appointments.filter(
          (a) => a.doctorId === doctor.id && isSameDay(a.startsAt, day),
        )
        counts.push(dayRows.length)
        maxCount = Math.max(maxCount, dayRows.length)

        const worksToday = doctor.workdays.includes(day.getDay())
        const busy = dayRows.reduce((sum, a) => sum + a.durationMinutes, 0)
        utilization.push(
          worksToday ? Math.min(100, (busy / shiftMinutes) * 100) : 0,
        )
      }

      const workdayCount = days.filter((d) =>
        doctor.workdays.includes(d.getDay()),
      ).length

      return {
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        specialty: doctor.specialty,
        counts,
        utilization,
        total: counts.reduce((sum, c) => sum + c, 0),
        averageUtilization: workdayCount
          ? utilization.reduce((sum, u) => sum + u, 0) / workdayCount
          : 0,
      }
    })

    rows.sort((a, b) => b.total - a.total)

    return {
      days: days.map((d) => d.toISOString().slice(0, 10)),
      rows,
      maxCount,
    }
  }

  /* ------------------------------------------------------------------ */

  private rangeWhere(from?: string, to?: string): Prisma.AppointmentWhereInput {
    if (!from && !to) return {}
    return {
      startsAt: {
        ...(from ? { gte: startOfDay(new Date(from)) } : {}),
        ...(to ? { lte: endOfDay(new Date(to)) } : {}),
      },
    }
  }

  private async requireOwn(
    model: 'patient' | 'doctor' | 'service',
    id: string,
    message: string,
  ) {
    const delegate = this.db[model] as {
      findFirst: (args: unknown) => Promise<unknown>
    }
    const row = await delegate.findFirst({ where: { id } })
    if (!row) throw new NotFoundException(message)
    return row
  }
}

/* ------------------------------------------------------------------ */

function toApiAppointment(row: Expanded) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    serviceId: row.serviceId,
    startsAt: toApiDateTime(row.startsAt)!,
    durationMinutes: row.durationMinutes,
    status: toApi(row.status),
    paymentStatus: toApi(row.paymentStatus),
    notes: row.notes,
    checkedInAt: toApiDateTime(row.checkedInAt),
    completedAt: toApiDateTime(row.completedAt),
    cancelledAt: toApiDateTime(row.cancelledAt),
    cancelReason: row.cancelReason,
    createdBy: row.createdById,
    createdAt: toApiDateTime(row.createdAt)!,
    patient: row.patient,
    doctor: row.doctor,
    // Enum kichik harfga o'giriladi — xom Prisma qatori chiqib ketmasin
    service: { ...row.service, priceMode: toApi(row.service.priceMode) },
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const cursor = startOfDay(from)
  const last = startOfDay(to)
  // Chegara: bir yildan uzun davr so'ralsa ham xotira to'lib ketmasin
  while (cursor <= last && days.length < 400) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Ertangi kunning oxiri — undan keyingi qabullarga xabar yuborilmaydi */
function endOfTomorrow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Telegram `parse_mode: HTML` uchun.
 *
 * Bemor ismi yoki xizmat nomida `<` bo'lsa, Telegram butun xabarni
 * rad etadi — ya'ni xabar umuman kelmaydi va sababi ko'rinmaydi.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
