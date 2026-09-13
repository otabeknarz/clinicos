import { Module } from '@nestjs/common'

import { DaysOffController } from './days-off.controller'
import { DaysOffService } from './days-off.service'

@Module({
  controllers: [DaysOffController],
  providers: [DaysOffService],
})
export class DaysOffModule {}
