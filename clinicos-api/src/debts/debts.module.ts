import { Module } from '@nestjs/common'

import { DebtsController } from './debts.controller'
import { DebtsService } from './debts.service'

@Module({
  controllers: [DebtsController],
  providers: [DebtsService],
  // Eksport qarz formulasini qayta yozmasin — xizmatning o‘zini oladi
  exports: [DebtsService],
})
export class DebtsModule {}
