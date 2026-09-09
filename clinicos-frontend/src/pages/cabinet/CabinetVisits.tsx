import { ClipboardList, ShieldAlert } from 'lucide-react'

import { listCabinetVisits } from '@/api/cabinet'
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

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-[20px]">
        <EmptyState
          icon={<ClipboardList size={24} strokeWidth={1.75} />}
          title={t('cabinet.noVisits')}
          description={t('cabinet.noVisitsHint')}
          className="py-10"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
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
