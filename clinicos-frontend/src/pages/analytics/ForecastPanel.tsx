import { lazy, Suspense, useState } from 'react'
import { AlertTriangle, Download, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'

import { forecastToRows, getForecast } from '@/api/forecast'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { datedFilename, downloadCsv } from '@/lib/csv'
import { money, percent } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { ForecastHorizon } from '@/types/models'

const ForecastChart = lazy(() => import('./ForecastChart'))

/**
 * Prognoz paneli.
 *
 * Egasi uchun eng qimmatli ekran: "keyingi choraklarda nima bo'ladi va
 * qachon xavf tug'iladi". Shuning uchun ogohlantirish tepada, raqamlar
 * ostida, grafik eng pastda turadi — muhimlik tartibida.
 */
export function ForecastPanel() {
  const { t } = useI18n()
  const toast = useToast()
  // Segmented matnli qiymat bilan ishlaydi, shuning uchun davr ham matn
  const [horizonKey, setHorizonKey] = useState<'3' | '6' | '12'>('6')
  const horizon = Number(horizonKey) as ForecastHorizon

  const { data, loading, error, reload } = useAsync(() => getForecast(horizon), [horizon])

  function exportCsv() {
    if (!data) return
    downloadCsv(datedFilename(`prognoz-${horizon}-oy`), forecastToRows(data))
    toast.success(t('export.done'))
  }

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('forecast.title')}
          subtitle={
            data ? t('forecast.basedOn', { months: data.basedOnMonths }) : t('forecast.subtitle')
          }
          action={
            <div className="flex items-center gap-2">
              <Segmented<'3' | '6' | '12'>
                size="sm"
                value={horizonKey}
                onChange={setHorizonKey}
                options={[
                  { value: '3', label: t('forecast.horizon.3') },
                  { value: '6', label: t('forecast.horizon.6') },
                  { value: '12', label: t('forecast.horizon.12') },
                ]}
              />
              <Button
                size="sm"
                variant="gray"
                icon={<Download size={14} />}
                onClick={exportCsv}
                disabled={!data}
              >
                <span className="hidden lg:inline">{t('export.csv')}</span>
              </Button>
            </div>
          }
        />
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading || !data ? (
        <CardSkeleton className="m-5 h-64 border-0 shadow-none" />
      ) : (
        <>
          {/* ============ Ogohlantirishlar ============ */}
          {data.warnings.length > 0 ? (
            <div className="space-y-2 px-5 pb-4 sm:px-6">
              {data.warnings.map((warning, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2.5 rounded-[12px] px-4 py-3',
                    warning.severity === 'bad' ? 'bg-bad-soft' : 'bg-warn-soft',
                  )}
                >
                  <AlertTriangle
                    size={16}
                    className={cn(
                      'mt-0.5 shrink-0',
                      warning.severity === 'bad' ? 'text-bad' : 'text-warn',
                    )}
                  />
                  <p
                    className={cn(
                      'text-subhead',
                      warning.severity === 'bad' ? 'text-bad' : 'text-warn',
                    )}
                  >
                    {t(warning.key, warning.vars)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 pb-4 sm:px-6">
              <div className="flex items-center gap-2.5 rounded-[12px] bg-ok-soft px-4 py-3">
                <ShieldCheck size={16} className="shrink-0 text-ok" />
                <p className="text-subhead text-ok">{t('forecast.risk.ok')}</p>
              </div>
            </div>
          )}

          {/* ============ Asosiy raqamlar ============ */}
          <div className="hairline-t grid gap-px bg-separator sm:grid-cols-3">
            <Figure
              label={t('forecast.revenue')}
              value={money(data.totals.revenue)}
              tone="accent"
            />
            <Figure
              label={t('forecast.expenses')}
              value={money(data.totals.expenses)}
              tone="warn"
            />
            <Figure
              label={data.totals.profit >= 0 ? t('forecast.profit') : t('forecast.loss')}
              value={money(Math.abs(data.totals.profit))}
              tone={data.totals.profit >= 0 ? 'ok' : 'bad'}
              emphasis
            />
          </div>

          {/* ============ O'sish va ishonchlilik ============ */}
          <div className="hairline-t grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-footnote text-label-secondary">
                  {data.growthRate >= 0 ? (
                    <TrendingUp size={14} className="text-ok" />
                  ) : (
                    <TrendingDown size={14} className="text-bad" />
                  )}
                  {t('forecast.growth')}
                </span>
                <span
                  className={cn(
                    'text-callout font-semibold tnum',
                    data.growthRate >= 0 ? 'text-ok' : 'text-bad',
                  )}
                >
                  {data.growthRate >= 0 ? '+' : ''}
                  {data.growthRate.toFixed(1)}%
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-footnote text-label-secondary">
                  {t('forecast.confidence')}
                </span>
                <span className="text-callout font-semibold tnum text-label">
                  {percent(data.confidence)}
                </span>
              </div>
              <ProgressBar
                value={data.confidence}
                tone={data.confidence >= 65 ? 'ok' : data.confidence >= 40 ? 'warn' : 'bad'}
                className="mt-2"
              />
            </div>
          </div>

          {/* ============ Zarardan chiqish ============ */}
          {data.breakEvenGap > 0 ? (
            <div className="hairline-t px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-[12px] bg-sunken px-4 py-3">
                <div className="min-w-0">
                  <p className="text-subhead font-medium text-label">
                    {t('forecast.breakEven')}
                  </p>
                  <p className="text-caption text-label-tertiary">
                    {t('forecast.breakEvenHint')}
                  </p>
                </div>
                <p className="text-title-3 font-bold tnum text-bad">
                  +{money(data.breakEvenGap)}
                </p>
              </div>
            </div>
          ) : null}

          {/* ============ Grafik ============ */}
          <div className="hairline-t p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-headline text-label">{t('forecast.chart')}</p>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Legend color="var(--ios-blue)" label={t('forecast.revenue')} />
                <Legend color="var(--ios-orange)" label={t('forecast.expenses')} />
                <Legend color="var(--label-tertiary)" label={t('forecast.projected')} dashed />
              </ul>
            </div>

            <Suspense fallback={<CardSkeleton className="h-72 border-0 shadow-none" />}>
              <ForecastChart forecast={data} />
            </Suspense>

            <p className="mt-4 text-caption text-label-tertiary">{t('forecast.disclaimer')}</p>
          </div>
        </>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function Figure({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string
  value: string
  tone: 'accent' | 'warn' | 'ok' | 'bad'
  emphasis?: boolean
}) {
  const TONE = {
    accent: 'text-accent',
    warn: 'text-warn',
    ok: 'text-ok',
    bad: 'text-bad',
  }

  return (
    <div className="bg-raised px-5 py-4 sm:px-6">
      <p className="text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 font-bold tnum',
          emphasis ? 'text-title-2' : 'text-title-3',
          TONE[tone],
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="h-0.5 w-5 rounded-full"
        style={
          dashed
            ? {
                background: `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 8px)`,
              }
            : { background: color }
        }
      />
      <span className="text-caption text-label-secondary">{label}</span>
    </li>
  )
}
