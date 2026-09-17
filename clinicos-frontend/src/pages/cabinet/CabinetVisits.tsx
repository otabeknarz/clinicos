import { CalendarClock, ClipboardList, ShieldAlert } from 'lucide-react'

import { listCabinetAppointments, listCabinetVisits } from '@/api/cabinet'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { dateLong, time } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'

/**
 * Tashriflar tarixi — bemorning o'z kartochkasi.
 *
 * TASHXIS BIRINCHI O'RINDA. Ro'yxatda odam qidiradigan narsa "menda
 * nima aniqlangan" — xizmat nomi emas. Shuning uchun sarlavha
 * tashxis, xizmat esa ostida turadi.
 */
export function CabinetVisitsPage() {
  const { t, tService, tComplaint } = useI18n()
  const { profile } = usePatient()
  const { data, loading, error, reload } = useAsync(
    () => listCabinetVisits(profile?.patientId),
    [profile?.patientId],
  )
  /*
    REJALASHTIRILGAN QABULLAR tarixdan OLDIN turadi: bemor bu sahifani
    ko'pincha "qachon borishim kerak" deb ochadi. Ilgari faqat bosh
    sahifadagi eng yaqin bittasi ko'rinardi.
  */
  const upcoming = useAsync(
    () => listCabinetAppointments(profile?.patientId),
    [profile?.patientId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />

  const planned = upcoming.data ?? []
  const plannedBlock =
    planned.length > 0 ? (
      <section className="space-y-2">
        <h2 className="flex items-center gap-1.5 px-1 text-footnote font-semibold uppercase tracking-wide text-label-tertiary">
          <CalendarClock size={14} />
          {t('cabinet.planned')}
        </h2>
        <ol className="space-y-2">
          {planned.map((appointment) => (
            <li key={appointment.id}>
              <Card className="rounded-[20px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-subhead font-semibold text-label">
                      {dateLong(appointment.startsAt)}, {time(appointment.startsAt)}
                    </p>
                    <p className="mt-0.5 text-caption text-label-secondary">
                      {tService(appointment.serviceName)} · {appointment.doctorName}
                    </p>
                  </div>
                  <Badge tone={appointment.status === 'scheduled' ? 'warn' : 'ok'}>
                    {appointment.status === 'scheduled'
                      ? t('cabinet.plannedWaiting')
                      : appointment.status === 'confirmed'
                        ? t('cabinet.plannedConfirmed')
                        : t('cabinet.plannedArrived')}
                  </Badge>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    ) : null

  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        {plannedBlock}
        <Card className="rounded-[20px]">
          <EmptyState
            icon={<ClipboardList size={24} strokeWidth={1.75} />}
            title={t('cabinet.noVisits')}
            description={t('cabinet.noVisitsHint')}
            className="py-10"
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plannedBlock}
      <p className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-caption font-medium text-warn">
        <ShieldAlert size={13} />
        {t('cabinet.medicalNotice')}
      </p>

      <ol className="space-y-3">
        {data.map((visit) => (
          <li key={visit.id}>
            <Card className="rounded-[20px] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="min-w-0 flex-1 text-subhead font-semibold text-label">
                  {visit.diagnosis || t('cabinet.visitFallback')}
                </h2>
                <p className="shrink-0 text-caption tnum text-label-tertiary">
                  {dateLong(visit.visitedAt)}
                </p>
              </div>

              <p className="mt-1 text-caption text-label-tertiary">
                {visit.doctorName}
                {visit.serviceName ? ` · ${tService(visit.serviceName)}` : ''} ·{' '}
                {time(visit.visitedAt)}
              </p>

              <dl className="mt-3 space-y-2 text-footnote">
                {visit.complaint ? (
                  <Row label={t('visit.complaint')} value={tComplaint(visit.complaint)} />
                ) : null}
                {visit.treatment ? (
                  <Row label={t('visit.treatment')} value={visit.treatment} />
                ) : null}
              </dl>

              {/*
                Rasmlar — rentgen, tahlil varaqasi. Havolalar qisqa
                muddatli imzolangan bo'ladi, shuning uchun sahifa
                yangilanganda qaytadan olinadi.
              */}
              {visit.images.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {visit.images.map((image) => (
                    <li key={image.id}>
                      <a
                        href={image.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-16 w-16 overflow-hidden rounded-[10px] bg-sunken"
                      >
                        <img
                          src={image.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-label-tertiary">{label}</dt>
      <dd className="break-words text-label">{value}</dd>
    </div>
  )
}
