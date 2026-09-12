/**
 * Telefonni BIR XIL ko'rinishga soladi: "+998 90 123 45 67".
 *
 * Bir joyda turadi, chunki uchta oqim shu shaklga tayanadi:
 * Excel'dan ko'chirish (takrorni raqam bo'yicha topadi), o'zi
 * ro'yxatdan o'tish va kirish. Ikki xil normalizatsiya bo'lsa,
 * odam ro'yxatdan o'tgan raqami bilan kira olmay qolardi.
 *
 * Shakli tanib bo'lmasa — qo'lidagi matn qaytadi: mavjud
 * yozuvlarni "to'g'rilab" buzib qo'ymaslik uchun.
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits
  if (local.length !== 9) return value.trim()
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
}

/** Kiritilgan matn telefonga o'xshaydimi (email emasmi) */
export function looksLikePhone(value: string): boolean {
  return !value.includes('@') && value.replace(/\D/g, '').length >= 7
}
