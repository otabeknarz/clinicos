import { Body, Controller, Get, Post } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { SetDeleteCodeDto } from './delete-code.dto'
import { DeleteCodeService } from './delete-code.service'

@Controller('clinic/delete-code')
export class DeleteCodeController {
  constructor(private readonly codes: DeleteCodeService) {}

  // GET /clinic/delete-code  →  { isSet }  (kodning o'zi hech qachon qaytmaydi)
  @Get()
  @RequirePermission('settings.view')
  status() {
    return this.codes.status()
  }

  // POST /clinic/delete-code  { password, code }
  @Post()
  @RequirePermission('settings.manage')
  @Audit('update', 'delete_code', '')
  set(@Body() dto: SetDeleteCodeDto) {
    return this.codes.set(dto)
  }
}
