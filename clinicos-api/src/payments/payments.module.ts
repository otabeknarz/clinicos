import { Module } from '@nestjs/common'

import { ServicesModule } from '../services/services.module'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  // Narxni katalogdan olish uchun
  imports: [ServicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
