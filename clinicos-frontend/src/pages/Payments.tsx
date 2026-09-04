import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarRange, Plus, Search, Wallet } from 'lucide-react'

import { getPaymentSummary, listPayments } from '@/api/payments'
import { PaymentFormModal } from '@/components/modals/PaymentFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { StatCard } from '@/components/ui/KpiCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { dateShort, money, moneyShort } from '@/lib/format'
import { PAYMENT_LABEL, PAYMENT_TONE } from '@/lib/status'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import type { PaymentExpanded, PaymentMethod, PaymentStatus } from '@/types/models'

const PAGE_SIZE = 15

export function PaymentsPage() {
  const { t, tService } = useI18n()
  const { can } = useAuth()

  /*
    Klinikaning haftalik/oylik aylanmasi — egasining raqami.
    Registratorga bugungi tushum yetarli (smena yopishda ham shu kerak).
  */
  const showTotals = can('revenue.view')
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all')
  const [status, setStatus] = useState<PaymentStatus | 'all'>(
    (searchParams.get('status') as PaymentStatus) ?? 'all',
  )
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const debounced = useDebounced(search, 250)

  const summary = useAsync(() => getPaymentSummary(), [])
  const { data, loading, error, reload } = useAsync(
    () => listPayments({ search: debounced, method, status, page, pageSize: PAGE_SIZE }),
    [debounced, method, status, page],
  )

  function refreshAll() {
    reload()
    summary.reload()
  }

  const columns: Column<PaymentExpanded>[] = [
    {
      key: 'date',
      header: t('common.date'),
      width: 'w-28',
      render: (row) => <span className="tnum text-label-secondary">{dateShort(row.paidAt)}</span>,
    },
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row) => <span className="font-medium text-label">{row.patient.fullName}</span>,
    },
    {
      key: 'doctor',
      header: t('common.doctor'),
      hideBelow: 'lg',
      render: (row) => <span className="text-label-secondary">{row.doctor.fullName}</span>,
    },
    {
      key: 'service',
      header: t('common.service'),
      hideBelow: 'md',
      render: (row) => (
        <span className="text-label-secondary">{tService(row.service.name)}</span>
      ),
    },
    {
      key: 'method',
      header: t('payments.col.method'),
      hideBelow: 'xl',
      render: (row) => (
        <span className="text-label-secondary">{t(`payments.method.${row.method}`)}</span>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      align: 'right',
      render: (row) => <span className="font-semibold tnum text-label">{money(row.amount)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      render: (row) => (
        <Badge tone={PAYMENT_TONE[row.status]} dot>
          {t(PAYMENT_LABEL[row.status])}
        </Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('payments.title')}
        actions={
          can('payments.create') ? (
            <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
              <span className="hidden sm:inline">{t('payments.add')}</span>
            </Button>
          ) : undefined
        }
      />

      {/*
        Yuqori statistika.

        Bugungi tushum HAMMAGA ko'rinadi — registrator kun davomida
        qancha yiqqanini bilishi kerak, smena yopishda ham shu kerak.

        Haftalik va oylik esa klinikaning umumiy aylanmasi: bu egasining
        raqami. Pul yig'uvchi odam umumiy rasmni bilmasa, tekshiruvni
        chalg'itish qiyinroq — tizimning firibgarlikka qarshi mantiqi
        shunga tayanadi.

        Egasi ishonadigan registratorga `extraPermissions` orqali
        `revenue.view` berib, ochib qo'yishi mumkin.
      */}
      <div className={cn('grid gap-4', showTotals && 'sm:grid-cols-3')}>
        <StatCard
          loading={summary.loading}
          icon={<Wallet size={14} />}
          tone="ok"
          label={t('payments.revenueToday')}
          value={summary.data ? moneyShort(summary.data.today) : '—'}
        />
        {showTotals ? (
          <>
            <StatCard
              loading={summary.loading}
              icon={<CalendarDays size={14} />}
              tone="accent"
              label={t('payments.revenueWeek')}
              value={summary.data ? moneyShort(summary.data.week) : '—'}
            />
            <StatCard
              loading={summary.loading}
              icon={<CalendarRange size={14} />}
              tone="brand"
              label={t('payments.revenueMonth')}
              value={summary.data ? moneyShort(summary.data.month) : '—'}
            />
          </>
        ) : null}
      </div>

      <Card padded={false} className="mt-5">
        <div className="hairline space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder={t('action.search')}
              icon={<Search size={16} />}
              className="sm:max-w-xs"
            />

            <FilterPills<PaymentMethod | 'all'>
              value={method}
              onChange={(v) => {
                setMethod(v)
                setPage(1)
              }}
              options={[
                { value: 'all', label: t('common.all') },
                { value: 'cash', label: t('payments.method.cash') },
                { value: 'card', label: t('payments.method.card') },
                { value: 'transfer', label: t('payments.method.transfer') },
              ]}
              className="sm:ml-auto"
            />
          </div>

          <FilterPills<PaymentStatus | 'all'>
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'paid', label: t('payments.status.paid') },
              { value: 'pending', label: t('payments.status.pending') },
              { value: 'refunded', label: t('payments.status.refunded') },
            ]}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <>
            <DataTable
              rows={data?.items ?? []}
              columns={columns}
              loading={loading}
              emptyState={<EmptyState />}
              renderMobile={(row) => (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-label">{row.patient.fullName}</p>
                    <p className="truncate text-caption text-label-tertiary">
                      {dateShort(row.paidAt)} · {t(`payments.method.${row.method}`)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tnum text-label">
                    {money(row.amount)}
                  </span>
                </div>
              )}
            />

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onChange={setPage}
              className="hairline-t"
            />
          </>
        )}
      </Card>

      <PaymentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refreshAll}
      />
    </>
  )
}
