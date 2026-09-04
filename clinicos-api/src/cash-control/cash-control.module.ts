import { Module } from '@nestjs/common'

import { CashControlController } from './cash-control.controller'
import { CashControlService } from './cash-control.service'

@Module({
  controllers: [CashControlController],
  providers: [CashControlService],
})
export class CashControlModule {}
