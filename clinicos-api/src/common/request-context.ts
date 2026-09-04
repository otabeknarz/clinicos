import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable } from '@nestjs/common'

/**
 * Joriy so'rovning konteksti.
 *
 * NEGA AsyncLocalStorage: `clinicId` ni har bir servis va metodga
 * argument qilib uzatish kerak bo'lardi. Yuzta joyda uzatilib,
 * bittasida unutilsa — o'sha yerda filtr yo'qoladi. Kontekst esa
 * so'rov boshida bir marta qo'yiladi va butun zanjir bo'ylab
 * o'zi boradi.
 *
 * MUHIM: bu yerdagi qiymatlar faqat TOKENDAN olinadi. So'rov
 * tanasidan yoki sarlavhasidan hech qachon emas.
 */
export interface RequestUser {
  userId: string
  clinicId: string
  role: 'SUPERADMIN' | 'OWNER' | 'RECEPTIONIST' | 'DOCTOR'
  /** Rol DOCTOR bo'lsa — shifokor profili id'si, aks holda null */
  doctorId: string | null
  permissions: string[]
  /*
    Platforma egasi klinika paneliga "kirgan" bo'lsa — kirish
    yozuvining id'si. Bu holatda `clinicId` o'sha klinikaniki
    bo'ladi, lekin `role` SUPERADMIN bo'lib qoladi.
  */
  impersonationId: string | null
}

/*
  Saqlanadigan narsa — O'ZGARUVCHAN idish, foydalanuvchining o'zi emas.

  NEGA: kontekst so'rov boshida, middleware'da ochilishi kerak
  (u eng birinchi ishlaydi). Lekin o'sha paytda foydalanuvchi hali
  noma'lum — token qorovulda tekshiriladi. Shuning uchun middleware
  bo'sh idish qo'yadi, qorovul esa uni to'ldiradi.

  `enterWith` bilan qilib ko'rildi va ishlamadi: qorovul tokenni
  `await` bilan tekshiradi, `enterWith` esa `await` dan keyin
  chaqirilganda kontekstni CHAQIRUVCHIGA qaytarmaydi. Natijada
  keyingi qorovul bo'sh kontekstga duch kelardi.
*/
interface Holder {
  user: RequestUser | null
}

const storage = new AsyncLocalStorage<Holder>()

@Injectable()
export class RequestContext {
  /** So'rov boshida bo'sh kontekst ochadi. Middleware chaqiradi. */
  begin<T>(fn: () => T): T {
    return storage.run({ user: null }, fn)
  }

  /** Token tekshirilgach foydalanuvchini qo'yadi. Qorovul chaqiradi. */
  set(user: RequestUser): void {
    const holder = storage.getStore()
    if (!holder) {
      throw new Error(
        'Kontekst ochilmagan. ContextMiddleware ro‘yxatdan o‘tganmi?',
      )
    }
    holder.user = user
  }

  /** Kontekst bor deb ishonadigan joylar uchun */
  require(): RequestUser {
    const user = storage.getStore()?.user ?? null
    if (!user) {
      /*
        Bu holat bo'lmasligi kerak: qorovul tokensiz so'rovni
        o'tkazmaydi. Yetib kelsa — dasturchi xatosi, masalan
        fon vazifasi so'rov konteksisiz baza servisini chaqirgan.
        Jim davom etgandan ko'ra to'xtagani xavfsizroq.
      */
      throw new Error(
        'So‘rov konteksti yo‘q. Fon vazifasidan bazaga murojaat ' +
          'qilyapsizmi? U holda platforma mijozidan foydalaning.',
      )
    }
    return user
  }

  /** Kontekst bo'lmasligi mumkin bo'lgan joylar uchun */
  peek(): RequestUser | null {
    return storage.getStore()?.user ?? null
  }
}
