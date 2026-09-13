import { Global, Module } from '@nestjs/common'

import { OrphanFilesService } from './orphan-files.service'
import { UploadsController } from './uploads.controller'
import { StorageService } from './storage.service'

/**
 * Global: imzolangan havola interseptori butun ilova bo'ylab
 * ishlaydi, ya'ni `StorageService` har joyda kerak.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService, OrphanFilesService],
  exports: [StorageService],
})
export class StorageModule {}
