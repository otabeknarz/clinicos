/**
 * Shartli class nomlarini birlashtirish.
 *
 * Har qanday qiymatni qabul qiladi va faqat bo'sh bo'lmagan matnlarni
 * qoldiradi — shu tufayli `icon && 'pl-10'` kabi yozuvlar ham ishlaydi
 * (u yerda `icon` ReactNode bo'lishi mumkin).
 */
export function cn(...parts: unknown[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ')
}
