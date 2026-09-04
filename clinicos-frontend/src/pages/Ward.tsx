import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  LogIn,
  LogOut,
  TrendingUp,
} from 'lucide-react'

import {
  dischargePatient,
  getBedBoard,
  getWardStats,
  listAdmissions,
  listRooms,
} from '@/api/ward'
import { BedBoard, BedBoardLegend } from './ward/BedBoard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/KpiCard'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { addDays, rangeFromPreset, startOfDay, toISODate } from '@/lib/dates'
import { dateCompact, dateShort, groupDigits, money, moneyShort, percent, phone as fmtPhone } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { AdmissionExpanded, AdmissionStatus, Room } from '@/types/models'

const OccupancyChart = lazy(() => import('./ward/OccupancyChart'))

type Tab = 'board' | 'patients' | 'rooms' | 'analytics'

/** Shaxmatkada ko'rsatiladigan kunlar soni */
const BOARD_DAYS = 14

export function WardPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('board')

  const stats = useAsync(() => getWardStats(rangeFromPreset('30d')), [])

  return (
    <>
      <PageHeader
        title={t('ward.title')}
        subtitle={
          stats.data
            ? t('ward.subtitle', {
                occupied: stats.data.occupiedBeds,
                total: stats.data.totalBeds,
              })
            : undefined
        }
      />

      <WardKpis />

      <Card padded={false} className="mt-5">
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'board', label: t('ward.tab.board') },
              { value: 'patients', label: t('ward.tab.patients') },
              { value: 'rooms', label: t('ward.tab.rooms') },
              { value: 'analytics', label: t('ward.tab.analytics') },
            ]}
          />
        </div>

        {tab === 'board' ? <BoardTab /> : null}
        {tab === 'patients' ? <PatientsTab /> : null}
        {tab === 'rooms' ? <RoomsTab /> : null}
        {tab === 'analytics' ? <AnalyticsTab /> : null}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Ko'rsatkichlar                                                      */
/* ------------------------------------------------------------------ */

function WardKpis() {
  const { t } = useI18n()
  const { can } = useAuth()
  const { data, loading, error, reload } = useAsync(
    () => getWardStats(rangeFromPreset('30d')),
    [],
  )

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  const freeBeds = data ? data.totalBeds - data.occupiedBeds : 0

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        loading={loading}
        icon={<BedDouble size={14} />}
        tone="accent"
        label={t('ward.kpi.occupancy')}
        value={data ? percent(data.occupancyPct.value) : '—'}
        metric={data?.occupancyPct}
      />
      <StatCard
        loading={loading}
        icon={<DoorOpen size={14} />}
        tone="ok"
        label={t('ward.kpi.freeBeds')}
        value={data ? String(freeBeds) : '—'}
      />
      <StatCard
        loading={loading}
        icon={<LogIn size={14} />}
        tone="brand"
        label={t('ward.kpi.admitted')}
        value={data ? String(data.admittedToday) : '—'}
      />
      <StatCard
        loading={loading}
        icon={<LogOut size={14} />}
        tone="neutral"
        label={t('ward.kpi.discharged')}
        value={data ? String(data.dischargedToday) : '—'}
      />
      {can('revenue.view') ? (
        <StatCard
          loading={loading}
          icon={<TrendingUp size={14} />}
          tone="ok"
          label={t('ward.kpi.revenue')}
          value={data ? moneyShort(data.revenue.value) : '—'}
          metric={data?.revenue}
        />
      ) : (
        <StatCard
          loading={loading}
          icon={<TrendingUp size={14} />}
          tone="neutral"
          label={t('ward.kpi.avgStay')}
          value={data ? t('ward.days', { count: data.averageStayDays.toFixed(1) }) : '—'}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shaxmatka                                                           */
/* ------------------------------------------------------------------ */

function BoardTab() {
  const { t } = useI18n()
  // Kecha va bugundan boshlab — o'tgan kunlar ham ko'rinsin
  const [anchor, setAnchor] = useState(() => startOfDay(addDays(new Date(), -2)))

  const from = anchor
  const to = addDays(anchor, BOARD_DAYS - 1)

  const { data, loading, error, reload } = useAsync(
    () => getBedBoard(from, to),
    [toISODate(from), toISODate(to)],
  )

  return (
    <>
      <div className="hairline flex items-center gap-2 px-5 py-3 sm:px-6">
        <IconButton
          label={t('action.prev')}
          onClick={() => setAnchor((d) => addDays(d, -7))}
        >
          <ChevronLeft size={17} />
        </IconButton>
        <Button
          variant="gray"
          size="sm"
          onClick={() => setAnchor(startOfDay(addDays(new Date(), -2)))}
        >
          {t('calendar.today')}
        </Button>
        <IconButton label={t('action.next')} onClick={() => setAnchor((d) => addDays(d, 7))}>
          <ChevronRight size={17} />
        </IconButton>

        <span className="ml-auto text-footnote tnum text-label-secondary">
          {dateCompact(from)} — {dateCompact(to)}
        </span>
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading || !data ? (
        <CardSkeleton className="m-5 border-0 shadow-none" />
      ) : (
        <>
          <BedBoard data={data} />
          <div className="hairline-t">
            <BedBoardLegend />
          </div>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Yotgan bemorlar                                                     */
/* ------------------------------------------------------------------ */

function PatientsTab() {
  const { t } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [status, setStatus] = useState<AdmissionStatus | 'all'>('active')
  const [discharging, setDischarging] = useState<AdmissionExpanded | null>(null)

  const { data, loading, error, reload } = useAsync(() => listAdmissions({ status }), [status])
  const discharge = useAction(async (id: string) => dischargePatient(id))

  async function confirmDischarge() {
    if (!discharging) return
    await discharge.run(discharging.id)
    toast.success(t('toast.updated'))
    setDischarging(null)
    reload()
  }

  const columns: Column<AdmissionExpanded>[] = [
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.patient.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-label">{row.patient.fullName}</p>
            {/*
              Tashxis — tibbiy ma'lumot. Uni shifokor tashrif
              yozuvida belgilaydi va faqat tibbiy ruxsati borlar
              ko'radi.

              Registraturaga tashxis emas, telefon kerak: yotgan
              bemorning yaqinlariga qo'ng'iroq qilish uning ishi.
              Shifokor ismi qo'shni ustunda allaqachon bor.
            */}
            <p className="truncate text-caption text-label-tertiary">
              {can('patients.viewMedical') ? row.diagnosis : fmtPhone(row.patient.phone)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'bed',
      header: t('ward.bed'),
      render: (row) => (
        <div>
          <p className="font-medium tnum text-label">{row.bed.label}</p>
          <p className="text-caption text-label-tertiary">
            {t(`ward.category.${row.room.category}`)}
          </p>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: t('common.doctor'),
      hideBelow: 'lg',
      render: (row) => <span className="text-label-secondary">{row.doctor.fullName}</span>,
    },
    {
      key: 'admitted',
      header: t('ward.admittedAt'),
      hideBelow: 'md',
      render: (row) => (
        <div>
          <p className="tnum text-label-secondary">{dateShort(row.admittedAt)}</p>
          <p className="text-caption text-label-tertiary">
            {t('ward.days', { count: row.daysStayed })}
          </p>
        </div>
      ),
    },
    {
      key: 'accrued',
      header: t('ward.accrued'),
      align: 'right',
      hideBelow: 'xl',
      render: (row) => <span className="font-semibold tnum text-label">{money(row.accrued)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      render: (row) => (
        <Badge tone={ADMISSION_TONE[row.status]} dot>
          {t(`ward.status.${row.status}`)}
        </Badge>
      ),
    },
    ...(can('ward.manage')
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 'w-28',
            render: (row: AdmissionExpanded) =>
              row.status === 'active' ? (
                <Button
                  variant="tinted"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDischarging(row)
                  }}
                >
                  {t('ward.discharge')}
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="hairline px-5 py-3 sm:px-6">
        <Tabs<AdmissionStatus | 'all'>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: t('ward.status.active') },
            { value: 'planned', label: t('ward.status.planned') },
            { value: 'discharged', label: t('ward.status.discharged') },
            { value: 'all', label: t('common.all') },
          ]}
        />
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <DataTable
          rows={data ?? []}
          columns={columns}
          loading={loading}
          onRowClick={(row) => navigate(`/patients/${row.patient.id}`)}
          emptyState={
            <EmptyState
              icon={<BedDouble size={24} strokeWidth={1.75} />}
              title={t('ward.empty')}
              description=""
            />
          }
          renderMobile={(row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.patient.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-label">{row.patient.fullName}</p>
                <p className="truncate text-caption text-label-tertiary">
                  {row.bed.label} · {t('ward.days', { count: row.daysStayed })}
                </p>
              </div>
              <Badge tone={ADMISSION_TONE[row.status]}>{t(`ward.status.${row.status}`)}</Badge>
            </div>
          )}
        />
      )}

      <ConfirmDialog
        open={Boolean(discharging)}
        onClose={() => setDischarging(null)}
        onConfirm={confirmDischarge}
        danger={false}
        title={t('ward.confirmDischarge')}
        description={discharging?.patient.fullName}
        confirmLabel={t('ward.discharge')}
        pending={discharge.pending}
      />
    </>
  )
}

const ADMISSION_TONE: Record<AdmissionStatus, Tone> = {
  planned: 'neutral',
  active: 'accent',
  discharged: 'ok',
}

/* ------------------------------------------------------------------ */
/* Xonalar                                                             */
/* ------------------------------------------------------------------ */

function RoomsTab() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => listRooms(), [])

  if (error) return <ErrorState onRetry={reload} />
  if (loading) return <CardSkeleton className="m-5 border-0 shadow-none" />

  const columns: Column<Room>[] = [
    {
      key: 'number',
      header: t('ward.room'),
      render: (row) => (
        <span className="font-semibold tnum text-label">{row.number}</span>
      ),
    },
    {
      key: 'category',
      header: t('ward.category'),
      render: (row) => (
        <Badge tone={CATEGORY_TONE[row.category]}>{t(`ward.category.${row.category}`)}</Badge>
      ),
    },
    {
      key: 'floor',
      header: t('ward.floor'),
      align: 'right',
      hideBelow: 'sm',
      render: (row) => <span className="tnum text-label-secondary">{row.floor}</span>,
    },
    {
      key: 'rate',
      header: t('ward.dailyRate'),
      align: 'right',
      render: (row) => <span className="font-semibold tnum text-label">{money(row.dailyRate)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      render: (row) => (
        <Badge tone={row.status === 'active' ? 'ok' : 'warn'} dot>
          {row.status === 'active'
            ? t('ward.bedStatus.free')
            : t('ward.bedStatus.maintenance')}
        </Badge>
      ),
    },
  ]

  return <DataTable rows={data ?? []} columns={columns} emptyState={<EmptyState />} />
}

const CATEGORY_TONE = {
  luxury: 'brand',
  standard: 'accent',
  general: 'neutral',
} as const

/* ------------------------------------------------------------------ */
/* Tahlil                                                              */
/* ------------------------------------------------------------------ */

function AnalyticsTab() {
  const { t } = useI18n()
  const { can } = useAuth()
  const { data, loading, error, reload } = useAsync(
    () => getWardStats(rangeFromPreset('30d')),
    [],
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data) return <CardSkeleton className="m-5 border-0 shadow-none" />

  return (
    <div className="space-y-6 p-5 sm:p-6">
      {/* --- Bandlik dinamikasi --- */}
      <div>
        <CardHeader title={t('ward.occupancyChart')} subtitle={t('common.last30d')} />
        <div className="mt-4">
          <Suspense fallback={<CardSkeleton className="h-56 border-0 shadow-none" />}>
            <OccupancyChart data={data.occupancySeries} />
          </Suspense>
        </div>
      </div>

      {/* --- Toifalar bo'yicha --- */}
      <div>
        <CardHeader title={t('ward.byCategory')} />
        <ul className="mt-4 space-y-4">
          {data.byCategory.map((row) => {
            const pct = row.totalBeds ? (row.occupiedBeds / row.totalBeds) * 100 : 0
            return (
              <li key={row.category}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-subhead text-label">
                    {t(`ward.category.${row.category}`)}
                  </span>
                  <span className="text-footnote tnum text-label-secondary">
                    {row.occupiedBeds} / {row.totalBeds}
                    {can('revenue.view') ? ` · ${moneyShort(row.revenue)}` : ''}
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  tone={CATEGORY_TONE[row.category]}
                  className="mt-2"
                />
              </li>
            )
          })}
        </ul>
      </div>

      {/* --- Qisqacha raqamlar --- */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label={t('ward.kpi.avgStay')} value={t('ward.days', { count: data.averageStayDays.toFixed(1) })} />
        <Figure label={t('ward.bed')} value={groupDigits(data.totalBeds)} />
        <Figure label={t('ward.kpi.occupancy')} value={percent(data.occupancyPct.value)} />
        {can('revenue.view') ? (
          <Figure label={t('ward.kpi.revenue')} value={moneyShort(data.revenue.value)} />
        ) : null}
      </dl>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-sunken p-4">
      <dt className="text-caption text-label-tertiary">{label}</dt>
      <dd className="mt-1 text-title-3 font-semibold tnum text-label">{value}</dd>
    </div>
  )
}
