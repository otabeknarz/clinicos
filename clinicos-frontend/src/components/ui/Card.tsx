import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Karta — barcha sahifalarning asosiy qurilish bloki.
 *
 * Apple sirti: oq fon, katta radius, deyarli ko'rinmas soya.
 * Qorong'i rejimda soya o'rniga yupqa chegara ishlaydi (`.card` ichida).
 */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('card squircle', padded && 'p-5 sm:p-6', className)}>{children}</section>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        /*
          Telefonda sarlavha va boshqaruv ustma-ust tushadi.

          NEGA: yonma-yon turganda "Moliyaviy prognoz" kabi sarlavha
          ikki-uch qatorga bo'linib ketardi, chunki yonidagi davr
          tanlagichi joyni olib qo'yadi.
        */
        'flex flex-col gap-3',
        'sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-headline text-label">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-footnote text-label-secondary">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/** Ichki bo'lim ajratgichi */
export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('hairline -mx-5 sm:-mx-6', className)} />
}
