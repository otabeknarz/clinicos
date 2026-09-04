import { Controller, Get, Query } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional } from 'class-validator'

import { RequirePermission } from '../common/guards/permissions.guard'
import { ForecastService } from './forecast.service'

class HorizonDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([3, 6, 12])
  horizon: number = 6
}

@Controller()
export class ForecastController {
  constructor(private readonly forecast: ForecastService) {}

  // GET /forecast?horizon=3|6|12
  @Get('forecast')
  @RequirePermission('analytics.view')
  get(@Query() query: HorizonDto) {
    return this.forecast.forecast(query.horizon)
  }

  // GET /reports/monthly
  @Get('reports/monthly')
  @RequirePermission('analytics.view')
  monthly() {
    return this.forecast.monthly()
  }
}
