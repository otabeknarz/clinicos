import { Module } from '@nestjs/common'

import { AttendanceModule } from '../attendance/attendance.module'
import { StorageModule } from '../storage/storage.module'
import { FaceController } from './face.controller'
import { FaceService } from './face.service'

/**
 * Davomatni belgilash qoidalari `AttendanceService` da qoladi:
 * yuz orqali kelgan yozuv ham qo'lda kiritilgani bilan bir xil
 * yo'ldan o'tadi (kechikish, bayroq, jurnal).
 */
@Module({
  imports: [AttendanceModule, StorageModule],
  controllers: [FaceController],
  providers: [FaceService],
})
export class FaceModule {}
