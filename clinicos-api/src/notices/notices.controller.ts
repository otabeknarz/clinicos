import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { BroadcastDto } from './notices.dto'
import { NoticesService } from './notices.service'

/**
 * Bemorlarga xabar.
 *
 * `patients.message` — ALOHIDA ruxsat. Bemor ro'yxatini ko'rish
 * huquqi klinika nomidan hammaga yozish huquqini bermaydi: bitta
 * noto'g'ri xabar butun bazaga ketadi va orqaga qaytarib bo'lmaydi.
 * Shifokor va egasida bor, registratorga esa egasi o'zi beradi.
 */
@Controller('patient-notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  /** Yuborishdan oldin: nechta odamga boradi */
  // GET /patient-notices/audience?scope=&from=&to=
  @Get('audience')
  @RequirePermission('patients.message')
  audience(@Query('scope') scope = 'appointments', @Query('from') from?: string, @Query('to') to?: string) {
    return this.notices.audience(scope, from, to)
  }

  // GET /patient-notices
  @Get()
  @RequirePermission('patients.message')
  history() {
    return this.notices.history()
  }

  // POST /patient-notices
  @Post()
  @RequirePermission('patients.message')
  @Audit('create', 'patient-notice')
  broadcast(@Body() dto: BroadcastDto) {
    return this.notices.broadcast(dto)
  }
}
