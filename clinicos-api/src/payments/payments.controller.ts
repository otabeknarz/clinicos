import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { PaymentInputDto, PaymentQueryDto, RevenueQueryDto } from './payments.dto'
import { PaymentsService } from './payments.service'

/**
 * To'lovlar.
 *
 * DIQQAT: bu yerda PATCH ham, DELETE ham YO'Q va bo'lmasligi kerak.
 * Kiritilgan to'lov o'zgarmaydi — xato bo'lsa qaytariladi.
 */
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // GET /payments/summary  →  bugungi / haftalik / oylik daromad
  @Get('payments/summary')
  @RequirePermission('payments.view')
  summary() {
    return this.payments.summary()
  }

  // GET /payments?search=&method=&status=&from=&to=&page=
  @Get('payments')
  @RequirePermission('payments.view')
  list(@Query() query: PaymentQueryDto) {
    return this.payments.list(query)
  }

  // POST /payments
  @Post('payments')
  @RequirePermission('payments.create')
  create(@Body() dto: PaymentInputDto) {
    return this.payments.create(dto)
  }

  // POST /payments/:id/refund
  @Post('payments/:id/refund')
  @RequirePermission('payments.refund')
  refund(@Param() params: IdParamDto) {
    return this.payments.refund(params.id)
  }

  /*
    GET /reports/revenue?from=&to=

    Alohida ruxsat: `revenue.view`. Registratorda u yo'q —
    u to'lovlarni kiritadi, lekin klinikaning umumiy aylanmasini
    ko'rmaydi.
  */
  @Get('reports/revenue')
  @RequirePermission('revenue.view')
  revenue(@Query() query: RevenueQueryDto) {
    return this.payments.revenue(query)
  }
}
