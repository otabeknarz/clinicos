import { useState } from 'react'
import { Receipt, TrendingUp, Wallet } from 'lucide-react'

import { getRevenueReport } from '@/api/payments'
import { AreaTrend, ChartLegend, DonutChart, RankedBars } from '@/components/charts/Charts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { TextInput } from '@/components/ui/Form'
import { StatCard } from '@/components/ui/KpiCard'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { rangeFromPreset } from '@/lib/dates'
import { compactNumber, money, moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { DateRange, DateRangePreset } from '@/types/models'

export function RevenuePage() {
  const { t, tService } = useI18n()

  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('30d'))

  const { data, loading, error, reload } = useAsync(
    () => getRevenueReport(range),
    [range.from, range.to],
  )

  function selectPreset(preset: DateRangePreset) {
    setRange(preset === 'custom' ? { ...range, preset } : rangeFromPreset(preset))
  }

  return (
    <>
      <PageHeader
        title={t('revenue.title')}
        subtitle={`${range.from} — ${range.to}`}
        actions={
          <Segmented<DateRangePreset>
            size="sm"
            value={range.preset}
            onChange={selectPreset}
            options={[
              { value: 'today', label: t('common.today') },
              { value: '7d', label: '7' },
              { value: '30d', label: '30' },
              { value: 'year', label: t('common.thisYear') },
              { value: 'custom', label: '…' },
            ]}
          />
        }
      />

      {/* --- Ixtiyoriy davr --- */}
      {range.preset === 'custom' ? (
        <Card className="mb-5">
          <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
            <TextInput
              label={t('common.from')}
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
            <TextInput
              label={t('common.to')}
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          {/* --- Asosiy raqamlar --- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              loading={loading}
              icon={<Wallet size={14} />}
              tone="ok"
              label={t('revenue.total')}
              value={data ? money(data.totalRevenue) : '—'}
            />
            <StatCard
              loading={loading}
              icon={<TrendingUp size={14} />}
              tone="accent"
              label={t('revenue.net')}
              value={data ? money(data.netRevenue) : '—'}
            />
            <StatCard
              loading={loading}
              icon={<Receipt size={14} />}
              tone="brand"
              label={t('revenue.transactions')}
              value={data ? String(data.transactions) : '—'}
            />
            <StatCard
              loading={loading}
              icon={<Wallet size={14} />}
              tone="neutral"
              label={t('revenue.averageCheck')}
              value={data ? money(data.averageCheck) : '—'}
            />
          </div>

          {/* --- Dinamika --- */}
          <Card className="mt-5">
            <CardHeader title={t('revenue.overTime')} />
            <div className="mt-5">
              {loading || !data ? (
                <CardSkeleton className="h-64 border-0 shadow-none" />
              ) : (
                <AreaTrend
                  data={data.overTime}
                  height={280}
                  format={(v) => money(v)}
                  axisFormat={(v) => compactNumber(v)}
                />
              )}
            </div>
          </Card>

          {/* --- Taqsimotlar --- */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('revenue.byDoctor')} />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <RankedBars items={data.byDoctor} format={(v) => moneyShort(v)} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t('revenue.byService')} />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <RankedBars
                    items={data.byService.slice(0, 8).map((item) => ({
                      ...item,
                      label: tService(item.label),
                    }))}
                    format={(v) => moneyShort(v)}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* --- To'lov usullari --- */}
          <Card className="mt-5">
            <CardHeader title={t('revenue.byMethod')} />
            {loading || !data ? (
              <CardSkeleton className="mt-5 h-48 border-0 shadow-none" />
            ) : (
              <div className="mt-5 grid items-center gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
                <DonutChart
                  data={data.byMethod.map((item) => ({
                    label: t(`payments.method.${item.label}`),
                    value: item.value,
                  }))}
                  format={(v) => money(v)}
                />
                <ChartLegend
                  items={data.byMethod.map((item) => ({
                    id: item.id,
                    label: t(`payments.method.${item.label}`),
                    value: item.value,
                  }))}
                  format={(v) => moneyShort(v)}
                />
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
