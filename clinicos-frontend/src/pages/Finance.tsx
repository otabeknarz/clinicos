import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Ban, Banknote, Paperclip, Plus, Scale, Wallet } from 'lucide-react'

import { getFinanceSummary, listFinanceEntries, listMyFinanceEntries, voidFinanceEntry } from '@/api/finance'
import { FinanceEntryModal, FinanceTypeIcon } from '@/components/modals/FinanceEntryModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { TextArea } from '@/components/ui/Form'
import { StatCard } from '@/components/ui/KpiCard'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills, Segmented } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { rangeFromPreset } from '@/lib/dates'
import { dateShort, money, moneyShort, time } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { DateRange, DateRangePreset, FinanceEntry, FinanceEntryType, FinanceSummary } from '@/types/models'

/**
 * KIRIM-CHIQIM.
 *
 * Bitta savolga javob: "Oy oxirida klinikada qancha pul qoldi va qolgani
 * qayerga ketdi?". Bemor to'lovlari (registrator yozgan) va qolgan hamma
 * pul — xarid, ijara, maosh, soliq — bir sahifada.
 *
 * IKKI KO'RINISH:
 *   `finance.view`   — butun hisobot va barcha yozuvlar (egasi, buxgalter)
 *   `finance.create` — faqat yozish va O'Z yozuvlari (kassadan pul
 *                      beradigan registrator). Klinikaning umumiy puli
 *                      unga ko'rinmaydi.
 */
export function FinancePage() {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const canView = can('finance.view')
  const canCreate = can('finance.create')
  const canVoid = can('finance.void')

  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('30d'))
  const [filter, setFilter] = useState<'all' | FinanceEntryType>('all')
  const [creating, setCreating] = useState<FinanceEntryType | null>(null)
  const [voiding, setVoiding] = useState<FinanceEntry | null>(null)
  const [viewing, setViewing] = useState<FinanceEntry | null>(null)

  const summary = useAsync(
    () => (canView ? getFinanceSummary(range) : Promise.resolve(null)),
    [range.from, range.to, canView],
  )
  const entries = useAsync(
    () => (canView ? listFinanceEntries(range) : listMyFinanceEntries(range)),
    [range.from, range.to, canView],
  )

  function reload() {
    summary.reload()
    entries.reload()
  }

  const rows = (entries.data ?? []).filter((e) => filter === 'all' || e.type === filter)

  return (
    <>
      <PageHeader
        title={t('finance.title')}
        subtitle={canView ? t('finance.subtitle') : t('finance.subtitleMine')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<DateRangePreset>
              size="sm"
              value={range.preset}
              onChange={(preset) => setRange(rangeFromPreset(preset))}
              options={[
                { value: 'today', label: t('common.today') },
                { value: '7d', label: '7' },
                { value: '30d', label: '30' },
                { value: 'year', label: t('finance.year') },
              ]}
            />
            {canCreate ? (
              <>
                <Button variant="gray" size="sm" icon={<ArrowDownLeft size={15} />} onClick={() => setCreating('income')}>
                  {t('finance.addIncome')}
                </Button>
                <Button size="sm" icon={<Plus size={15} />} onClick={() => setCreating('expense')}>
                  {t('finance.addExpense')}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {/* --- Hisobot: faqat `finance.view` --- */}
      {canView ? (
        summary.error ? (
          <Card className="mb-5">
            <ErrorState onRetry={summary.reload} />
          </Card>
        ) : summary.loading || !summary.data ? (
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <Overview data={summary.data} />
        )
      ) : null}

      {/* --- Yozuvlar --- */}
      <Card padded={false}>
        <div className="space-y-3 p-5 sm:p-6 sm:pb-4">
          <CardHeader
            title={canView ? t('finance.entries') : t('finance.myEntries')}
            subtitle={t('finance.entriesHint')}
          />
          <FilterPills<'all' | FinanceEntryType>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'expense', label: t('finance.expenses') },
              { value: 'income', label: t('finance.otherIncome') },
            ]}
          />
        </div>

        {entries.error ? (
          <ErrorState onRetry={entries.reload} />
        ) : (
          <EntriesTable
            rows={rows}
            loading={entries.loading}
            canVoid={canVoid}
            onVoid={setVoiding}
            onReceipts={setViewing}
            emptyAction={
              canCreate ? (
                <Button size="sm" icon={<Plus size={15} />} onClick={() => setCreating('expense')}>
                  {t('finance.addExpense')}
                </Button>
              ) : null
            }
          />
        )}
      </Card>

      <FinanceEntryModal
        open={creating !== null}
        initialType={creating ?? 'expense'}
        onClose={() => setCreating(null)}
        onSaved={reload}
      />

      <ReceiptsModal entry={viewing} onClose={() => setViewing(null)} />

      <VoidModal
        entry={voiding}
        onClose={() => setVoiding(null)}
        onDone={() => {
          toast.success(t('finance.voided'))
          reload()
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Umumiy ko'rinish                                                    */
/* ------------------------------------------------------------------ */

function Overview({ data }: { data: FinanceSummary }) {
  const { t } = useI18n()

  const expenses = data.byCategory.filter((c) => c.type === 'expense')
  const incomes = data.byCategory.filter((c) => c.type === 'income')

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<ArrowDownLeft size={14} />} tone="ok" label={t('finance.totalIncome')} value={money(data.income.total)} />
        <StatCard icon={<ArrowUpRight size={14} />} tone="bad" label={t('finance.totalExpense')} value={money(data.expense.total)} />
        <StatCard
          icon={<Scale size={14} />}
          tone={data.net >= 0 ? 'accent' : 'bad'}
          label={t('finance.net')}
          value={<span className={data.net < 0 ? 'text-bad' : undefined}>{money(data.net)}</span>}
        />
        <StatCard icon={<Banknote size={14} />} tone="warn" label={t('finance.cashOut')} value={money(data.expense.cash)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title={t('finance.daily')} subtitle={t('finance.dailyHint')} />
          <DailyBars daily={data.daily} />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title={t('finance.whereFrom')} />
          <ul className="mt-3 space-y-3">
            <ShareRow
              label={t('finance.fromPatients')}
              amount={data.income.patients}
              total={data.income.total}
              tone="ok"
              detail={`${t('payments.method.cash')} ${moneyShort(data.patientsByMethod.cash)} · ${t('payments.method.card')} ${moneyShort(data.patientsByMethod.card)}`}
            />
            {incomes.map((row) => (
              <ShareRow
                key={row.category}
                label={t(`finance.category.${row.category}`)}
                amount={row.amount}
                total={data.income.total}
                tone="ok"
              />
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-5 mt-5">
        <CardHeader
          title={t('finance.whereTo')}
          subtitle={data.voidedCount > 0 ? t('finance.voidedCount', { count: data.voidedCount }) : undefined}
        />
        {expenses.length === 0 ? (
          <EmptyState className="py-8" title={t('finance.noExpenses')} description="" />
        ) : (
          <ul className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {expenses.map((row) => (
              <ShareRow
                key={row.category}
                label={t(`finance.category.${row.category}`)}
                amount={row.amount}
                total={data.expense.total}
                tone="bad"
                detail={t('finance.entriesCount', { count: row.count })}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function ShareRow({
  label,
  amount,
  total,
  tone,
  detail,
}: {
  label: string
  amount: number
  total: number
  tone: 'ok' | 'bad'
  detail?: string
}) {
  const share = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-subhead text-label">{label}</span>
        <span className="shrink-0 text-subhead font-semibold tnum text-label">{money(amount)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill-4">
        <div
          className={cn('h-full rounded-full', tone === 'ok' ? 'bg-ok' : 'bg-bad')}
          style={{ width: `${Math.max(share, amount > 0 ? 2 : 0)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-caption text-label-tertiary">
        <span className="truncate">{detail ?? ''}</span>
        <span className="tnum">{share}%</span>
      </div>
    </li>
  )
}

/**
 * Kunlik ustunlar — yashil kirim, qizil chiqim.
 *
 * Grafik kutubxonasi ATAYLAB olinmadi: bu yerda bitta savol bor — "qaysi
 * kuni chiqim kirimdan oshib ketdi", unga ikki rangli ustun yetadi.
 * Uzun davrda (yil) kunlar haftalarga yig'iladi, aks holda 365 ta ustun
 * ipga aylanadi.
 */
function DailyBars({ daily }: { daily: FinanceSummary['daily'] }) {
  const { t } = useI18n()

  const buckets =
    daily.length > 62
      ? Array.from({ length: Math.ceil(daily.length / 7) }, (_, i) => {
          const week = daily.slice(i * 7, i * 7 + 7)
          return {
            date: week[0].date,
            income: week.reduce((s, d) => s + d.income, 0),
            expense: week.reduce((s, d) => s + d.expense, 0),
          }
        })
      : daily

  const max = Math.max(1, ...buckets.map((b) => Math.max(b.income, b.expense)))

  if (buckets.every((b) => b.income === 0 && b.expense === 0)) {
    return <EmptyState className="py-10" title={t('finance.noData')} description="" />
  }

  return (
    <div className="mt-4">
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label={t('finance.daily')}>
        {buckets.map((b) => (
          <div
            key={b.date}
            className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-px"
            title={`${dateShort(b.date)} · +${money(b.income)} · −${money(b.expense)}`}
          >
            <div className="w-1/2 rounded-t-[3px] bg-ok/80" style={{ height: `${(b.income / max) * 100}%` }} />
            <div className="w-1/2 rounded-t-[3px] bg-bad/80" style={{ height: `${(b.expense / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-caption text-label-tertiary tnum">
        <span>{dateShort(buckets[0].date)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ok" /> {t('finance.income')}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bad" /> {t('finance.expense')}
          </span>
        </span>
        <span>{dateShort(buckets[buckets.length - 1].date)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Yozuvlar jadvali                                                    */
/* ------------------------------------------------------------------ */

function EntriesTable({
  rows,
  loading,
  canVoid,
  onVoid,
  onReceipts,
  emptyAction,
}: {
  rows: FinanceEntry[]
  loading: boolean
  canVoid: boolean
  onVoid: (entry: FinanceEntry) => void
  onReceipts: (entry: FinanceEntry) => void
  emptyAction: React.ReactNode
}) {
  const { t } = useI18n()

  const amountCell = (row: FinanceEntry) => (
    <span
      className={cn(
        'whitespace-nowrap font-semibold tnum',
        row.voidedAt ? 'text-label-tertiary line-through' : row.type === 'expense' ? 'text-bad' : 'text-ok',
      )}
    >
      {row.type === 'expense' ? '−' : '+'}
      {money(row.amount)}
    </span>
  )

  const columns: Column<FinanceEntry>[] = [
    {
      key: 'date',
      header: t('common.date'),
      render: (row) => (
        <span className="whitespace-nowrap tnum text-label-secondary">
          {dateShort(row.occurredAt)} <span className="text-label-tertiary">{time(row.occurredAt)}</span>
        </span>
      ),
    },
    {
      key: 'what',
      header: t('finance.category'),
      render: (row) => (
        /* Kenglik cheklangan: uzun izoh jadvalni yon tomonga cho'zib, amal ustunini ekrandan chiqarardi */
        <div className="flex min-w-0 max-w-[16rem] items-center gap-3 lg:max-w-[20rem] 2xl:max-w-[28rem]">
          <FinanceTypeIcon type={row.type} voided={Boolean(row.voidedAt)} />
          <div className="min-w-0">
            <p className={cn('truncate font-medium', row.voidedAt ? 'text-label-tertiary' : 'text-label')}>
              {t(`finance.category.${row.category}`)}
              {row.counterparty ? <span className="font-normal text-label-secondary"> · {row.counterparty}</span> : null}
            </p>
            <p className="truncate text-caption text-label-tertiary">
              {row.voidedAt ? `${t('finance.voidedBy', { name: row.voidedByName ?? '—' })}: ${row.voidReason}` : row.note || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'method',
      header: t('finance.method'),
      hideBelow: 'md',
      render: (row) => (
        <Badge tone={row.method === 'cash' ? 'warn' : 'neutral'}>{t(`payments.method.${row.method}`)}</Badge>
      ),
    },
    {
      key: 'by',
      header: t('finance.recordedBy'),
      hideBelow: 'xl',
      render: (row) => <span className="whitespace-nowrap text-label-secondary">{row.createdByName}</span>,
    },
    {
      key: 'receipts',
      header: '',
      align: 'center',
      width: 'w-14',
      render: (row) => <ReceiptsButton row={row} onOpen={onReceipts} />,
    },
    { key: 'amount', header: t('finance.amount'), align: 'right', render: amountCell },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-28',
      render: (row) =>
        row.voidedAt ? (
          <Badge tone="neutral">{t('finance.voidedBadge')}</Badge>
        ) : canVoid ? (
          <Button variant="plain" size="sm" icon={<Ban size={14} />} onClick={() => onVoid(row)}>
            {t('finance.void')}
          </Button>
        ) : null,
    },
  ]

  return (
    <DataTable
      rows={rows}
      loading={loading}
      columns={columns}
      emptyState={
        <EmptyState
          className="py-12"
          icon={<Wallet size={22} />}
          title={t('finance.empty')}
          description={t('finance.emptyHint')}
          action={emptyAction}
        />
      }
      renderMobile={(row) => (
        <div className="flex items-center gap-3">
          <FinanceTypeIcon type={row.type} voided={Boolean(row.voidedAt)} />
          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-medium', row.voidedAt ? 'text-label-tertiary' : 'text-label')}>
              {t(`finance.category.${row.category}`)}
            </p>
            <p className="truncate text-caption text-label-tertiary">
              {dateShort(row.occurredAt)} · {t(`payments.method.${row.method}`)}
              {row.counterparty ? ` · ${row.counterparty}` : ''}
            </p>
          </div>
          <ReceiptsButton row={row} onOpen={onReceipts} />
          <div className="text-right">
            {amountCell(row)}
            {row.voidedAt ? (
              <p className="text-caption text-label-tertiary">{t('finance.voidedBadge')}</p>
            ) : canVoid ? (
              <button type="button" className="text-caption text-accent" onClick={() => onVoid(row)}>
                {t('finance.void')}
              </button>
            ) : null}
          </div>
        </div>
      )}
    />
  )
}

/** Biriktirilgan rasmlar soni — bosilsa ko'rish oynasi */
function ReceiptsButton({ row, onOpen }: { row: FinanceEntry; onOpen: (entry: FinanceEntry) => void }) {
  const { t } = useI18n()
  /* Demo bazada eski yozuvlarda maydon bo'lmasligi mumkin */
  if (!row.receipts?.length) return null
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(row)
      }}
      aria-label={t('finance.viewReceipts')}
      className="inline-flex items-center gap-1 rounded-full bg-fill-4 px-2 py-1 text-caption font-medium tnum text-label-secondary hover:bg-fill-3 hover:text-label"
    >
      <Paperclip size={12} />
      {row.receipts.length}
    </button>
  )
}

/**
 * Chek va hujjatlarni ko'rish. Rasm bosilsa to'liq o'lchamda yangi oynada
 * ochiladi — nakladnoydagi mayda raqamni o'qish uchun.
 */
function ReceiptsModal({ entry, onClose }: { entry: FinanceEntry | null; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={t('finance.receipts')}
      description={
        entry
          ? `${t(`finance.category.${entry.category}`)} · ${dateShort(entry.occurredAt)} · ${money(entry.amount)}`
          : undefined
      }
    >
      {entry ? (
        <div className="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3">
          {entry.receipts.map((src, index) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[12px] ring-1 ring-separator hover:ring-accent"
            >
              <img
                src={src}
                alt={`${t('finance.receipt')} ${index + 1}`}
                className="aspect-[3/4] w-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Bekor qilish                                                        */
/* ------------------------------------------------------------------ */

/**
 * Bekor qilish — sabab MAJBURIY. Yozuv o'chmaydi: summadan chiqadi,
 * ro'yxatda esa kim, qachon va nega bekor qilgani bilan qoladi.
 */
function VoidModal({
  entry,
  onClose,
  onDone,
}: {
  entry: FinanceEntry | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const action = useAction(async () => voidFinanceEntry(entry!.id, reason))
  const error = touched && reason.trim().length < 3 ? t('finance.voidReasonRequired') : undefined

  function close() {
    setReason('')
    setTouched(false)
    onClose()
  }

  async function submit() {
    setTouched(true)
    if (reason.trim().length < 3) return
    const result = await action.run()
    if (!result) {
      toast.error(action.lastError()?.message || t('toast.error'))
      return
    }
    onDone()
    close()
  }

  return (
    <Modal
      open={entry !== null}
      onClose={close}
      size="sm"
      title={t('finance.voidTitle')}
      description={t('finance.voidHint')}
      footer={
        <>
          {/* "Bekor qilish" ikki marta yozilmasin — yopish tugmasi boshqa so'z bilan */}
          <Button variant="gray" onClick={close}>
            {t('action.close')}
          </Button>
          <Button variant="danger" icon={<Ban size={16} />} loading={action.pending} onClick={submit}>
            {t('finance.voidConfirm')}
          </Button>
        </>
      }
    >
      {entry ? (
        <div className="space-y-4 pb-2">
          <div className="flex items-center gap-3 rounded-[12px] bg-sunken px-4 py-3">
            <FinanceTypeIcon type={entry.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-subhead font-medium text-label">
                {t(`finance.category.${entry.category}`)}
              </p>
              <p className="truncate text-caption text-label-tertiary">
                {dateShort(entry.occurredAt)} · {entry.createdByName}
              </p>
            </div>
            <span className="text-subhead font-semibold tnum text-label">{money(entry.amount)}</span>
          </div>
          <TextArea
            label={t('finance.voidReason')}
            required
            rows={3}
            autoFocus
            value={reason}
            error={error}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      ) : null}
    </Modal>
  )
}
