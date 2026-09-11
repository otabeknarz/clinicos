import { useState } from 'react'
import { PackageCheck, TriangleAlert } from 'lucide-react'

import { listBatches, pharmacySummary } from '@/api/pharmacy'
import type { BatchRow } from '@/api/pharmacy'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/Table'
import { Segmented } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateShort, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * ZAXIRA — PARTIYALAR BO'YICHA.
 *
 * Aptekaning asosiy yo'qotishi — muddati o'tib ketgan tovar.
 * Shuning uchun ro'yxat sana bo'yicha emas, MUDDATIGACHA QOLGAN
 * KUN bo'yicha tartiblanadi: eng yaqinlari doim tepada turadi va
 * ularni ko'rmaslikning iloji yo'q.
 */
export function PharmacyStockPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all')

  const summary = useAsync(pharmacySummary, [])
  const { data, loading } = useAsync(() => listBatches(filter), [filter])
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label={t('pharmacy.stockValue')}
          value={money(summary.data?.stockValue ?? 0)}
          hint={t('pharmacy.stockValueHint')}
        />
        <Tile
          label={t('pharmacy.expiringSoon')}
          value={String(summary.data?.expiringBatches ?? 0)}
          tone={summary.data?.expiringBatches ? 'warn' : undefined}
        />
        <Tile
          label={t('pharmacy.lowStock')}
          value={String(summary.data?.lowStock ?? 0)}
          tone={summary.data?.lowStock ? 'warn' : undefined}
        />
        <Tile
          label={t('pharmacy.outOfStock')}
          value={String(summary.data?.outOfStock ?? 0)}
          tone={summary.data?.outOfStock ? 'bad' : undefined}
        />
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6 sm:pb-4">
          <CardHeader
            title={t('nav.pharmacyStock')}
            subtitle={loading ? undefined : t('pharmacy.batchCount', { count: rows.length })}
            action={
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('common.all') },
                  { value: 'expiring', label: t('pharmacy.expiringSoon') },
                  { value: 'expired', label: t('pharmacy.expired') },
                ]}
              />
            }
          />
        </div>

        <DataTable<BatchRow>
          rows={rows}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<PackageCheck size={22} />}
              title={t('pharmacy.stockClean')}
              description={t('pharmacy.stockCleanHint')}
            />
          }
          columns={[
            {
              key: 'name',
              header: t('pharmacy.medicine'),
              render: (row) => (
                <div className="min-w-0">
                  <p className="font-medium text-label">{row.medicineName}</p>
                  <p className="mt-0.5 text-caption text-label-tertiary">
                    {t('pharmacy.batch')} {row.code} · {row.supplierName}
                  </p>
                </div>
              ),
            },
            {
              key: 'qty',
              header: t('pharmacy.quantity'),
              align: 'right',
              render: (row) => (
                <span className="tabular-nums font-medium text-label">
                  {row.quantity} {row.unit}
                </span>
              ),
            },
            {
              key: 'buy',
              header: t('pharmacy.buyPrice'),
              align: 'right',
              hideBelow: 'lg',
              render: (row) => (
                <span className="tabular-nums text-label-secondary">
                  {money(row.buyPrice)}
                </span>
              ),
            },
            {
              key: 'expiry',
              header: t('pharmacy.expires'),
              align: 'right',
              render: (row) => <ExpiryCell row={row} />,
            },
          ]}
          renderMobile={(row) => (
            <div className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-medium text-label">{row.medicineName}</span>
                <span className="shrink-0 tabular-nums font-semibold text-label">
                  {row.quantity} {row.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-caption">
                <span className="truncate text-label-tertiary">
                  {t('pharmacy.batch')} {row.code}
                </span>
                <ExpiryCell row={row} />
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  )
}

/**
 * Muddat — sana va qolgan kun birga.
 *
 * Yolg'iz sana yetarli emas: "12.11.2026" ni ko'rgan odam uni
 * bugungi kun bilan solishtirishi kerak bo'ladi. "43 kun qoldi"
 * esa o'sha zahoti tushunarli.
 */
function ExpiryCell({ row }: { row: BatchRow }) {
  const { t } = useI18n()

  if (row.daysLeft < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-bad">
        <TriangleAlert size={13} />
        {t('pharmacy.expired')}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-col items-end">
      <span
        className={cn(
          'tabular-nums',
          row.daysLeft <= 30
            ? 'font-semibold text-bad'
            : row.daysLeft <= 90
              ? 'font-semibold text-warn'
              : 'text-label-secondary',
        )}
      >
        {dateShort(row.expiresAt)}
      </span>
      {row.daysLeft <= 90 ? (
        <Badge tone={row.daysLeft <= 30 ? 'bad' : 'warn'}>
          {t('pharmacy.daysLeft', { count: row.daysLeft })}
        </Badge>
      ) : null}
    </span>
  )
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'warn' | 'bad'
}) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-callout font-bold tabular-nums sm:text-title-3',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
          !tone && 'text-label',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-caption text-label-quaternary">{hint}</p> : null}
    </Card>
  )
}
