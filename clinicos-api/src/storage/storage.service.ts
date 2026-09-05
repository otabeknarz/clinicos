import { randomUUID } from 'node:crypto'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'

import { RequestContext } from '../common/request-context'

/**
 * ============================================================
 *  FAYL XOTIRASI (S3 / MinIO)
 * ============================================================
 *
 * BUCKET YOPIQ. Fayl to'g'ridan-to'g'ri o'qilmaydi — API qisqa
 * muddatli imzolangan havola beradi. Sabab oddiy: avatar ham,
 * klinika logosi ham shaxsiy ma'lumot, kelajakda esa bu yerga
 * bemor hujjatlari tushadi. Havolani bilgan begona odam ochib
 * ko'ra oladigan bo'lsa, klinika ajratishning ma'nosi qolmaydi.
 *
 * KALIT TUZILISHI — klinika ajratish shu yerda ham ishlaydi:
 *
 *     clinics/<clinicId>/<tur>/<uuid>.<kengaytma>
 *
 * `clinicId` FAQAT TOKENDAN olinadi, so'rovdan hech qachon —
 * bazadagi qoida bilan bir xil. Boshqa klinikaning kalitini
 * so'ragan odam imzolangan havola olmaydi.
 *
 * BAZADA HAVOLA EMAS, KALIT saqlanadi. Havola vaqtinchalik:
 * uni bazaga yozib qo'yilsa, bir necha daqiqadan keyin
 * ishlamay qolardi. O'girish javob chegarasida bo'ladi —
 * `signed-url.interceptor.ts`.
 */

/** Kalit shu prefiks bilan boshlanadi — havoladan ajratish uchun */
export const KEY_PREFIX = 'clinics/'

/**
 * Ruxsat etilgan turlar va ularning imzosi (birinchi baytlari).
 *
 * NEGA MAGIC BAYT: mijoz yuborgan `Content-Type` ga ishonib
 * bo'lmaydi. `.jpg` deb atalgan HTML fayl brauzerda sahifa
 * bo'lib ochilardi.
 *
 * SVG ATAYLAB YO'Q: uning ichida skript bo'lishi mumkin.
 */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
]

/** Imzolangan havola necha soniya yashaydi */
const URL_TTL_SECONDS = 15 * 60

export interface StoredFile {
  key: string
  mime: string
  size: number
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private readonly bucket = process.env.S3_BUCKET ?? 'clinicos'
  private readonly client: S3Client

  constructor(private readonly ctx: RequestContext) {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      /*
        MinIO yo'l uslubidagi manzilni kutadi
        (`https://s3.../bucket/kalit`), virtual-host emas —
        aks holda har bir bucket uchun alohida DNS kerak bo'lardi.
      */
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      },
    })
  }

  /** Sozlanganmi — bo'lmasa yuklash endpointi yopiq turadi */
  get enabled(): boolean {
    return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY)
  }

  /**
   * Bucket bor-yo'qligini tekshiradi, bo'lmasa yaratadi.
   *
   * NEGA DASTURDA: qo'lda yaratish qadami unutiladi va xato
   * faqat birinchi yuklashda, foydalanuvchi oldida chiqadi.
   * Bucket YOPIQ yaratiladi — MinIO'da sukut bo'yicha shunday.
   */
  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('S3 sozlanmagan — fayl yuklash o‘chiq')
      return
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      this.logger.log(`S3 tayyor: ${this.bucket}`)
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
        this.logger.log(`S3 bucket yaratildi: ${this.bucket}`)
      } catch (error) {
        this.logger.error('S3 bucket yaratilmadi', error as Error)
      }
    }
  }

  /**
   * Baytlarni tekshiradi: haqiqatan rasmmi va qaysi turda.
   * Mijozning `Content-Type` iga ishonilmaydi.
   */
  detectType(buffer: Buffer): { mime: string; ext: string } | null {
    if (buffer.length < 12) return null
    return SIGNATURES.find((s) => s.test(buffer)) ?? null
  }

  /**
   * Faylni joriy klinika papkasiga yozadi va KALITNI qaytaradi.
   *
   * `kind` — `avatars`, `logos` kabi papka nomi.
   *
   * Bucket yo'q bo'lsa yaratib, QAYTA URINADI. Nega: bucket
   * ilova ishga tushganda bir marta tekshiriladi, lekin S3
   * keyinroq ham qayta tiklanishi mumkin (xotira almashtirildi,
   * bucket qo'lda o'chirildi). U holda ilovani qayta ishga
   * tushirmagunicha har bir yuklash sinardi — aynan shunday
   * bo'ldi ham.
   */
  async put(kind: string, buffer: Buffer, type: { mime: string; ext: string }): Promise<StoredFile> {
    const { clinicId } = this.ctx.require()
    const key = `${KEY_PREFIX}${clinicId}/${kind}/${randomUUID()}.${type.ext}`

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: type.mime,
    })

    try {
      await this.client.send(command)
    } catch (error) {
      if (!isMissingBucket(error)) throw error
      this.logger.warn(`Bucket yo‘q edi, qayta yaratilmoqda: ${this.bucket}`)
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
      await this.client.send(command)
    }

    return { key, mime: type.mime, size: buffer.length }
  }

  /**
   * Kalitdan qisqa muddatli havola.
   *
   * Kalit BOSHQA klinikaniki bo'lsa `null` qaytadi — bunday
   * kalit javobga tushib qolgan bo'lsa, u yerda xato bor va
   * havola berish uni yashirib qo'yardi.
   */
  async signedUrl(key: string): Promise<string | null> {
    if (!this.enabled) return null

    const user = this.ctx.peek()
    if (!user) return null
    if (!key.startsWith(`${KEY_PREFIX}${user.clinicId}/`)) {
      this.logger.warn(`Begona kalit so‘raldi: ${key}`)
      return null
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: URL_TTL_SECONDS },
    )
  }

  /**
   * Yozuvga biriktirilayotgan kalit SHU klinikanikimi.
   *
   * NEGA KERAK: kalit shakli DTO da tekshiriladi, lekin shakl
   * to'g'ri bo'la turib boshqa klinikaning `clinicId` si bilan
   * kelishi mumkin. Undan fayl ochib bo'lmaydi (havola
   * berilmaydi), lekin bazada begona kalit yotishi o'zi xato:
   * keyinchalik uni ko'rgan odam sizib chiqqan deb o'ylaydi.
   */
  assertOwnKey(key: string | null | undefined): void {
    if (!key) return
    const { clinicId } = this.ctx.require()
    if (!key.startsWith(`${KEY_PREFIX}${clinicId}/`)) {
      throw new BadRequestException('Bu fayl boshqa klinikaga tegishli')
    }
  }

  /** Eski faylni o'chirish. Xato bo'lsa so'rov to'xtamaydi. */
  async remove(key: string): Promise<void> {
    if (!this.enabled || !key.startsWith(KEY_PREFIX)) return
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (error) {
      this.logger.warn(`Fayl o‘chmadi: ${key} — ${(error as Error).message}`)
    }
  }
}

/** S3 xatosi "bunday bucket yo'q" deganimi */
function isMissingBucket(error: unknown): boolean {
  const name = (error as { name?: string })?.name
  return name === 'NoSuchBucket' || name === 'NotFound'
}

/** Qiymat saqlangan kalitmi (havola yoki data URL emas) */
export function isStorageKey(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(KEY_PREFIX)
}
