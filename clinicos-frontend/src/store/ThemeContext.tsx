import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

import { ThemeContext } from './theme-context'
import type { ThemeMode, ThemeValue } from './theme-context'
import { useLocalStorage } from '@/lib/useLocalStorage'

/**
 * Yorug' / qorong'i rejim.
 *
 * `system` — foydalanuvchi OS sozlamasiga ergashadi (Apple shunday qiladi).
 * Tanlov `<html>` elementiga `.dark` klassini qo'yadi; barcha ranglar
 * `src/index.css`dagi CSS o'zgaruvchilaridan keladi, shuning uchun
 * komponentlarda hech qanday shart yozish kerak emas.
 */


const STORAGE_KEY = 'clinicos.theme'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useLocalStorage<ThemeMode>(STORAGE_KEY, 'light')

  const apply = useCallback((next: ThemeMode) => {
    const dark = next === 'dark' || (next === 'system' && systemPrefersDark())
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  useEffect(() => {
    apply(mode)
    if (mode !== 'system') return

    // Tizim rejimida OS sozlamasi o'zgarsa — darhol ergashamiz
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode, apply])

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      resolved: mode === 'dark' || (mode === 'system' && systemPrefersDark()) ? 'dark' : 'light',
      setMode,
    }),
    [mode, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

