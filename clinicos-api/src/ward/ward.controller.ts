import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  AdmissionInputDto,
  AdmissionQueryDto,
  RoomInputDto,
  WardRangeDto,
} from './ward.dto'
import { WardService } from './ward.service'

@Controller('ward')
export class WardController {
  constructor(private readonly ward: WardService) {}

  // GET /ward/rooms
  @Get('rooms')
  @RequirePermission('ward.view')
  listRooms() {
    return this.ward.listRooms()
  }

  // POST /ward/rooms
  @Post('rooms')
  @RequirePermission('ward.manage')
  createRoom(@Body() dto: RoomInputDto) {
    return this.ward.createRoom(dto)
  }

  // PATCH /ward/rooms/:id
  @Patch('rooms/:id')
  @RequirePermission('ward.manage')
  updateRoom(@Param() params: IdParamDto, @Body() dto: RoomInputDto) {
    return this.ward.updateRoom(params.id, dto)
  }

  // GET /ward/board?from=&to=
  @Get('board')
  @RequirePermission('ward.view')
  board(@Query() query: WardRangeDto) {
    return this.ward.bedBoard(query)
  }

  // GET /ward/stats?from=&to=
  @Get('stats')
  @RequirePermission('ward.view')
  stats(@Query() query: WardRangeDto) {
    return this.ward.stats(query)
  }

  // GET /ward/admissions?status=&search=
  @Get('admissions')
  @RequirePermission('ward.view')
  listAdmissions(@Query() query: AdmissionQueryDto) {
    return this.ward.listAdmissions(query)
  }

  // POST /ward/admissions
  @Post('admissions')
  @RequirePermission('ward.manage')
  admit(@Body() dto: AdmissionInputDto) {
    return this.ward.admit(dto)
  }

  // POST /ward/admissions/:id/discharge
  @Post('admissions/:id/discharge')
  @RequirePermission('ward.manage')
  discharge(@Param() params: IdParamDto) {
    return this.ward.discharge(params.id)
  }
}
