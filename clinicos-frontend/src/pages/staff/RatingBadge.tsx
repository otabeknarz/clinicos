import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { percent } from '@/lib/format'
import { useI18n } from '@/i18n'
import type { RatingFactor } from '@/types/models'

/**
 * Reyting belgisi.
 *
 * Reyting avtomatik hisoblanadi, shuning uchun xodim "nega menga 3.8?"
 * deb so'rashi tabiiy. `title` da omillar ro'yxati turadi, batafsil
 * tafsilot esa profil kartasida.
 */
export function RatingBadge({
  rating,
  factors,
  size = 'md',
}: {
  rating: number | null
  factors?: RatingFactor[]
  size?: 'sm' | 'md'
}) {
  const { t } = useI18n()

  if (rating === null) {
    return (
      <span
        className="text-caption text-label-quaternary"
        title={t('staff.ratingNone')}
      >
        —
      </span>
    )
  }

  const tone =
    rating >= 4.5
      ? 'bg-ok-soft text-ok'
      : rating >= 3.5
        ? 'bg-accent-soft text-accent'
        : rating >= 2.5
          ? 'bg-warn-soft text-warn'
          : 'bg-bad-soft text-bad'

  const hint = factors?.length
    ? factors.map((f) => `${t(f.labelKey)}: ${f.display}`).join('\n')
    : t('staff.ratingAuto')

  return (
    <span
      title={hint}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold tnum',
        tone,
        size === 'sm' ? 'px-2 py-0.5 text-caption' : 'px-2.5 py-1 text-footnote',
      )}
    >
      <Star size={size === 'sm' ? 11 : 12} className="fill-current" />
      {rating.toFixed(1)}
    </span>
  )
}

/** Reyting nimadan hisoblanganini ochib beruvchi ro'yxat */
export function RatingBreakdown({ factors }: { factors: RatingFactor[] }) {
  const { t } = useI18n()

  if (factors.length === 0) {
    return <p className="text-footnote text-label-tertiary">{t('staff.ratingNone')}</p>
  }

  return (
    <ul className="space-y-2.5">
      {factors.map((factor) => (
        <li key={factor.labelKey}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-footnote text-label-secondary">{t(factor.labelKey)}</span>
            <span className="text-footnote font-medium tnum text-label">{factor.display}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-4">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, factor.score))}%`,
                  background:
                    factor.score >= 80
                      ? 'var(--ios-green)'
                      : factor.score >= 55
                        ? 'var(--ios-blue)'
                        : 'var(--ios-orange)',
                  transition: 'width 0.5s var(--ease-out-soft)',
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-caption-2 tnum text-label-tertiary">
              {percent(factor.weight * 100)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
