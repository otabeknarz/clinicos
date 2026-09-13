import { Injectable, Logger } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import { KEY_PREFIX, StorageService } from './storage.service'

/**
 * EGASIZ FAYLLARNI TOZALASH — bir martalik, qo'lda yoqiladi.
 *
 * Fayl kaliti `clinics/<clinicId>/...` ko'rinishida. Klinika bazadan
 * butunlay o'chirilsa (sotuvdan oldingi toza platforma), uning rasmlari
 * omborda egasiz qoladi: hech kim ko'rmaydi, lekin joy egallaydi va shaxsiy
 * ma'lumot (rentgen, chek) sifatida turadi.
 *
 * FAQAT `PURGE_ORPHAN_FILES=1` BO'LSA ishlaydi. Oddiy holatda klinika hech
 * qachon butunlay o'chmaydi (`deletedAt` qo'yiladi), ya'ni egasiz fayl
 * bo'lmaydi — vazifani doim yoqib qo'yishga sabab yo'q.
 *
 * XAVFSIZLIK: bazada BIRORTA HAM klinika topilmasa to'xtaydi — ulanish
 * xatosi yoki bo'sh bazaga ulangan konteyner butun omborni o'chirib
 * yubormasligi kerak. Faqat bazada YO'Q klinikaning fayllari o'chadi.
 */
@Injectable()
export class OrphanFilesService implements OnModuleInit {
  private readonly log = new Logger('OrphanFiles')

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    if (process.env.PURGE_ORPHAN_FILES !== '1') return
    if (!this.storage.enabled) {
      this.log.warn('PURGE_ORPHAN_FILES yoqilgan, lekin S3 sozlanmagan — o‘tkazib yuborildi')
      return
    }
    /* Ilova to'liq ko'tarilsin, baza ulansin */
    setTimeout(() => void this.run(), 15_000)
  }

  async run(): Promise<void> {
    try {
      const clinics = await this.prisma.acrossAllClinics().clinic.findMany({ select: { id: true } })
      if (clinics.length === 0) {
        this.log.warn('Bazada klinika yo‘q — xavfsizlik uchun fayllar o‘chirilmadi')
        return
      }
      const known = new Set(clinics.map((c) => c.id))

      const keys = await this.storage.listKeys(KEY_PREFIX)
      const orphans = keys.filter((key) => !known.has(key.slice(KEY_PREFIX.length).split('/')[0]))

      this.log.log(`Omborda ${keys.length} ta fayl, egasizi ${orphans.length} ta — o‘chirilmoqda`)
      const deleted = orphans.length > 0 ? await this.storage.deleteKeys(orphans) : 0
      this.log.log(`Egasiz fayllar tozalandi: ${deleted} ta o‘chirildi, ${keys.length - orphans.length} ta qoldi`)
    } catch (error) {
      this.log.warn(`Egasiz fayllar tozalanmadi: ${String(error)}`)
    }
  }
}
