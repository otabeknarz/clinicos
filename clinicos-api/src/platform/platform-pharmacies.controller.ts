import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  PharmacyCreateDto,
  PharmacySuspendDto,
  PharmacyUpdateDto,
} from './platform-pharmacies.dto'
import { PlatformPharmaciesService } from './platform-pharmacies.service'

/**
 * PLATFORMA: APTEKALAR — klinikalardan ALOHIDA bo'lim.
 *
 * Butun kontroller `platform.view` bilan yopilgan (faqat SUPERADMIN),
 * o'zgartiradigan amallar esa qo'shimcha `platform.manage` talab qiladi —
 * `PlatformController` bilan bir xil tartib.
 */
@Controller('platform/pharmacies')
@RequirePermission('platform.view')
export class PlatformPharmaciesController {
  constructor(private readonly pharmacies: PlatformPharmaciesService) {}

  @Get('')
  list() {
    return this.pharmacies.list()
  }

  @Get(':id')
  get(@Param() { id }: IdParamDto) {
    return this.pharmacies.get(id)
  }

  @Post('')
  @RequirePermission('platform.manage')
  create(@Body() dto: PharmacyCreateDto) {
    return this.pharmacies.create(dto)
  }

  @Patch(':id')
  @RequirePermission('platform.manage')
  @Audit('update', 'Pharmacy')
  update(@Param() { id }: IdParamDto, @Body() dto: PharmacyUpdateDto) {
    return this.pharmacies.update(id, dto)
  }

  @Post(':id/suspend')
  @RequirePermission('platform.manage')
  @Audit('suspend', 'Pharmacy')
  suspend(@Param() { id }: IdParamDto, @Body() dto: PharmacySuspendDto) {
    return this.pharmacies.suspend(id, dto.reason)
  }

  @Post(':id/activate')
  @RequirePermission('platform.manage')
  @Audit('activate', 'Pharmacy')
  activate(@Param() { id }: IdParamDto) {
    return this.pharmacies.activate(id)
  }

  @Post(':id/reset-owner-password')
  @RequirePermission('platform.manage')
  @Audit('reset_password', 'Pharmacy')
  resetOwnerPassword(@Param() { id }: IdParamDto) {
    return this.pharmacies.resetOwnerPassword(id)
  }
}
