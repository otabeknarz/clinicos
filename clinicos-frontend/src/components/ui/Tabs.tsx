import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { useScrollHint } from '@/lib/useScrollHint'

/**
 * Segmentli boshqaruv — Apple'ning `UISegmentedControl`i.
 *
 * Kichik to'plamlar uchun (Kun/Hafta, Bugun/Hafta/Oy). Ichkarida
 * sirpanuvchi oq "kapsula" bo'ladi.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex shrink-0 items-center rounded-[10px] bg-fill-4 p-0.5',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-full rounded-[8px] px-3 font-medium whitespace-nowrap',
              'transition-all duration-200',
              size === 'sm' ? 'text-caption' : 'text-footnote',
              active
                ? 'bg-raised text-label shadow-xs'
                : 'text-label-secondary hover:text-label',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Sahifa ichidagi tablar (Umumiy / Tashriflar / To'lovlar).
 * Ostki chiziq bilan — segmentli boshqaruvdan farqli, ko'proq element sig'adi.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  className?: string
}) {
  // Telefonda tablar sig'masa, chetda "yana bor" ishorasi chiqadi
  const { ref, maskClass } = useScrollHint<HTMLDivElement>()

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn('scroll-hidden flex gap-1 overflow-x-auto', maskClass, className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative shrink-0 px-3 pb-3 pt-1 text-subhead font-medium',
              'transition-colors duration-150',
              active ? 'text-label' : 'text-label-secondary hover:text-label',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {option.label}
              {option.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-caption-2 font-semibold tnum',
                    active ? 'bg-accent-soft text-accent' : 'bg-fill-4 text-label-tertiary',
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Filtr "tabletkalari" — Bemorlar sahifasidagi Hammasi/Yangi/Faol.
 */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
}) {
  const { ref, maskClass } = useScrollHint<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn('scroll-hidden flex gap-2 overflow-x-auto', maskClass, className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 shrink-0 rounded-full px-3.5 text-footnote font-medium',
              'transition-colors duration-150',
              active
                ? 'bg-label text-raised'
                : 'bg-fill-4 text-label-secondary hover:bg-fill-3 hover:text-label',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
