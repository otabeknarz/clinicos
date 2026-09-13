import { Module } from '@nestjs/common'

import { PrescriptionsController } from './prescriptions.controller'
import { PrescriptionsService } from './prescriptions.service'

/**
 * Onlayn retsept klinika va apteka o'rtasida turadi, shuning
 * uchun ikkalasining modulida emas, o'zida.
 */
@Module({
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
