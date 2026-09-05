/**
 * Fayl kaliti qanday ko'rinishda bo'lishi kerak.
 *
 * Bitta joyda, chunki bir necha DTO da tekshiriladi
 * (`avatarUrl`, `logoUrl`).
 *
 * NEGA QAT'IY SHAKL: bu maydonlarga ilgari base64 data URL
 * yozilardi — interfeys rasmni brauzerda kodlab yuborardi.
 * Natijada 30 KB matn bazaga tushardi (klinika logosida
 * chegara umuman yo'q edi). Endi bu yerga faqat yuklangan
 * faylning kaliti tushadi, rasmning o'zi S3 da yotadi.
 *
 * Shakli: clinics/<clinicId>/<tur>/<uuid>.<kengaytma>
 */
export const STORAGE_KEY_PATTERN =
  /^clinics\/[0-9a-fA-F-]{36}\/(avatars|logos)\/[0-9a-fA-F-]{36}\.(jpg|png|webp)$/

export const STORAGE_KEY_MESSAGE =
  'Rasm avval POST /uploads/:kind orqali yuklanadi, bu yerga uning kaliti yoziladi'
