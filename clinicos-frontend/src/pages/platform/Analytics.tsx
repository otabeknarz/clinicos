import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Info,
  PieChart,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'

import { getPlatformAnalytics } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  compactNumber,
  currencyLabel,
  money,
  moneyShort,
  monthsShort,
  percent,
} from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { PlatformAnalytics } from '@/types/models'

/**
 * PLATFORMA ANALITIKASI — butun tarmoq bo'yicha.
 *
 * Bosh sahifa bizning biznesimiz haqida, bu esa MIJOZLARIMIZNING
 * biznesi haqida: klinikalar qancha aylanma qilmoqda, qancha foyda
 * qolmoqda, qaysi shifokorlar ko'proq daromad keltirmoqda, odamlar
 * nima bilan kelmoqda.
 *
 * NEGA KERAK: mijozning biznesi o'sib borsa, bizning obunamiz ham
 * o'sadi. Tushib ketsa — u ketishidan oldin bilishimiz kerak.
 */
export function PlatformAnalyticsPage() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => getPlatformAnalytics(), [])

  return (
    <>
      <PageHeader title={t('analytics.platformTitle')} subtitle={t('analytics.platformSubtitle')} />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              loading={loading}
              icon={<Activity size={17} />}
              tone="accent"
              label={t('analytics.turnover')}
              value={data ? compactNumber(data.turnover.value) : '—'}
              countTo={data?.turnover.value}
              format={compactNumber}
              unit={currencyLabel()}
              metric={data?.turnover}
              caption={t('platform.vsLastMonth')}
            />
            <KpiCard
              loading={loading}
              icon={<TrendingUp size={17} />}
              tone="ok"
              label={t('analytics.profit')}
              value={data ? compactNumber(data.estimatedProfit.value) : '—'}
              countTo={data?.estimatedProfit.value}
              format={compactNumber}
              unit={currencyLabel()}
              metric={data?.estimatedProfit}
              caption={t('analytics.profitCaption')}
            />
            <KpiCard
              loading={loading}
              icon={<CircleDollarSign size={17} />}
              tone="brand"
              label={t('analytics.ourRevenue')}
              value={data ? compactNumber(data.ourRevenue.value) : '—'}
              countTo={data?.ourRevenue.value}
              format={compactNumber}
              unit={currencyLabel()}
              metric={data?.ourRevenue}
              caption={t('platform.vsLastMonth')}
            />
            <KpiCard
              loading={loading}
              icon={<PieChart size={17} />}
              tone="accent"
              label={t('analytics.takeRate')}
              value={data ? percent(data.takeRate, 2) : '—'}
              countTo={data?.takeRate}
              format={(v) => percent(v, 2)}
              caption={t('analytics.takeRateCaption')}
            />
          </div>

          {/* Foyda taxminiy ekani yashirilmaydi */}
          {data ? (
            <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-fill-4 px-4 py-3 text-caption text-label-secondary">
              <Info size={14} className="mt-0.5 shrink-0" />
              {t('analytics.profitNote', { share: percent(data.payrollShare) })}
            </p>
          ) : null}

          {loading || !data ? (
            <div className="mt-5 grid gap-5">
              <CardSkeleton className="min-h-72" />
              <CardSkeleton className="min-h-72" />
            </div>
          ) : (
            <>
              <div className="mt-5">
                <MoneyChart data={data} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <ClinicsCard data={data} />
                <DoctorsCard data={data} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <PaidDoctorsCard data={data} />
                <ConditionsCard data={data} />
              </div>

              <div className="mt-5">
                <SpecialtyRevenueCard data={data} />
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Pul oqimi                                                           */
/* ------------------------------------------------------------------ */

/**
 * Uchta chiziq bitta grafikda: aylanma, foyda va bizning ulushimiz.
 *
 * Nega birga: ular bir-biriga bog'liq. Aylanma o'sib, bizning
 * ulushimiz o'smasa — narx siyosati orqada qolgan degani.
 */
function MoneyChart({ data }: { data: PlatformAnalytics }) {
  const { t } = useI18n()
  const labels = monthsShort()

  const max = Math.max(...data.history.map((h) => h.turnover), 1)

  return (
    <Card className="min-w-0">
      <CardHeader title={t('analytics.moneyFlow')} subtitle={t('platform.growthHint')} />

      <div className="mt-6 flex h-52 items-end gap-2">
        {data.history.map((row, index) => {
          const isLast = index === data.history.length - 1

          return (
            <div
              key={row.period}
              className="flex h-full min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex w-full flex-1 items-end">
                {/* Aylanma — orqa ustun */}
                <div
                  data-motion="bar"
                  className={cn(
                    'w-full rounded-t-[4px]',
                    isLast ? 'bg-accent/30' : 'bg-accent/15',
                  )}
                  style={{
                    height: `${Math.max(2, (row.turnover / max) * 100)}%`,
                    animationDelay: `${180 + index * 55}ms`,
                  }}
                  title={`${t('analytics.turnover')}: ${money(row.turnover)}`}
                />

                {/* Foyda — ustiga tushadigan ustun */}
                <div
                  data-motion="bar"
                  className={cn(
                    'absolute bottom-0 left-0 w-full rounded-t-[4px]',
                    isLast ? 'bg-ok' : 'bg-ok/45',
                  )}
                  style={{
                    height: `${Math.max(1, (row.profit / max) * 100)}%`,
                    animationDelay: `${240 + index * 55}ms`,
                  }}
                  title={`${t('analytics.profit')}: ${money(row.profit)}`}
                />

              </div>

              <span className="text-caption-2 text-label-tertiary">
                {labels[Number(row.period.slice(5, 7)) - 1]}
              </span>
            </div>
          )
        })}
      </div>

      {/*
        Bizning daromadimiz bu grafikda YO'Q va bo'lmasligi ham kerak:
        u aylanmaning ikki foizi, bir shkalada ko'rinmaydigan chiziqqa
        aylanadi. Uni alohida shkalaga qo'yish esa grafikni aldamchi
        qiladi. Shuning uchun u pastda alohida qator bo'lib turadi.
      */}
      <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {[
          { key: 'turnover', color: 'bg-accent/30', label: t('analytics.turnover') },
          { key: 'profit', color: 'bg-ok', label: t('analytics.profit') },
        ].map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span className={cn('size-3 rounded-[4px]', item.color)} />
            <span className="text-caption text-label-secondary">{item.label}</span>
          </li>
        ))}
      </ul>

      {/* --- Bizning daromadimiz alohida --- */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[12px] bg-sunken px-4 py-3">
        <span className="size-3 shrink-0 rounded-[4px] bg-brand" />
        <span className="min-w-0 flex-1 text-footnote text-label-secondary">
          {t('analytics.ourRevenue')}
        </span>
        <span className="text-subhead font-semibold tnum text-label">
          {money(data.ourRevenue.value)}
        </span>
        <span className="text-caption tnum text-label-tertiary">
          {percent(data.takeRate, 2)} {t('analytics.takeRateCaption')}
        </span>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Eng kuchli klinikalar                                               */
/* ------------------------------------------------------------------ */

function ClinicsCard({ data }: { data: PlatformAnalytics }) {
  const { t } = useI18n()
  const max = Math.max(...data.topClinics.map((c) => c.turnover), 1)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('analytics.topClinics')}
          subtitle={t('analytics.topClinicsHint')}
          action={
            <Link
              to="/platform/clinics"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          }
        />
      </div>

      <ul>
        {data.topClinics.map((clinic, index) => (
          <li key={clinic.tenantId} className="hairline last:border-b-0">
            <Link
              to={`/platform/clinics/${clinic.tenantId}`}
              className="row-press block px-5 py-3 sm:px-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-5 shrink-0 text-caption tnum text-label-quaternary">
                  {index + 1}
                </span>

                <Avatar name={clinic.name} size="xs" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subhead font-medium text-label">
                    {clinic.name}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {clinic.city} · {clinic.planName}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-footnote font-semibold tnum text-label">
                    {moneyShort(clinic.turnover)}
                  </span>
                  <span className="block text-caption tnum text-ok">
                    {moneyShort(clinic.profit)}
                  </span>
                </span>
              </div>

              <ProgressBar
                value={(clinic.turnover / max) * 100}
                tone="accent"
                className="mt-2"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Eng ko'p daromad keltirgan shifokorlar                              */
/* ------------------------------------------------------------------ */

function DoctorsCard({ data }: { data: PlatformAnalytics }) {
  const { t, tSpecialty } = useI18n()

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('analytics.topDoctors')}
          subtitle={t('analytics.topDoctorsHint')}
          action={
            <Link
              to="/platform/registry?view=doctors"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          }
        />
      </div>

      <ul>
        {data.topDoctors.map((doctor, index) => (
          <li key={doctor.id} className="hairline last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="w-5 shrink-0 text-caption tnum text-label-quaternary">
                {index + 1}
              </span>

              <Avatar name={doctor.fullName} size="xs" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-subhead font-medium text-label">
                  {doctor.fullName}
                </span>
                <span className="block truncate text-caption text-label-tertiary">
                  {tSpecialty(doctor.specialty)} · {doctor.tenantName}
                </span>
              </span>

              {doctor.rating !== null ? (
                <Badge tone={doctor.rating >= 4.5 ? 'ok' : 'neutral'}>
                  {doctor.rating.toFixed(1)}
                </Badge>
              ) : null}

              <span className="shrink-0 text-right">
                <span className="block text-footnote font-semibold tnum text-label">
                  {moneyShort(doctor.revenue)}
                </span>
                {/* Keltirgan daromadi bilan olgan maoshi yonma-yon */}
                <span className="block text-caption tnum text-label-tertiary">
                  {t('analytics.paid')} {moneyShort(doctor.monthlyPay)}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Eng yuqori maosh oladigan shifokorlar                               */
/* ------------------------------------------------------------------ */

/**
 * Maosh reytingi.
 *
 * NEGA DAROMAD REYTINGIDAN ALOHIDA: ular bir xil emas. Foizli
 * shifokor klinikaga ko'p pul keltirib, o'zi kam olishi mumkin —
 * yoki aksincha. Tarmoq qurishda va shifokorni taklif qilishda
 * aynan shu ikkinchi raqam kerak.
 *
 * Yuqorida bozordagi o'rtacha oylik turadi: taklif tayyorlashda
 * tayanch nuqta shu.
 */
function PaidDoctorsCard({ data }: { data: PlatformAnalytics }) {
  const { t, tSpecialty } = useI18n()
  const max = Math.max(...data.topPaid.map((d) => d.monthlyPay), 1)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('analytics.topPaid')}
          subtitle={t('analytics.topPaidHint')}
          action={
            <span className="text-right">
              <span className="block text-caption text-label-tertiary">
                {t('analytics.avgPay')}
              </span>
              <span className="block text-footnote font-semibold tnum text-label">
                {moneyShort(data.avgPay)}
              </span>
            </span>
          }
        />
      </div>

      <ul>
        {data.topPaid.map((doctor, index) => (
          <li key={doctor.id} className="hairline last:border-b-0">
            <div className="px-5 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-5 shrink-0 text-caption tnum text-label-quaternary">
                  {index + 1}
                </span>

                <Avatar name={doctor.fullName} size="xs" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subhead font-medium text-label">
                    {doctor.fullName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {tSpecialty(doctor.specialty)} · {doctor.tenantName}
                  </span>
                </span>

                <Badge tone="neutral">
                  {doctor.payType === 'salary'
                    ? t('staff.payType.salary')
                    : `${doctor.percentRate}%`}
                </Badge>

                <span className="shrink-0 text-right">
                  <span className="block text-footnote font-semibold tnum text-label">
                    {moneyShort(doctor.monthlyPay)}
                  </span>
                  <span className="block text-caption tnum text-label-tertiary">
                    {moneyShort(doctor.revenue)}
                  </span>
                </span>
              </div>

              <ProgressBar
                value={(doctor.monthlyPay / max) * 100}
                tone="ok"
                className="mt-2"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="px-5 py-4 text-caption text-label-tertiary sm:px-6">
        {t('analytics.topPaidNote')}
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Odamlar nima bilan kelmoqda                                         */
/* ------------------------------------------------------------------ */

function ConditionsCard({ data }: { data: PlatformAnalytics }) {
  const { t, tComplaint } = useI18n()
  const max = Math.max(...data.topConditions.map((c) => c.share), 1)

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('analytics.conditions')}
        subtitle={t('analytics.conditionsHint')}
      />

      <ul className="mt-5 space-y-4">
        {data.topConditions.map((row) => (
          <li key={row.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-footnote text-label">
                {tComplaint(row.key)}
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-footnote font-semibold tnum text-label">
                  {percent(row.share, 1)}
                </span>
                <span
                  className={cn(
                    'w-14 text-right text-caption font-medium tnum',
                    row.changePct >= 0 ? 'text-ok' : 'text-bad',
                  )}
                >
                  {row.changePct >= 0 ? '+' : ''}
                  {percent(row.changePct, 0)}
                </span>
              </span>
            </div>
            <ProgressBar value={(row.share / max) * 100} tone="accent" className="mt-2" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Mutaxassisliklar bo'yicha daromad                                   */
/* ------------------------------------------------------------------ */

/**
 * Qaysi yo'nalish ko'proq pul keltiradi.
 *
 * Bemorlar soni emas, DAROMAD ko'rsatiladi: ko'p bemor qabul
 * qiladigan terapevt kam bemorli jarrohdan kam pul keltirishi
 * mumkin, va qaror shu raqamga qarab qabul qilinadi.
 */
function SpecialtyRevenueCard({ data }: { data: PlatformAnalytics }) {
  const { t, tSpecialty } = useI18n()

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('analytics.bySpecialty')}
          subtitle={t('analytics.bySpecialtyHint')}
        />
      </div>

      <ul>
        {data.revenueBySpecialty.map((row) => (
          <li key={row.key} className="hairline last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <Stethoscope size={15} className="shrink-0 text-label-tertiary" />

              <span className="w-36 shrink-0 truncate text-footnote font-medium text-label">
                {tSpecialty(row.key)}
              </span>

              <span className="min-w-24 flex-1">
                <ProgressBar value={row.share} tone="brand" />
              </span>

              <span className="w-14 shrink-0 text-right text-caption tnum text-label-tertiary">
                {percent(row.share, 1)}
              </span>

              <span className="w-24 shrink-0 text-right text-footnote font-semibold tnum text-label">
                {moneyShort(row.revenue)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 px-5 py-4 text-caption text-label-tertiary sm:px-6">
        <Building2 size={13} className="mt-0.5 shrink-0" />
        {t('analytics.bySpecialtyNote')}
      </p>
    </Card>
  )
}
