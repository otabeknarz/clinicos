/** Tillar ro'yxati va lug'at turi — tarjimalarning o'zisiz. */

export type Lang = 'uz' | 'ru' | 'en'

export type Dict = Record<string, string>

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'uz', label: "O'zbekcha", short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
]

export const DEFAULT_LANG: Lang = 'uz'
