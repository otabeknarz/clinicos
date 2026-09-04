import { useState } from 'react'

import { getRevenueSeries } from '@/api/analytics'
import type { RevenuePeriod } from '@/api/analytics'
import { AreaTrend } from '@/components/charts/Charts'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { compactNumber, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * Bosh sahifadagi daromad grafigi.
 *
 * ALOHIDA FAYLDA, chunki grafik kutubxonasi (recharts) katta — u faqat
 * shu karta kerak bo'lganda yuklanadi. Shu tufayli bosh sahifa
 * birinchi marta tezroq ochiladi.
 */
export default function RevenueCard() {
  const { t } = useI18n()
  const [period, setPeriod] = useState<RevenuePeriod>('week')
  const { data, loading, error, reload } = useAsync(() => getRevenueSeries(period), [period])

  const total = (data ?? []).reduce((sum, point) => sum + point.value, 0)

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('dash.revenue.title')}
        subtitle={loading ? undefined : money(total)}
        action={
          <Segmented
            size="sm"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'today', label: t('common.today') },
              { value: 'week', label: t('common.thisWeek') },
              { value: 'month', label: t('common.thisMonth') },
            ]}
          />
        }
      />

      <div className="mt-5">
        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <Skeleton className="h-[240px] w-full rounded-[14px]" />
        ) : (
          <AreaTrend
            data={data ?? []}
            format={(v) => money(v)}
            axisFormat={(v) => compactNumber(v)}
          />
        )}
      </div>
    </Card>
  )
}
