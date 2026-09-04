import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
} from 'lucide-react'

import {
  deletePatient,
  getPatient,
  getPatientAppointments,
  getPatientPayments,
  getPatientVisits,
} from '@/api/patients'
import { AppointmentFormModal } from '@/components/modals/AppointmentFormModal'
import { PatientFormModal } from '@/components/modals/PatientFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import {
  age,
  dateLong,
  dateShort,
  dateTime,
  money,
  phone as formatPhone,
  time,
} from '@/lib/format'
import {
  APPOINTMENT_LABEL,
  APPOINTMENT_TONE,
  PATIENT_LABEL,
  PATIENT_TONE,
  PAYMENT_LABEL,
  PAYMENT_TONE,
} from '@/lib/status'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

type Tab = 'overview' | 'visits' | 'appointments' | 'payments'

export function PatientProfilePage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: patient, loading, error, reload } = useAsync(() => getPatient(id), [id])

  const remove = useAction(async () => deletePatient(id))

  if (loading) return <CardSkeleton className="min-h-64" />
  if (error) return <ErrorState onRetry={reload} />
  if (!patient) return <EmptyState title={t('state.notFound.title')} />

  async function handleDelete() {
    await remove.run()
    toast.success(t('toast.deleted'))
    navigate('/patients')
  }

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/patients"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            <ArrowLeft size={14} />
            {t('patients.title')}
          </Link>
        }
        title={patient.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Phone size={13} />
              {formatPhone(patient.phone)}
            </span>
            <span>
              {t('patient.age', { count: age(patient.birthDate) })} ·{' '}
              {t(`patient.gender.${patient.gender}`)}
            </span>
            <Badge tone={PATIENT_TONE[patient.status]} dot>
              {t(PATIENT_LABEL[patient.status])}
            </Badge>
          </span>
        }
        actions={
          <>
            {can('appointments.create') ? (
              <Button icon={<CalendarPlus size={16} />} onClick={() => setBookOpen(true)}>
                <span className="hidden sm:inline">{t('appts.add')}</span>
              </Button>
            ) : null}
            {can('patients.edit') ? (
              <IconButton label={t('action.edit')} onClick={() => setEditOpen(true)}>
                <Pencil size={16} />
              </IconButton>
            ) : null}
            {can('patients.delete') ? (
              <IconButton
                label={t('action.delete')}
                onClick={() => setConfirmDelete(true)}
                className="hover:text-bad"
              >
                <Trash2 size={16} />
              </IconButton>
            ) : null}
          </>
        }
      />

      <QuickStats patient={patient} />

      <Card padded={false} className="mt-5">
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: t('patient.tab.overview') },
              ...(can('visits.view')
                ? [{ value: 'visits' as const, label: t('patient.tab.visits') }]
                : []),
              { value: 'appointments', label: t('patient.tab.appointments') },
              ...(can('payments.view')
                ? [{ value: 'payments' as const, label: t('patient.tab.payments') }]
                : []),
            ]}
          />
        </div>

        <div className="p-5 sm:p-6">
          {tab === 'overview' ? <OverviewTab patientId={id} /> : null}
          {tab === 'visits' ? <VisitsTab patientId={id} /> : null}
          {tab === 'appointments' ? <AppointmentsTab patientId={id} /> : null}
          {tab === 'payments' ? <PaymentsTab patientId={id} /> : null}
        </div>
      </Card>

      <PatientFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patient={patient}
        onSaved={reload}
      />

      <AppointmentFormModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSaved={reload}
        presetPatientId={id}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        pending={remove.pending}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tezkor statistika                                                   */
/* ------------------------------------------------------------------ */

function QuickStats({ patient }: { patient: import('@/types/models').PatientWithStats }) {
  const { t } = useI18n()

  const items = [
    { label: t('patient.stat.totalVisits'), value: String(patient.stats.visitCount) },
    {
      label: t('patient.stat.lastVisit'),
      value: patient.stats.lastVisitAt ? dateShort(patient.stats.lastVisitAt) : '—',
    },
    { label: t('patient.stat.totalSpent'), value: money(patient.stats.totalSpent) },
    {
      label: t('patient.nextFollowUp'),
      value: patient.stats.nextFollowUpAt ? dateShort(patient.stats.nextFollowUpAt) : '—',
      highlight: Boolean(patient.stats.nextFollowUpAt),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card squircle p-4">
          <p className="text-caption text-label-tertiary">{item.label}</p>
          <p
            className={cn(
              'mt-1.5 text-title-3 font-semibold tnum',
              item.highlight ? 'text-accent' : 'text-label',
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Umumiy                                                              */
/* ------------------------------------------------------------------ */

function OverviewTab({ patientId }: { patientId: string }) {
  const { t } = useI18n()
  const { data: patient } = useAsync(() => getPatient(patientId), [patientId])
  const { data: appointments } = useAsync(
    () => getPatientAppointments(patientId),
    [patientId],
  )

  // Date.now() ni render ichida chaqirmaymiz — u har renderda o'zgaradi
  // va natijani beqaror qiladi. Hooklar erta return'dan oldin turishi shart.
  const now = useMemo(() => Date.now(), [appointments])

  if (!patient) return null

  const upcoming = (appointments ?? [])
    .filter((a) => new Date(a.startsAt).getTime() > now)
    .filter((a) => a.status !== 'cancelled')
    .slice(0, 3)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <CardHeader title={t('patient.tab.overview')} />
        <dl className="mt-4 space-y-3">
          <Row label={t('common.phone')} value={formatPhone(patient.phone)} />
          <Row label={t('patientForm.birthDate')} value={dateLong(patient.birthDate)} />
          <Row label={t('patientForm.gender')} value={t(`patient.gender.${patient.gender}`)} />
          <Row
            label={t('common.address')}
            value={patient.address || '—'}
            icon={<MapPin size={14} />}
          />
          <Row label={t('common.notes')} value={patient.notes || '—'} />
        </dl>
      </div>

      <div>
        <CardHeader title={t('patient.tab.appointments')} />
        {upcoming.length === 0 ? (
          <p className="mt-4 text-subhead text-label-tertiary">{t('appts.empty.desc')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {upcoming.map((appointment) => (
              <li
                key={appointment.id}
                className="flex items-center gap-3 rounded-[12px] bg-sunken px-3.5 py-3"
              >
                <span className="text-footnote font-semibold tnum text-label">
                  {time(appointment.startsAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subhead text-label">
                    {appointment.doctor.fullName}
                  </span>
                  <span className="block text-caption text-label-tertiary">
                    {dateShort(appointment.startsAt)}
                  </span>
                </span>
                <Badge tone={APPOINTMENT_TONE[appointment.status]}>
                  {t(APPOINTMENT_LABEL[appointment.status])}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-footnote text-label-tertiary">{label}</dt>
      <dd className="inline-flex min-w-0 items-center gap-1.5 text-right text-subhead text-label">
        {icon}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tashriflar tarixi                                                   */
/* ------------------------------------------------------------------ */

function VisitsTab({ patientId }: { patientId: string }) {
  const { t, tComplaint, tService } = useI18n()
  const { data, loading, error, reload } = useAsync(() => getPatientVisits(patientId), [patientId])

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />
  if (!data || data.length === 0) return <EmptyState />

  return (
    <>
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-caption font-medium text-warn">
        <ShieldAlert size={13} />
        {t('patient.medicalNotice')}
      </p>

      <ol className="space-y-3">
        {data.map((visit) => (
          <li key={visit.id} className="rounded-[14px] bg-sunken p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-subhead font-medium text-label">
                {visit.service ? tService(visit.service.name) : tComplaint(visit.complaint)}
              </p>
              <p className="text-caption tnum text-label-tertiary">{dateTime(visit.visitedAt)}</p>
            </div>

            <p className="mt-0.5 text-caption text-label-tertiary">{visit.doctor.fullName}</p>

            <dl className="mt-3 space-y-1.5 text-footnote">
              {visit.diagnosis ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-label-tertiary">{t('visit.diagnosis')}:</dt>
                  <dd className="text-label">{visit.diagnosis}</dd>
                </div>
              ) : null}
              {visit.treatment ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-label-tertiary">{t('visit.treatment')}:</dt>
                  <dd className="text-label-secondary">{visit.treatment}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ol>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qabullar                                                            */
/* ------------------------------------------------------------------ */

function AppointmentsTab({ patientId }: { patientId: string }) {
  const { t, tService } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => getPatientAppointments(patientId),
    [patientId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />
  if (!data || data.length === 0) {
    return <EmptyState icon={<ClipboardList size={24} strokeWidth={1.75} />} />
  }

  return (
    <ul className="divide-y divide-separator">
      {data.map((appointment) => (
        <li key={appointment.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
          <span className="w-24 shrink-0 text-footnote tnum text-label-secondary">
            {dateShort(appointment.startsAt)}
          </span>
          <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
            {time(appointment.startsAt)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-subhead text-label">
              {tService(appointment.service.name)}
            </span>
            <span className="block truncate text-caption text-label-tertiary">
              {appointment.doctor.fullName}
            </span>
          </span>
          <Badge tone={APPOINTMENT_TONE[appointment.status]} dot>
            {t(APPOINTMENT_LABEL[appointment.status])}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* To'lovlar                                                           */
/* ------------------------------------------------------------------ */

function PaymentsTab({ patientId }: { patientId: string }) {
  const { t, tService } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => getPatientPayments(patientId),
    [patientId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />
  if (!data || data.length === 0) return <EmptyState />

  const total = data
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between rounded-[12px] bg-sunken px-4 py-3">
        <span className="text-footnote text-label-secondary">{t('common.total')}</span>
        <span className="text-title-3 font-semibold tnum text-label">{money(total)}</span>
      </div>

      <ul className="divide-y divide-separator">
        {data.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="w-24 shrink-0 text-footnote tnum text-label-secondary">
              {dateShort(payment.paidAt)}
            </span>
            <span className="min-w-0 flex-1 truncate text-subhead text-label">
              {tService(payment.service.name)}
            </span>
            <span className="shrink-0 text-caption text-label-tertiary">
              {t(`payments.method.${payment.method}`)}
            </span>
            <span className="shrink-0 text-subhead font-semibold tnum text-label">
              {money(payment.amount)}
            </span>
            <Badge tone={PAYMENT_TONE[payment.status]}>{t(PAYMENT_LABEL[payment.status])}</Badge>
          </li>
        ))}
      </ul>
    </>
  )
}
