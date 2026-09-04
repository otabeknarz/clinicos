import { Body, Controller, Get, Patch } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { ClinicInputDto } from './clinic.dto'
import { ClinicService } from './clinic.service'

@Controller('clinic')
export class ClinicController {
  constructor(private readonly clinic: ClinicService) {}

  // GET /clinic
  @Get()
  get() {
    return this.clinic.get()
  }

  // PATCH /clinic  — faqat `settings.manage` ruxsati bilan
  @Patch()
  @RequirePermission('settings.manage')
  update(@Body() dto: ClinicInputDto) {
    return this.clinic.update(dto)
  }
}
