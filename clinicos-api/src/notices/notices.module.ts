import { Module } from '@nestjs/common'

import { TelegramModule } from '../telegram/telegram.module'
import { NoticesController } from './notices.controller'
import { NoticesService } from './notices.service'
import { RemindersService } from './reminders.service'

/**
 * Xabar va eslatma bitta modulda: ikkalasi ham `PatientNotice`
 * yozuvini yaratadi va bemor botiga yuboradi. Ajratilsa, ikkita
 * joyda ikkita "yetkazish" mantiqi paydo bo'lardi.
 */
@Module({
  imports: [TelegramModule],
  controllers: [NoticesController],
  providers: [NoticesService, RemindersService],
})
export class NoticesModule {}
