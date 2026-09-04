import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  Repeat,
  UserPlus,
  UserRound,
  UserX,
} from 'lucide-react'

import { getClinicPerformance, getDashboardSummary } from '@/api/analytics'
import { listTodayAppointments } from '@/api/appointments'
import { listFollowUpsDue } from '@/api/visits'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  compactNumber,
  currencyLabel,
  dateLong,
  dateRelative,
  groupDigits,
  moneyShort,
  percent,
  time,
} from '@/lib/format'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '@/lib/status'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/** Grafik kutubxonasi og'ir — talab bo'yicha yuklanadi */
const RevenueCard = lazy(() => import('./dashboard/RevenueCard'))

/** Egasining kuzatuv bloklari — statsionar va kassa nazorati */
const WardMonitorCard = lazy(() =>
  import('./dashboard/MonitorCards').then((m) => ({ default: m.WardMonitorCard })),
)
const CashMonitorCard = lazy(() =>
  import('./dashboard/MonitorCards').then((m) => ({ default: m.CashMonitorCard })),
)

export function DashboardPage() {
  const { t } = useI18n()
  const { session, can } = useAuth()

  const firstName = session?.user.fullName.split(' ')[0] ?? ''
  const greeting = greetingKey()

  return (
    <>
      <PageHeader
        title={`${t(greeting)}, ${firstName}`}
        subtitle={t('dash.subtitle')}
        actions={
          <span className="hidden rounded-[10px] bg-fill-4 px-3 py-2 text-footnote font-medium text-label-secondary sm:inline-block">
            {dateLong(new Date())}
          </span>
        }
      />

      <KpiGrid />

      {/*
        Tushum kartochkasi faqat `revenue.view` bo'lganda.

        Ilgari bu yerda registratorga "klinika ko'rsatkichlari"
        kartochkasi ko'rsatilardi — lekin unda ham aylanma va
        o'rtacha chek bor. Ya'ni yopilgan narsa boshqa eshikdan
        chiqib turardi. Endi u slot umuman ochilmaydi va jadval
        butun kenglikni oladi.
      */}
      <div
        className={cn(
          'mt-5 grid gap-5',
          can('revenue.view') && 'xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
        )}
      >
        {can('revenue.view') ? (
          <Suspense fallback={<CardSkeleton className="min-h-80" />}>
            <RevenueCard />
          </Suspense>
        ) : null}
        <TodayScheduleCard />
      </div>

      {/* --- Kuzatuv bloklari: faqat egasida --- */}
      {can('ward.view') || can('cashcontrol.view') ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {can('ward.view') ? (
            <Suspense fallback={<CardSkeleton className="min-h-44" />}>
              <WardMonitorCard />
            </Suspense>
          ) : null}
          {can('cashcontrol.view') ? (
            <Suspense fallback={<CardSkeleton className="min-h-44" />}>
              <CashMonitorCard />
            </Suspense>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {can('revenue.view') ? <ClinicPerformanceCard /> : null}
        <FollowUpsCard />
      </div>
    </>
  )
}

function greetingKey(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'dash.greeting.morning'
  if (hour < 18) return 'dash.greeting.day'
  return 'dash.greeting.evening'
}

/* ------------------------------------------------------------------ */
/* KPI kartalar                                                        */
/* ------------------------------------------------------------------ */

function KpiGrid() {
  const { t } = useI18n()
  const { can } = useAuth()
  const { data, loading, error, reload } = useAsync(() => getDashboardSummary(), [])

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  const showMoney = can('payments.view')

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        loading={loading}
        icon={<UserRound size={17} />}
        tone="accent"
        label={t('dash.kpi.patientsToday')}
        value={data ? groupDigits(data.patientsToday.value) : '—'}
        metric={data?.patientsToday}
        caption={t('common.vsYesterday')}
      />

      {showMoney ? (
        <KpiCard
          loading={loading}
          icon={<CircleDollarSign size={17} />}
          tone="ok"
          label={t('dash.kpi.revenueToday')}
          value={data ? compactNumber(data.revenueToday.value) : '—'}
          unit={currencyLabel()}
          metric={data?.revenueToday}
          caption={t('common.vsYesterday')}
        />
      ) : null}

      <KpiCard
        loading={loading}
        icon={<CalendarCheck size={17} />}
        tone="brand"
        label={t('dash.kpi.appointments')}
        value={data ? groupDigits(data.appointmentsToday.value) : '—'}
        metric={data?.appointmentsToday}
        caption={
          data ? t('dash.kpi.remaining', { count: data.appointmentsRemaining }) : undefined
        }
      />

      <KpiCard
        loading={loading}
        icon={<UserPlus size={17} />}
        tone="accent"
        label={t('dash.kpi.newPatients')}
        value={data ? groupDigits(data.newPatients.value) : '—'}
        metric={data?.newPatients}
        caption={t('common.vsYesterday')}
      />

      <KpiCard
        loading={loading}
        icon={<Repeat size={17} />}
        tone="brand"
        label={t('dash.kpi.returningPatients')}
        value={data ? groupDigits(data.returningPatients.value) : '—'}
        metric={data?.returningPatients}
        caption={t('common.vsYesterday')}
      />

      <KpiCard
        loading={loading}
        icon={<UserX size={17} />}
        tone="bad"
        label={t('dash.kpi.noShow')}
        value={data ? groupDigits(data.noShows.value) : '—'}
        metric={data?.noShows}
        lowerIsBetter
        caption={t('common.vsYesterday')}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bugungi jadval                                                      */
/* ------------------------------------------------------------------ */

function TodayScheduleCard() {
  const { t, tService } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => listTodayAppointments(), [])

  const rows = (data ?? []).filter((a) => a.status !== 'cancelled')

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('dash.schedule.title')}
          subtitle={loading ? undefined : `${rows.length}`}
          action={
            <Link
              to="/appointments"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          }
        />
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-12 rounded-[8px]" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={24} strokeWidth={1.75} />}
          title={t('dash.schedule.empty')}
          description=""
          className="py-10"
        />
      ) : (
        <ul className="max-h-[420px] overflow-y-auto scroll-slim">
          {rows.map((appointment) => (
            <li key={appointment.id} className="hairline last:border-b-0">
              <button
                type="button"
                onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                className="row-press flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6"
              >
                <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
                  {time(appointment.startsAt)}
                </span>

                <Avatar name={appointment.patient.fullName} size="xs" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subhead font-medium text-label">
                    {appointment.patient.fullName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {appointment.doctor.fullName} · {tService(appointment.service.name)}
                  </span>
                </span>

                <Badge tone={APPOINTMENT_TONE[appointment.status]} dot>
                  {t(APPOINTMENT_LABEL[appointment.status])}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Klinika ko'rsatkichlari                                             */
/* ------------------------------------------------------------------ */

function ClinicPerformanceCard() {
  const { t } = useI18n()
  const { can } = useAuth()
  const { data, loading, error, reload } = useAsync(() => getClinicPerformance(), [])

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  if (loading || !data) return <CardSkeleton className="min-h-64" />

  // Moliyaviy ko'rsatkichlar faqat `revenue.view` ruxsati bilan.
  // Registrator kundalik kassani ko'radi, lekin klinikaning umumiy
  // daromadini emas — spec talabi.
  const showMoney = can('revenue.view')

  const rows = [
    {
      key: 'patients',
      label: t('nav.patients'),
      value: groupDigits(data.patients),
      pct: (data.patients / data.targets.patients) * 100,
      tone: 'accent' as const,
    },
    {
      key: 'revenue',
      label: t('revenue.title'),
      value: moneyShort(data.revenue),
      pct: (data.revenue / data.targets.revenue) * 100,
      tone: 'ok' as const,
    },
    {
      key: 'appointments',
      label: t('nav.appointments'),
      value: groupDigits(data.appointments),
      pct: (data.appointments / data.targets.appointments) * 100,
      tone: 'brand' as const,
    },
    {
      key: 'check',
      label: t('revenue.averageCheck'),
      value: moneyShort(data.averageCheck),
      pct: (data.averageCheck / data.targets.averageCheck) * 100,
      tone: 'accent' as const,
    },
    {
      key: 'returning',
      label: t('analytics.retention'),
      value: percent(data.returningRate),
      pct: (data.returningRate / data.targets.returningRate) * 100,
      tone: 'brand' as const,
    },
    {
      key: 'noshow',
      label: t('analytics.noShowRate'),
      value: percent(data.noShowRate, 1),
      // Bu ko'rsatkichda kamayish yaxshi — shuning uchun teskari hisoblanadi
      pct: Math.max(0, 100 - (data.noShowRate / data.targets.noShowRate) * 100),
      tone: data.noShowRate > data.targets.noShowRate ? ('bad' as const) : ('ok' as const),
    },
  ].filter((row) => showMoney || (row.key !== 'revenue' && row.key !== 'check'))

  return (
    <Card className="min-w-0">
      <CardHeader title={t('dash.performance.title')} subtitle={t('common.last30d')} />

      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-footnote text-label-secondary">{row.label}</span>
              <span className="text-footnote font-semibold tnum text-label">{row.value}</span>
            </div>
            <ProgressBar value={row.pct} tone={row.tone} className="mt-2" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Takroriy tashrif kutayotganlar                                      */
/* ------------------------------------------------------------------ */

function FollowUpsCard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => listFollowUpsDue(7), [])

  const rows = (data ?? []).slice(0, 6)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('dash.followUps.title')}
          subtitle={loading ? undefined : `${data?.length ?? 0}`}
        />
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3 px-5 pb-5 sm:px-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[10px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState className="py-10" description="" />
      ) : (
        <ul className="pb-2">
          {rows.map((followUp) => {
            const overdue = followUp.recommendedDate < new Date().toISOString().slice(0, 10)
            return (
              <li key={followUp.id} className="hairline last:border-b-0">
                <button
                  type="button"
                  onClick={() => navigate(`/patients/${followUp.patientId}`)}
                  className="row-press flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6"
                >
                  <Avatar name={followUp.patientName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-subhead font-medium text-label">
                      {followUp.patientName}
                    </span>
                    <span className="block truncate text-caption text-label-tertiary">
                      {followUp.doctorName}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-caption font-medium tnum',
                      overdue ? 'text-bad' : 'text-label-secondary',
                    )}
                  >
                    {dateRelative(followUp.recommendedDate)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > 0 ? (
        <div className="px-5 pb-5 sm:px-6">
          <Button variant="tinted" block size="sm" onClick={() => navigate('/patients')}>
            {t('action.viewAll')}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
