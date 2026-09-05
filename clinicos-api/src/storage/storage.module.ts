import { Global, Module } from '@nestjs/common'

import { UploadsController } from './uploads.controller'
import { StorageService } from './storage.service'

/**
 * Global: imzolangan havola interseptori butun ilova bo'ylab
 * ishlaydi, ya'ni `StorageService` har joyda kerak.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
