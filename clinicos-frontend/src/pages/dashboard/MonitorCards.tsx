import { Link } from 'react-router-dom'
import { ArrowRight, BedDouble, ShieldCheck } from 'lucide-react'

import { getCashControlReport } from '@/api/cashControl'
import { getWardStats } from '@/api/ward'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { rangeFromPreset } from '@/lib/dates'
import { money, moneyShort, percent } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * Egasining kuzatuv bloklari.
 *
 * CEO kundalik ishni bajarmaydi — u nazorat qiladi. Shuning uchun bosh
 * sahifada ikkita savolga darhol javob bo'lishi kerak:
 *   1. Statsionar qanchalik to'la? (bo'sh koyka = yo'qotilgan pul)
 *   2. Kassada farq bormi?
 */

/* ------------------------------------------------------------------ */
/* Statsionar bandligi                                                 */
/* ------------------------------------------------------------------ */

export function WardMonitorCard() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => getWardStats(rangeFromPreset('30d')),
    [],
  )

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  if (loading || !data) return <CardSkeleton className="min-h-44" />

  const freeBeds = data.totalBeds - data.occupiedBeds
  const occupancy = data.totalBeds ? (data.occupiedBeds / data.totalBeds) * 100 : 0

  return (
    <Card className="min-w-0">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-accent-soft text-accent">
              <BedDouble size={14} />
            </span>
            {t('ward.title')}
          </span>
        }
        action={
          <Link
            to="/ward"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            {t('action.view')}
            <ArrowRight size={14} />
          </Link>
        }
      />

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-title-1 font-bold tnum text-label">{percent(occupancy)}</span>
        <span className="text-footnote text-label-secondary">
          {data.occupiedBeds} / {data.totalBeds}
        </span>
      </div>

      <ProgressBar
        value={occupancy}
        tone={occupancy > 85 ? 'warn' : 'accent'}
        className="mt-3"
      />

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Figure label={t('ward.kpi.freeBeds')} value={String(freeBeds)} />
        <Figure label={t('ward.kpi.admitted')} value={String(data.admittedToday)} />
        <Figure
          label={t('ward.kpi.avgStay')}
          value={data.averageStayDays.toFixed(1)}
        />
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Kassa nazorati                                                      */
/* ------------------------------------------------------------------ */

export function CashMonitorCard() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => getCashControlReport(rangeFromPreset('30d')),
    [],
  )

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  if (loading || !data) return <CardSkeleton className="min-h-44" />

  const alarming = data.gap > 0
  const collectedPct = data.expected ? (data.collected / data.expected) * 100 : 100

  return (
    <Card className={cn('min-w-0', alarming && 'ring-1 ring-inset ring-bad/25')}>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-[7px]',
                alarming ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok',
              )}
            >
              <ShieldCheck size={14} />
            </span>
            {t('cash.title')}
          </span>
        }
        action={
          <Link
            to="/cash-control"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            {t('action.view')}
            <ArrowRight size={14} />
          </Link>
        }
      />

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className={cn('text-title-1 font-bold tnum', alarming ? 'text-bad' : 'text-ok')}
        >
          {data.gap === 0 ? t('cash.gapOk') : money(data.gap)}
        </span>
      </div>
      <p className="mt-1 text-caption text-label-tertiary">{t('cash.gap')}</p>

      <ProgressBar value={collectedPct} tone={alarming ? 'warn' : 'ok'} className="mt-3" />

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Figure
          label={t('cash.unpaidVisits')}
          value={String(data.unpaidVisits.count)}
          tone={data.unpaidVisits.count > 0 ? 'warn' : undefined}
        />
        <Figure
          label={t('cash.cancelledAfterCheckIn')}
          value={String(data.cancelledAfterCheckIn)}
          tone={data.cancelledAfterCheckIn > 0 ? 'bad' : undefined}
        />
        <Figure label={t('cash.collected')} value={moneyShort(data.collected)} />
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn' | 'bad'
}) {
  return (
    <div className="min-w-0">
      <dd
        className={cn(
          'text-callout font-semibold tnum',
          tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-label',
        )}
      >
        {value}
      </dd>
      <dt className="mt-0.5 truncate text-caption-2 text-label-tertiary">{label}</dt>
    </div>
  )
}
