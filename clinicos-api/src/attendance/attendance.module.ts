import { Module } from '@nestjs/common'

import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
  // Yuz orqali davomat ham shu qoidalardan o'tadi
  exports: [AttendanceService],
})
export class AttendanceModule {}
