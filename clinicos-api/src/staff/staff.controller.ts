import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  MonthQueryDto, ResetPasswordDto, StaffInputDto, StaffQueryDto,
} from './staff.dto'
import { StaffService } from './staff.service'

@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  /*
    Tartib muhim: `/me/...` yo'llari `/staff/:id` dan oldin
    e'lon qilinishi shart emas (boshqa prefiks), lekin
    `/staff/:id/schedule` `:id` dan keyin turadi.
  */

  // GET /me/profile — xodimning o'z kartasi
  @Get('me/profile')
  myProfile() {
    return this.staff.myProfile()
  }

  // GET /me/schedule?month=
  @Get('me/schedule')
  mySchedule(@Query() query: MonthQueryDto) {
    return this.staff.myScheduleFor(query.month)
  }

  // GET /staff?search=&position=&status=
  @Get('staff')
  @RequirePermission('staff.view')
  list(@Query() query: StaffQueryDto) {
    return this.staff.list(query)
  }

  // GET /staff/:id
  @Get('staff/:id')
  @RequirePermission('staff.view')
  get(@Param() params: IdParamDto) {
    return this.staff.get(params.id)
  }

  /*
    GET /staff/:id/schedule?month=

    Ruxsat servis ichida: xodim O'Z jadvalini ko'rish uchun
    `staff.view` talab qilinmaydi — u CEO belgilagan ish
    kunlarini bilishi kerak.
  */
  @Get('staff/:id/schedule')
  schedule(@Param() params: IdParamDto, @Query() query: MonthQueryDto) {
    return this.staff.schedule(params.id, query.month)
  }

  // GET /doctors/:id/schedule?month=
  @Get('doctors/:id/schedule')
  doctorSchedule(@Param() params: IdParamDto, @Query() query: MonthQueryDto) {
    return this.staff.doctorSchedule(params.id, query.month)
  }

  // POST /staff
  @Post('staff')
  @RequirePermission('staff.manage')
  create(@Body() dto: StaffInputDto) {
    return this.staff.create(dto)
  }

  // PATCH /staff/:id
  @Patch('staff/:id')
  @RequirePermission('staff.manage')
  update(@Param() params: IdParamDto, @Body() dto: StaffInputDto) {
    return this.staff.update(params.id, dto)
  }

  // DELETE /staff/:id
  @Delete('staff/:id')
  @RequirePermission('staff.manage')
  remove(@Param() params: IdParamDto) {
    return this.staff.remove(params.id)
  }

  // POST /staff/:id/password  { password, mustChangePassword }
  @Post('staff/:id/password')
  @RequirePermission('users.manage')
  resetPassword(@Param() params: IdParamDto, @Body() dto: ResetPasswordDto) {
    return this.staff.resetPassword(params.id, dto)
  }
}
