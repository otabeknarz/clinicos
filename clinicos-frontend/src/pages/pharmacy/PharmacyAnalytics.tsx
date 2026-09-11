import { useState } from 'react'
import { PackageX } from 'lucide-react'

import { pharmacyAnalytics } from '@/api/pharmacy'
import { AreaTrend, RankedBars } from '@/components/charts/Charts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Tabs'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateCompact, money, moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * APTEKA ANALITIKASI — FAQAT RAHBAR KO'RADI.
 *
 * Sotuvchida bu sahifa yo'q va bu ataylab: hisobot uning O'Z
 * ishining tekshiruvi. Klinikada ham kassa nazorati registratorga
 * ochilmaydi — tekshiruv qanday chiqayotganini ko'rib turgan odam
 * farqni yopish yo'lini topib oladi.
 */
export function PharmacyAnalyticsPage() {
  const { t } = useI18n()
  const [days, setDays] = useState<'7' | '30' | '90'>('30')

  const { data, loading } = useAsync(() => pharmacyAnalytics(Number(days)), [days])

  if (loading || !data) return <CardSkeleton />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('nav.pharmacyAnalytics')}
          subtitle={t('pharmacy.periodHint', { count: days })}
          action={
            <Segmented
              value={days}
              onChange={setDays}
              options={[
                { value: '7', label: t('pharmacy.days7') },
                { value: '30', label: t('pharmacy.days30') },
                { value: '90', label: t('pharmacy.days90') },
              ]}
            />
          }
        />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label={t('pharmacy.revenue')} value={money(data.revenue)} />
        <Tile label={t('pharmacy.profit')} value={money(data.profit)} tone="good" />
        <Tile label={t('pharmacy.margin')} value={`${data.marginPct}%`} />
        <Tile label={t('pharmacy.receipts')} value={String(data.receipts)} />
        <Tile label={t('pharmacy.averageReceipt')} value={money(data.averageReceipt)} />
      </div>

      <Card>
        <CardHeader title={t('pharmacy.revenueTrend')} />
        <div className="mt-4">
          <AreaTrend
            data={data.byDay.map((day) => ({
              label: dateCompact(day.date),
              value: day.revenue,
            }))}
            format={(value) => money(value)}
            axisFormat={(value) => moneyShort(value)}
            gradientId="pharmacyRevenue"
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('pharmacy.topSellers')}
            subtitle={t('pharmacy.topSellersHint')}
          />
          <RankedBars
            className="mt-4"
            format={(value) => money(value)}
            items={data.top.map((item) => ({
              id: item.medicineId,
              label: (
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="block text-caption text-label-tertiary">
                    {item.quantity} {t('pharmacy.unitsSold')} ·{' '}
                    {t('pharmacy.profit')} {money(item.profit)}
                  </span>
                </span>
              ),
              value: item.revenue,
              sharePct: data.revenue ? (item.revenue / data.revenue) * 100 : 0,
            }))}
          />
        </Card>

        <Card>
          <CardHeader
            title={t('pharmacy.deadStock')}
            subtitle={t('pharmacy.deadStockHint')}
          />
          {data.dead.length === 0 ? (
            <EmptyState
              icon={<PackageX size={22} />}
              title={t('pharmacy.deadStockNone')}
            />
          ) : (
            <ul className="mt-3 divide-y divide-separator">
              {data.dead.map((item) => (
                <li
                  key={item.medicineId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-subhead text-label">
                      {item.name}
                    </span>
                    <span className="block text-caption text-label-tertiary">
                      {item.quantity} {t('pharmacy.left').toLowerCase()}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-warn">
                    {money(item.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good'
}) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-callout font-bold tabular-nums sm:text-title-3',
          tone === 'good' ? 'text-good' : 'text-label',
        )}
      >
        {value}
      </p>
    </Card>
  )
}
