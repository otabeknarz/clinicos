import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { mergeMap } from 'rxjs/operators'

import { isStorageKey, StorageService } from './storage.service'

/**
 * KALITNI IMZOLANGAN HAVOLAGA O'GIRISH.
 *
 * Bazada fayl KALITI saqlanadi (`clinics/<id>/avatars/<uuid>.jpg`),
 * interfeys esa ochib ko'radigan HAVOLA kutadi. O'girish shu yerda,
 * javob chegarasida bo'ladi.
 *
 * NEGA INTERSEPTOR, HAR BIR MAPPER'DA EMAS:
 *
 *   Avatar to'rtta joyda qaytadi — foydalanuvchi, shifokor, xodim
 *   va klinika logosi. Har birining mapper'i sinxron; imzolash esa
 *   asinxron. Ularni birma-bir `async` ga o'tkazish butun servis
 *   qatlamiga tarqalardi va yangi joy qo'shilganda unutilardi.
 *
 *   Bu yerda esa qoida bitta: maydon nomi `Url` bilan tugasa va
 *   qiymati kalitga o'xshasa — havolaga o'giriladi.
 *
 * NEGA NOM HAM TEKSHIRILADI: `POST /uploads` javobida `key`
 * maydoni bor va u mijozga XOM holida kerak — keyin uni
 * `PATCH /profile` ga qaytaradi. Faqat qiymatga qarab
 * o'girilganda u ham havolaga aylanib, oqim uzilardi.
 *
 * XAVFSIZLIK: havolani `StorageService` beradi va u kalit JORIY
 * klinikaniki ekanini tekshiradi. Boshqa klinikaning kaliti
 * javobga tushib qolsa, havola o'rniga `null` qaytadi — ya'ni
 * xato yashirilmaydi, fayl esa ochilmaydi.
 */
@Injectable()
export class SignedUrlInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.storage.enabled) return next.handle()

    return next.handle().pipe(mergeMap((body) => this.resolve(body)))
  }

  /**
   * Javobni aylanib chiqib, kalitlarni havolaga almashtiradi.
   *
   * CHUQURLIK CHEKLANGAN: javob tuzilmalari sayoz (ro'yxat →
   * yozuv → maydon). Cheksiz chuqurlik halqali havolada
   * to'xtamay qolardi.
   */
  private async resolve(node: unknown, depth = 0): Promise<unknown> {
    if (depth > 6 || node === null || typeof node !== 'object') return node

    if (Array.isArray(node)) {
      return Promise.all(node.map((item) => this.resolve(item, depth + 1)))
    }

    const out = node as Record<string, unknown>
    for (const [key, value] of Object.entries(out)) {
      if (key.endsWith('Url') && isStorageKey(value)) {
        out[key] = await this.storage.signedUrl(value)
      } else if (value !== null && typeof value === 'object') {
        await this.resolve(value, depth + 1)
      }
    }
    return out
  }
}
