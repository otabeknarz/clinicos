import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  LogIn,
  MoreHorizontal,
  Search,
  XCircle,
} from 'lucide-react'

import { listAppointments, setAppointmentStatus } from '@/api/appointments'
import { listDoctorsShort } from '@/api/doctors'
import { AppointmentFormModal } from '@/components/modals/AppointmentFormModal'
import { VisitFormModal } from '@/components/modals/VisitFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput, Select } from '@/components/ui/Form'
import { MenuDivider, MenuItem, Popover } from '@/components/ui/Popover'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { addDays, endOfDay, startOfDay, startOfWeek } from '@/lib/dates'
import { dateShort, time } from '@/lib/format'
import {
  APPOINTMENT_LABEL,
  APPOINTMENT_PAYMENT_LABEL,
  APPOINTMENT_PAYMENT_TONE,
  APPOINTMENT_TONE,
} from '@/lib/status'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { AppointmentExpanded, AppointmentStatus } from '@/types/models'

type RangeKey = 'today' | 'week' | 'upcoming' | 'all'
const PAGE_SIZE = 15

export function AppointmentsPage() {
  const { t, tService } = useI18n()
  const { can, session } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [range, setRange] = useState<RangeKey>('today')
  const [status, setStatus] = useState<AppointmentStatus | 'all'>(
    (searchParams.get('status') as AppointmentStatus) ?? 'all',
  )
  const [doctorId, setDoctorId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [visitFor, setVisitFor] = useState<AppointmentExpanded | null>(null)

  const debouncedSearch = useDebounced(search, 250)
  const { from, to } = rangeBounds(range)

  const { data: doctors } = useAsync(() => listDoctorsShort(), [])

  const { data, loading, error, reload } = useAsync(
    () =>
      listAppointments({
        from,
        to,
        status,
        doctorId,
        search: debouncedSearch,
        page,
        pageSize: PAGE_SIZE,
      }),
    [from, to, status, doctorId, debouncedSearch, page],
  )

  const rows = data?.items ?? []

  async function changeStatus(id: string, next: AppointmentStatus) {
    await setAppointmentStatus(id, next)
    toast.success(t('toast.updated'))
    reload()
  }

  const columns: Column<AppointmentExpanded>[] = [
    {
      key: 'time',
      header: t('appts.col.time'),
      width: 'w-32',
      render: (row) => (
        <div>
          <p className="font-semibold tnum text-label">{time(row.startsAt)}</p>
          <p className="text-caption tnum text-label-tertiary">{dateShort(row.startsAt)}</p>
        </div>
      ),
    },
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.patient.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-label">{row.patient.fullName}</p>
            <p className="truncate text-caption text-label-tertiary">
              {tService(row.service.name)}
            </p>
          </div>
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
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={APPOINTMENT_TONE[row.status]} dot>
          {t(APPOINTMENT_LABEL[row.status])}
        </Badge>
      ),
    },
    {
      key: 'payment',
      header: t('appts.col.payment'),
      hideBelow: 'xl',
      render: (row) => (
        <Badge tone={APPOINTMENT_PAYMENT_TONE[row.paymentStatus]}>
          {t(APPOINTMENT_PAYMENT_LABEL[row.paymentStatus])}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      render: (row) => <RowActions row={row} onStatus={changeStatus} onVisit={setVisitFor} />,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('appts.title')}
        subtitle={loading ? undefined : `${data?.total ?? 0}`}
        primaryAction={
          can('appointments.create')
            ? {
                icon: <CalendarPlus size={16} />,
                label: t('appts.add'),
                shortLabel: t('action.add'),
                onClick: () => setFormOpen(true),
              }
            : undefined
        }
      />

      <Card padded={false}>
        <div className="hairline space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder={t('patients.search')}
              icon={<Search size={16} />}
              className="sm:max-w-xs"
            />

            {session?.user.role !== 'doctor' ? (
              <Select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value)
                  setPage(1)
                }}
                placeholder={t('calendar.allDoctors')}
                options={[
                  { value: 'all', label: t('calendar.allDoctors') },
                  ...(doctors ?? []).map((d) => ({ value: d.id, label: d.fullName })),
                ]}
                className="sm:w-56"
              />
            ) : null}

            <FilterPills<RangeKey>
              value={range}
              onChange={(v) => {
                setRange(v)
                setPage(1)
              }}
              options={[
                { value: 'today', label: t('common.today') },
                { value: 'week', label: t('common.thisWeek') },
                { value: 'upcoming', label: t('action.next') },
                { value: 'all', label: t('common.all') },
              ]}
              className="sm:ml-auto"
            />
          </div>

          <FilterPills<AppointmentStatus | 'all'>
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'scheduled', label: t('appts.status.scheduled') },
              { value: 'confirmed', label: t('appts.status.confirmed') },
              { value: 'checked_in', label: t('appts.status.checked_in') },
              { value: 'completed', label: t('appts.status.completed') },
              { value: 'no_show', label: t('appts.status.no_show') },
              { value: 'cancelled', label: t('appts.status.cancelled') },
            ]}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              loading={loading}
              onRowClick={(row) => navigate(`/patients/${row.patient.id}`)}
              emptyState={
                <EmptyState
                  icon={<ClipboardList size={24} strokeWidth={1.75} />}
                  title={t('appts.empty.title')}
                  description={t('appts.empty.desc')}
                />
              }
              renderMobile={(row) => (
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
                    {time(row.startsAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-label">{row.patient.fullName}</p>
                    <p className="truncate text-caption text-label-tertiary">
                      {row.doctor.fullName}
                    </p>
                  </div>
                  <Badge tone={APPOINTMENT_TONE[row.status]}>
                    {t(APPOINTMENT_LABEL[row.status])}
                  </Badge>
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

      <AppointmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
      />

      <VisitFormModal
        open={Boolean(visitFor)}
        appointment={visitFor}
        onClose={() => setVisitFor(null)}
        onSaved={reload}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qator amallari                                                      */
/* ------------------------------------------------------------------ */

/**
 * Registratura uchun eng muhim joy: bir bosishda holatni o'zgartirish.
 * "Kelgan" → "Yakunlash" ketma-ketligi eng ko'p ishlatiladi.
 */
function RowActions({
  row,
  onStatus,
  onVisit,
}: {
  row: AppointmentExpanded
  onStatus: (id: string, status: AppointmentStatus) => void
  onVisit: (appointment: AppointmentExpanded) => void
}) {
  const { t } = useI18n()
  const { can, session } = useAuth()

  const canEdit = can('appointments.edit')
  const canCancel = can('appointments.cancel')
  const canVisit = can('visits.create') && session?.user.role === 'doctor'

  if (!canEdit && !canCancel && !canVisit) return null

  const done = row.status === 'completed' || row.status === 'cancelled'

  return (
    <Popover
      width="w-52"
      trigger={({ toggle }) => (
        <IconButton
          label={t('action.more')}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        >
          <MoreHorizontal size={17} />
        </IconButton>
      )}
    >
      {({ close }) => (
        <div onClick={(e) => e.stopPropagation()}>
          {canEdit && row.status === 'scheduled' ? (
            <MenuItem
              icon={<CheckCircle2 size={16} />}
              onClick={() => {
                onStatus(row.id, 'confirmed')
                close()
              }}
            >
              {t('appts.status.confirmed')}
            </MenuItem>
          ) : null}

          {canEdit && (row.status === 'scheduled' || row.status === 'confirmed') ? (
            <MenuItem
              icon={<LogIn size={16} />}
              onClick={() => {
                onStatus(row.id, 'checked_in')
                close()
              }}
            >
              {t('appts.status.checked_in')}
            </MenuItem>
          ) : null}

          {canVisit && !done ? (
            <MenuItem
              icon={<ClipboardList size={16} />}
              onClick={() => {
                onVisit(row)
                close()
              }}
            >
              {t('patient.tab.visits')}
            </MenuItem>
          ) : null}

          {canEdit && !done ? (
            <MenuItem
              icon={<CheckCircle2 size={16} />}
              onClick={() => {
                onStatus(row.id, 'completed')
                close()
              }}
            >
              {t('appts.status.completed')}
            </MenuItem>
          ) : null}

          {canCancel && !done ? (
            <>
              <MenuDivider />
              <MenuItem
                icon={<XCircle size={16} />}
                danger
                onClick={() => {
                  onStatus(row.id, 'cancelled')
                  close()
                }}
              >
                {t('appts.status.cancelled')}
              </MenuItem>
              <MenuItem
                icon={<XCircle size={16} />}
                danger
                onClick={() => {
                  onStatus(row.id, 'no_show')
                  close()
                }}
              >
                {t('appts.status.no_show')}
              </MenuItem>
            </>
          ) : null}
        </div>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */

function rangeBounds(range: RangeKey): { from?: string; to?: string } {
  const now = new Date()

  switch (range) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'week':
      return {
        from: startOfWeek(now).toISOString(),
        to: endOfDay(addDays(startOfWeek(now), 6)).toISOString(),
      }
    case 'upcoming':
      return { from: now.toISOString() }
    case 'all':
      return {}
  }
}
