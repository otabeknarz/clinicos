import { useState } from 'react'
import { Search } from 'lucide-react'

import { listMedicines, LOW_STOCK } from '@/api/pharmacy'
import type { MedicineStock } from '@/types/pharmacy'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { DataTable } from '@/components/ui/Table'
import { Segmented } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateShort, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * DORILAR KATALOGI.
 *
 * Zaxira ustuni PARTIYALARDAN yig'iladi — dorining o'zida "qancha
 * bor" degan ustun yo'q. Bo'lganida u partiyalar bilan darrov
 * ziddiyatga tushardi: bittasi sotilganda ikkalasini ham
 * yangilash kerak bo'lardi va bittasi unutilardi.
 */
export function PharmacyMedicinesPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState<'all' | 'low' | 'out'>('all')

  const { data, loading } = useAsync(() => listMedicines({ search, stock }), [search, stock])
  const rows = data ?? []

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('nav.pharmacyMedicines')}
          subtitle={loading ? undefined : t('pharmacy.medicineCount', { count: rows.length })}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SearchInput
            className="min-w-0 flex-1"
            value={search}
            onChange={setSearch}
            icon={<Search size={16} />}
            placeholder={t('pharmacy.searchCatalog')}
          />
          <Segmented
            value={stock}
            onChange={setStock}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'low', label: t('pharmacy.lowStock') },
              { value: 'out', label: t('pharmacy.outOfStock') },
            ]}
          />
        </div>
      </div>

      <DataTable<MedicineStock>
        rows={rows}
        loading={loading}
        emptyState={<EmptyState title={t('pharmacy.nothingFound')} />}
        columns={[
          {
            key: 'name',
            header: t('pharmacy.medicine'),
            render: (row) => (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-label">{row.name}</span>
                  {row.prescriptionOnly ? (
                    <Badge tone="warn">{t('pharmacy.rx')}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-caption text-label-tertiary">
                  {row.manufacturer} · {row.country}
                </p>
              </div>
            ),
          },
          {
            key: 'form',
            header: t('pharmacy.form'),
            hideBelow: 'lg',
            render: (row) => (
              <span className="text-label-secondary">{t(`pharmacy.form.${row.form}`)}</span>
            ),
          },
          {
            key: 'price',
            header: t('pharmacy.price'),
            align: 'right',
            render: (row) => (
              <span className="tabular-nums font-medium text-label">
                {money(row.sellPrice)}
              </span>
            ),
          },
          {
            key: 'stock',
            header: t('pharmacy.inStock'),
            align: 'right',
            render: (row) => <StockCell row={row} unit={row.unit} />,
          },
          {
            key: 'expiry',
            header: t('pharmacy.nearestExpiry'),
            align: 'right',
            hideBelow: 'md',
            render: (row) =>
              row.nearestExpiry ? (
                <span
                  className={cn(
                    'tabular-nums',
                    row.expiringSoon > 0 ? 'text-warn' : 'text-label-secondary',
                  )}
                >
                  {dateShort(row.nearestExpiry)}
                </span>
              ) : (
                <span className="text-label-quaternary">—</span>
              ),
          },
        ]}
        renderMobile={(row) => (
          <div className="min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 font-medium text-label">{row.name}</span>
              <span className="shrink-0 tabular-nums font-semibold text-label">
                {money(row.sellPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-caption text-label-tertiary">
              <span className="truncate">{row.manufacturer}</span>
              <StockCell row={row} unit={row.unit} />
            </div>
          </div>
        )}
      />
    </Card>
  )
}

/**
 * Qoldiq — rangi bilan.
 *
 * Nol qizil, kam sariq: aptekada bu ikkalasi boshqa-boshqa ish
 * talab qiladi. Tugagani sotib bo'lmaydi, tugab qolgani esa
 * BUYURTMA berish vaqti kelganini bildiradi.
 */
function StockCell({ row, unit }: { row: MedicineStock; unit: string }) {
  const { t } = useI18n()

  if (row.inStock === 0) {
    return <span className="font-semibold text-bad">{t('pharmacy.none')}</span>
  }

  return (
    <span
      className={cn(
        'tabular-nums font-semibold',
        row.inStock <= LOW_STOCK ? 'text-warn' : 'text-label',
      )}
    >
      {row.inStock} {unit}
    </span>
  )
}
