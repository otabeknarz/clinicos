import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { EnrollFaceDto, FaceCheckInDto, FaceVerifyDto } from './face.dto'
import { FaceService } from './face.service'

/**
 * Yuz bo'yicha davomat.
 *
 * Ro'yxatdan o'tkazish va o'chirish — `staff.manage` (egasi):
 * biometrik ma'lumotni olish kadrlar qarori, kundalik ish emas.
 *
 * Kamera sahifasi — `attendance.manage`: DAVOMAT TO'LIQ
 * REGISTRATURADA. Sahifa registraturaning planshetida ochiq
 * turadi, xodim kelib qaraydi va yozuv o'zi tushadi — kelish
 * vaqtini hech kim qo'lda yozmaydi.
 */
@Controller('attendance/face')
export class FaceController {
  constructor(private readonly faces: FaceService) {}

  // GET /attendance/face
  @Get()
  @RequirePermission('attendance.view')
  list() {
    return this.faces.list()
  }

  /*
    POST /attendance/face

    RUXSAT `attendance.manage`, `staff.manage` EMAS.

    Yuz aynan davomat belgilash paytida olinadi: xodim kamera
    oldida turganda registrator "Keldi" ni bosadi va oyna uchta
    kadr yig'ib qo'ya qoladi. Kadrlar `staff.manage` talab qilsa,
    registrator hech kimni ro'yxatdan o'tkaza olmasdi va bu
    imkoniyat amalda ishlamay qolardi — davomat esa to'liq
    registraturada.

    Yozuv AUDITGA tushadi: biometrik ma'lumot olish jimgina
    bo'lmasligi kerak.
  */
  @Post()
  @RequirePermission('attendance.manage')
  @Audit('create', 'staff-face')
  enroll(@Body() dto: EnrollFaceDto) {
    return this.faces.enroll(dto)
  }

  // DELETE /attendance/face/:staffId
  @Delete(':staffId')
  @RequirePermission('staff.manage')
  @Audit('delete', 'staff-face')
  remove(@Param('staffId') staffId: string) {
    return this.faces.remove(staffId)
  }

  /*
    POST /attendance/face/verify

    "Keldi" tugmasining tasdig'i: registrator kimni belgilayotganini
    aytadi, kamera esa o'sha odam ekanini tekshiradi.
  */
  @Post('verify')
  @RequirePermission('attendance.manage')
  verify(@Body() dto: FaceVerifyDto) {
    return this.faces.verify(dto)
  }

  // POST /attendance/face/check-in
  @Post('check-in')
  @RequirePermission('attendance.manage')
  checkIn(@Body() dto: FaceCheckInDto) {
    return this.faces.checkIn(dto)
  }
}
