import { Body, Controller, Get, Post } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { WaiveDebtDto } from './debts.dto'
import { DebtsService } from './debts.service'

/**
 * Qarzdorlik.
 *
 * Ko'rish — `payments.view`: egasida ham, registratorda ham bor.
 * Registrator qarzni ko'rmasa, uni undira olmaydi.
 *
 * Kechirish esa FAQAT egasida (`debts.waive`). Pulni oladigan odam
 * qarzni ham yopa olsa, pulni o'ziga olib "kechirdim" deb yozib
 * qo'yishi mumkin bo'lardi.
 */
@Controller('debts')
export class DebtsController {
  constructor(private readonly debts: DebtsService) {}

  // GET /debts
  @Get()
  @RequirePermission('debts.view')
  list() {
    return this.debts.list()
  }

  // POST /debts/waive
  @Post('waive')
  @RequirePermission('debts.waive')
  @Audit('waive', 'debt')
  waive(@Body() dto: WaiveDebtDto) {
    return this.debts.waive(dto)
  }
}
