import { Global, Module } from '@nestjs/common'

import { TelegramController } from './telegram.controller'
import { TelegramService } from './telegram.service'

/**
 * `@Global` — xizmat bir necha modulda kerak bo'ladi (hozir
 * qabullar, keyin eslatmalar) va har birida qayta import qilib
 * o'tirmaslik uchun. `AuditModule` ham shu sababdan global.
 */
@Global()
@Module({
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
