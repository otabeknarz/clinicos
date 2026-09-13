import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { OfferDto, PrescribeDto, RxQueryDto, RxStatusDto } from './prescriptions.dto'
import { PrescriptionsService } from './prescriptions.service'

/**
 * ONLAYN RETSEPT.
 *
 * Ikki tomoni bor va ular ATAYLAB boshqa-boshqa ruxsat bilan:
 * klinika tomonida `prescriptions.manage` (shifokor, registrator,
 * ega), apteka tomonida `pharmacy.sell` — dorini beradigan odam.
 *
 * Har bir so'rov chaqiruvchining O'Z ustuni bo'yicha filtrlanadi
 * (`prescriptions.service.ts` dagi izoh): bu jadval ikki
 * klinikaga tegishli va avtomatik tenant filtri unga
 * qo'llanmaydi.
 */
@Controller()
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  /*
    POST /prescriptions/offers

    Aptekalar ro'yxati. GET emas, chunki narx AYNAN yozilgan
    dorilar bo'yicha hisoblanadi va ular so'rov tanasida keladi.
    Hech narsa yaratmaydi.
  */
  @Post('prescriptions/offers')
  @RequirePermission('prescriptions.manage')
  offers(@Body() dto: OfferDto) {
    return this.prescriptions.offers(dto)
  }

  // POST /prescriptions
  @Post('prescriptions')
  @RequirePermission('prescriptions.manage')
  @Audit('create', 'prescription')
  create(@Body() dto: PrescribeDto) {
    return this.prescriptions.create(dto)
  }

  // GET /prescriptions?status=
  @Get('prescriptions')
  @RequirePermission('prescriptions.manage')
  list(@Query() query: RxQueryDto) {
    return this.prescriptions.list(query.status)
  }

  // POST /prescriptions/:id/cancel
  @Post('prescriptions/:id/cancel')
  @RequirePermission('prescriptions.manage')
  @Audit('update', 'prescription')
  cancel(@Param('id') id: string) {
    return this.prescriptions.cancel(id)
  }

  // GET /pharmacy/inbox?status=
  @Get('pharmacy/inbox')
  @RequirePermission('pharmacy.view')
  inbox(@Query() query: RxQueryDto) {
    return this.prescriptions.inbox(query.status)
  }

  // POST /pharmacy/inbox/:id/status
  @Post('pharmacy/inbox/:id/status')
  @RequirePermission('pharmacy.sell')
  @Audit('update', 'prescription')
  setStatus(@Param('id') id: string, @Body() dto: RxStatusDto) {
    return this.prescriptions.setStatus(id, dto.status)
  }
}
