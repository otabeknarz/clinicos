import { dict as uz } from './uz'
import { DEFAULT_LANG } from './langs'
import type { Dict, Lang } from './langs'

export type { Dict, Lang }
export { LANGS, DEFAULT_LANG } from './langs'

/*
 * O'zbekcha DOIM birga keladi.
 *
 * Ikki sabab: u standart til, va boshqa tilda kalit topilmasa
 * o'zbekchasi ko'rsatiladi — xom kalit chiqib qolmasin.
 */
export const FALLBACK: Dict = uz

// Bir marta yuklangan til qayta yuklanmaydi
const cache = new Map<Lang, Dict>([[DEFAULT_LANG, uz]])

/**
 * Tilni yuklash.
 *
 * Ruscha va inglizcha alohida bo'lakda — tanlanmaguncha
 * brauzerga umuman tushmaydi.
 */
export async function loadDictionary(lang: Lang): Promise<Dict> {
  const cached = cache.get(lang)
  if (cached) return cached

  const loaded =
    lang === 'ru'
      ? (await import('./ru')).dict
      : lang === 'en'
        ? (await import('./en')).dict
        : uz

  cache.set(lang, loaded)
  return loaded
}

/** Allaqachon yuklangan bo'lsa — darrov beradi (birinchi chizish uchun) */
export function peekDictionary(lang: Lang): Dict | undefined {
  return cache.get(lang)
}
