import { useState } from 'react'
import { Download, Repeat, Target, UserPlus, UserX, Wallet } from 'lucide-react'

import { getAnalyticsReport } from '@/api/analytics'
import { ForecastPanel } from './analytics/ForecastPanel'
import { AreaTrend, BarTrend, RankedBars } from '@/components/charts/Charts'
import { PageHeader } from '@/components/layout/PageHeader'
import { IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/KpiCard'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { rangeFromPreset } from '@/lib/dates'
import { datedFilename, downloadCsv } from '@/lib/csv'
import { compactNumber, groupDigits, money, moneyShort, percent } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { DateRange, DateRangePreset, SeriesPoint } from '@/types/models'

/**
 * Analitika.
 *
 * Maqsad: klinika egasi sahifani ochib, 30 soniyada biznesni tushunsin.
 * Shuning uchun tepada 5 ta asosiy raqam, ostida 4 ta grafik, eng pastda
 * reyting — boshqa hech narsa yo'q.
 */
export function AnalyticsPage() {
  const { t, tService } = useI18n()
  const toast = useToast()
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('30d'))

  const { data, loading, error, reload } = useAsync(
    () => getAnalyticsReport(range),
    [range.from, range.to],
  )

  return (
    <>
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        actions={
          <Segmented<DateRangePreset>
            size="sm"
            value={range.preset}
            onChange={(preset) => setRange(rangeFromPreset(preset))}
            options={[
              { value: '7d', label: '7' },
              { value: '30d', label: '30' },
              { value: 'year', label: t('common.thisYear') },
            ]}
          />
        }
      />

      {/* --- Moliyaviy prognoz: egasi uchun eng muhim blok --- */}
      <div className="mb-5">
        <ForecastPanel />
      </div>

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          {/* --- Asosiy ko'rsatkichlar --- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              loading={loading}
              icon={<Wallet size={14} />}
              tone="ok"
              label={t('revenue.total')}
              value={data ? moneyShort(data.revenue.value) : '—'}
              metric={data?.revenue}
            />
            <StatCard
              loading={loading}
              icon={<UserPlus size={14} />}
              tone="accent"
              label={t('dash.kpi.newPatients')}
              value={data ? groupDigits(data.newPatients.value) : '—'}
              metric={data?.newPatients}
            />
            <StatCard
              loading={loading}
              icon={<Repeat size={14} />}
              tone="brand"
              label={t('dash.kpi.returningPatients')}
              value={data ? groupDigits(data.returningPatients.value) : '—'}
              metric={data?.returningPatients}
            />
            <StatCard
              loading={loading}
              icon={<Target size={14} />}
              tone="accent"
              label={t('analytics.conversion')}
              value={data ? percent(data.conversionRate.value, 1) : '—'}
              metric={data?.conversionRate}
            />
            <StatCard
              loading={loading}
              icon={<UserX size={14} />}
              tone="bad"
              label={t('analytics.noShowRate')}
              value={data ? percent(data.noShowRate.value, 1) : '—'}
              metric={data?.noShowRate}
              lowerIsBetter
            />
          </div>

          {/* --- Grafiklar --- */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={t('analytics.revenueGrowth')}
                action={
                  <ExportButton
                    rows={seriesToRows(t('analytics.revenueGrowth'), data?.revenueGrowth)}
                    name="daromad-osishi"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <AreaTrend
                    data={data.revenueGrowth}
                    gradientId="revenueGrowth"
                    format={(v) => money(v)}
                    axisFormat={(v) => compactNumber(v)}
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t('analytics.patientGrowth')}
                action={
                  <ExportButton
                    rows={seriesToRows(t('analytics.patientGrowth'), data?.patientGrowth)}
                    name="bemorlar-osishi"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <AreaTrend
                    data={data.patientGrowth}
                    color="var(--ios-purple)"
                    gradientId="patientGrowth"
                    format={(v) => groupDigits(v)}
                    axisFormat={(v) => groupDigits(v)}
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t('analytics.appointments')}
                action={
                  <ExportButton
                    rows={seriesToRows(t('analytics.appointments'), data?.appointmentsSeries)}
                    name="qabullar"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <BarTrend
                    data={data.appointmentsSeries}
                    color="var(--ios-teal)"
                    format={(v) => groupDigits(v)}
                    axisFormat={(v) => groupDigits(v)}
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t('analytics.retention')}
                subtitle="%"
                action={
                  <ExportButton
                    rows={seriesToRows(t('analytics.retention'), data?.retentionSeries)}
                    name="ushlab-qolish"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <AreaTrend
                    data={data.retentionSeries}
                    color="var(--ios-green)"
                    gradientId="retention"
                    format={(v) => percent(v)}
                    axisFormat={(v) => percent(v)}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* --- Reytinglar --- */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={t('analytics.revenuePerDoctor')}
                action={
                  <ExportButton
                    rows={breakdownToRows(t('common.doctor'), data?.revenuePerDoctor)}
                    name="shifokor-daromadi"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <RankedBars items={data.revenuePerDoctor} format={(v) => moneyShort(v)} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={t('analytics.revenuePerService')}
                action={
                  <ExportButton
                    rows={breakdownToRows(
                      t('common.service'),
                      data?.revenuePerService.map((item) => ({
                        ...item,
                        label: tService(item.label),
                      })),
                    )}
                    name="xizmat-daromadi"
                    onDone={() => toast.success(t('export.done'))}
                  />
                }
              />
              <div className="mt-5">
                {loading || !data ? (
                  <CardSkeleton className="h-56 border-0 shadow-none" />
                ) : (
                  <RankedBars
                    items={data.revenuePerService.slice(0, 8).map((item) => ({
                      ...item,
                      label: tService(item.label),
                    }))}
                    format={(v) => moneyShort(v)}
                    colorful
                  />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Eksport                                                             */
/* ------------------------------------------------------------------ */

/**
 * Har bir tahlil blokini alohida CSV qilib yuklab olish.
 *
 * Egasi raqamlarni Excel'da ochib, o'zicha hisoblashi kerak - shuning
 * uchun har bir grafik yonida alohida tugma turadi.
 */
function ExportButton({
  rows,
  name,
  onDone,
}: {
  rows: (string | number)[][]
  name: string
  onDone: () => void
}) {
  const { t } = useI18n()

  return (
    <IconButton
      label={t('export.csv')}
      disabled={rows.length <= 1}
      onClick={() => {
        downloadCsv(datedFilename(name), rows)
        onDone()
      }}
    >
      <Download size={15} />
    </IconButton>
  )
}

/** Vaqt qatorini CSV qatorlariga aylantirish */
function seriesToRows(title: string, series?: SeriesPoint[]): (string | number)[][] {
  if (!series) return []
  return [['Davr', title], ...series.map((point) => [point.label, point.value])]
}

/** Taqsimotni CSV qatorlariga aylantirish */
function breakdownToRows(
  title: string,
  items?: { label: string; value: number; sharePct: number }[],
): (string | number)[][] {
  if (!items) return []
  return [
    [title, 'Summa', 'Ulush %'],
    ...items.map((item) => [item.label, item.value, item.sharePct.toFixed(1)]),
  ]
}
