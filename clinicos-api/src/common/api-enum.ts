/**
 * Enum qiymatlarini baza va interfeys o'rtasida o'girish.
 *
 * Baza: `CHECKED_IN`, `MALE`, `SALARY_PERCENT`
 * Frontend: `checked_in`, `male`, `salary_percent`
 *
 * Farq faqat harf kattaligida — barcha enumlar tekshirildi va
 * ularning hammasi shu qoidaga bo'ysunadi. Shuning uchun har bir
 * enum uchun alohida jadval yozish shart emas: qo'lda yozilgan
 * jadval ertami-kechmi sxemadan orqada qolardi.
 *
 * NEGA UMUMAN O'GIRAMIZ: frontend allaqachon yozilgan va uning
 * shartnomasi kichik harfda. Backend baza uslubini interfeysga
 * chiqarsa, frontenddagi yuzlab joyni o'zgartirish kerak bo'lardi.
 * Chegara shu yerda — bazadan chiqishda o'giriladi.
 */

/** Bazadan interfeysga: `CHECKED_IN` → `checked_in` */
export function toApi<T extends string>(value: T): Lowercase<T>
export function toApi<T extends string>(value: T | null): Lowercase<T> | null
export function toApi<T extends string>(value: T | null): Lowercase<T> | null {
  return value === null ? null : (value.toLowerCase() as Lowercase<T>)
}

/** Interfeysdan bazaga: `checked_in` → `CHECKED_IN` */
export function toDb<T extends string>(value: T): Uppercase<T>
export function toDb<T extends string>(value: T | null): Uppercase<T> | null
export function toDb<T extends string>(value: T | null): Uppercase<T> | null {
  return value === null ? null : (value.toUpperCase() as Uppercase<T>)
}

/**
 * Sanani interfeys kutgan ko'rinishga o'girish.
 *
 * `ISODate` — faqat kun: "2026-09-04"
 * `ISODateTime` — to'liq vaqt: "2026-09-04T09:30:00.000Z"
 *
 * Frontend ikkalasini ham matn sifatida kutadi, `Date` obyektini emas.
 */
export function toApiDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10)
}

export function toApiDateTime(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}
