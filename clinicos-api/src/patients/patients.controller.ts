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

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import {
  CreatePatientDto,
  IdParamDto,
  PatientListQueryDto,
  UpdatePatientDto,
} from './patients.dto'
import { PatientsService } from './patients.service'

/**
 * Bemorlar.
 *
 * MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa
 * TIBBIY ma'lumot. Shuning uchun `/visits` alohida ruxsat talab
 * qiladi — registrator bemorni ko'radi, lekin tashxisini emas.
 */
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  // GET /patients?search=&filter=&page=&pageSize=
  @Get()
  @RequirePermission('patients.view')
  list(@Query() query: PatientListQueryDto) {
    return this.patients.list(query)
  }

  // GET /patients/:id
  @Get(':id')
  @RequirePermission('patients.view')
  get(@Param() params: IdParamDto) {
    return this.patients.get(params.id)
  }

  // POST /patients
  @Post()
  @RequirePermission('patients.create')
  create(@Body() dto: CreatePatientDto) {
    return this.patients.create(dto)
  }

  // PATCH /patients/:id
  @Patch(':id')
  @RequirePermission('patients.edit')
  update(@Param() params: IdParamDto, @Body() dto: UpdatePatientDto) {
    return this.patients.update(params.id, dto)
  }

  // DELETE /patients/:id
  /*
    DELETE /patients/:id

    `patients.delete` sukut bo'yicha hech kimda yo'q — bemor
    yozuvini o'chirish qaytarib bo'lmaydigan amal. Kerak bo'lsa
    egasi aniq bir odamga qo'shimcha ruxsat sifatida beradi.
  */
  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('patients.delete')
  remove(@Param() params: IdParamDto) {
    return this.patients.remove(params.id)
  }

  /*
    GET /patients/:id/visits — TIBBIY MA'LUMOT

    `visits.view` ruxsati talab qilinadi. Registratorda u yo'q:
    u bemorni ro'yxatga oladi va pulini oladi, lekin tashxisini
    ko'rmaydi. Tibbiy sir shifokor bilan bemor o'rtasida qoladi.

    Har bir ochilish AuditLog'ga yoziladi: kim, qachon, qaysi
    bemorning tibbiy yozuviga qaragani qolsin.
  */
  @Get(':id/visits')
  @RequirePermission('visits.view')
  @Audit('view_medical', 'Patient')
  visits(@Param() params: IdParamDto) {
    return this.patients.visits(params.id)
  }

  // GET /patients/:id/appointments
  @Get(':id/appointments')
  @RequirePermission('appointments.view')
  appointments(@Param() params: IdParamDto) {
    return this.patients.appointments(params.id)
  }

  // GET /patients/:id/payments
  @Get(':id/payments')
  @RequirePermission('payments.view')
  payments(@Param() params: IdParamDto) {
    return this.patients.payments(params.id)
  }

  // GET /patients/:id/follow-ups
  @Get(':id/follow-ups')
  @RequirePermission('patients.view')
  followUps(@Param() params: IdParamDto) {
    return this.patients.followUps(params.id)
  }
}
