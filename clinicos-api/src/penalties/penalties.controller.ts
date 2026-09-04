import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { PenaltyRuleInputDto, PeriodDto, WaiveDto } from './penalties.dto'
import { PenaltiesService } from './penalties.service'

@Controller()
export class PenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  // GET /penalty-rules
  @Get('penalty-rules')
  @RequirePermission('staff.manage')
  listRules() {
    return this.penalties.listRules()
  }

  // POST /penalty-rules
  @Post('penalty-rules')
  @RequirePermission('staff.manage')
  createRule(@Body() dto: PenaltyRuleInputDto) {
    return this.penalties.createRule(dto)
  }

  // PATCH /penalty-rules/:id
  @Patch('penalty-rules/:id')
  @RequirePermission('staff.manage')
  updateRule(@Param() params: IdParamDto, @Body() dto: PenaltyRuleInputDto) {
    return this.penalties.updateRule(params.id, dto)
  }

  // DELETE /penalty-rules/:id
  @Delete('penalty-rules/:id')
  @RequirePermission('staff.manage')
  removeRule(@Param() params: IdParamDto) {
    return this.penalties.removeRule(params.id)
  }

  /*
    GET /me/penalties?period=

    Xodim O'Z jarimalarini ko'radi — ruxsat talab qilinmaydi.
    Odam o'ziga solingan jarimani bilishi shart.
  */
  @Get('me/penalties')
  mine(@Query() query: PeriodDto) {
    return this.penalties.mine(query.period)
  }

  // GET /penalties?period=
  @Get('penalties')
  @RequirePermission('staff.manage')
  list(@Query() query: PeriodDto) {
    return this.penalties.list(query.period)
  }

  /*
    POST /penalties/:id/waive

    Egasi jarimani QO'LDA sola olmaydi — faqat kechira oladi.
    Shuning uchun bu yerda `create` endpointi yo'q va bo'lmaydi.
  */
  @Post('penalties/:id/waive')
  @RequirePermission('staff.manage')
  waive(@Param() params: IdParamDto, @Body() dto: WaiveDto) {
    return this.penalties.waive(params.id, dto)
  }

  // DELETE /penalties/:id/waive — kechirishni bekor qilish
  @Delete('penalties/:id/waive')
  @RequirePermission('staff.manage')
  unwaive(@Param() params: IdParamDto) {
    return this.penalties.unwaive(params.id)
  }
}
