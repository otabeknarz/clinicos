import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'

import { I18nContext } from './context'
import type { I18nValue } from './context'
import { DEFAULT_LANG, FALLBACK, LANGS, loadDictionary, peekDictionary } from './dictionary'
import type { Dict, Lang } from './dictionary'
import { categoryName, complaintName, serviceName, specialtyName } from './data'
import { setFormatLang } from '@/lib/format'
import { useLocalStorage } from '@/lib/useLocalStorage'

export type { Lang }
export { LANGS }
export { useI18n } from './context'

const STORAGE_KEY = 'clinicos.lang'


export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useLocalStorage<Lang>(STORAGE_KEY, DEFAULT_LANG)

  /*
    Joriy tilning lug'ati.

    O'zbekcha ilova bilan birga keladi, ruscha va inglizcha esa
    tanlangandagina yuklanadi. Yuklanguncha o'zbekchasi ko'rinadi —
    xom kalit ko'rsatishdan ko'ra shunisi yaxshi.

    Lug'at modul darajasida saqlanadi, shuning uchun uni holatda
    takrorlamaymiz: yuklanib bo'lgach shunchaki qayta chizishni
    so'raymiz. Aks holda tayyor til uchun ham ortiqcha chizish
    bo'lardi.
  */
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const dict: Dict = peekDictionary(lang) ?? FALLBACK

  useEffect(() => {
    // Sana/pul formatlagichi ham shu tilda ishlashi kerak
    setFormatLang(lang)
    document.documentElement.lang = lang

    if (peekDictionary(lang)) return

    let alive = true
    void loadDictionary(lang).then(() => {
      if (alive) redraw()
    })

    return () => {
      alive = false
    }
  }, [lang])

  const setLang = useCallback(
    (next: Lang) => {
      setFormatLang(next)
      setLangRaw(next)
      // Almashish paytida sahifa "sakramasin" — avval yuklab, keyin qo'yamiz
      void loadDictionary(next)
    },
    [setLangRaw],
  )

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Tarjima topilmasa — o'zbekchaga, u ham bo'lmasa kalitning o'ziga tushamiz.
      // Xom kalit ekranda ko'rinsa, demak lug'atga qo'shish kerak.
      const raw = dict[key] ?? FALLBACK[key] ?? key
      if (!vars) return raw
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      )
    },
    [dict],
  )

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t,
      tSpecialty: (key: string) => specialtyName(key, lang),
      tCategory: (key: string) => categoryName(key, lang),
      tService: (key: string) => serviceName(key, lang),
      tComplaint: (key: string) => complaintName(key, lang),
    }),
    [lang, setLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

