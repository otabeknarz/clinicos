import {
  BadRequestException,
  Controller,
  Param,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { StorageService } from './storage.service'

/**
 * Yuklash mumkin bo'lgan turlar va ular qaysi papkaga tushadi.
 *
 * `visits` — tashrifga biriktiriladigan rasm (rentgen, tish surati).
 * U MAXFIY TIBBIY MA'LUMOT: bucket yopiq, kalit klinika papkasida
 * yotadi va javobda faqat `visits.view` bori uchun havolaga o'giriladi.
 *
 * `feedback` — bemor fikriga biriktirgan rasm. Uni BEMOR yuklaydi,
 * shuning uchun `POST /patient/uploads` alohida marshruti bor:
 * bu marshrut xodim tokenini kutadi.
 */
/* `pharmacy` — kirim hujjatlari (nakladnoy, sertifikat) */
const KINDS = ['avatars', 'logos', 'visits', 'feedback', 'pharmacy'] as const
type Kind = (typeof KINDS)[number]

/**
 * Eng katta fayl — 10 MB.
 *
 * Interfeys rasmni brauzerda 256 pikselga kichraytirib yuboradi
 * (~20-40 KB), ya'ni bu chegara faqat suiiste'molga qarshi.
 */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * FAYL YUKLASH.
 *
 * Javobda HAVOLA emas, KALIT qaytadi. Uni tegishli yozuvga
 * yozish alohida so'rov: masalan `PATCH /profile` ga
 * `{ avatarUrl: "<kalit>" }`.
 *
 * NEGA IKKI QADAM: yuklash va yozuvni tahrirlash — boshqa-boshqa
 * amallar. Bitta so'rovda qilinsa, forma bekor qilinganda ham
 * fayl yozilib ketardi va uni kim tozalashi noma'lum bo'lardi.
 *
 * SERVER TOMONDA YUKLANADI, imzolangan PUT havola bilan emas:
 * shunda baytlarni ko'rib, haqiqatan rasmligini tekshirish
 * mumkin. Mijoz to'g'ridan-to'g'ri yozadigan bo'lsa, bucket'ga
 * nima tushayotganini hech kim bilmasdi.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  // POST /uploads/:kind   (multipart/form-data, maydon nomi: file)
  @Post(':kind')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @Param('kind') kind: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ key: string; mime: string; size: number }> {
    if (!this.storage.enabled) {
      throw new ServiceUnavailableException('Fayl xotirasi sozlanmagan')
    }
    if (!KINDS.includes(kind as Kind)) {
      throw new BadRequestException('Noma’lum fayl turi')
    }
    if (!file) {
      throw new BadRequestException('Fayl yuborilmagan')
    }

    /*
      Turni BAYTLARDAN aniqlaymiz. Mijoz yuborgan `Content-Type`
      ga ishonib bo'lmaydi: `.jpg` deb atalgan HTML fayl
      brauzerda sahifa bo'lib ochilardi.
    */
    const type = this.storage.detectType(file.buffer)
    if (!type) {
      throw new BadRequestException('Faqat JPEG, PNG yoki WebP rasm')
    }

    return this.storage.put(kind, file.buffer, type)
  }
}
