import { Module } from '@nestjs/common'

import { DebtsModule } from '../debts/debts.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

/**
 * Qarzdorlik eksporti `DebtsService` ni chaqiradi: qarz HISOBLANADI,
 * saqlanmaydi. Formulani bu yerda takrorlasak, fayldagi raqam
 * ekrandagidan farq qila boshlardi.
 */
@Module({
  imports: [DebtsModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
