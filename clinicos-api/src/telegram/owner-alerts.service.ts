import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from './telegram.service'

/**
 * KLINIKA EGASIGA BOTDAN OGOHLANTIRISH.
 *
 * Ega har kuni klinikada bo'lmaydi va panelga ham har soatda
 * kirmaydi. Uning uchun muhim uchta-to'rtta hodisa bor va ular
 * O'ZI yetib borishi kerak: davomat vaqti orqaga surib yozilgani,
 * yomon baholangan izoh, kassadagi tafovut.
 *
 * XABAR YIG'ILIB QOLMAYDI: har birida "Tanishib chiqdim" tugmasi
 * bor, bosilganda suhbatdan o'chadi.
 *
 * HECH QACHON XATO TASHLAMAYDI. Chaqiruvchi joylar — davomat
 * belgilash, izoh saqlash: ularning ishi Telegram tufayli
 * to'xtashi mumkin emas.
 */
@Injectable()
export class OwnerAlertsService {
  private readonly log = new Logger('OwnerAlerts')

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  async send(clinicId: string, text: string): Promise<void> {
    if (!this.telegram.enabled) return

    try {
      /*
        `acrossAllClinics` — chaqiruvchi kontekstda boshqa
        klinikaning konteksti bo'lishi mumkin emas, lekin bu yerda
        `clinicId` ATAYLAB argumentda: fon vazifasidan ham
        chaqiriladi, u yerda kontekst umuman yo'q.
      */
      const owners = await this.prisma.acrossAllClinics().user.findMany({
        where: {
          clinicId,
          role: 'OWNER',
          isActive: true,
          telegramUserId: { not: null },
        },
        select: { telegramUserId: true },
      })

      if (owners.length === 0) return

      await Promise.all(
        owners.map((owner) =>
          this.telegram.send(
            owner.telegramUserId as string,
            text,
            this.telegram.ackButton(),
          ),
        ),
      )
    } catch (error) {
      this.log.warn(`Egaga xabar yuborilmadi: ${String(error)}`)
    }
  }
}
