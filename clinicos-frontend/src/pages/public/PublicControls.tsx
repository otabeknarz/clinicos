import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/cn'
import { LANGS, useI18n } from '@/i18n'
import { useTheme } from '@/store/theme-context'

/**
 * TIL VA REJIM — TANISHTIRUV VA KIRISH SAHIFALARINING TEPASIDA.
 *
 * Ikkalasi ham HAR SAHIFADA bir joyda turadi: rus tilida so'zlashadigan
 * odam landing'ni ochib, tilni almashtirish tugmasini qidirib yurmasligi
 * kerak. Tanlov ilova ichidagi bilan UMUMIY — kirgandan keyin ham
 * o'sha til va o'sha rejim davom etadi.
 *
 * Til — ochiladigan ro'yxat: uchta tugma aylantirib bosiladigan
 * "keyingi til" ko'rinishida edi va odam qaysi tilga o'tishini
 * bilmay bosardi.
 */
export function PublicControls({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const { resolved, setMode } = useTheme()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = LANGS.find((one) => one.code === lang) ?? LANGS[0]
  const dark = resolved === 'dark'

  return (
    <div className={cn('public-controls', className)} ref={rootRef}>
      <div className="public-lang">
        <button
          type="button"
          className="public-control"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Globe size={15} strokeWidth={1.8} />
          <span>{current.short}</span>
        </button>

        {open ? (
          <ul className="public-lang-list" role="listbox">
            {LANGS.map((one) => (
              <li key={one.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={one.code === lang}
                  className={cn('public-lang-option', one.code === lang && 'is-active')}
                  onClick={() => {
                    setLang(one.code)
                    setOpen(false)
                  }}
                >
                  {one.label}
                  {one.code === lang ? <Check size={14} /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Bir bosishda almashadi — ikki holatli tanlov uchun ro'yxat ortiqcha */}
      <button
        type="button"
        className="public-control public-control--icon"
        aria-label={dark ? 'Light' : 'Dark'}
        onClick={() => setMode(dark ? 'light' : 'dark')}
      >
        {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
      </button>
    </div>
  )
}
