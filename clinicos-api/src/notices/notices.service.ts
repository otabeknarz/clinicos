import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { escapeHtml } from '../common/telegram-text'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import { BroadcastDto } from './notices.dto'

/**
 * BEMORLARGA XABAR.
 *
 * Xabar IKKI JOYDA yashaydi: bemor kabinetida (yozuv sifatida) va
 * Telegramda (yetkazish yo'li sifatida). Bot ochilmagan bemor
 * xabarni kabinetda baribir ko'radi — shuning uchun yozuv har doim
 * yaratiladi, Telegram esa "yetkazildi" bayrog'ini qo'yadi.
 *
 * KIMGA YUBORILADI. Shifokor faqat O'Z bemorlariga yozadi: uning
 * qabuliga yozilmagan odamga xabar yuborishi — klinika nomidan
 * begona odamga yozish degani. Egasi va registrator esa klinikaning
 * barcha qabullari bo'yicha yuboradi.
 */
@Injectable()
export class NoticesService {
  private readonly log = new Logger('Notices')

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly telegram: TelegramService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Xabar kimga boradi — YUBORISHDAN OLDIN.
   *
   * Odam "qabulga yozilganlarga" deganida nechta odam nazarda
   * tutilayotganini ko'rishi kerak: 3 ta emas, 300 ta bo'lsa,
   * bu boshqa qaror.
   */
  async audience(scope: string, from?: string, to?: string) {
    const patients = await this.targets(scope === 'patients' ? 'patients' : 'appointments', {
      from,
      to,
    })
    return {
      total: patients.length,
      /* Telegramga ulanganlar — qolganlari faqat kabinetda ko'radi */
      telegram: patients.filter((p) => p.telegramUserId).length,
    }
  }

  async broadcast(dto: BroadcastDto) {
    const user = this.ctx.require()

    const patients = await this.targets(dto.scope, {
      from: dto.from,
      to: dto.to,
      patientIds: dto.patientIds,
    })
    if (patients.length === 0) throw new BadRequestException('Xabar yuboriladigan bemor topilmadi')

    const me = await this.db.user.findFirst({
      where: { id: user.userId },
      select: { fullName: true },
    })

    const text = dto.text.trim()
    /* `createManyAndReturn` — id'lar kerak: yetkazilganini AYNAN
       shu yozuvlarga belgilaymiz, bemorning eski xabarlariga emas */
    const created = await this.db.patientNotice.createManyAndReturn({
      data: patients.map((patient) => ({
        clinicId: user.clinicId,
        patientId: patient.id,
        kind: 'BROADCAST' as const,
        text,
        createdById: user.userId,
        createdByName: me?.fullName ?? '',
      })),
    })

    /*
      Telegramga yuborish — JAVOBDAN KEYIN. Besh yuz xabar birma-bir
      ketadi (Telegram sekundiga ~30 tasini qabul qiladi), bu bir
      necha soniya. Xodim shuncha vaqt "yuborilmoqda" ekraniga
      qarab turmasligi kerak: yozuvlar allaqachon yaratilgan.
    */
    const clinic = await this.db.clinic.findFirst({ select: { name: true } })
    const linked = new Map(patients.filter((p) => p.telegramUserId).map((p) => [p.id, p]))
    void this.deliver(
      created
        .filter((notice) => linked.has(notice.patientId))
        .map((notice) => ({
          noticeId: notice.id,
          telegramUserId: linked.get(notice.patientId)?.telegramUserId ?? null,
        })),
      `<b>${escapeHtml(clinic?.name ?? 'Klinika')}</b>\n\n${escapeHtml(text)}`,
    )

    return {
      total: patients.length,
      telegram: patients.filter((p) => p.telegramUserId).length,
    }
  }

  /** Xodim ko'radigan tarix — kim, qachon, nechtaga yuborgan */
  async history() {
    const rows = await this.db.patientNotice.findMany({
      where: { kind: 'BROADCAST' },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        text: true,
        createdAt: true,
        createdByName: true,
        delivered: true,
      },
    })

    /* Bitta yuborish — yuzta yozuv. Ular matn va vaqt bo'yicha yig'iladi */
    const groups = new Map<
      string,
      { text: string; sentAt: Date; sentBy: string; total: number; delivered: number }
    >()

    for (const row of rows) {
      const minute = new Date(row.createdAt)
      minute.setSeconds(0, 0)
      const key = `${minute.toISOString()}|${row.text}`
      const group = groups.get(key) ?? {
        text: row.text,
        sentAt: row.createdAt,
        sentBy: row.createdByName,
        total: 0,
        delivered: 0,
      }
      group.total++
      if (row.delivered) group.delivered++
      groups.set(key, group)
    }

    return [...groups.values()].map((group) => ({
      text: group.text,
      sentAt: toApiDateTime(group.sentAt),
      sentBy: group.sentBy,
      total: group.total,
      delivered: group.delivered,
    }))
  }

  /* ------------------------------------------------------------------ */

  private async targets(
    scope: 'appointments' | 'patients',
    options: { from?: string; to?: string; patientIds?: string[] },
  ) {
    const user = this.ctx.require()

    if (scope === 'patients') {
      const ids = options.patientIds ?? []
      if (ids.length === 0) return []
      return this.db.patient.findMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        select: { id: true, fullName: true, telegramUserId: true },
      })
    }

    const from = options.from ? new Date(options.from) : startOfToday()
    const to = options.to ? endOfDay(new Date(options.to)) : endOfDay(addDays(startOfToday(), 7))

    const appointments = await this.db.appointment.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] },
        /* Shifokor faqat o'z qabullariga yozadi */
        ...(user.role === 'DOCTOR' && user.doctorId ? { doctorId: user.doctorId } : {}),
      },
      select: {
        patient: { select: { id: true, fullName: true, telegramUserId: true, status: true } },
      },
    })

    /* Bir bemorda bir necha qabul bo'lishi mumkin — xabar bitta boradi */
    const unique = new Map<string, { id: string; fullName: string; telegramUserId: string | null }>()
    for (const row of appointments) {
      if (row.patient.status !== 'ACTIVE') continue
      unique.set(row.patient.id, {
        id: row.patient.id,
        fullName: row.patient.fullName,
        telegramUserId: row.patient.telegramUserId,
      })
    }
    return [...unique.values()]
  }

  /**
   * Telegramga yuborish va "yetkazildi" belgisini qo'yish.
   *
   * Xato tashlamaydi: bitta bemor botni bloklagani butun yuborishni
   * to'xtatmasligi kerak. `TelegramService.send` ham xatoni yutadi.
   */
  private async deliver(
    items: { noticeId: string; telegramUserId: string | null }[],
    text: string,
  ): Promise<void> {
    for (const item of items) {
      if (!item.telegramUserId) continue
      await this.telegram.send(item.telegramUserId, text, undefined, 'patient')
      try {
        /*
          Fon vazifasida so'rov konteksti yo'q — klinika filtrli
          mijozni ishlatib bo'lmaydi. Yozuv id bo'yicha topiladi,
          ya'ni boshqa klinikaga tegib ketish ehtimoli yo'q.
        */
        await this.prisma.acrossAllClinics().patientNotice.update({
          where: { id: item.noticeId },
          data: { delivered: true },
        })
      } catch (error) {
        this.log.warn(`Yetkazildi belgisi qo‘yilmadi: ${String(error)}`)
      }
      /* Telegram sekundiga ~30 xabar qabul qiladi */
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  }
}

/* ------------------------------------------------------------------ */

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}
