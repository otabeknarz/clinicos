import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Receipt } from 'lucide-react'

import { listInvoices, markInvoicePaid } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/KpiCard'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { INVOICE_TONE } from './tone'
import { dateCompact, money, moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { InvoiceStatus, TenantInvoice } from '@/types/models'

const STATUSES: (InvoiceStatus | 'all')[] = ['all', 'overdue', 'pending', 'paid']

/**
 * HISOBLAR.
 *
 * Bu yerda pul kutiladi: kim to'lagan, kim to'lamagan, qancha
 * kechikkan. To'lanmaganlar ro'yxat boshida turadi.
 *
 * DASTURCHIGA: haqiqiy tizimda to'lov Payme/Click webhook orqali
 * belgilanadi. Qo'lda "to'landi" tugmasi faqat bank o'tkazmasi
 * kabi holatlar uchun qoladi.
 */
export function PlatformInvoicesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const status = (searchParams.get('status') as InvoiceStatus) ?? 'all'

  const { data, loading, error, reload } = useAsync(
    () => listInvoices({ status, page }),
    [status, page, version],
  )

  // Yuqoridagi hisob uchun — filtrdan mustaqil
  const all = useAsync(() => listInvoices({ pageSize: 1000 }), [version])

  const rows = all.data?.items ?? []
  const sumBy = (s: InvoiceStatus) =>
    rows.filter((i) => i.status === s).reduce((sum, i) => sum + i.amount, 0)

  async function markPaid(invoice: TenantInvoice) {
    setBusy(invoice.id)
    try {
      await markInvoicePaid(invoice.id)
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  const columns = [
    {
      key: 'tenant',
      header: t('platform.clinic'),
      render: (row: TenantInvoice) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.tenantName} size="xs" />
          <div className="min-w-0">
            <p className="truncate text-subhead font-medium text-label">
              {row.tenantName}
            </p>
            <p className="truncate text-caption text-label-tertiary">{row.planName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'period',
      header: t('platform.period'),
      hideBelow: 'md' as const,
      render: (row: TenantInvoice) => (
        <span className="text-footnote tnum text-label-secondary">{row.period}</span>
      ),
    },
    {
      key: 'due',
      header: t('platform.dueAt'),
      hideBelow: 'lg' as const,
      render: (row: TenantInvoice) => (
        <span className="text-footnote tnum text-label-secondary">
          {dateCompact(row.dueAt)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('common.amount'),
      align: 'right' as const,
      render: (row: TenantInvoice) => (
        <span className="text-subhead font-semibold tnum text-label">
          {money(row.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'center' as const,
      render: (row: TenantInvoice) => (
        <Badge tone={INVOICE_TONE[row.status]} dot>
          {t(`platform.invoice.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      width: 'w-32',
      render: (row: TenantInvoice) =>
        row.status === 'paid' ? null : (
          <Button
            variant="tinted"
            size="sm"
            icon={<Check size={14} />}
            loading={busy === row.id}
            onClick={(e) => {
              e.stopPropagation()
              void markPaid(row)
            }}
          >
            {t('platform.markPaid')}
          </Button>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('platform.invoices')}
        subtitle={t('platform.invoicesSubtitle')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={all.loading}
          icon={<Receipt size={14} />}
          tone="bad"
          label={t('platform.invoice.overdue')}
          value={moneyShort(sumBy('overdue'))}
        />
        <StatCard
          loading={all.loading}
          icon={<Receipt size={14} />}
          tone="warn"
          label={t('platform.invoice.pending')}
          value={moneyShort(sumBy('pending'))}
        />
        <StatCard
          loading={all.loading}
          icon={<Receipt size={14} />}
          tone="ok"
          label={t('platform.invoice.paid')}
          value={moneyShort(sumBy('paid'))}
        />
      </div>

      <Card padded={false} className="mt-5">
        <div className="hairline p-4 sm:p-5">
          <FilterPills<InvoiceStatus | 'all'>
            value={status}
            onChange={(v: InvoiceStatus | 'all') => {
              const next = new URLSearchParams(searchParams)
              if (v === 'all') next.delete('status')
              else next.set('status', v)
              setSearchParams(next, { replace: true })
              setPage(1)
            }}
            options={STATUSES.map((value) => ({
              value,
              label: value === 'all' ? t('common.all') : t(`platform.invoice.${value}`),
            }))}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <>
            <DataTable<TenantInvoice>
              rows={data?.items ?? []}
              columns={columns}
              loading={loading}
              emptyState={
                <EmptyState
                  icon={<Receipt size={24} strokeWidth={1.75} />}
                  title={t('platform.noInvoices')}
                  description=""
                />
              }
              /*
                Telefonda kartochka: klinika, davr va summa bir joyda,
                "To'landi" tugmasi esa butun kenglikda — asosiy amal
                barmoq bilan aniq bosiladigan bo'lsin.
              */
              renderMobile={(row) => (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <Avatar name={row.tenantName} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-subhead font-medium text-label">
                        {row.tenantName}
                      </p>
                      <p className="truncate text-caption text-label-tertiary">
                        {row.planName} · {row.period}
                      </p>
                    </div>
                    <Badge tone={INVOICE_TONE[row.status]} dot>
                      {t(`platform.invoice.${row.status}`)}
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-caption text-label-tertiary">
                      {t('platform.dueAt')}: {dateCompact(row.dueAt)}
                    </span>
                    <span className="text-subhead font-semibold tnum text-label">
                      {money(row.amount)}
                    </span>
                  </div>

                  {row.status === 'paid' ? null : (
                    <Button
                      variant="tinted"
                      size="sm"
                      className="w-full"
                      icon={<Check size={14} />}
                      loading={busy === row.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void markPaid(row)
                      }}
                    >
                      {t('platform.markPaid')}
                    </Button>
                  )}
                </div>
              )}
            />

            <Pagination
              page={page}
              pageSize={20}
              total={data?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  )
}
