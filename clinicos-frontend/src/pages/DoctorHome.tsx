import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageSquare,
  Repeat,
  Stethoscope,
  UserRound,
  UserX,
} from 'lucide-react'

import { listTodayAppointments, setAppointmentStatus } from '@/api/appointments'
import { getDoctor } from '@/api/doctors'
import { listRecentFeedbackForDoctor } from '@/api/feedback'
import { listFollowUpsDue } from '@/api/visits'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { Stars } from '@/components/ui/Stars'
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateLong, dateRelative, groupDigits, percent, time } from '@/lib/format'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '@/lib/status'
import type { AppointmentExpanded } from '@/types/models'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

/** Tashrifni yozish oynasi og'ir — talab bo'yicha yuklanadi */
const VisitFormModal = lazy(() =>
  import('@/components/modals/VisitFormModal').then((m) => ({ default: m.VisitFormModal })),
)

/**
 * SHIFOKORNING BOSH SAHIFASI.
 *
 * Egasining paneli "klinika qanday ketyapti" degan savolga javob
 * beradi. Shifokorga esa boshqa narsa kerak: bugun kimni qabul
 * qilaman, kim navbatda, o'zim haqimda nima deyishyapti.
 *
 * Shuning uchun bu yerda klinikaning daromadi ham, boshqa
 * shifokorlarning ko'rsatkichlari ham yo'q. Hamma ma'lumot
 * `scopeDoctorId` orqali shu shifokorga cheklangan.
 */
export function DoctorHomePage() {
  const { t } = useI18n()
  const { session } = useAuth()

  const firstName = session?.user.fullName.split(' ')[0] ?? ''
  const doctorId = session?.user.doctorId ?? ''

  return (
    <>
      <PageHeader
        title={`${t(greetingKey())}, ${firstName}`}
        subtitle={t('doctorHome.subtitle')}
        actions={
          <span className="hidden rounded-[10px] bg-fill-4 px-3 py-2 text-footnote font-medium text-label-secondary sm:inline-block">
            {dateLong(new Date())}
          </span>
        }
      />

      <KpiRow doctorId={doctorId} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <TodayCard />

        <div className="grid content-start gap-5">
          <FeedbackCard />
          <FollowUpsCard />
        </div>
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
/* Ko'rsatkichlar                                                      */
/* ------------------------------------------------------------------ */

/**
 * Shifokorning o'z ko'rsatkichlari.
 *
 * Daromad ATAYLAB yo'q: u shifokorning "Moliya" bo'limida turadi,
 * bosh sahifada esa ish jarayoni ko'rsatkichlari kerak. Kun boshida
 * pul emas, bemorlar soni muhim.
 */
function KpiRow({ doctorId }: { doctorId: string }) {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => getDoctor(doctorId),
    [doctorId],
    { skip: !doctorId },
  )

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  const stats = data?.stats

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        loading={loading}
        icon={<CalendarCheck size={17} />}
        tone="accent"
        label={t('doctors.appointmentsToday')}
        value={stats ? groupDigits(stats.appointmentsToday) : '—'}
      />
      <KpiCard
        loading={loading}
        icon={<CheckCircle2 size={17} />}
        tone="ok"
        label={t('staff.metric.completed')}
        value={stats ? groupDigits(stats.completedThisMonth) : '—'}
        caption={t('common.last30d')}
      />
      <KpiCard
        loading={loading}
        icon={<UserRound size={17} />}
        tone="brand"
        label={t('doctors.patientsMonth')}
        value={stats ? groupDigits(stats.patientsThisMonth) : '—'}
        caption={t('common.last30d')}
      />
      <KpiCard
        loading={loading}
        icon={<UserX size={17} />}
        tone="bad"
        label={t('analytics.noShowRate')}
        value={stats ? percent(stats.noShowRate, 1) : '—'}
        caption={t('common.last30d')}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bugungi qabullar                                                    */
/* ------------------------------------------------------------------ */

/**
 * Shifokorning bugungi jadvali — ish qurolining o'zi.
 *
 * Har bir qatorda ikkita amal: tashrifni yozish (tashxis, tavsiya)
 * va qabulni yakunlash. Boshqa hech narsa — qabul yozish, bekor
 * qilish, pul olish registraturaning ishi.
 */
function TodayCard() {
  const { t, tService } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  const [busy, setBusy] = useState<string | null>(null)
  const [visitFor, setVisitFor] = useState<AppointmentExpanded | null>(null)

  const { data, loading, error, reload } = useAsync(() => listTodayAppointments(), [])

  const rows = (data ?? []).filter((a) => a.status !== 'cancelled')

  async function complete(id: string) {
    setBusy(id)
    try {
      await setAppointmentStatus(id, 'completed')
      reload()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('doctorHome.today')}
          subtitle={loading ? undefined : t('doctorHome.todayCount', { count: rows.length })}
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
          icon={<Stethoscope size={24} strokeWidth={1.75} />}
          title={t('doctorHome.todayEmpty')}
          description=""
          className="py-12"
        />
      ) : (
        <ul className="max-h-[560px] overflow-y-auto scroll-slim">
          {rows.map((appointment) => {
            const done = appointment.status === 'completed'

            return (
              <li key={appointment.id} className="hairline last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
                    {time(appointment.startsAt)}
                  </span>

                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar name={appointment.patient.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-subhead font-medium text-label">
                        {appointment.patient.fullName}
                      </span>
                      <span className="block truncate text-caption text-label-tertiary">
                        {tService(appointment.service.name)}
                      </span>
                    </span>
                  </button>

                  <Badge tone={APPOINTMENT_TONE[appointment.status]} dot>
                    {t(APPOINTMENT_LABEL[appointment.status])}
                  </Badge>

                  {done ? null : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="gray"
                        size="sm"
                        icon={<ClipboardList size={14} />}
                        onClick={() => setVisitFor(appointment)}
                      >
                        <span className="hidden sm:inline">{t('doctorHome.recordVisit')}</span>
                      </Button>
                      <Button
                        variant="tinted"
                        size="sm"
                        icon={<CheckCircle2 size={14} />}
                        loading={busy === appointment.id}
                        onClick={() => complete(appointment.id)}
                      >
                        {t('reception.complete')}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {visitFor ? (
        <Suspense fallback={null}>
          <VisitFormModal
            open
            appointment={visitFor}
            onClose={() => setVisitFor(null)}
            onSaved={() => {
              setVisitFor(null)
              reload()
            }}
          />
        </Suspense>
      ) : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Anonim fikrlar                                                      */
/* ------------------------------------------------------------------ */

/**
 * Bemorlarning shifokor haqidagi fikri — ANONIM.
 *
 * Kim yozgani ko'rsatilmaydi va fikr tashrifdan bir necha kun keyin,
 * oldindan bilib bo'lmaydigan vaqtda ochiladi. Ikkalasi birga
 * ishlaydi: faqat ismni yashirish yetarli emas, chunki fikr darhol
 * kelsa, shifokor o'sha kungi bemorni eslaydi.
 */
function FeedbackCard() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(
    () => listRecentFeedbackForDoctor(14),
    [],
  )

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  if (loading) return <CardSkeleton className="min-h-56" />

  const rows = (data ?? []).slice(0, 5)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('doctorHome.feedback')}
          subtitle={t('doctorHome.feedbackHint')}
          action={
            <Link
              to="/feedback"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={24} strokeWidth={1.75} />}
          title={t('doctorHome.feedbackEmpty')}
          description=""
          className="py-10"
        />
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="hairline px-5 py-3 last:border-b-0 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <Stars value={row.rating} size={15} />
                <span className="shrink-0 text-caption text-label-tertiary">
                  {dateRelative(row.revealAt)}
                </span>
              </div>

              {row.text ? (
                <p className="mt-1.5 line-clamp-3 text-footnote text-label-secondary">
                  {row.text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 px-5 py-4 text-caption text-label-tertiary sm:px-6">
        <Clock size={13} className="mt-0.5 shrink-0" />
        {t('doctorHome.feedbackDelay')}
      </p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Takroriy tashrif kutayotganlar                                      */
/* ------------------------------------------------------------------ */

/**
 * Shifokorning o'zi tavsiya qilgan takroriy tashriflar.
 *
 * Registratura ularni qo'ng'iroq qilib chaqiradi, lekin shifokor
 * ham ko'rib turishi kerak: kim qaytishi kerak edi va qaytmadi.
 */
function FollowUpsCard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsync(() => listFollowUpsDue(14), [])

  if (error) {
    return (
      <Card>
        <ErrorState onRetry={reload} />
      </Card>
    )
  }

  if (loading) return <CardSkeleton className="min-h-44" />

  const rows = (data ?? []).slice(0, 5)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('dash.followUps.title')}
          subtitle={`${data?.length ?? 0}`}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Repeat size={24} strokeWidth={1.75} />}
          title={t('doctorHome.followUpsEmpty')}
          description=""
          className="py-8"
        />
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="hairline last:border-b-0">
              <button
                type="button"
                onClick={() => navigate(`/patients/${row.patientId}`)}
                className="row-press flex w-full items-center gap-3 px-5 py-3 text-left sm:px-6"
              >
                <Avatar name={row.patientName} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-subhead font-medium text-label">
                    {row.patientName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {row.reason}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-caption tnum',
                    row.recommendedDate <= new Date().toISOString().slice(0, 10)
                      ? 'font-medium text-warn'
                      : 'text-label-tertiary',
                  )}
                >
                  {dateRelative(row.recommendedDate)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
