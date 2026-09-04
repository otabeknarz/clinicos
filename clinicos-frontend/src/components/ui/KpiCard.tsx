import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { DeltaBadge } from './Badge'
import { ProgressRing } from './Progress'
import { Skeleton } from './States'
import { cn } from '@/lib/cn'
import { useCountUp } from '@/lib/useCountUp'
import { percentDelta } from '@/lib/format'
import { deltaTone } from '@/lib/status'
import type { Tone } from '@/lib/status'
import type { Metric } from '@/types/models'

/**
 * KPI karta — bosh sahifaning asosiy elementi.
 *
 * Tuzilishi (spec bo'yicha):
 *   yuqori chap   — kichik ikonka
 *   yuqori o'ng   — kichik doiraviy indikator
 *   markaz        — katta qalin raqam
 *   past          — kichik kulrang izoh
 */
export function KpiCard({
  icon,
  tone = 'accent',
  label,
  value,
  unit,
  metric,
  caption,
  /** Kamayish yaxshi bo'lgan ko'rsatkichlar uchun (kelmaganlar soni) */
  lowerIsBetter = false,
  loading,
  className,
  to,
  countTo,
  format,
}: {
  icon: ReactNode
  tone?: Tone
  label: string
  value: ReactNode
  /** Raqamdan keyin kichik shriftda: "so'm", "%" va h.k. */
  unit?: string
  metric?: Metric
  caption?: ReactNode
  lowerIsBetter?: boolean
  loading?: boolean
  className?: string
  /**
   * Berilsa, karta bosiladigan havolaga aylanadi.
   *
   * Raqamni ko'rgan odamning navbatdagi savoli — "bu nimadan
   * iborat?". Karta o'sha ro'yxatga olib borsa, javob bir bosishda
   * topiladi.
   */
  to?: string
  /**
   * Berilsa, raqam noldan shu qiymatgacha sanab chiqadi.
   *
   * Faqat platforma panelida ishlatiladi: klinika panelida raqam
   * kuniga o'nlab marta ko'riladi va har safar sanash chalg'itadi.
   */
  countTo?: number
  /** Sanalayotgan raqamni matnga aylantirish */
  format?: (value: number) => string
}) {
  if (loading) {
    return (
      <div className={cn('card squircle p-4 sm:p-5', className)} aria-busy>
        <div className="flex items-start justify-between">
          <Skeleton className="h-8 w-8 rounded-[9px] sm:h-9 sm:w-9 sm:rounded-[10px]" />
          <Skeleton className="h-8 w-8 rounded-full sm:h-10 sm:w-10" />
        </div>
        <Skeleton className="mt-3 h-7 w-24 sm:mt-5 sm:h-8 sm:w-28" />
        <Skeleton className="mt-2 h-3 w-20 sm:mt-2.5 sm:w-24" />
      </div>
    )
  }

  const change = metric?.changePct ?? null
  const changeTone = deltaTone(change, lowerIsBetter)

  // Halqa to'ldirilishi: o'zgarish kattaligiga qarab (vizual signal).
  // 25% va undan yuqori o'zgarish — to'la halqa.
  const ringValue = change === null ? 0 : Math.min(100, (Math.abs(change) / 25) * 100)

  const shell = cn(
    'card card-interactive squircle block p-4 sm:p-5',
    to && 'cursor-pointer transition-transform duration-150 active:scale-[0.99]',
    className,
  )

  /*
    Havola bo'lsa `Link`, bo'lmasa oddiy `div`. Ikkalasini bitta
    o'zgaruvchiga yig'ish TypeScript uchun noqulay — `Link` `to`
    ni majburiy talab qiladi. Shuning uchun ichki qism alohida.
  */
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[9px] sm:h-9 sm:w-9 sm:rounded-[10px]',
            TONE_ICON[tone],
          )}
        >
          {icon}
        </span>

        {change !== null ? (
          <>
            {/* Telefonda halqa kichikroq — joy tejaladi.
                Ko'rinishni o'ram boshqaradi: `hidden` bilan `inline-flex`
                bir elementda to'qnashadi, shuning uchun alohida span. */}
            <span className="sm:hidden">
              <ProgressRing value={ringValue} tone={changeTone} size={30} thickness={3} />
            </span>
            <span className="hidden sm:block">
              <ProgressRing value={ringValue} tone={changeTone} size={40} thickness={3.5} />
            </span>
          </>
        ) : null}
      </div>

      <p className="mt-3 flex items-baseline gap-1 text-title-2 font-bold tnum text-label sm:mt-4 sm:text-title-1">
        <span className="truncate">
          {countTo !== undefined && format ? <CountUpValue target={countTo} format={format} /> : value}
        </span>
        {unit ? (
          <span className="shrink-0 text-footnote font-semibold text-label-secondary sm:text-callout">
            {unit}
          </span>
        ) : null}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mt-1.5">
        <p className="text-caption text-label-secondary sm:text-footnote">{label}</p>
        {change !== null ? (
          <DeltaBadge value={percentDelta(change)} tone={changeTone} />
        ) : null}
      </div>

      {/* Izoh telefonda yashiriladi — o'rniga ekranda ko'proq karta sig'adi */}
      {caption ? (
        <p className="mt-1 hidden text-caption text-label-tertiary sm:block">{caption}</p>
      ) : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-label-secondary',
  accent: 'bg-accent-soft text-accent',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
}

/**
 * Soddaroq statistika kartasi — sahifa tepasidagi uchta raqam uchun
 * (To'lovlar, Daromad sahifalari).
 */
export function StatCard({
  label,
  value,
  metric,
  icon,
  tone = 'accent',
  loading,
  lowerIsBetter,
  className,
}: {
  label: string
  value: ReactNode
  metric?: Metric
  icon?: ReactNode
  tone?: Tone
  loading?: boolean
  lowerIsBetter?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn('card squircle p-5', className)} aria-busy>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-32" />
      </div>
    )
  }

  const change = metric?.changePct ?? null

  return (
    <div className={cn('card squircle p-5', className)}>
      <div className="flex items-center gap-2">
        {icon ? (
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-[7px]', TONE_ICON[tone])}>
            {icon}
          </span>
        ) : null}
        <p className="text-footnote text-label-secondary">{label}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-title-2 font-bold tnum text-label">{value}</p>
        {change !== null ? (
          <DeltaBadge value={percentDelta(change)} tone={deltaTone(change, lowerIsBetter)} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * Sanalib chiqadigan raqam.
 *
 * Alohida komponent, chunki hook shart bilan chaqirilmaydi — uni
 * `KpiCard` ichida `countTo` bor-yo'qligiga qarab ishlatib bo'lmaydi.
 */
function CountUpValue({
  target,
  format,
}: {
  target: number
  format: (value: number) => string
}) {
  const current = useCountUp(target)
  return <>{format(current)}</>
}
