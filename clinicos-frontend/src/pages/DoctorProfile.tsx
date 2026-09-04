import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'

import {
  getDoctor,
  getDoctorAppointments,
  getDoctorPatients,
} from '@/api/doctors'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { EarningsTab } from '@/pages/doctor/EarningsTab'
import {
  dateShort,
  groupDigits,
  money,
  moneyShort,
  percent,
  phone as formatPhone,
  time,
} from '@/lib/format'
import {
  APPOINTMENT_LABEL,
  APPOINTMENT_TONE,
  DOCTOR_LABEL,
  DOCTOR_TONE,
} from '@/lib/status'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

type Tab = 'overview' | 'workdays' | 'schedule' | 'patients' | 'performance' | 'earnings'

/**
 * Shifokor profili.
 *
 * Ikki yo'ldan ochiladi:
 *   /doctors/:id — egasi yoki registratura ro'yxatdan ochadi
 *   /me          — shifokorning o'zi (`self` rejimi)
 *
 * Bir xil sahifa ikkalasiga ham xizmat qiladi: farq faqat qaysi
 * bo'limlar ochilishida, u esa ruxsatlar orqali hal bo'ladi.
 */
export function DoctorProfilePage({ self = false }: { self?: boolean }) {
  const params = useParams()
  const { t, tSpecialty } = useI18n()
  const { can, session } = useAuth()
  const [tab, setTab] = useState<Tab>(self ? 'earnings' : 'overview')

  // O'z profilida id sessiyadan olinadi — URL da boshqa shifokorning
  // id'sini yozib qo'yish imkoni bo'lmasligi kerak
  const id = self ? (session?.user.doctorId ?? '') : (params.id ?? '')

  // Shifokorning daromadi — klinika egasining ma'lumoti.
  // Registratura uni ko'rmaydi.
  const showMoney = can('revenue.view')

  /*
    Moliya bo'limi — shifokorning o'z pulini ko'rishi uchun.

    Ikki holatda ochiladi: shifokorning O'ZI kirgan bo'lsa yoki
    xodimlar bilan ishlash ruxsati bo'lsa (klinika egasi). Registrator
    ikkalasiga ham kirmaydi.

    ESLATMA: bu FAQAT ko'rsatma. Haqiqiy himoya serverda —
    `GET /doctors/:id/earnings` shu ikki shartni o'zi tekshirishi shart.
  */
  const showEarnings = can('staff.manage') || session?.user.doctorId === id

  const { data: doctor, loading, error, reload } = useAsync(() => getDoctor(id), [id])

  if (loading) return <CardSkeleton className="min-h-64" />
  if (error) return <ErrorState onRetry={reload} />
  if (!doctor) return <EmptyState title={t('state.notFound.title')} />

  return (
    <>
      <PageHeader
        back={
          // O'z profilida orqaga qaytadigan ro'yxat yo'q —
          // shifokor hamkasblari ro'yxatini ko'rmaydi
          self ? undefined : (
            <Link
              to="/doctors"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              <ArrowLeft size={14} />
              {t('doctors.title')}
            </Link>
          )
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={doctor.fullName} size="lg" />
            <span>{doctor.fullName}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{tSpecialty(doctor.specialty)}</span>
            <span className="inline-flex items-center gap-1.5">
              <Phone size={13} />
              {formatPhone(doctor.phone)}
            </span>
            <Badge tone={DOCTOR_TONE[doctor.status]} dot>
              {t(DOCTOR_LABEL[doctor.status])}
            </Badge>
          </span>
        }
      />

      <div
        className={cn(
          'grid grid-cols-2 gap-3 sm:gap-4',
          /*
            Uchta ko'rsatkich ikki ustunga sig'maydi — oxirgisi
            telefonda butun kenglikni oladi, aks holda yonida bo'sh
            katak qolib, sahifa chala ko'rinadi.
          */
          showMoney
            ? 'lg:grid-cols-4'
            : '[&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1 sm:grid-cols-3',
        )}
      >
        <Stat label={t('doctors.appointmentsToday')} value={groupDigits(doctor.stats.appointmentsToday)} />
        <Stat label={t('doctors.patientsMonth')} value={groupDigits(doctor.stats.patientsThisMonth)} />
        <Stat
          label={t('appts.status.completed')}
          value={groupDigits(doctor.stats.completedThisMonth)}
        />
        {/* Moliyaviy ko'rsatkichlar faqat egasida */}
        {showMoney ? (
          <Stat label={t('doctors.revenueMonth')} value={moneyShort(doctor.stats.revenueThisMonth)} />
        ) : null}
      </div>

      <Card padded={false} className="mt-5">
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: t('doctor.tab.overview') },
              { value: 'workdays', label: t('schedule.title') },
              { value: 'schedule', label: t('doctor.tab.schedule') },
              { value: 'patients', label: t('doctor.tab.patients') },
              { value: 'performance', label: t('doctor.tab.performance') },
              /*
                Moliya — shifokorning SHAXSIY puli: maoshi, foizi,
                bonuslari. Uni shifokorning o'zi va klinika egasi
                ko'radi; registratura ko'rmaydi.
              */
              ...(showEarnings
                ? [{ value: 'earnings' as const, label: t('earnings.tab') }]
                : []),
            ]}
          />
        </div>

        <div className="p-5 sm:p-6">
          {tab === 'overview' ? <OverviewTab doctor={doctor} /> : null}
          {tab === 'workdays' ? <WorkdaysTab doctorId={id} /> : null}
          {tab === 'schedule' ? <ScheduleTab doctorId={id} /> : null}
          {tab === 'patients' ? <PatientsTab doctorId={id} /> : null}
          {tab === 'performance' ? <PerformanceTab doctor={doctor} /> : null}
          {tab === 'earnings' && showEarnings ? <EarningsTab doctorId={id} /> : null}
        </div>
      </Card>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card squircle p-4">
      <p className="text-caption text-label-tertiary">{label}</p>
      <p className="mt-1.5 text-title-3 font-semibold tnum text-label">{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function OverviewTab({ doctor }: { doctor: import('@/types/models').DoctorWithStats }) {
  const { t, tSpecialty } = useI18n()
  const weekdayNames = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']

  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      <Row label={t('doctor.specialty')} value={tSpecialty(doctor.specialty)} />
      <Row label={t('common.phone')} value={formatPhone(doctor.phone)} />
      <Row label={t('common.email')} value={doctor.email} icon={<Mail size={13} />} />
      <Row label={t('doctor.fee')} value={money(doctor.consultationFee)} />
      <Row label={t('doctor.shift')} value={`${doctor.shiftStart} — ${doctor.shiftEnd}`} />
      <Row
        label={t('settings.tab.hours')}
        value={doctor.workdays.map((d) => weekdayNames[d]).join(', ')}
      />
    </dl>
  )
}

/**
 * Shifokorning ish kunlari kalendari.
 *
 * NEGA KERAK: shifokor "qaysi kunlari ishlayman" degan savolga
 * istalgan vaqtda javob olishi kerak — jadvalni klinika egasi
 * belgilaydi, lekin uni ko'rish uchun hech kimdan so'rash shart emas.
 *
 * Bu yerda faqat ish kunlari: qabullar ro'yxati qo'shni bo'limda.
 */
function WorkdaysTab({ doctorId }: { doctorId: string }) {
  const { t } = useI18n()

  return (
    <>
      <CardHeader title={t('schedule.title')} subtitle={t('schedule.doctorHint')} />
      <WorkScheduleCalendar doctorId={doctorId} className="mt-5" />
    </>
  )
}

/* ------------------------------------------------------------------ */

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
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

function ScheduleTab({ doctorId }: { doctorId: string }) {
  const { t, tService } = useI18n()
  const navigate = useNavigate()

  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 14)

  const { data, loading, error, reload } = useAsync(
    () => getDoctorAppointments(doctorId, from.toISOString(), to.toISOString()),
    [doctorId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />
  if (!data || data.length === 0) return <EmptyState />

  const upcoming = [...data].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  return (
    <ul className="divide-y divide-separator">
      {upcoming.map((appointment) => (
        <li key={appointment.id}>
          <button
            type="button"
            onClick={() => navigate(`/patients/${appointment.patient.id}`)}
            className="row-press flex w-full items-center gap-3 py-3 text-left"
          >
            <span className="w-24 shrink-0 text-footnote tnum text-label-secondary">
              {dateShort(appointment.startsAt)}
            </span>
            <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
              {time(appointment.startsAt)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-subhead text-label">
                {appointment.patient.fullName}
              </span>
              <span className="block truncate text-caption text-label-tertiary">
                {tService(appointment.service.name)}
              </span>
            </span>
            <Badge tone={APPOINTMENT_TONE[appointment.status]} dot>
              {t(APPOINTMENT_LABEL[appointment.status])}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

function PatientsTab({ doctorId }: { doctorId: string }) {
  const { can } = useAuth()
  const showMoney = can('revenue.view')
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(
    () => getDoctorPatients(doctorId),
    [doctorId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />
  if (!data || data.length === 0) return <EmptyState />

  return (
    <ul className="divide-y divide-separator">
      {data.slice(0, 40).map((patient) => (
        <li key={patient.id}>
          <button
            type="button"
            onClick={() => navigate(`/patients/${patient.id}`)}
            className="row-press flex w-full items-center gap-3 py-3 text-left"
          >
            <Avatar name={patient.fullName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-subhead text-label">{patient.fullName}</span>
              <span className="block truncate text-caption text-label-tertiary tnum">
                {formatPhone(patient.phone)}
              </span>
            </span>
            <span className="shrink-0 text-footnote tnum text-label-secondary">
              {patient.stats.visitCount}
            </span>
            {/*
              Bemorlarning to'lovlarini qo'shsa, shifokorning daromadi
              kelib chiqadi — shuning uchun bu ustun ham egasiga
              cheklangan.
            */}
            {showMoney ? (
              <span className="hidden shrink-0 text-footnote font-medium tnum text-label sm:block">
                {money(patient.stats.totalSpent)}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

function PerformanceTab({ doctor }: { doctor: import('@/types/models').DoctorWithStats }) {
  const { t } = useI18n()
  const { can } = useAuth()

  /**
   * Registratura shifokorning samaradorligini ko'radi, lekin uning
   * pulini emas: qabullar soni va kelmaganlar ulushi ish jarayoni
   * uchun kerak, o'rtacha chek va oylik daromad esa — egasining
   * ma'lumoti.
   */
  const rows = [
    {
      label: t('appts.status.completed'),
      value: groupDigits(doctor.stats.completedThisMonth),
      pct: Math.min(100, (doctor.stats.completedThisMonth / 200) * 100),
      tone: 'ok' as const,
    },
    {
      label: t('analytics.noShowRate'),
      value: percent(doctor.stats.noShowRate, 1),
      pct: Math.max(0, 100 - doctor.stats.noShowRate * 10),
      tone: doctor.stats.noShowRate > 8 ? ('bad' as const) : ('ok' as const),
    },
    ...(can('revenue.view')
      ? [
          {
            label: t('revenue.averageCheck'),
            value: money(doctor.stats.averageCheck),
            pct: Math.min(100, (doctor.stats.averageCheck / 400_000) * 100),
            tone: 'accent' as const,
          },
          {
            label: t('doctors.revenueMonth'),
            value: money(doctor.stats.revenueThisMonth),
            pct: Math.min(100, (doctor.stats.revenueThisMonth / 60_000_000) * 100),
            tone: 'brand' as const,
          },
        ]
      : []),
  ]

  return (
    <>
      <CardHeader title={t('doctor.tab.performance')} subtitle={t('common.last30d')} />
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-footnote text-label-secondary">{row.label}</span>
              <span className="text-footnote font-semibold tnum text-label">{row.value}</span>
            </div>
            <ProgressBar value={row.pct} tone={row.tone} className="mt-2" />
          </li>
        ))}
      </ul>
    </>
  )
}
