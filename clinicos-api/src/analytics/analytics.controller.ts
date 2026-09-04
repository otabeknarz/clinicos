import { Controller, Get, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { AnalyticsService } from './analytics.service'
import { RangeDto, RevenuePeriodDto } from './analytics.dto'

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // GET /dashboard/summary
  @Get('dashboard/summary')
  @RequirePermission('dashboard.view')
  summary() {
    return this.analytics.dashboard()
  }

  /*
    GET /dashboard/revenue?period=today|week|month

    Pul raqamlari — `revenue.view` talab qiladi. Registratorda
    u yo'q: bosh sahifada unga qabullar ko'rinadi, aylanma emas.
  */
  @Get('dashboard/revenue')
  @RequirePermission('revenue.view')
  revenue(@Query() query: RevenuePeriodDto) {
    return this.analytics.revenueSeries(query)
  }

  // GET /dashboard/performance
  @Get('dashboard/performance')
  @RequirePermission('analytics.view')
  performance() {
    return this.analytics.performance()
  }

  // GET /reports/analytics?from=&to=
  @Get('reports/analytics')
  @RequirePermission('analytics.view')
  report(@Query() query: RangeDto) {
    return this.analytics.report(query)
  }
}
