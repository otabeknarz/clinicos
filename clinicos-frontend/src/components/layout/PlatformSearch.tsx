import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Search, Stethoscope, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { platformSearch } from '@/api/platform'
import { Spinner } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { PlatformSearchHit, PlatformSearchScope } from '@/types/models'

const SCOPES: PlatformSearchScope[] = ['all', 'clinic', 'doctor', 'patient']

const ICONS: Record<Exclude<PlatformSearchScope, 'all'>, LucideIcon> = {
  clinic: Building2,
  doctor: Stethoscope,
  patient: UserRound,
}

/**
 * PLATFORMA QIDIRUVI.
 *
 * Klinika panelidagi qidiruvdan alohida: u yerda bemor, xizmat va
 * qabul qidiriladi; bu yerda klinikalar, ularning shifokorlari va
 * bemorlari.
 *
 * NEGA TURKUM TUGMALARI: "Karimov" deb qidirsangiz ham shifokor, ham
 * bemor chiqadi. Qaysi biri kerakligini oldindan aytish natijani
 * o'nlab qatordan tozalab o'tirishdan tez.
 *
 * Har turkumdan 5 tadan ko'rsatiladi — bu qidiruv oynasi, ro'yxat
 * emas. To'liq ro'yxat filtrlari bilan "Ro'yxatlar" bo'limida.
 */
export function PlatformSearch({ className }: { className?: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<PlatformSearchScope>('all')
  const [open, setOpen] = useState(false)

  const debounced = useDebounced(query, 200)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, loading } = useAsync(
    () => platformSearch(debounced, scope),
    [debounced, scope],
    { skip: debounced.trim().length < 2 },
  )

  const hits = debounced.trim().length < 2 ? [] : (data ?? [])

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function go(hit: PlatformSearchHit) {
    navigate(hit.href)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute inset-y-0 left-3 my-auto text-label-tertiary"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={t('psearch.placeholder')}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className={cn(
            'h-10 w-full rounded-[10px] bg-fill-4 pl-10 pr-16 text-subhead text-label',
            'border border-transparent outline-none placeholder:text-label-tertiary',
            'transition-colors duration-150 focus:border-accent focus:bg-raised',
          )}
        />
        <kbd
          className={cn(
            'pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-5 items-center',
            'rounded-[5px] bg-fill-3 px-1.5 text-caption-2 font-medium text-label-tertiary lg:flex',
          )}
        >
          ⌘K
        </kbd>
      </div>

      {open ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-96 overflow-y-auto',
            'scroll-slim animate-scale-in origin-top rounded-[16px] p-1.5',
            /*
              To'q (shaffof bo'lmagan) fon.

              `material-thick` bu yerda ishlamaydi: yuqori panelning
              o'zida `backdrop-filter` bor va u ichkaridagi xiralashni
              buzadi — natijada orqadagi matn aniq ko'rinib, ro'yxatni
              o'qib bo'lmaydi.
            */
            'border border-separator bg-raised shadow-popover',
          )}
        >
          {/* --- Turkum tanlash --- */}
          <div className="flex flex-wrap gap-1 border-b border-separator px-1 pb-2">
            {SCOPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={cn(
                  'rounded-[8px] px-2.5 py-1.5 text-caption font-medium',
                  'transition-colors duration-150',
                  scope === item
                    ? 'bg-accent text-white'
                    : 'text-label-secondary hover:bg-fill-4',
                )}
              >
                {t(`psearch.scope.${item}`)}
              </button>
            ))}
          </div>

          {debounced.trim().length < 2 ? (
            <p className="py-6 text-center text-footnote text-label-tertiary">
              {t('psearch.hint')}
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-label-tertiary">
              <Spinner />
              <span className="text-footnote">{t('common.loading')}</span>
            </div>
          ) : hits.length === 0 ? (
            <p className="py-6 text-center text-footnote text-label-tertiary">
              {t('search.noResults')}
            </p>
          ) : (
            <ul className="pt-1">
              {hits.map((hit) => {
                const Icon = ICONS[hit.scope]

                return (
                  <li key={`${hit.scope}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => go(hit)}
                      className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-fill-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-fill-4 text-label-secondary">
                        <Icon size={15} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-subhead text-label">
                          {hit.title}
                        </span>
                        <span className="block truncate text-caption text-label-tertiary">
                          {hit.subtitle}
                        </span>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block text-caption tnum text-label-tertiary">
                          {hit.meta}
                        </span>
                        <span className="block text-caption-2 text-label-quaternary">
                          {t(`psearch.scope.${hit.scope}`)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
