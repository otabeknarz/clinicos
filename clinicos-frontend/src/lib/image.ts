/**
 * Profil rasmini tayyorlash.
 *
 * NEGA KERAK: telefondan olingan rasm 3-5 MB bo'ladi. Uni o'sha holicha
 * yuborish ham, saqlash ham noto'g'ri — avatar uchun 256 piksel yetarli.
 *
 * Bu yerda rasm brauzerda kichraytiriladi va JPEG'ga o'giriladi. Natijada
 * ~20-40 KB qoladi.
 *
 * BACKEND BILAN: fayl `multipart/form-data` orqali yuboriladi va S3 kabi
 * obyekt xotirasida saqlanadi. Bazaga faqat havola yoziladi. Bu yerdagi
 * data URL faqat demo rejim uchun.
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
  dataUrl: string
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
    return { ok: false, dataUrl: '', error: 'type' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, dataUrl: '', error: 'size' }
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
    if (!ctx) return { ok: false, dataUrl: '', error: 'decode' }

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    bitmap.close()

    return { ok: true, dataUrl: canvas.toDataURL('image/jpeg', QUALITY) }
  } catch {
    return { ok: false, dataUrl: '', error: 'decode' }
  }
}
