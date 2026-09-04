import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  DaysQueryDto, FeedbackInputDto, FeedbackQueryDto, LookupDto,
  ReplyDto, StatsQueryDto, StatusDto,
} from './feedback.dto'
import { FeedbackService } from './feedback.service'

@Controller()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /*
    DASTURCHIGA: bu ikki endpoint bemor uchun ochiq bo'lishi kerak
    (fikr havolasi SMS orqali yuboriladi va bemorda hisob yo'q).

    Hozircha ular YOPIQ. Ochishdan oldin himoya qo'shing: bir
    telefondan kuniga necha marta so'rov yuborish mumkinligini
    cheklang, aks holda raqamlarni birma-bir sinab, klinikaning
    bemorlar bazasini aniqlab olish mumkin bo'ladi.
  */
  @Post('feedback/lookup')
  @RequirePermission('feedback.view')
  lookup(@Body() dto: LookupDto) {
    return this.feedback.lookup(dto)
  }

  @Post('feedback')
  @RequirePermission('feedback.view')
  create(@Body() dto: FeedbackInputDto) {
    return this.feedback.create(dto)
  }

  // GET /feedback/stats?days=
  @Get('feedback/stats')
  @RequirePermission('feedback.view')
  stats(@Query() query: StatsQueryDto) {
    return this.feedback.stats(query)
  }

  /*
    GET /me/feedback?days=

    Shifokorning o'zi haqidagi fikrlar — ISMSIZ va KECHIKTIRIB.
    Ruxsat talab qilinmaydi: har bir shifokor o'zi haqidagi
    fikrni ko'rishi kerak.
  */
  @Get('me/feedback')
  mine(@Query() query: DaysQueryDto) {
    return this.feedback.forDoctor(query.days)
  }

  // GET /feedback?search=&rating=&doctorId=&status=&page=
  @Get('feedback')
  @RequirePermission('feedback.view')
  list(@Query() query: FeedbackQueryDto) {
    return this.feedback.list(query)
  }

  // POST /feedback/:id/reply  { text }
  @Post('feedback/:id/reply')
  @RequirePermission('feedback.manage')
  reply(@Param() params: IdParamDto, @Body() dto: ReplyDto) {
    return this.feedback.reply(params.id, dto)
  }

  // PATCH /feedback/:id  { status }
  @Patch('feedback/:id')
  @RequirePermission('feedback.manage')
  setStatus(@Param() params: IdParamDto, @Body() dto: StatusDto) {
    return this.feedback.setStatus(params.id, dto.status)
  }
}
