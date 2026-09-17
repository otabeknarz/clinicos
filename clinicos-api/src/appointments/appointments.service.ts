import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { toApi, toApiDateTime, toDb } from '../common/api-enum'
import { paginated } from '../common/pagination'
import { dayKeyToDb, localDayKey } from '../common/day-key'
import { RequestContext } from '../common/request-context'
import { escapeHtml, whenInWords } from '../common/telegram-text'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import {
  AppointmentInputDto,
  AppointmentQueryDto,
  AppointmentRangeDto,
  BulkMoveDto,
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
  private readonly log = new Logger(AppointmentsService.name)

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
    const { clinicId, userId, role, doctorId: ownDoctorId } = this.ctx.require()

    /*
      SHIFOKOR FAQAT O'ZIGA YOZADI. Kalendarda bo'sh vaqtni o'zi belgilaydi,
      lekin hamkasbining jadvaliga bemor qo'sha olmaydi — u registratura ishi.
    */
    if (role === 'DOCTOR' && dto.doctorId !== ownDoctorId) {
      throw new ForbiddenException('Faqat o‘zingizga qabul yoza olasiz')
    }

    /*
      Bemor, shifokor va xizmat SHU klinikaniki ekanini tekshiramiz.

      Filtr o'zi ham begona id'ni o'tkazmaydi, lekin u holda Prisma
      "foreign key" xatosi bilan 500 qaytarardi. Bu yerda tushunarli
      xabar beriladi.
    */
    const service = await this.requireOwn('service', dto.serviceId, 'Xizmat topilmadi')
    await this.requireOwn('patient', dto.patientId, 'Bemor topilmadi')
    await this.requireOwn('doctor', dto.doctorId, 'Shifokor topilmadi')

    const closed = await this.closedReason(new Date(dto.startsAt), dto.doctorId)
    if (closed) throw new BadRequestException(closed)

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
    /* Shifokor o'zi yozgan bo'lsa — o'ziga xabar yuborilmaydi */
    if (role !== 'DOCTOR') void this.notifyDoctor(row)
    /*
      BEMORGA HAM — agar u bemor botiga ulangan bo'lsa. Ilgari bemor
      faqat 3 kun va 1 kun oldingi eslatmani olardi: bugunga yoki
      ertaga kechqurun yozilgan qabulga umuman xabar kelmasdi.
    */
    void this.notifyPatient(row)

    return toApiAppointment(row)
  }

  /**
   * Shu kun klinika yoki shifokor uchun dam olish kunimi.
   * Dam olish bo'lsa — foydalanuvchiga ko'rsatiladigan sabab, aks holda `null`.
   */
  private async closedReason(startsAt: Date, doctorId: string): Promise<string | null> {
    const rows = await this.db.dayOff.findMany({
      where: {
        date: dayKeyToDb(localDayKey(startsAt)),
        OR: [{ doctorId: null }, { doctorId }],
      },
      select: { doctorId: true, reason: true },
    })
    if (rows.length === 0) return null
    const clinicWide = rows.find((row) => row.doctorId === null)
    const row = clinicWide ?? rows[0]
    const why = row.reason ? ` (${row.reason})` : ''
    return clinicWide
      ? `Bu kun klinika dam oladi${why} — boshqa kunni tanlang`
      : `Bu kun shifokor ishlamaydi${why} — boshqa kun yoki boshqa shifokorni tanlang`
  }

  /**
   * QABULLARNI KO'CHIRISH.
   *
   * Har bir qabul ALOHIDA tekshiriladi va ALOHIDA saqlanadi: bittasi band
   * vaqtga tushsa, qolganlari to'xtamaydi. Javob — ko'chirilganlar va
   * sababi bilan qolib ketganlar; registrator ularni qo'lda joylaydi.
   *
   * QOIDALAR:
   *   - faqat rejada yoki tasdiqlangan qabul ko'chadi (kelgan, yakunlangan,
   *     bekor qilingan va kelmagan — tarix, ular o'zgarmaydi);
   *   - yangi kun klinika yoki yangi shifokor uchun dam olish bo'lmasin;
   *   - yangi shifokorning o'sha vaqti band bo'lmasin;
   *   - KUNI o'zgarsa, tasdiq bekor bo'ladi (bemor ESKI vaqtni tasdiqlagan)
   *     va eski eslatmalar o'chiriladi — yangi kun uchun qaytadan boradi.
   */
  async bulkMove(dto: BulkMoveDto) {
    if (dto.mode === 'doctor') {
      await this.requireOwn('doctor', dto.doctorId!, 'Shifokor topilmadi')
    }

    const rows = await this.db.appointment.findMany({
      where: { id: { in: dto.ids } },
      include: EXPAND,
      orderBy: { startsAt: 'asc' },
    })

    const moved: ReturnType<typeof toApiAppointment>[] = []
    const skipped: { id: string; patientName: string; time: string; reason: string }[] = []

    for (const row of rows) {
      const skip = (reason: string) =>
        skipped.push({ id: row.id, patientName: row.patient.fullName, time: row.startsAt.toISOString(), reason })

      if (row.status !== 'SCHEDULED' && row.status !== 'CONFIRMED') {
        skip('Qabul boshlangan yoki yopilgan — ko‘chirilmaydi')
        continue
      }

      let startsAt = row.startsAt
      if (dto.mode === 'date') {
        const [y, m, d] = dto.date!.split('-').map(Number)
        startsAt = new Date(y, m - 1, d, row.startsAt.getHours(), row.startsAt.getMinutes(), 0, 0)
      }
      const doctorId = dto.mode === 'doctor' ? dto.doctorId! : row.doctorId

      if (startsAt.getTime() === row.startsAt.getTime() && doctorId === row.doctorId) {
        skip('O‘zgarish yo‘q — o‘sha kun va o‘sha shifokor')
        continue
      }
      if (startsAt.getTime() < Date.now()) {
        skip('Yangi vaqt o‘tib ketgan')
        continue
      }

      const closed = await this.closedReason(startsAt, doctorId)
      if (closed) {
        skip(closed.replace(/ — .*$/, ''))
        continue
      }

      /* Yangi shifokorning shu vaqti bandmi */
      const endsAt = new Date(startsAt.getTime() + row.durationMinutes * 60_000)
      const dayStart = new Date(startsAt)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(startsAt)
      dayEnd.setHours(23, 59, 59, 999)
      const sameDay = await this.db.appointment.findMany({
        where: {
          doctorId,
          id: { not: row.id },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
          startsAt: { gte: dayStart, lte: dayEnd },
        },
        select: { startsAt: true, durationMinutes: true, patient: { select: { fullName: true } } },
      })
      const clash = sameDay.find(
        (other) =>
          other.startsAt < endsAt &&
          new Date(other.startsAt.getTime() + other.durationMinutes * 60_000) > startsAt,
      )
      if (clash) {
        skip(`Shu vaqt band: ${clash.patient.fullName}`)
        continue
      }

      const dayChanged = localDayKey(startsAt) !== localDayKey(row.startsAt)
      const updated = await this.db.appointment.update({
        where: { id: row.id },
        data: {
          startsAt,
          doctorId,
          ...(row.status === 'CONFIRMED' && startsAt.getTime() !== row.startsAt.getTime()
            ? { status: 'SCHEDULED' }
            : {}),
        },
        include: EXPAND,
      })

      /* Eski vaqt uchun yuborilgan eslatmalar yangi kun uchun qaytadan borsin */
      await this.db.patientNotice.deleteMany({
        where: {
          appointmentId: row.id,
          kind: { in: dayChanged ? ['REMINDER', 'REMINDER_SOON', 'RESCHEDULED'] : ['RESCHEDULED'] },
        },
      })

      if (dto.notify) void this.notifyRescheduled(updated, row.startsAt, row.doctor.fullName)
      if (doctorId !== row.doctorId || dayChanged) void this.notifyDoctor(updated)

      moved.push(toApiAppointment(updated))
    }

    const found = new Set(rows.map((row) => row.id))
    for (const id of dto.ids) {
      if (!found.has(id)) skipped.push({ id, patientName: '—', time: '', reason: 'Qabul topilmadi' })
    }

    this.log.log(`Ko‘chirish: ${moved.length} ta ko‘chirildi, ${skipped.length} ta qoldi`)
    return { moved, skipped }
  }

  /** "Qabulingiz o'zgardi" — bemorga, bemor botidan. Xato tashlamaydi. */
  private async notifyRescheduled(
    row: { id: string; clinicId: string; startsAt: Date; patient: { id: string }; doctor: { fullName: string }; service: { name: string } },
    oldStartsAt: Date,
    oldDoctor: string,
  ) {
    try {
      if (!this.telegram.patientEnabled) return
      const details = await this.db.appointment.findFirst({
        where: { id: row.id },
        select: {
          patient: { select: { telegramUserId: true } },
          clinic: { select: { name: true, phone: true } },
        },
      })
      if (!details?.patient.telegramUserId) {
        this.log.log(`Bemor boti: bemor ${row.patient.id} botga ulanmagan — ko‘chirish xabari yuborilmadi`)
        return
      }

      const lines = [
        `<b>${escapeHtml(details.clinic.name)}</b>`,
        '',
        '<b>Qabulingiz o‘zgardi.</b>',
        '',
        `<b>Yangi vaqt:</b> ${escapeHtml(whenInWords(row.startsAt))}`,
        `<b>Shifokor:</b> ${escapeHtml(row.doctor.fullName)}`,
        `<b>Xizmat:</b> ${escapeHtml(row.service.name)}`,
      ]
      if (oldStartsAt.getTime() !== row.startsAt.getTime() || oldDoctor !== row.doctor.fullName) {
        lines.push('', `Avvalgisi: ${escapeHtml(whenInWords(oldStartsAt))}, ${escapeHtml(oldDoctor)}`)
      }
      if (details.clinic.phone) {
        lines.push('', `Vaqt to‘g‘ri kelmasa, qo‘ng‘iroq qiling: ${escapeHtml(details.clinic.phone)}`)
      }
      const text = lines.join('\n')

      await this.telegram.send(
        details.patient.telegramUserId,
        text,
        { inline_keyboard: [[{ text: 'Qabul qildim', callback_data: `appt:${row.id}` }]] },
        'patient',
      )
      await this.db.patientNotice.create({
        data: {
          clinicId: row.clinicId,
          patientId: row.patient.id,
          appointmentId: row.id,
          kind: 'RESCHEDULED',
          text: text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
          createdByName: 'Tizim',
          delivered: true,
        },
      })
    } catch (error) {
      this.log.warn(`Bemor boti: ko‘chirish xabari yuborilmadi: ${String(error)}`)
    }
  }

  /**
   * "SIZ QABULGA YOZILDINGIZ" — bemorga, bemor botidan.
   *
   * Xabarda "Qabul qildim" tugmasi bor — eslatmadagi bilan bir xil:
   * bosilsa qabul tasdiqlanadi. Xabar `PatientNotice` ga ham yoziladi
   * (kabinetda ko'rinadi) va shu yozuv yaqin eslatmani takrorlamaslik
   * uchun ishlatiladi: ertangi qabulga yozilgan odamga yarim soatdan
   * keyin yana "ertaga qabulingiz bor" deb yozish ortiqcha.
   *
   * HECH QACHON XATO TASHLAMAYDI va har bir tarmoq logga yoziladi —
   * `notifyDoctor` dagi sabab bilan.
   */
  private async notifyPatient(row: { id: string; startsAt: Date; patient: { id: string } }) {
    try {
      if (!this.telegram.patientEnabled) {
        this.log.warn('Bemor boti: tokeni yo‘q — qabul xabari yuborilmadi')
        return
      }
      if (row.startsAt.getTime() < Date.now()) {
        this.log.log('Bemor boti: qabul vaqti o‘tib ketgan — xabar yuborilmadi')
        return
      }

      const details = await this.db.appointment.findFirst({
        where: { id: row.id },
        select: {
          clinicId: true,
          patient: { select: { id: true, telegramUserId: true } },
          doctor: { select: { fullName: true } },
          service: { select: { name: true } },
          clinic: { select: { name: true, phone: true } },
        },
      })
      if (!details) return
      if (!details.patient.telegramUserId) {
        this.log.log(`Bemor boti: bemor ${details.patient.id} botga ulanmagan — xabar yuborilmadi`)
        return
      }

      const text = bookedText({
        clinic: details.clinic.name,
        clinicPhone: details.clinic.phone,
        service: details.service.name,
        doctor: details.doctor.fullName,
        startsAt: row.startsAt,
      })

      await this.telegram.send(
        details.patient.telegramUserId,
        text,
        { inline_keyboard: [[{ text: 'Qabul qildim', callback_data: `appt:${row.id}` }]] },
        'patient',
      )
      this.log.log(`Bemor boti: bemor ${details.patient.id} ga qabul xabari yuborildi`)

      await this.db.patientNotice.create({
        data: {
          clinicId: details.clinicId,
          patientId: details.patient.id,
          appointmentId: row.id,
          kind: 'BOOKED',
          text: text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
          createdByName: 'Tizim',
          delivered: true,
        },
      })
    } catch (error) {
      this.log.warn(`Bemor boti: qabul xabari yuborilmadi: ${String(error)}`)
    }
  }

  /**
   * Yangi qabul haqida shifokorga Telegram xabari.
   *
   * FAQAT BIR HAFTA ICHIDA. Chegara kerak: uzoq muddatli qabullar
   * shifokorning bugungi rejasini o'zgartirmaydi va telefon bekorga
   * jiringlagani sayin xabarlar o'qilmay qo'yiladi. Lekin chegara
   * juda tor bo'lsa ham yomon — ilgari u "ertaga" edi va indinga
   * yozilgan qabulga xabar jimgina yuborilmasdi.
   *
   * O'ZIGA O'ZI XABAR YUBORMAYDI: shifokor o'z qabulini yozgan
   * bo'lsa (bunday holat kam, lekin bor), telefoni bekorga
   * jiringlamasin.
   */
  private async notifyDoctor(row: {
    id: string
    doctorId: string
    startsAt: Date
    patient: { fullName: string }
    service: { name: string }
  }) {
    /*
      HAR BIR TARMOQ LOGGA YOZILADI.

      Ilgari bu yerdan besh xil yo'l bilan JIMGINA chiqib ketish
      mumkin edi va tashqaridan hammasi bir xil ko'rinardi: qabul
      saqlanadi, xabar kelmaydi, logda hech narsa yo'q. "Xabar
      kelmayapti" ni tekshirishning imkoni bo'lmasdi — muvaffaqiyat
      ham, o'tkazib yuborish ham sukut bilan tugardi.
    */
    if (!this.telegram.enabled) {
      this.log.warn('Telegram: bot tokeni yo‘q — xabar yuborilmadi')
      return
    }

    const { userId } = this.ctx.require()

    const cutoff = notifyCutoff()
    if (row.startsAt > cutoff) {
      this.log.log('Telegram: qabul bir haftadan keyinga — xabar yuborilmadi')
      return
    }

    const doctorUser = await this.db.user.findFirst({
      where: { doctorId: row.doctorId, isActive: true },
      select: { id: true, telegramUserId: true },
    })
    if (!doctorUser?.telegramUserId) {
      /*
        Nima uchun xabar ketmaganini AYTIB qo'yamiz. Bu yo'l jimgina
        to'xtaydi — qabul odatdagidek saqlanadi — va tashqaridan
        "bot ishlamayapti" bilan farqi ko'rinmaydi.
      */
      this.log.warn(`Telegram: shifokor ${row.doctorId} ulanmagan — xabar yuborilmadi`)
      return
    }
    if (doctorUser.id === userId) {
      this.log.log('Telegram: shifokor qabulni o‘zi yozdi — xabar yuborilmadi')
      return
    }

    this.log.log(`Telegram: shifokor ${row.doctorId} ga xabar yuborilmoqda`)

    /*
      XABARNING O'ZI YETARLI BO'LSIN.

      Ilgari bu yerda uchta yalang'och qator turardi — ism, xizmat
      va `11-sentabr, 14:00`. Shifokor sanani kalendarga solishtirib
      o'tirardi, keyin ilovani ochib, ro'yxatdan o'sha bemorni
      qidirardi. Endi vaqt SO'Z bilan yoziladi va xabarning ichida
      tashrif yozadigan tugma bor.

      TO'LOV TUGMASI ATAYLAB YO'Q: pulni registrator oladi, shifokor
      emas — bu tizimning asosiy qoidalaridan biri (`payments.create`
      shifokorda yo'q, tugma 403 bilan tugardi). "Ko'rikni tugatish"
      ham alohida tugma emas: tashrif saqlangan zahoti qabul O'ZI
      yakunlanadi, ikkinchi tugma esa ikkinchi yo'l ochib qo'yardi.
    */
    await this.telegram.send(
      doctorUser.telegramUserId,
      [
        '<b>Yangi qabul</b>',
        '',
        `<b>Bemor:</b> ${escapeHtml(row.patient.fullName)}`,
        `<b>Sabab:</b> ${escapeHtml(row.service.name)}`,
        `<b>Qachon:</b> ${escapeHtml(whenInWords(row.startsAt))}`,
      ].join('\n'),
      {
        /*
          IKKINCHI QATORDA "TANISHIB CHIQDIM".

          Xabarlar YIG'ILIB QOLMASLIGI kerak: shifokor kunlik
          qabullarni o'qib chiqadi va tugmani bosadi — xabar
          o'chadi. Aks holda bir haftada suhbat eslatmalarga
          to'lib, keraklisi ko'rinmay qolardi.
        */
        inline_keyboard: [
          [
            {
              text: 'Tashrif yozish',
              web_app: { url: this.telegram.appLink(`/tashrif/${row.id}`) },
            },
          ],
          [{ text: 'Tanishib chiqdim', callback_data: 'ack' }],
        ],
      },
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

    /* Vaqt yoki shifokor o'zgarsa — yangi kun dam olish kuni emasligi tekshiriladi */
    if (dto.startsAt || dto.doctorId) {
      const closed = await this.closedReason(
        dto.startsAt ? new Date(dto.startsAt) : current.startsAt,
        dto.doctorId ?? current.doctorId,
      )
      if (closed) throw new BadRequestException(closed)
    }

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
      days: days.map((d) => localDayKey(d)),
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

/**
 * Xabar yuboriladigan oxirgi kun — bugundan bir hafta keyin.
 *
 * Ilgari bu ERTANGI kun edi va oqibati yomon bo'ldi: indinga
 * yozilgan qabulga xabar jimgina yuborilmasdi, tashqaridan esa
 * bu "bot buzuq" bilan bir xil ko'rinardi. Chegara umuman
 * bo'lmasligi ham to'g'ri emas — bir yil keyingi qabul
 * shifokorning bugungi rejasini o'zgartirmaydi va bunday
 * xabarlar ko'payib ketsa, u xabarlarni butunlay o'qimay
 * qo'yadi. Bir hafta — shifokor haqiqatan rejalashtiradigan
 * oraliq.
 */
function notifyCutoff(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 59, 999)
  return d
}

/** "Siz qabulga yozildingiz" matni — eslatma bilan bir uslubda */
function bookedText(input: {
  clinic: string
  clinicPhone: string
  service: string
  doctor: string
  startsAt: Date
}): string {
  const lines = [
    `<b>${escapeHtml(input.clinic)}</b>`,
    '',
    'Siz qabulga yozildingiz.',
    '',
    `<b>Qachon:</b> ${escapeHtml(whenInWords(input.startsAt))}`,
    `<b>Xizmat:</b> ${escapeHtml(input.service)}`,
    `<b>Shifokor:</b> ${escapeHtml(input.doctor)}`,
  ]
  if (input.clinicPhone) {
    lines.push('', `Kelolmasangiz, oldindan xabar bering: ${escapeHtml(input.clinicPhone)}`)
  }
  return lines.join('\n')
}
