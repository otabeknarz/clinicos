import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { CreateFinanceEntryDto, FinanceRangeDto, VoidFinanceEntryDto } from './finance.dto'
import { FinanceService } from './finance.service'

/**
 * KIRIM-CHIQIM.
 *
 * Standart holatda FAQAT egasida. Egasi uni xodimga beradi:
 *
 *   `finance.view`    — butun hisobot va barcha yozuvlar (buxgalter)
 *   `finance.create`  — chiqim/kirim yozish va O'Z yozuvlarini ko'rish
 *                       (kassadan xaridga pul beradigan registrator)
 *   `finance.void`    — bekor qilish, BERILMAYDI, egasida qoladi
 */
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // GET /finance/summary?from=&to=
  @Get('summary')
  @RequirePermission('finance.view')
  summary(@Query() query: FinanceRangeDto) {
    return this.finance.summary(query)
  }

  // GET /finance/entries?from=&to=&type=
  @Get('entries')
  @RequirePermission('finance.view')
  list(@Query() query: FinanceRangeDto) {
    return this.finance.list(query)
  }

  // GET /finance/my-entries?from=&to=&type=
  @Get('my-entries')
  @RequirePermission('finance.create')
  mine(@Query() query: FinanceRangeDto) {
    return this.finance.mine(query)
  }

  // POST /finance/entries
  @Post('entries')
  @RequirePermission('finance.create')
  @Audit('create', 'finance_entry')
  create(@Body() dto: CreateFinanceEntryDto) {
    return this.finance.create(dto)
  }

  // POST /finance/entries/:id/void
  @Post('entries/:id/void')
  @RequirePermission('finance.void')
  @Audit('void', 'finance_entry')
  void(@Param() params: IdParamDto, @Body() dto: VoidFinanceEntryDto) {
    return this.finance.void(params.id, dto)
  }
}
