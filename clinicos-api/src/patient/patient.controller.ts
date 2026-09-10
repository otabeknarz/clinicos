import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

import { Public } from '../common/guards/jwt-auth.guard'
import { TelegramService } from '../telegram/telegram.service'
import { PatientAuthDto } from './patient.dto'
import { PatientAuthService } from './patient-auth.service'
import { PatientGuard } from './patient.guard'
import { PatientService } from './patient.service'

/**
 * BEMOR KABINETI.
 *
 * Barcha marshrutlar `@Public()` — global qorovullar XODIM tokenini
 * kutadi, bu yerda esa bemor tokeni keladi. Tekshiruvni
 * `PatientGuard` o'tkazadi. `@RequirePermission` YO'Q va bo'lmasligi
 * kerak: bemorning ruxsatlari bo'sh, ya'ni har qanday ruxsat talabi
 * marshrutni butunlay yopib qo'yardi.
 */
@Controller('patient')
@UseGuards(ThrottlerGuard)
export class PatientController {
  constructor(
    private readonly auth: PatientAuthService,
    private readonly patient: PatientService,
    private readonly telegram: TelegramService,
  ) {}

  // POST /patient/auth
  @Post('auth')
  @Public()
  signIn(@Body() dto: PatientAuthDto) {
    return this.auth.signIn(dto.initData, dto.clinicId)
  }

  // GET /patient/card
  @Get('card')
  @Public()
  @UseGuards(PatientGuard)
  card() {
    return this.patient.card()
  }

  // GET /patient/visits
  @Get('visits')
  @Public()
  @UseGuards(PatientGuard)
  visits() {
    return this.patient.visits()
  }

  // GET /patient/debt
  @Get('debt')
  @Public()
  @UseGuards(PatientGuard)
  debt() {
    return this.patient.debt()
  }

  /*
    POST /patient/telegram/webhook

    BEMOR botining xabarlari. Xodim botinikidan alohida marshrut va
    ALOHIDA maxfiy kalit: ikkalasi bitta bo'lsa, bir botning
    so'rovi ikkinchisining nomidan ish qilardi.
  */
  @Post('telegram/webhook')
  @Public()
  async webhook(
    @Body() update: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    if (!this.telegram.webhookAllowed(secret, 'patient')) return { ok: true }

    const message = this.telegram.parsePatientMessage(update)
    if (!message) return { ok: true }

    if (message.ownPhone) {
      const linked = await this.auth.linkByPhone(message.chatId, message.ownPhone)
      await this.telegram.send(
        message.chatId,
        linked > 0
          ? [
              '<b>Kartangiz topildi</b>',
              '',
              'Kabinetda tashriflaringiz, tashxislaringiz va',
              'qarzingiz ko‘rinadi.',
            ].join('\n')
          : [
              '<b>Karta topilmadi</b>',
              '',
              'Bu raqam bo‘yicha bemor yozuvi yo‘q. Klinikaga',
              'murojaat qiling — raqamingizni to‘g‘rilashsin.',
            ].join('\n'),
        linked > 0 ? this.cabinetButton() : { remove_keyboard: true },
        'patient',
      )
      return { ok: true }
    }

    /*
      Raqam hali ulashilmagan. Tugmani HAR SAFAR ko'rsatamiz: bemor
      botga qaytib kelganida nima qilish kerakligi ko'rinib tursin.
    */
    await this.telegram.send(
      message.chatId,
      [
        '<b>Bemor kabineti</b>',
        '',
        'Kartangizni ochish uchun telefon raqamingizni ulashing —',
        'klinikadagi yozuvingiz shu raqam bo‘yicha topiladi.',
      ].join('\n'),
      {
        keyboard: [[{ text: 'Raqamni ulashish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
      'patient',
    )

    return { ok: true }
  }

  private cabinetButton() {
    return {
      inline_keyboard: [
        [
          {
            text: 'Kabinetni ochish',
            web_app: { url: this.telegram.appLink('/cabinet') },
          },
        ],
      ],
    }
  }
}
