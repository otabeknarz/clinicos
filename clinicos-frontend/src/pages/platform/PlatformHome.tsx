import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  LogIn,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react'

import { getPlatformStats, listImpersonations } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  compactNumber,
  currencyLabel,
  dateTime,
  groupDigits,
  money,
  moneyShort,
  percent,
} from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { PlatformStats } from '@/types/models'

/**
 * PLATFORMA BOSH SAHIFASI.
 *
 * Bu ClinicOS ning o'z biznesi haqidagi sahifa: nechta klinika,
 * qancha daromad, kim to'lamayapti, kim ketyapti.
 *
 * Klinikalarning ichki ishi bu yerda YO'Q. Bemorlar, tashriflar,
 * tashxislar — ularning birortasi ham platforma egasiga ko'rinmaydi.
 * Ko'rinadigan yagona narsa — sonlar (nechta shifokor, nechta bemor),
 * chunki ular tarif chegarasini tekshirish uchun kerak.
 */
export function PlatformHomePage() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => getPlatformStats(), [])

  return (
    <>
      <PageHeader title={t('platform.title')} subtitle={t('platform.subtitle')} />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              loading={loading}
              icon={<CircleDollarSign size={17} />}
              tone="ok"
              label={t('platform.mrr')}
              value={data ? compactNumber(data.mrr.value) : '—'}
              countTo={data?.mrr.value}
              format={compactNumber}
              unit={currencyLabel()}
              metric={data?.mrr}
              caption={t('platform.vsLastMonth')}
            />
            <KpiCard
              loading={loading}
              icon={<Building2 size={17} />}
              tone="accent"
              label={t('platform.payingClinics')}
              value={
                data ? groupDigits(data.tenants.active + data.tenants.pastDue) : '—'
              }
              countTo={data ? data.tenants.active + data.tenants.pastDue : undefined}
              format={(v) => groupDigits(Math.round(v))}
              caption={
                data ? t('platform.ofTotal', { count: data.tenants.total }) : undefined
              }
            />
            <KpiCard
              loading={loading}
              icon={<UserPlus size={17} />}
              tone="brand"
              label={t('platform.newThisMonth')}
              value={data ? groupDigits(data.newThisMonth.value) : '—'}
              metric={data?.newThisMonth}
              caption={t('platform.vsLastMonth')}
            />
            <KpiCard
              loading={loading}
              icon={<TrendingDown size={17} />}
              tone="bad"
              label={t('platform.churnRate')}
              value={data ? percent(data.churnRate, 1) : '—'}
              countTo={data?.churnRate}
              format={(v) => percent(v, 1)}
              lowerIsBetter
              caption={t('platform.churnHint')}
            />
          </div>

          {loading || !data ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <CardSkeleton className="min-h-72" />
              <CardSkeleton className="min-h-72" />
            </div>
          ) : (
            <>
              <AttentionRow data={data} />

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <PlanBreakdown data={data} />
                <GrowthCard data={data} />
              </div>

              <div className="mt-5">
                <ImpersonationCard />
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* E'tibor talab qiladiganlar                                          */
/* ------------------------------------------------------------------ */

/**
 * Pul bilan bog'liq ishlar bir joyda.
 *
 * Sinovda turganlar ham shu yerda: ularning muddati tugagach,
 * yo to'laydi, yo ketadi — aynan shu payt aralashuv foyda beradi.
 */
function AttentionRow({ data }: { data: PlatformStats }) {
  const { t } = useI18n()

  const items = [
    data.overdue.count > 0 && {
      key: 'overdue',
      tone: 'bad' as const,
      icon: <AlertTriangle size={16} />,
      title: t('platform.overdueInvoices', { count: data.overdue.count }),
      amount: data.overdue.amount,
      to: '/platform/invoices?status=overdue',
    },
    data.tenants.trial > 0 && {
      key: 'trial',
      tone: 'accent' as const,
      icon: <UserPlus size={16} />,
      title: t('platform.inTrial', { count: data.tenants.trial }),
      amount: 0,
      to: '/platform/clinics?status=trial',
    },
    data.tenants.suspended > 0 && {
      key: 'suspended',
      tone: 'warn' as const,
      icon: <Building2 size={16} />,
      title: t('platform.suspendedClinics', { count: data.tenants.suspended }),
      amount: 0,
      to: '/platform/clinics?status=suspended',
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item))

  if (items.length === 0) return null

  const TONE_ICON = {
    bad: 'bg-bad-soft text-bad',
    accent: 'bg-accent-soft text-accent',
    warn: 'bg-warn-soft text-warn',
  }

  return (
    <Card className="mt-5" padded={false}>
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <CardHeader title={t('platform.attention')} />
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.key} className="hairline last:border-b-0">
            <Link
              to={item.to}
              className="row-press flex items-center gap-3 px-5 py-3 sm:px-6"
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-[9px]',
                  TONE_ICON[item.tone],
                )}
              >
                {item.icon}
              </span>

              <span className="min-w-0 flex-1 truncate text-subhead font-medium text-label">
                {item.title}
              </span>

              {item.amount > 0 ? (
                <span className="text-subhead font-semibold tnum text-label">
                  {moneyShort(item.amount)}
                </span>
              ) : null}

              <ArrowRight size={16} className="shrink-0 text-label-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Tariflar kesimi                                                     */
/* ------------------------------------------------------------------ */

/**
 * Qaysi tarif qancha pul keltirayotgani.
 *
 * Klinikalar soni emas, DAROMAD ulushi ko'rsatiladi: 20 ta arzon
 * mijoz 5 ta qimmatidan kam pul keltirishi mumkin, va qaror shu
 * raqamga qarab qabul qilinadi.
 */
function PlanBreakdown({ data }: { data: PlatformStats }) {
  const { t } = useI18n()
  const total = data.byPlan.reduce((sum, p) => sum + p.mrr, 0)

  return (
    <Card className="min-w-0">
      <CardHeader title={t('platform.byPlan')} subtitle={t('platform.mrrShare')} />

      <ul className="mt-5 space-y-4">
        {data.byPlan.map((plan, index) => (
          <li key={plan.planId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-footnote font-medium text-label">{plan.planName}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-caption tnum text-label-tertiary">
                  {t('platform.clinicCount', { count: plan.count })}
                </span>
                <span className="text-footnote font-semibold tnum text-label">
                  {moneyShort(plan.mrr)}
                </span>
              </span>
            </div>
            <ProgressBar
              value={total > 0 ? (plan.mrr / total) * 100 : 0}
              tone={index === 2 ? 'brand' : index === 1 ? 'accent' : 'ok'}
              className="mt-2"
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-baseline justify-between gap-3 rounded-[12px] bg-sunken px-4 py-3">
        <span className="text-footnote text-label-secondary">{t('platform.mrr')}</span>
        <span className="text-title-3 font-bold tnum text-label">{money(total)}</span>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* O'sish                                                              */
/* ------------------------------------------------------------------ */

/**
 * Oxirgi 12 oydagi daromad — oddiy ustunlar bilan.
 *
 * Grafik kutubxonasi ATAYLAB ishlatilmagan: bu yerda 12 ta ustun
 * bor, ular uchun 390 KB'lik kutubxona yuklash ortiqcha. Batafsil
 * grafiklar "Tahlil" bo'limida.
 */
function GrowthCard({ data }: { data: PlatformStats }) {
  const { t } = useI18n()

  const max = Math.max(...data.history.map((h) => h.mrr), 1)
  const monthLabels = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('platform.growth')}
        subtitle={t('platform.growthHint')}
        action={
          <Badge tone={data.mrr.changePct && data.mrr.changePct >= 0 ? 'ok' : 'bad'}>
            <TrendingUp size={11} />
            {percent(data.mrr.changePct ?? 0, 1)}
          </Badge>
        }
      />

      <div className="mt-6 flex h-40 items-end gap-1.5">
        {data.history.map((row, index) => {
          const monthIndex = Number(row.period.slice(5, 7)) - 1
          const isLast = index === data.history.length - 1

          return (
            <div
              key={row.period}
              className="flex h-full min-w-0 flex-1 flex-col items-center gap-2"
            >
              {/*
                Ustun balandligi foizda beriladi, shuning uchun uni
                o'lchami aniq bo'lgan konteyner ichiga qo'yish kerak.
                Aks holda foiz nolga aylanadi va ustun ko'rinmaydi.
              */}
              <div className="flex w-full flex-1 items-end">
                <div
                  data-motion="bar"
                  className={cn(
                    'w-full rounded-t-[4px] transition-all',
                    isLast ? 'bg-accent' : 'bg-accent/35',
                  )}
                  style={{
                    height: `${Math.max(2, (row.mrr / max) * 100)}%`,
                    animationDelay: `${180 + index * 55}ms`,
                  }}
                  title={`${row.period} · ${money(row.mrr)}`}
                />
              </div>

              <span className="text-caption-2 text-label-tertiary">
                {monthLabels[monthIndex]}
              </span>
            </div>
          )
        })}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-caption text-label-tertiary">
            {t('platform.trialConversion')}
          </dt>
          <dd className="mt-0.5 text-subhead font-semibold tnum text-label">
            {percent(data.trialConversionRate)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-label-tertiary">{t('platform.avgCheck')}</dt>
          <dd className="mt-0.5 text-subhead font-semibold tnum text-label">
            {moneyShort(
              data.tenants.active + data.tenants.pastDue > 0
                ? data.mrr.value / (data.tenants.active + data.tenants.pastDue)
                : 0,
            )}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Klinika paneliga kirishlar                                          */
/* ------------------------------------------------------------------ */

/**
 * Yordam uchun klinika paneliga kirishlar tarixi.
 *
 * Bu yozuv o'z-o'zini nazorat qilish uchun: platforma egasi
 * klinikaning butun panelini ko'ra oladi, shuning uchun har bir
 * kirish sabab bilan qayd etiladi va ro'yxat ochiq turadi.
 */
function ImpersonationCard() {
  const { t } = useI18n()
  const { data, loading } = useAsync(() => listImpersonations(8), [])

  if (loading) return <CardSkeleton className="min-h-44" />

  const rows = data ?? []

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('platform.accessLog')}
          subtitle={t('platform.accessLogHint')}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<LogIn size={24} strokeWidth={1.75} />}
          title={t('platform.accessLogEmpty')}
          description=""
          className="py-10"
        />
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="hairline last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <LogIn size={15} className="shrink-0 text-label-tertiary" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote font-medium text-label">
                    {row.tenantName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {row.reason}
                  </span>
                </span>

                <span className="shrink-0 text-caption tnum text-label-tertiary">
                  {dateTime(row.startedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
