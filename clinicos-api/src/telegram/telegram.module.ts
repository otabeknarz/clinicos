import { forwardRef, Global, Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { OwnerAlertsService } from './owner-alerts.service'
import { TelegramController } from './telegram.controller'
import { TelegramService } from './telegram.service'

/**
 * `@Global` — xizmat bir necha modulda kerak bo'ladi (hozir
 * qabullar, keyin eslatmalar) va har birida qayta import qilib
 * o'tirmaslik uchun. `AuditModule` ham shu sababdan global.
 */
@Global()
@Module({
  /*
    `forwardRef` — ikki modul bir-biriga tayanadi va bu ataylab:
    ro'yxatdan o'tishni bot tasdiqlaydi (`AuthService` botga
    murojaat qiladi), tasdiqning o'zi esa botga kelgan xabardan
    boshlanadi (`TelegramController` `AuthService` ni chaqiradi).
  */
  imports: [forwardRef(() => AuthModule)],
  controllers: [TelegramController],
  providers: [TelegramService, OwnerAlertsService],
  exports: [TelegramService, OwnerAlertsService],
})
export class TelegramModule {}
