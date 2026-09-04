import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  AppointmentInputDto,
  AppointmentQueryDto,
  AppointmentRangeDto,
  DoctorLoadQueryDto,
  SetStatusDto,
  UpdateAppointmentDto,
} from './appointments.dto'
import { AppointmentsService } from './appointments.service'

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  /*
    Tartib muhim: `today`, `range` va `load` `:id` dan OLDIN turishi
    kerak. Aks holda Express ularni id deb qabul qiladi va so'rov
    "Qabul topilmadi" bo'lib qaytadi.
  */

  // GET /appointments/today
  @Get('today')
  @RequirePermission('appointments.view')
  today() {
    return this.appointments.today()
  }

  // GET /appointments/range?from=&to=&doctorId=
  @Get('range')
  @RequirePermission('appointments.view')
  range(@Query() query: AppointmentRangeDto) {
    return this.appointments.range(query)
  }

  // GET /appointments/load?from=&to=
  @Get('load')
  @RequirePermission('appointments.view')
  load(@Query() query: DoctorLoadQueryDto) {
    return this.appointments.doctorLoad(query)
  }

  // GET /appointments?from=&to=&doctorId=&status=&search=&page=
  @Get()
  @RequirePermission('appointments.view')
  list(@Query() query: AppointmentQueryDto) {
    return this.appointments.list(query)
  }

  // GET /appointments/:id
  @Get(':id')
  @RequirePermission('appointments.view')
  get(@Param() params: IdParamDto) {
    return this.appointments.get(params.id)
  }

  // POST /appointments
  @Post()
  @RequirePermission('appointments.create')
  create(@Body() dto: AppointmentInputDto) {
    return this.appointments.create(dto)
  }

  // PATCH /appointments/:id
  @Patch(':id')
  @RequirePermission('appointments.edit')
  update(@Param() params: IdParamDto, @Body() dto: UpdateAppointmentDto) {
    return this.appointments.update(params.id, dto)
  }

  // POST /appointments/:id/status  { status, reason? }
  @Post(':id/status')
  @RequirePermission('appointments.edit')
  setStatus(@Param() params: IdParamDto, @Body() dto: SetStatusDto) {
    return this.appointments.setStatus(params.id, dto)
  }

  // DELETE /appointments/:id
  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('appointments.edit')
  remove(@Param() params: IdParamDto) {
    return this.appointments.remove(params.id)
  }
}
