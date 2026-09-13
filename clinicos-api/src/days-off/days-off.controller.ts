import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { CreateDayOffDto, DaysOffRangeDto } from './days-off.dto'
import { DaysOffService } from './days-off.service'

/**
 * DAM OLISH KUNLARI.
 *
 * Ko'rish — kalendarni ko'radigan har kimga (shifokor ham o'z dam olishini
 * ko'rsin). Belgilash — `daysoff.manage`: egasi va registrator.
 */
@Controller('days-off')
export class DaysOffController {
  constructor(private readonly daysOff: DaysOffService) {}

  // GET /days-off?from=&to=
  @Get()
  @RequirePermission('appointments.view')
  list(@Query() query: DaysOffRangeDto) {
    return this.daysOff.list(query)
  }

  // POST /days-off
  @Post()
  @RequirePermission('daysoff.manage')
  @Audit('create', 'day_off')
  create(@Body() dto: CreateDayOffDto) {
    return this.daysOff.create(dto)
  }

  // DELETE /days-off/:id
  @Delete(':id')
  @RequirePermission('daysoff.manage')
  @Audit('delete', 'day_off')
  remove(@Param() params: IdParamDto) {
    return this.daysOff.remove(params.id)
  }
}
