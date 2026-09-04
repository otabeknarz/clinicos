/**
 * Formatlash — pul, sana, telefon, raqamlar.
 *
 * Til `setFormatLang()` orqali beriladi (i18n provayderi chaqiradi), shuning
 * uchun komponentlar har safar tilni uzatib o'tirmaydi.
 */

import type { ISODate, ISODateTime, UZS } from '@/types/models'

export type Lang = 'uz' | 'ru' | 'en'

let currentLang: Lang = 'uz'

export function setFormatLang(lang: Lang) {
  currentLang = lang
}

export function getFormatLang(): Lang {
  return currentLang
}

const LOCALES: Record<Lang, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

/* ------------------------------------------------------------------ */
/* Pul                                                                 */
/* ------------------------------------------------------------------ */

const CURRENCY_LABEL: Record<Lang, string> = {
  uz: "so'm",
  ru: 'сум',
  en: 'UZS',
}

/** Joriy tildagi valyuta yorlig'i: "so'm" / "сум" / "UZS" */
export function currencyLabel(): string {
  return CURRENCY_LABEL[currentLang]
}

/**
 * To'liq summa: "1 250 000 so'm"
 * Jadval va kvitansiyalar uchun — aniq raqam kerak bo'lganda.
 */
export function money(amount: UZS): string {
  return `${groupDigits(amount)} ${CURRENCY_LABEL[currentLang]}`
}

/** Valyutasiz, faqat guruhlangan raqam: "1 250 000" */
export function groupDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Ixcham summa: "12.4M so'm", "284.3M so'm", "1.2 mlrd so'm"
 * KPI kartalar va grafik o'qlari uchun.
 */
export function moneyShort(amount: UZS): string {
  return `${compactNumber(amount)} ${CURRENCY_LABEL[currentLang]}`
}

/** Valyutasiz ixcham raqam: "12.4M", "284.3M", "1.2B" */
export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000_000) return `${sign}${trimZero(abs / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${sign}${trimZero(abs / 1_000_000)}M`
  if (abs >= 10_000) return `${sign}${trimZero(abs / 1_000)}K`
  return `${sign}${groupDigits(abs)}`
}

function trimZero(n: number): string {
  const s = n.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/* ------------------------------------------------------------------ */
/* Foiz                                                                */
/* ------------------------------------------------------------------ */

/** "+12.4%" / "-2.1%" — ishorasi bilan */
export function percentDelta(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/** "68%" — ishorasiz */
export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

/* ------------------------------------------------------------------ */
/* Sana va vaqt                                                        */
/* ------------------------------------------------------------------ */

const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

const MONTHS_LONG: Record<Lang, string[]> = {
  uz: [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ],
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

export function monthsShort(): string[] {
  return MONTHS_SHORT[currentLang]
}

export function weekdaysShort(): string[] {
  return WEEKDAYS_SHORT[currentLang]
}

/** "28 avg 2026" */
export function dateShort(value: ISODate | ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[currentLang][d.getMonth()]} ${d.getFullYear()}`
}

/** "28 avgust 2026" */
export function dateLong(value: ISODate | ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_LONG[currentLang][d.getMonth()]} ${d.getFullYear()}`
}

/** "28 avg" — yilsiz, grafik o'qlari uchun */
export function dateCompact(value: ISODate | ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[currentLang][d.getMonth()]}`
}

/** "09:30" */
export function time(value: ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "28 avg, 09:30" */
export function dateTime(value: ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${dateCompact(d)}, ${time(d)}`
}

/** Yosh: 34 */
export function age(birthDate: ISODate): number {
  const b = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--
  return years
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toDate(value: ISODate | ISODateTime | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/* ------------------------------------------------------------------ */
/* Telefon                                                             */
/* ------------------------------------------------------------------ */

/**
 * "+998901234567" → "+998 90 123 45 67"
 * Boshqa formatdagi raqamni o'zgartirmasdan qaytaradi.
 */
export function phone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`
  }
  return value
}

/** Kiritish maydonida jonli formatlash uchun */
export function phoneInputMask(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('998')) digits = digits.slice(3)
  digits = digits.slice(0, 9)

  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
  return `+998 ${parts.filter(Boolean).join(' ')}`.trimEnd()
}

/** Maskadan toza E.164 raqam: "+998901234567" */
export function phoneToE164(masked: string): string {
  const digits = masked.replace(/\D/g, '')
  return digits.startsWith('998') ? `+${digits}` : `+998${digits}`
}

/* ------------------------------------------------------------------ */
/* Ism                                                                 */
/* ------------------------------------------------------------------ */

/** "Aziz Karimov" → "AK" */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Ismdan barqaror rang indeksi — avatar foni uchun */
export function colorIndex(seed: string, buckets: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash % buckets
}

/* ------------------------------------------------------------------ */
/* Nisbiy vaqt                                                         */
/* ------------------------------------------------------------------ */

const RELATIVE: Record<Lang, { today: string; yesterday: string; tomorrow: string }> = {
  uz: { today: 'Bugun', yesterday: 'Kecha', tomorrow: 'Ertaga' },
  ru: { today: 'Сегодня', yesterday: 'Вчера', tomorrow: 'Завтра' },
  en: { today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow' },
}

/** Bugun/kecha/ertaga bo'lsa so'z bilan, aks holda "28 avg 2026" */
export function dateRelative(value: ISODate | ISODateTime | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'

  const diff = dayDiff(d, new Date())
  if (diff === 0) return RELATIVE[currentLang].today
  if (diff === -1) return RELATIVE[currentLang].yesterday
  if (diff === 1) return RELATIVE[currentLang].tomorrow
  return dateShort(d)
}

/** a va b orasidagi kunlar farqi (a - b), vaqtni hisobga olmasdan */
export function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((da - db) / 86_400_000)
}

/* ------------------------------------------------------------------ */
/* Intl zaxira                                                         */
/* ------------------------------------------------------------------ */

/** Kerak bo'lganda standart Intl formatlagichi */
export function intlNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALES[currentLang], options).format(value)
}
