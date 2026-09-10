import { Body, Controller, Delete, Get, Headers, Post } from '@nestjs/common'

import { Public } from '../common/guards/jwt-auth.guard'
import { RequirePermission } from '../common/guards/permissions.guard'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramLinkDto } from './telegram.dto'
import { TelegramService } from './telegram.service'

@Controller()
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  /*
    GET /me/telegram

    Hisob ulanganmi. Ilgari buni bilishning YO'LI YO'Q EDI:
    ulanish jimgina bo'lardi, ulanmagani ham jimgina — shifokor
    xabar kelmayotganini ko'rardi-yu, sababini topa olmasdi.
  */
  @Get('me/telegram')
  @RequirePermission('settings.view')
  async status() {
    const { userId } = this.ctx.require()
    const user = await this.prisma
      .forCurrentClinic()
      .user.findFirst({ where: { id: userId }, select: { telegramUserId: true } })

    return { linked: Boolean(user?.telegramUserId), available: this.telegram.enabled }
  }

  /*
    POST /me/telegram

    Xodim ilovani Telegram mini app ichida ochganda frontend shu
    marshrutga `initData` yuboradi va hisob JIMGINA bog'lanadi.

    `settings.view` — har bir rolda bor, ya'ni amalda "kirgan bo'lsa
    yetadi". Yangi ruxsat ochmadim: bog'lanadigan narsa foydalanuvchi
    O'ZI, ya'ni bu ruxsat masalasi emas.
  */
  @Post('me/telegram')
  @RequirePermission('settings.view')
  async link(@Body() dto: TelegramLinkDto) {
    const verified = this.telegram.verifyInitData(dto.initData)
    if (!verified) {
      /*
        XATO QAYTARILMAYDI. Imzo yaroqsiz bo'lishining odatiy sababi —
        ilova brauzerda ochilgan yoki token o'rnatilmagan. Bu nosozlik
        emas, shuning uchun interfeys qizil xato ko'rsatmasligi kerak.
      */
      return { linked: false }
    }

    const { userId } = this.ctx.require()
    await this.prisma
      .forCurrentClinic()
      .user.update({
        where: { id: userId },
        data: { telegramUserId: verified.telegramUserId },
      })

    return { linked: true }
  }

  /*
    POST /me/telegram/link

    Botga olib boradigan bir martalik havola. Mini app ichidagi
    jimgina ulanish YETMAYDI: ilovani brauzerdan ochgan shifokor
    hech qachon ulanmasdi. Ustiga-ustak bot O'ZI birinchi bo'lib
    yoza olmaydi — odam suhbatni ochmaguncha xabar 403 bo'ladi.
    Havolani bosgan odam ikkalasini bir yo'la bajaradi.
  */
  @Post('me/telegram/link')
  @RequirePermission('settings.view')
  async linkUrl() {
    const username = await this.telegram.username()
    if (!username) return { url: null }

    const { userId } = this.ctx.require()
    const code = this.telegram.issueLinkCode(userId)
    return { url: `https://t.me/${username}?start=${code}` }
  }

  /*
    DELETE /me/telegram

    Ulanishni uzish. Telefon almashtirilganda kerak: eski hisobga
    xabar ketaverardi va yangisiga hech narsa kelmasdi.
  */
  @Delete('me/telegram')
  @RequirePermission('settings.view')
  async unlink() {
    const { userId } = this.ctx.require()
    await this.prisma
      .forCurrentClinic()
      .user.update({ where: { id: userId }, data: { telegramUserId: null } })

    return { linked: false }
  }

  /*
    POST /telegram/webhook

    Telegram botga kelgan xabarlarni shu yerga tashlaydi. Marshrut
    OCHIQ bo'lishi shart — Telegram'da bizning tokenimiz yo'q —
    shuning uchun `setWebhook` da berilgan maxfiy kalit sarlavhada
    tekshiriladi.

    HAR DOIM `{ ok: true }` QAYTADI. Telegram xato javobni qayta
    urinish belgisi deb biladi va bir xil xabarni soatlab
    yuboraverardi; yaroqsiz so'rov shunchaki e'tiborsiz qoldiriladi.
  */
  @Post('telegram/webhook')
  @Public()
  async webhook(
    @Body() update: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    if (!this.telegram.webhookAllowed(secret)) return { ok: true }

    const message = this.telegram.parseMessage(update)
    if (!message) return { ok: true }

    const code = this.telegram.startPayload(message.text)
    const userId = code ? this.telegram.consumeLinkCode(code) : null

    if (userId) {
      /*
        `acrossAllClinics` — bu yerda klinika konteksti YO'Q va
        bo'lishi ham mumkin emas: so'rovni Telegram yuboradi, unda
        token yo'q. Kim ekanligini bir martalik kod aytadi, kod esa
        aynan bitta foydalanuvchiga berilgan.
      */
      await this.prisma
        .acrossAllClinics()
        .user.update({
          where: { id: userId },
          data: { telegramUserId: message.chatId },
        })
    }

    await this.telegram.sendWelcome(message.chatId, Boolean(userId))
    return { ok: true }
  }
}
