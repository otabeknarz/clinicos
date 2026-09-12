import { Module } from '@nestjs/common'

import { ExportModule } from '../export/export.module'
import { GoogleController } from './google.controller'
import { GoogleService } from './google.service'

/**
 * Google Sheets integratsiyasi eksport bo'limlarini qayta
 * ishlatadi: jadvalga aynan fayldagi ustunlar tushadi.
 */
@Module({
  imports: [ExportModule],
  controllers: [GoogleController],
  providers: [GoogleService],
})
export class GoogleModule {}
