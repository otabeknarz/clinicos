import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { ImportService } from './import.service'

/** Eng katta fayl — 5 MB (taxminan 50 000 qatorlik CSV) */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * IMPORT — Excel'dan ko'chirish.
 *
 * `data.import` ruxsati BAZAGA YOZADI, shuning uchun u eksportdan
 * ham qattiqroq: uning ustiga bo'limning o'z ruxsati ham talab
 * qilinadi (bemor qo'shish, xizmat boshqarish...).
 *
 * Ikki qadam: avval "ko'rib chiqish" (nechtasi tayyor, qayerda
 * xato), keyin "yuklash". Bir qadamda qilinsa, odam faylni
 * ko'rmasdan bazaga yozib yuborardi.
 */
@Controller('import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  // GET /import/datasets
  @Get('datasets')
  @RequirePermission('data.import')
  datasets() {
    return this.imports.list()
  }

  // POST /import/:dataset/preview
  @Post(':dataset/preview')
  @RequirePermission('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  preview(@Param('dataset') dataset: string, @UploadedFile() file?: Express.Multer.File) {
    return this.imports.preview(dataset, file)
  }

  // POST /import/:dataset/apply
  @Post(':dataset/apply')
  @RequirePermission('data.import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  @Audit('create', 'import')
  apply(@Param('dataset') dataset: string, @UploadedFile() file?: Express.Multer.File) {
    return this.imports.apply(dataset, file)
  }
}
