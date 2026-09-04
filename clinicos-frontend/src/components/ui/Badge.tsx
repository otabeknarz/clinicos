import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/status'

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-label-secondary',
  accent: 'bg-accent-soft text-accent',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-neutral',
  accent: 'bg-accent',
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
}

/**
 * Holat belgisi.
 *
 * Apple uslubi: rangli fon emas, YUMSHOQ rangli fon + to'yingan matn.
 * Shu tufayli jadvalda o'nlab badge bo'lsa ham ko'z charchamaydi.
 */
export function Badge({
  tone = 'neutral',
  children,
  dot,
  className,
}: {
  tone?: Tone
  children: ReactNode
  /** Chap tomonda kichik nuqta */
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-caption font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} /> : null}
      {children}
    </span>
  )
}

/** O'zgarish ko'rsatkichi: +12.4% / -2.1% */
export function DeltaBadge({
  value,
  tone,
  className,
}: {
  value: string
  tone: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5',
        'text-caption font-semibold tnum',
        TONES[tone],
        className,
      )}
    >
      {value}
    </span>
  )
}
