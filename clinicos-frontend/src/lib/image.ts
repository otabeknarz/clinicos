/**
 * Profil rasmini tayyorlash.
 *
 * NEGA KERAK: telefondan olingan rasm 3-5 MB bo'ladi. Uni o'sha holicha
 * yuborish ham, saqlash ham noto'g'ri — avatar uchun 256 piksel yetarli.
 *
 * Bu yerda rasm brauzerda kichraytiriladi va JPEG'ga o'giriladi. Natijada
 * ~20-40 KB qoladi.
 *
 * BACKEND BILAN: `blob` `multipart/form-data` orqali `POST /uploads/avatars`
 * ga yuboriladi, server uni S3 ga yozib KALIT qaytaradi, bazaga o'sha kalit
 * yoziladi. `dataUrl` esa faqat DARHOL ko'rsatish uchun — yuklash tugagunicha
 * foydalanuvchi rasmni ko'rib tursin. Demo rejimda saqlanadigan ham o'sha.
 */

/** Avatar uchun eng katta o'lcham */
const MAX_SIZE = 256
/** JPEG sifati */
const QUALITY = 0.85
/** Qabul qilinadigan eng katta fayl (10 MB) */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export type ImageError = 'type' | 'size' | 'decode'

export interface ImageResult {
  ok: boolean
  /** Darhol ko'rsatish uchun (va demo rejimda saqlash uchun) */
  dataUrl: string
  /** Serverga yuboriladigan fayl. Xato bo'lsa `null`. */
  blob: Blob | null
  error?: ImageError
}

/**
 * Rasmni kvadrat qilib kesib, kichraytiradi.
 *
 * Kesish markazdan olinadi — portret rasmda odam yuzi odatda markazda
 * bo'ladi, shuning uchun bu eng xavfsiz variant.
 */
export async function prepareAvatar(file: File): Promise<ImageResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, dataUrl: '', blob: null, error: 'type' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, dataUrl: '', blob: null, error: 'size' }
  }

  try {
    const bitmap = await createImageBitmap(file)

    // Markazdan kvadrat kesamiz
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2

    const size = Math.min(MAX_SIZE, side)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, dataUrl: '', blob: null, error: 'decode' }

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    bitmap.close()

    /*
      Canvas orqali o'tgani uchun natijada EXIF qolmaydi —
      telefon rasmidagi joylashuv ma'lumoti ham shu yerda
      tushib qoladi. Bu yaxshi: uni serverga yuborishning
      hojati yo'q.
    */
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob) return { ok: false, dataUrl: '', blob: null, error: 'decode' }

    return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', QUALITY), blob }
  } catch {
    return { ok: false, dataUrl: '', blob: null, error: 'decode' }
  }
}
