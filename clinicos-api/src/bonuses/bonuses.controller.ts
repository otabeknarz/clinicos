import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  BonusInputDto, BonusRuleInputDto, PeriodQueryDto, RequiredPeriodDto,
} from './bonuses.dto'
import { BonusesService } from './bonuses.service'

@Controller()
export class BonusesController {
  constructor(private readonly bonuses: BonusesService) {}

  /*
    `suggestions` `:id` dan oldin turishi kerak, aks holda
    Express uni id deb qabul qiladi.
  */

  // GET /bonuses/suggestions?period=
  @Get('bonuses/suggestions')
  @RequirePermission('bonus.manage')
  suggestions(@Query() query: RequiredPeriodDto) {
    return this.bonuses.suggestions(query.period)
  }

  // GET /bonuses?period=&staffId=
  @Get('bonuses')
  @RequirePermission('bonus.manage')
  list(@Query() query: PeriodQueryDto) {
    return this.bonuses.list(query)
  }

  // POST /bonuses
  @Post('bonuses')
  @RequirePermission('bonus.manage')
  create(@Body() dto: BonusInputDto) {
    return this.bonuses.create(dto)
  }

  // POST /bonuses/:id/pay
  @Post('bonuses/:id/pay')
  @RequirePermission('bonus.manage')
  pay(@Param() params: IdParamDto) {
    return this.bonuses.pay(params.id)
  }

  // DELETE /bonuses/:id
  @Delete('bonuses/:id')
  @HttpCode(204)
  @RequirePermission('bonus.manage')
  remove(@Param() params: IdParamDto) {
    return this.bonuses.remove(params.id)
  }

  // GET /bonus-rules
  @Get('bonus-rules')
  @RequirePermission('bonus.manage')
  listRules() {
    return this.bonuses.listRules()
  }

  // POST /bonus-rules
  @Post('bonus-rules')
  @RequirePermission('bonus.manage')
  createRule(@Body() dto: BonusRuleInputDto) {
    return this.bonuses.createRule(dto)
  }

  // PATCH /bonus-rules/:id
  @Patch('bonus-rules/:id')
  @RequirePermission('bonus.manage')
  updateRule(@Param() params: IdParamDto, @Body() dto: BonusRuleInputDto) {
    return this.bonuses.updateRule(params.id, dto)
  }

  // DELETE /bonus-rules/:id
  @Delete('bonus-rules/:id')
  @HttpCode(204)
  @RequirePermission('bonus.manage')
  removeRule(@Param() params: IdParamDto) {
    return this.bonuses.removeRule(params.id)
  }
}
