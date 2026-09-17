import { Body, Controller, Get, Post } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { CollectDebtDto, SetDebtDueDto, WaiveDebtDto } from './debts.dto'
import { DebtsService } from './debts.service'

/**
 * Qarzdorlik.
 *
 * Ko'rish — `debts.view`: egasi, registrator va shifokor (faqat o'z
 * bemorlariniki). Undirish — `debts.collect`: uchalasida ham.
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

  // POST /debts/due  { appointmentId | admissionId, dueDate }
  @Post('due')
  @RequirePermission('debts.view')
  setDue(@Body() dto: SetDebtDueDto) {
    return this.debts.setDue(dto)
  }

  // POST /debts/collect  { appointmentId | admissionId, amount, method, notes, dueDate? }
  @Post('collect')
  @RequirePermission('debts.collect')
  @Audit('collect', 'debt')
  collect(@Body() dto: CollectDebtDto) {
    return this.debts.collect(dto)
  }
}
