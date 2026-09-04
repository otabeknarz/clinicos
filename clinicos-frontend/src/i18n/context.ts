import { createContext, useContext } from 'react'

import type { Lang } from './dictionary'

/** i18n konteksti. Alohida fayl — Fast Refresh uchun. */
export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Interfeys matni: t('nav.patients') */
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Ma'lumot tarjimasi */
  tSpecialty: (key: string) => string
  tCategory: (key: string) => string
  tService: (key: string) => string
  tComplaint: (key: string) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n faqat <I18nProvider> ichida ishlatiladi')
  return ctx
}
