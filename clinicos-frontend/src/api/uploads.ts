/**
 * Fayl yuklash.
 *
 * IKKI QADAM: avval fayl serverga yuboriladi va KALIT qaytadi,
 * keyin o'sha kalit tegishli yozuvga yoziladi
 * (`PATCH /profile` ga `{ avatarUrl: kalit }`).
 *
 * NEGA BIR SO'ROVDA EMAS: forma bekor qilinsa ham fayl yozilib
 * ketardi va uni kim tozalashi noma'lum bo'lib qolardi.
 *
 * Bazada HAVOLA emas, kalit yotadi. Server o'qishda qisqa
 * muddatli imzolangan havola qaytaradi — bucket yopiq, havolasiz
 * faylni ochib bo'lmaydi.
 */

import { delay, upload, USE_MOCK } from './client'

/** Qaysi papkaga tushadi. Serverdagi ro'yxat bilan bir xil. */
export type UploadKind = 'avatars' | 'logos'

export interface UploadedFile {
  /** Bazaga yoziladigan kalit */
  key: string
  mime: string
  size: number
}

// POST /uploads/:kind
export async function uploadImage(
  kind: UploadKind,
  file: Blob,
  /** Demo rejimda saqlanadigan qiymat — data URL */
  fallback: string,
): Promise<UploadedFile> {
  if (!USE_MOCK) {
    return upload<UploadedFile>(`/uploads/${kind}`, file, `${kind}.jpg`)
  }

  /*
    Demo rejimda server yo'q, shuning uchun "kalit" sifatida
    data URL ning o'zi qaytadi va u brauzerdagi bazaga yoziladi.
  */
  return delay({ key: fallback, mime: 'image/jpeg', size: file.size }, 300)
}
