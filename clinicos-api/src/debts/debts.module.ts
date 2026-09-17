import { Module } from '@nestjs/common'

import { PaymentsModule } from '../payments/payments.module'
import { DebtsController } from './debts.controller'
import { DebtsService } from './debts.service'

@Module({
  // Undirish oddiy to'lov yo'lidan o'tadi — chegara va kassa bir joyda
  imports: [PaymentsModule],
  controllers: [DebtsController],
  providers: [DebtsService],
  // Eksport qarz formulasini qayta yozmasin — xizmatning o‘zini oladi
  exports: [DebtsService],
})
export class DebtsModule {}
