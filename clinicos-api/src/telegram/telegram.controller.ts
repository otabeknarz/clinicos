import { Body, Controller, Headers, Post } from '@nestjs/common'

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
    POST /me/telegram

    Xodim ilovani Telegram mini app ichida ochganda frontend shu
    marshrutga `initData` yuboradi va hisob JIMGINA bog'lanadi.
    Alohida "hisobni bog'lash" tugmasi yo'q: u baribir bosilmasdi,
    va bog'lanmagan xodim xabar olmasligini bilmay yurardi.

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
    await this.telegram.handleUpdate(update)
    return { ok: true }
  }
}
