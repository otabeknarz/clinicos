import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { escapeHtml, whenInWords } from '../common/telegram-text'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'

/**
 * QABULDAN IKKI KUN OLDIN ESLATMA.
 *
 * NEGA IKKI KUN: bir kun oldin aytilsa, bemor ishini qayta
 * rejalashtira olmaydi; bir hafta oldin aytilgani esa unutiladi.
 * Ikki kun — ham eslashga, ham rejani o'zgartirishga yetadi.
 *
 * NEGA SOAT 9 DAN 20 GACHA: eslatma foydali bo'lishi uchun odam
 * uyg'oq bo'lishi kerak. Yarim tunda jiringlagan telefon —
 * bloklangan bot degani.
 *
 * TAKRORLANMAYDI: `PatientNotice` da `@@unique([appointmentId, kind])`
 * turibdi. Konteyner kuniga o'n marta qayta ko'tarilsa ham, bemorga
 * bitta eslatma boradi.
 *
 * BIR KONTEYNER. Vazifa oddiy taymerda ishlaydi, alohida navbat
 * yo'q — Telegram ulash kodlari ham shunday (`TelegramService`).
 * Ikkinchi nusxa qo'shilsa, ikkalasi ham urinadi va noyoblik
 * cheklovi ortiqchasini to'xtatadi, lekin o'shanda buni haqiqiy
 * rejalashtiruvchiga ko'chirish kerak.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Reminders')
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 30 * 60 * 1000)
    /* Ko'tarilgandan 20 soniya keyin — baza ulanib olsin */
    setTimeout(() => void this.run(), 20_000)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async run(): Promise<void> {
    const hour = new Date().getHours()
    if (hour < 9 || hour >= 20) return
    if (this.running) return

    this.running = true
    try {
      await this.send()
    } catch (error) {
      /* Fon vazifasi ilovani yiqitmaydi */
      this.log.warn(`Eslatma yuborilmadi: ${String(error)}`)
    } finally {
      this.running = false
    }
  }

  private async send(): Promise<void> {
    /*
      Fon vazifasida so'rov konteksti yo'q, shuning uchun filtrsiz
      mijoz ishlatiladi. Bu — `platform/`, `auth/` va Telegram
      webhook'idan keyingi to'rtinchi qonuniy holat: vazifa BARCHA
      klinikalar uchun ishlaydi va har bir yozuvga `clinicId` ni
      qabulning o'zidan oladi.
    */
    const db = this.prisma.acrossAllClinics()

    const start = new Date()
    start.setDate(start.getDate() + 2)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)

    const appointments = await db.appointment.findMany({
      where: {
        startsAt: { gte: start, lte: end },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        /* Eslatma allaqachon yuborilgan bo'lsa — qayta emas */
        notices: { none: { kind: 'REMINDER' } },
        clinic: { isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        clinicId: true,
        startsAt: true,
        patient: { select: { id: true, telegramUserId: true } },
        doctor: { select: { fullName: true } },
        service: { select: { name: true } },
        clinic: { select: { name: true, phone: true } },
      },
    })

    if (appointments.length === 0) return
    this.log.log(`Eslatma: ${appointments.length} ta qabul`)

    for (const appointment of appointments) {
      const text = reminderText({
        clinic: appointment.clinic.name,
        clinicPhone: appointment.clinic.phone,
        service: appointment.service.name,
        doctor: appointment.doctor.fullName,
        startsAt: appointment.startsAt,
      })

      let delivered = false
      if (appointment.patient.telegramUserId) {
        await this.telegram.send(appointment.patient.telegramUserId, text, undefined, 'patient')
        delivered = true
      }

      try {
        await db.patientNotice.create({
          data: {
            clinicId: appointment.clinicId,
            patientId: appointment.patient.id,
            appointmentId: appointment.id,
            kind: 'REMINDER',
            /* Kabinetda HTML emas, oddiy matn ko'rinadi */
            text: plain(text),
            createdByName: 'Tizim',
            delivered,
          },
        })
      } catch {
        /* Noyoblik cheklovi: eslatma allaqachon yozilgan — normal holat */
      }

      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  }
}

/* ------------------------------------------------------------------ */

export function reminderText(input: {
  clinic: string
  clinicPhone: string
  service: string
  doctor: string
  startsAt: Date
}): string {
  const lines = [
    `<b>${escapeHtml(input.clinic)}</b>`,
    '',
    `Eslatma: ${whenInWords(input.startsAt)} qabulingiz bor.`,
    `${escapeHtml(input.service)} — ${escapeHtml(input.doctor)}`,
  ]
  if (input.clinicPhone) {
    lines.push('', `Kelolmasangiz, oldindan xabar bering: ${escapeHtml(input.clinicPhone)}`)
  }
  return lines.join('\n')
}

/** Kabinet uchun — belgilarsiz matn */
function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}
