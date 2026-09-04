import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import {
  AttendanceInputDto, AttendanceRangeDto, AttendanceSummaryDto,
  DailyQueryDto, FlagsQueryDto,
} from './attendance.dto'
import { AttendanceService } from './attendance.service'

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // GET /attendance/summary?staffId=&days=
  @Get('summary')
  @RequirePermission('attendance.view')
  summary(@Query() query: AttendanceSummaryDto) {
    return this.attendance.summary(query.staffId, query.days)
  }

  // GET /attendance/daily?date=
  @Get('daily')
  @RequirePermission('attendance.view')
  daily(@Query() query: DailyQueryDto) {
    return this.attendance.daily(query.date)
  }

  /*
    GET /attendance/flags?limit=

    Vaqti orqaga surib kiritilgan yozuvlar.

    RUXSAT ATAYLAB `staff.manage`: davomatni registrator
    belgilaydi va unda `attendance.manage` bor. Agar shu ruxsat
    ishlatilsa, u O'ZIGA qarshi chiqqan ogohlantirishni ko'rib
    turardi — nazoratning ma'nosi qolmasdi.
  */
  @Get('flags')
  @RequirePermission('staff.manage')
  flags(@Query() query: FlagsQueryDto) {
    return this.attendance.flags(query.limit)
  }

  // GET /attendance?staffId=&from=&to=
  @Get()
  @RequirePermission('attendance.view')
  list(@Query() query: AttendanceRangeDto) {
    return this.attendance.list(query)
  }

  // POST /attendance
  @Post()
  @RequirePermission('attendance.manage')
  mark(@Body() dto: AttendanceInputDto) {
    return this.attendance.mark(dto)
  }
}
