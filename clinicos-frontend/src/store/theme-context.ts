import { createContext, useContext } from 'react'

/** Yorug' / qorong'i rejim. Alohida fayl — Fast Refresh uchun (auth-context.ts izohiga qarang). */
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeValue {
  mode: ThemeMode
  /** Amalda qo'llanayotgan rejim (system hal qilingandan keyin) */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeValue | null>(null)

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme faqat <ThemeProvider> ichida ishlatiladi')
  return ctx
}
