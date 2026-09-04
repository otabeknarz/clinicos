import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { deleteService, listServices } from '@/api/services'
import { ServiceFormModal } from '@/components/modals/ServiceFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { SERVICE_CATEGORIES } from '@/i18n/data'
import { money } from '@/lib/format'
import { SERVICE_LABEL, SERVICE_TONE } from '@/lib/status'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { Service } from '@/types/models'

export function ServicesPage() {
  const { t, tCategory, tService } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<Service | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Service | null>(null)

  const debounced = useDebounced(search, 250)
  const { data, loading, error, reload } = useAsync(
    () => listServices(debounced, category),
    [debounced, category],
  )

  const remove = useAction(async (id: string) => deleteService(id))

  async function confirmDelete() {
    if (!deleting) return
    await remove.run(deleting.id)
    toast.success(t('toast.deleted'))
    setDeleting(null)
    reload()
  }

  const manage = can('services.manage')

  const columns: Column<Service>[] = [
    {
      key: 'service',
      header: t('services.col.service'),
      render: (row) => <span className="font-medium text-label">{tService(row.name)}</span>,
    },
    {
      key: 'category',
      header: t('common.category'),
      hideBelow: 'sm',
      render: (row) => <span className="text-label-secondary">{tCategory(row.category)}</span>,
    },
    {
      key: 'duration',
      header: t('common.duration'),
      align: 'right',
      hideBelow: 'xl',
      render: (row) => (
        <span className="tnum text-label-secondary">
          {row.durationMinutes} {t('common.min')}
        </span>
      ),
    },
    {
      key: 'timing',
      header: t('services.col.timing'),
      hideBelow: 'md',
      render: (row) => (
        <Badge tone={row.paymentTiming === 'prepaid' ? 'warn' : 'neutral'}>
          {t(`serviceForm.${row.paymentTiming}`)}
        </Badge>
      ),
    },
    {
      key: 'loyalty',
      header: t('services.col.loyalty'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) =>
        row.loyaltyTiers.length === 0 ? (
          <span className="text-caption text-label-quaternary">—</span>
        ) : (
          <span className="text-caption tnum text-ok">
            {row.loyaltyTiers
              .map((tier) => `${tier.afterVisits}→${tier.discountPct}%`)
              .join(', ')}
          </span>
        ),
    },
    {
      key: 'price',
      header: t('common.price'),
      align: 'right',
      render: (row) => <span className="font-semibold tnum text-label">{money(row.price)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <Badge tone={SERVICE_TONE[row.status]}>{t(SERVICE_LABEL[row.status])}</Badge>
      ),
    },
    ...(manage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 'w-24',
            render: (row: Service) => (
              <div className="flex justify-end gap-1">
                <IconButton
                  label={t('action.edit')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(row)
                    setFormOpen(true)
                  }}
                >
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  label={t('action.delete')}
                  className="hover:text-bad"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleting(row)
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={t('services.title')}
        subtitle={loading ? undefined : `${data?.length ?? 0}`}
        primaryAction={
          manage
            ? {
                icon: <Plus size={16} />,
                label: t('services.add'),
                shortLabel: t('action.add'),
                onClick: () => {
                  setEditing(null)
                  setFormOpen(true)
                },
              }
            : undefined
        }
      />

      <Card padded={false}>
        <div className="hairline flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('action.search')}
            icon={<Search size={16} />}
            className="sm:max-w-xs"
          />
          <FilterPills
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: t('common.all') },
              ...SERVICE_CATEGORIES.map((key) => ({ value: key, label: tCategory(key) })),
            ]}
            className="sm:ml-auto"
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <DataTable
            rows={data ?? []}
            columns={columns}
            loading={loading}
            emptyState={<EmptyState />}
            renderMobile={(row) => (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-label">{tService(row.name)}</p>
                  <p className="truncate text-caption text-label-tertiary">
                    {tCategory(row.category)} · {t(`serviceForm.${row.paymentTiming}`)}
                    {row.loyaltyTiers.length > 0
                      ? ` · −${Math.max(...row.loyaltyTiers.map((x) => x.discountPct))}%`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tnum text-label">{money(row.price)}</span>
              </div>
            )}
          />
        )}
      </Card>

      <ServiceFormModal
        open={formOpen}
        service={editing}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={remove.pending}
      />
    </>
  )
}
