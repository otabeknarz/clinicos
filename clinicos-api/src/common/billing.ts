/**
 * OBUNA NARXI.
 *
 * Bitta joyda, chunki uch joyda kerak bo'ladi: obuna ochilganda,
 * tarif almashtirilganda va platforma panelidagi jadvalda. Uch marta
 * yozilsa, yaxlitlash bir-biridan farq qilib qolardi — pulda bu
 * sezilarli.
 */

/**
 * ASOSIY MUDDAT — UCH OY.
 *
 * Tariflar uch oydan boshlab sotiladi, shuning uchun tarifning
 * e'lon qilingan narxi ham uch oylik. Qolgan muddatlar undan
 * ko'paytirib chiqariladi: 6 oy = ×2, 12 oy = ×4.
 */
export const BASE_TERM_MONTHS = 3

/** Ruxsat etilgan muddatlar */
export const TERM_MONTHS = [3, 6, 12] as const

/**
 * Muddat uchun JAMI summa — mijoz bir marta to'laydigan pul.
 *
 * `basePrice` uch oyga tegishli: avval muddatga ko'paytiriladi,
 * keyin chegirma qo'llanadi. Yaxlitlash faqat OXIRIDA — oraliqda
 * yaxlitlansa, 6 va 12 oylik narxlar bir-biriga mos kelmay qolardi.
 */
export function termTotal(
  basePrice: number,
  months: number,
  discountPct: number,
): number {
  const full = (basePrice * months) / BASE_TERM_MONTHS
  return Math.round((full * (100 - discountPct)) / 100)
}

/**
 * Oylik daromad (MRR) uchun: muddat summasini oyga bo'lamiz.
 *
 * Hisobot raqami, hisob-faktura emas — shuning uchun yaxlitlash
 * bu yerda xavfsiz.
 */
export function monthlyFromTerm(termPrice: number, termMonths: number): number {
  if (termMonths <= 0) return 0
  return Math.round(termPrice / termMonths)
}
