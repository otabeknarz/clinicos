import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'

import { escapeHtml } from '../common/telegram-text'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import { AuthService } from './auth.service'

/**
 * ESKI O'ZI RO'YXATDAN O'TGAN KLINIKALARGA LOGIN.
 *
 * Ilgari o'zi ro'yxatdan o'tganda egasining "emaili" telefon raqami bo'lib
 * yozilardi: `nom@clinic-os.uz` login yo'q edi, admin panelda login ustuni
 * bo'sh turardi. Endi yangi ro'yxat login bilan ochiladi; bu vazifa
 * ilgari ochilganlarga ham xuddi shunday login beradi va egasiga botda
 * yozib yuboradi.
 *
 * Takror ishlasa zarar yo'q: faqat `@` siz emaili bor egalar olinadi —
 * login berilgach ular ro'yxatga qayta tushmaydi. Telefon bilan kirish
 * avvalgidek ishlaydi (kirish telefon ustunini ham tekshiradi).
 */
@Injectable()
export class LoginBackfillService implements OnModuleInit {
  private readonly log = new Logger('LoginBackfill')

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    /* Baza ulanib olsin — ko'tarilishni kechiktirmaymiz */
    setTimeout(() => void this.run(), 25_000)
  }

  async run(): Promise<void> {
    try {
      const db = this.prisma.acrossAllClinics()
      const owners = await db.user.findMany({
        where: {
          role: { in: ['OWNER', 'PHARMACY_OWNER'] },
          NOT: { email: { contains: '@' } },
        },
        select: {
          id: true,
          clinicId: true,
          telegramUserId: true,
          clinic: { select: { name: true } },
        },
      })
      if (owners.length === 0) return

      for (const owner of owners) {
        const login = await this.auth.uniqueLogin(owner.clinic.name)
        await db.$transaction([
          db.user.update({ where: { id: owner.id }, data: { email: login } }),
          db.subscription.updateMany({
            where: { clinicId: owner.clinicId, ownerEmail: '' },
            data: { ownerEmail: login },
          }),
          db.pharmacyStaff.updateMany({ where: { userId: owner.id }, data: { login } }),
        ])

        if (owner.telegramUserId) {
          void this.telegram.send(
            owner.telegramUserId,
            [
              `<b>${escapeHtml(owner.clinic.name)}</b>`,
              '',
              `Sizning loginingiz: <code>${login}</code>`,
              'Parol o‘zgarmadi. Telefon raqamingiz bilan ham kirsa bo‘ladi.',
            ].join('\n'),
          )
        }
      }
      this.log.log(`${owners.length} ta egaga login berildi`)
    } catch (error) {
      this.log.warn(`Login berilmadi: ${String(error)}`)
    }
  }
}
