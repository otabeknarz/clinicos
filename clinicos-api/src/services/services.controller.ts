import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { PriceQueryDto, ServiceInputDto, ServiceListQueryDto } from './services.dto'
import { ServicesService } from './services.service'

/**
 * Xizmatlar va narxlar.
 *
 * Narxni faqat EGASI o'zgartiradi. Bu firibgarlikka qarshi asosiy
 * cheklovlardan biri: narx katalogda qulflangan bo'lsa, registrator
 * o'zicha "chegirma" qilib farqni olib qola olmaydi.
 */
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // GET /services?search=&category=&status=
  @Get()
  @RequirePermission('services.view')
  list(@Query() query: ServiceListQueryDto) {
    return this.services.list(query)
  }

  /*
    GET /services/:id/price?patientId=

    Bemor uchun amaldagi narx: sodiqlik chegirmasi qo'llangan holda.
    Registratorga ham ochiq — u narxni ko'rmasa, pul ololmaydi.
  */
  @Get(':id/price')
  @RequirePermission('services.view')
  price(@Param() params: IdParamDto, @Query() query: PriceQueryDto) {
    return this.services.priceFor(params.id, query.patientId)
  }

  // POST /services
  @Post()
  @RequirePermission('services.manage')
  create(@Body() dto: ServiceInputDto) {
    return this.services.create(dto)
  }

  // PATCH /services/:id
  @Patch(':id')
  @RequirePermission('services.manage')
  update(@Param() params: IdParamDto, @Body() dto: ServiceInputDto) {
    return this.services.update(params.id, dto)
  }

  /*
    DELETE /services/:id

    Xizmat ishlatilgan bo'lsa o'chirilmaydi, arxivga o'tadi —
    javobda `{ archived: true }` keladi.
  */
  @Delete(':id')
  @RequirePermission('services.manage')
  remove(@Param() params: IdParamDto) {
    return this.services.remove(params.id)
  }
}
