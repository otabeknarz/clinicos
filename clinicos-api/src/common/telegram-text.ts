/**
 * TELEGRAM XABARLARINING MATNI.
 *
 * Ikki joydan chaqiriladi — yangi qabul (shifokorga) va ko'rik
 * tugagani (registratorga). Bitta nusxada turishi shart: ikkita
 * bo'lsa xabarlar bir-biridan asta-sekin uzoqlashib ketardi.
 */

/** Hafta kunlari — xabarda sana raqam bilan emas, so'z bilan yoziladi */
export const WEEKDAYS = [
  'yakshanba',
  'dushanba',
  'seshanba',
  'chorshanba',
  'payshanba',
  'juma',
  'shanba',
] as const

/**
 * Qabul vaqti — O'QIB TUSHUNADIGAN ko'rinishda.
 *
 * `11-sentabr, 14:00` degan yozuv shifokordan kalendarni ochishni
 * talab qiladi: bu qaysi kun, uzoqmi, yaqinmi? "Keyingi hafta
 * seshanba kuni" esa o'sha zahoti tushunarli. Chegara bir hafta
 * bo'lgani uchun eng uzoq holat ham "keyingi hafta" bilan tugaydi.
 */
export function whenInWords(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `soat ${pad(at.getHours())}:${pad(at.getMinutes())}`

  const midnight = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  const today = midnight(new Date())
  const day = midnight(at)
  const DAY_MS = 24 * 60 * 60 * 1000
  const days = Math.round((day.getTime() - today.getTime()) / DAY_MS)

  if (days === 0) return `bugun, ${time}`
  if (days === 1) return `ertaga, ${time}`
  if (days < 0) return `${WEEKDAYS[at.getDay()]} kuni, ${time}`

  /* Hafta DUSHANBADAN boshlanadi — "keyingi hafta" shunga nisbatan */
  const sinceMonday = (today.getDay() + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - sinceMonday)
  const weeks = Math.floor((day.getTime() - thisMonday.getTime()) / (7 * DAY_MS))
  const weekday = WEEKDAYS[at.getDay()]

  if (weeks === 0) return `${weekday} kuni, ${time}`
  return `keyingi hafta ${weekday} kuni, ${time}`
}

/**
 * Telegram `parse_mode: HTML` uchun.
 *
 * Bemor ismi yoki xizmat nomida `<` bo'lsa, Telegram butun xabarni
 * rad etadi — ya'ni xabar umuman kelmaydi va sababi ko'rinmaydi.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Summani o'qib bo'ladigan ko'rinishda.
 *
 * `150000` emas, `150 000 so'm`. Registrator xabarni telefonda
 * o'qiydi va raqamni sanab o'tirmasligi kerak.
 */
export function money(amount: number): string {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+$)/g, ' ')
  return `${grouped} so‘m`
}
