import { Module } from '@nestjs/common'

import { BonusesController } from './bonuses.controller'
import { BonusesService } from './bonuses.service'

@Module({
  controllers: [BonusesController],
  providers: [BonusesService],
})
export class BonusesModule {}
