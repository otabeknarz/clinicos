import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import { FollowUpPatchDto, FollowUpsQueryDto, VisitInputDto } from './visits.dto'
import { VisitsService } from './visits.service'

@Controller()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  /*
    POST /visits

    Tashrifni FAQAT shifokor yozadi (`visits.create`). Registratorda
    bu ruxsat yo'q va bo'lmasligi kerak: aks holda bir odam ham
    tashrifni, ham pulni yozib, solishtiruvni ma'nosiz qilardi.
  */
  @Post('visits')
  @RequirePermission('visits.create')
  create(@Body() dto: VisitInputDto) {
    return this.visits.create(dto)
  }

  // GET /visits/:id
  @Get('visits/:id')
  @RequirePermission('visits.view')
  get(@Param() params: IdParamDto) {
    return this.visits.get(params.id)
  }

  // GET /appointments/:id/visit  — qabulga biriktirilgan yozuv
  @Get('appointments/:id/visit')
  @RequirePermission('visits.view')
  byAppointment(@Param() params: IdParamDto) {
    return this.visits.byAppointment(params.id)
  }

  /*
    GET /follow-ups?daysAhead=

    Registraturaga ham ochiq: u shu ro'yxat bo'yicha qo'ng'iroq
    qiladi. Javobda tashxis yo'q — faqat kim, qachon va sababi.
  */
  @Get('follow-ups')
  @RequirePermission('patients.view')
  followUps(@Query() query: FollowUpsQueryDto) {
    return this.visits.followUpsDue(query.daysAhead)
  }

  // PATCH /follow-ups/:id
  @Patch('follow-ups/:id')
  @RequirePermission('patients.edit')
  updateFollowUp(@Param() params: IdParamDto, @Body() dto: FollowUpPatchDto) {
    return this.visits.updateFollowUp(params.id, dto)
  }
}
