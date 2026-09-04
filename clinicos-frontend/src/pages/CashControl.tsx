import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

import { getCashControlReport } from '@/api/cashControl'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/KpiCard'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { FilterPills, Segmented } from '@/components/ui/Tabs'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import { rangeFromPreset } from '@/lib/dates'
import { dateShort, money, moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { DateRange, DateRangePreset, ShiftClosure } from '@/types/models'

/**
 * KASSA NAZORATI — faqat egasi uchun.
 *
 * Sahifaning butun mantig'i bitta savolga javob beradi:
 * "Ko'rsatilgan xizmatlar summasi kassaga tushgan pulga to'g'ri keladimi?"
 *
 * Xizmat ko'rsatilganini shifokor qayd qiladi, pulni administrator.
 * Ikki yozuvni turli odam kiritgani uchun ularning farqi haqiqiy signal.
 */
export function CashControlPage() {
  const { t } = useI18n()
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('30d'))

  const { data, loading, error, reload } = useAsync(
    () => getCashControlReport(range),
    [range.from, range.to],
  )

  return (
    <>
      <PageHeader
        title={t('cash.title')}
        subtitle={t('cash.subtitle')}
        actions={
          <Segmented<DateRangePreset>
            size="sm"
            value={range.preset}
            onChange={(preset) => setRange(rangeFromPreset(preset))}
            options={[
              { value: 'today', label: t('common.today') },
              { value: '7d', label: '7' },
              { value: '30d', label: '30' },
            ]}
          />
        }
      />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* --- Asosiy solishtiruv --- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<ClipboardCheck size={14} />}
              tone="neutral"
              label={t('cash.expected')}
              value={money(data.expected)}
            />
            <StatCard
              icon={<Wallet size={14} />}
              tone="accent"
              label={t('cash.collected')}
              value={money(data.collected)}
            />
            <GapCard gap={data.gap} />
          </div>

          {/* --- Signallar --- */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Signal
              tone={data.unpaidVisits.count > 0 ? 'warn' : 'ok'}
              label={t('cash.unpaidVisits')}
              value={String(data.unpaidVisits.count)}
              detail={moneyShort(data.unpaidVisits.amount)}
            />
            <Signal
              tone={data.pendingPayments.count > 0 ? 'warn' : 'ok'}
              label={t('cash.pending')}
              value={String(data.pendingPayments.count)}
              detail={moneyShort(data.pendingPayments.amount)}
            />
            <Signal
              tone="neutral"
              label={t('cash.refunds')}
              value={String(data.refunds.count)}
              detail={moneyShort(data.refunds.amount)}
              icon={<RotateCcw size={14} />}
            />
            <Signal
              tone={data.cancelledAfterCheckIn > 0 ? 'bad' : 'ok'}
              label={t('cash.cancelledAfterCheckIn')}
              value={String(data.cancelledAfterCheckIn)}
              detail={t('cash.cancelledHint')}
              icon={<AlertTriangle size={14} />}
            />
          </div>

          {/* --- Xodimlar kesimida --- */}
          <Card padded={false} className="mt-5">
            <div className="p-5 sm:p-6 sm:pb-3">
              <CardHeader title={t('cash.byUser')} />
            </div>

            {data.byUser.length === 0 ? (
              <EmptyState className="py-10" description="" />
            ) : (
              <ul className="pb-2">
                {data.byUser.map((row) => (
                  <li
                    key={row.userId}
                    className="hairline flex items-center gap-3 px-5 py-3 last:border-b-0 sm:px-6"
                  >
                    <Avatar name={row.userName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-subhead font-medium text-label">
                        {row.userName}
                      </p>
                      <p className="text-caption text-label-tertiary tnum">
                        {row.transactions} {t('cash.transactions')}
                      </p>
                    </div>
                    <span className="shrink-0 text-subhead font-semibold tnum text-label">
                      {money(row.collected)}
                    </span>
                    {row.shortfall > 0 ? (
                      <Badge tone="bad">
                        −{moneyShort(row.shortfall)}
                      </Badge>
                    ) : (
                      <Badge tone="ok" dot>
                        {t('cash.gapOk')}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* --- Smena yopishlari --- */}
          <Card padded={false} className="mt-5">
            <div className="p-5 sm:p-6 sm:pb-3">
              <CardHeader title={t('cash.shifts')} subtitle={t('cash.closeShiftHint')} />
            </div>

            <ShiftTable rows={data.shiftClosures} />
          </Card>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Farq kartasi                                                        */
/* ------------------------------------------------------------------ */

/**
 * Eng muhim raqam. Musbat farq = kassaga yetib kelmagan pul.
 * Shuning uchun u alohida ajratib ko'rsatiladi.
 */
function GapCard({ gap }: { gap: number }) {
  const { t } = useI18n()
  // Kichik farq normal (yaxlitlash, chegirma). 1% dan oshsa — signal.
  const alarming = gap > 0

  return (
    <div
      className={cn(
        'card squircle p-5',
        alarming && 'ring-1 ring-inset ring-bad/30',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-[7px]',
            alarming ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok',
          )}
        >
          {alarming ? <ShieldCheck size={14} /> : <CheckCircle2 size={14} />}
        </span>
        <p className="text-footnote text-label-secondary">{t('cash.gap')}</p>
      </div>

      <p
        className={cn(
          'mt-2.5 text-title-2 font-bold tnum',
          alarming ? 'text-bad' : 'text-ok',
        )}
      >
        {gap === 0 ? t('cash.gapOk') : money(gap)}
      </p>

      <p className="mt-1 text-caption text-label-tertiary">{t('cash.expectedHint')}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Signal kartasi                                                      */
/* ------------------------------------------------------------------ */

function Signal({
  tone,
  label,
  value,
  detail,
  icon,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  label: string
  value: string
  detail: string
  icon?: React.ReactNode
}) {
  const TONE_BG = {
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    neutral: 'bg-neutral-soft text-label-secondary',
  }

  return (
    <div className="card squircle p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption text-label-secondary">{label}</p>
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            TONE_BG[tone],
          )}
        >
          {icon ?? <AlertTriangle size={13} />}
        </span>
      </div>
      <p className="mt-2 text-title-3 font-bold tnum text-label">{value}</p>
      <p className="mt-0.5 text-caption text-label-tertiary">{detail}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Smenalar jadvali                                                    */
/* ------------------------------------------------------------------ */

/**
 * Smena yopishlari.
 *
 * Ketma-ketlik saqlanadi (eng yangisi tepada), lekin egasi bir bosishda
 * faqat muammoli smenalarni ajratib olishi mumkin: kam topshirilgan,
 * ko'p topshirilgan yoki tinch o'tgan kunlar.
 *
 * "Ko'p olingan" ham signal: u odatda yaxlitlash xatosi yoki oldingi
 * kunning kamomadini yopish urinishi bo'ladi.
 */
type ShiftFilter = 'all' | 'exact' | 'short' | 'over'

function ShiftTable({ rows }: { rows: ShiftClosure[] }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<ShiftFilter>('all')

  const exact = rows.filter((r) => r.difference === 0)
  const short = rows.filter((r) => r.difference < 0)
  const over = rows.filter((r) => r.difference > 0)

  const filtered =
    filter === 'exact' ? exact : filter === 'short' ? short : filter === 'over' ? over : rows

  const totalShortfall = short.reduce((sum, r) => sum + Math.abs(r.difference), 0)
  const totalSurplus = over.reduce((sum, r) => sum + r.difference, 0)

  const columns: Column<ShiftClosure>[] = [
    {
      key: 'date',
      header: t('common.date'),
      render: (row) => <span className="tnum text-label-secondary">{dateShort(row.date)}</span>,
    },
    {
      key: 'user',
      header: t('staff.col.employee'),
      render: (row) => <span className="font-medium text-label">{row.userName}</span>,
    },
    {
      key: 'expected',
      header: t('cash.expectedCash'),
      align: 'right',
      hideBelow: 'sm',
      render: (row) => <span className="tnum text-label-secondary">{money(row.expectedCash)}</span>,
    },
    {
      key: 'declared',
      header: t('cash.declaredCash'),
      align: 'right',
      render: (row) => <span className="tnum text-label">{money(row.declaredCash)}</span>,
    },
    {
      key: 'difference',
      header: t('cash.difference'),
      align: 'right',
      render: (row) =>
        row.difference === 0 ? (
          <Badge tone="ok" dot>
            {t('cash.gapOk')}
          </Badge>
        ) : (
          <Badge tone={row.difference < 0 ? 'bad' : 'warn'}>
            {row.difference > 0 ? '+' : '−'}
            {moneyShort(Math.abs(row.difference))}
          </Badge>
        ),
    },
  ]

  return (
    <>
      {/* --- Filtr va yig'indilar --- */}
      <div className="hairline space-y-3 px-5 pb-4 sm:px-6">
        <FilterPills<ShiftFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `${t('common.all')} · ${rows.length}` },
            { value: 'exact', label: `${t('cash.filter.exact')} · ${exact.length}` },
            { value: 'short', label: `${t('cash.filter.short')} · ${short.length}` },
            { value: 'over', label: `${t('cash.filter.over')} · ${over.length}` },
          ]}
        />

        {/* Kamomad va ortiqcha yig'indisi - filtrdan qat'i nazar ko'rinadi */}
        {totalShortfall > 0 || totalSurplus > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {totalShortfall > 0 ? (
              <span className="text-footnote text-label-secondary">
                {t('cash.totalShortfall')}:{' '}
                <span className="font-semibold tnum text-bad">
                  −{money(totalShortfall)}
                </span>
              </span>
            ) : null}
            {totalSurplus > 0 ? (
              <span className="text-footnote text-label-secondary">
                {t('cash.totalSurplus')}:{' '}
                <span className="font-semibold tnum text-warn">+{money(totalSurplus)}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        emptyState={
          <EmptyState
            title={rows.length === 0 ? t('cash.noShifts') : t('cash.noMatch')}
            description=""
            className="py-10"
          />
        }
        renderMobile={(row) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-label">{row.userName}</p>
              <p className="truncate text-caption text-label-tertiary tnum">
                {dateShort(row.date)} · {money(row.declaredCash)}
              </p>
            </div>
            {row.difference === 0 ? (
              <Badge tone="ok">{t('cash.gapOk')}</Badge>
            ) : (
              <Badge tone={row.difference < 0 ? 'bad' : 'warn'}>
                {row.difference > 0 ? '+' : '−'}
                {moneyShort(Math.abs(row.difference))}
              </Badge>
            )}
          </div>
        )}
      />
    </>
  )
}
