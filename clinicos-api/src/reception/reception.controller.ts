import { Controller, Get } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { ReceptionService } from './reception.service'

@Controller('reception')
export class ReceptionController {
  constructor(private readonly reception: ReceptionService) {}

  // GET /reception/summary
  @Get('summary')
  @RequirePermission('appointments.view')
  summary() {
    return this.reception.summary()
  }
}
