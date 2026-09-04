import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { CashRangeDto, ShiftCloseDto } from './cash-control.dto'
import { CashControlService } from './cash-control.service'

@Controller()
export class CashControlController {
  constructor(private readonly cash: CashControlService) {}

  /*
    GET /cash-control?from=&to=

    Kutilgan va yig'ilgan pul solishtiruvi — FAQAT egasida.
    Registrator o'z ishining tekshiruvini ko'rmasligi kerak.
  */
  @Get('cash-control')
  @RequirePermission('cashcontrol.view')
  report(@Query() query: CashRangeDto) {
    return this.cash.report(query)
  }

  // GET /shifts/current  →  bugungi kutilayotgan naqd summa
  @Get('shifts/current')
  @RequirePermission('shift.close')
  current() {
    return this.cash.expectedCashToday()
  }

  // POST /shifts/close
  @Post('shifts/close')
  @RequirePermission('shift.close')
  close(@Body() dto: ShiftCloseDto) {
    return this.cash.closeShift(dto)
  }
}
