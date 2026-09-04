import {
  Body,
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { RequestContext } from '../common/request-context'
import { IdParamDto } from '../patients/patients.dto'
import {
  DoctorInputDto,
  DoctorListQueryDto,
  DoctorRangeQueryDto,
  EarningsQueryDto,
} from './doctors.dto'
import { DoctorsService } from './doctors.service'

@Controller('doctors')
export class DoctorsController {
  constructor(
    private readonly doctors: DoctorsService,
    private readonly ctx: RequestContext,
  ) {}

  /*
    GET /doctors?search=  yoki  ?fields=short

    `fields=short` — faqat ism va mutaxassislik, ruxsatsiz ochiq
    (kalendar filtri va qabul formasi uchun kerak).

    To'liq ro'yxat esa statistika, kontakt va maosh bilan keladi —
    unga `doctors.view` shart.
  */
  @Get()
  list(@Query() query: DoctorListQueryDto) {
    if (query.fields === 'short') return this.doctors.listShort()

    const { permissions } = this.ctx.require()
    if (!permissions.includes('doctors.view')) {
      throw new ForbiddenException('Bu amalga ruxsatingiz yo‘q')
    }
    return this.doctors.list(query.search)
  }

  // GET /doctors/:id
  @Get(':id')
  @RequirePermission('doctors.view')
  get(@Param() params: IdParamDto) {
    return this.doctors.get(params.id)
  }

  // GET /doctors/:id/appointments?from=&to=
  @Get(':id/appointments')
  @RequirePermission('appointments.view')
  appointments(@Param() params: IdParamDto, @Query() query: DoctorRangeQueryDto) {
    return this.doctors.appointments(params.id, query)
  }

  // GET /doctors/:id/patients
  @Get(':id/patients')
  @RequirePermission('patients.view')
  patients(@Param() params: IdParamDto) {
    return this.doctors.patients(params.id)
  }

  /*
    GET /doctors/:id/earnings?period=2026-09

    Ruxsat servis ichida tekshiriladi: shifokor faqat O'Z
    daromadini ko'radi, boshqasiniki — faqat egasida.
  */
  @Get(':id/earnings')
  earnings(@Param() params: IdParamDto, @Query() query: EarningsQueryDto) {
    return this.doctors.earnings(params.id, query)
  }

  // POST /doctors
  @Post()
  @RequirePermission('doctors.manage')
  create(@Body() dto: DoctorInputDto) {
    return this.doctors.create(dto)
  }

  // PATCH /doctors/:id
  @Patch(':id')
  @RequirePermission('doctors.manage')
  update(@Param() params: IdParamDto, @Body() dto: DoctorInputDto) {
    return this.doctors.update(params.id, dto)
  }

  // DELETE /doctors/:id
  @Delete(':id')
  @RequirePermission('doctors.manage')
  remove(@Param() params: IdParamDto) {
    return this.doctors.remove(params.id)
  }
}
