import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Yulduzli baho.
 *
 * `onChange` berilsa — bosiladigan (baho qo'yish uchun), aks holda
 * faqat ko'rsatish uchun.
 */
export function Stars({
  value,
  onChange,
  size = 18,
  className,
}: {
  /** 0-5 */
  value: number
  onChange?: (value: number) => void
  size?: number
  className?: string
}) {
  const interactive = Boolean(onChange)

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value)

        const icon = (
          <Star
            size={size}
            className={cn(
              'transition-colors duration-150',
              filled ? 'fill-current text-[var(--ios-yellow)]' : 'text-label-quaternary',
            )}
          />
        )

        if (!interactive) return <span key={star}>{icon}</span>

        return (
          <button
            key={star}
            type="button"
            aria-label={String(star)}
            onClick={() => onChange?.(star)}
            className="transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            {icon}
          </button>
        )
      })}
    </span>
  )
}

/** Yulduz + raqam, ixcham ko'rinish */
export function StarValue({
  value,
  count,
  size = 14,
}: {
  value: number
  count?: number
  size?: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Star
        size={size}
        className="fill-current text-[var(--ios-yellow)]"
      />
      <span className="font-semibold tnum text-label">{value.toFixed(1)}</span>
      {count !== undefined ? (
        <span className="text-caption tnum text-label-tertiary">({count})</span>
      ) : null}
    </span>
  )
}
