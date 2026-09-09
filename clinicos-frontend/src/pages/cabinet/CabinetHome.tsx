import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ClipboardList, Stethoscope } from 'lucide-react'

import { listCabinetVisits } from '@/api/cabinet'
import { Card } from '@/components/ui/Card'
import { Hero, StatStrip } from '@/components/ui/Hero'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { compactNumber, currencyLabel, dateLong, dateShort, time } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'

/**
 * Bemorning bosh ekrani.
 *
 * TARTIB QARZDAN BOSHLANADI, agar u bo'lsa. Bemor kabinetni ochganda
 * birinchi savoli ikkitadan biri: "qachon borishim kerak?" yoki
 * "qancha qarzim bor?". Qarz bo'lsa u muhimroq — chunki u harakat
 * talab qiladi; qarz yo'q bo'lsa keyingi qabul chiqadi.
 */
export function CabinetHomePage() {
  const { t } = useI18n()
  const { profile } = usePatient()
  const visits = useAsync(() => listCabinetVisits(profile?.patientId), [profile?.patientId])

  if (!profile) return null

  const hasDebt = profile.debtTotal > 0
  const recent = (visits.data ?? []).slice(0, 3)

  return (
    <div className="space-y-4">
      {hasDebt ? (
        <Hero
          eyebrow={t('cabinet.debtTotal')}
          value={compactNumber(profile.debtTotal)}
          unit={currencyLabel()}
          meta={t('cabinet.debtHint')}
          to="/cabinet/debt"
        />
      ) : (
        <Hero
          eyebrow={t('cabinet.nextVisit')}
          value={
            profile.nextAppointment
              ? dateShort(profile.nextAppointment.startsAt)
              : t('cabinet.noNext')
          }
          meta={
            profile.nextAppointment ? (
              <span>
                {time(profile.nextAppointment.startsAt)} ·{' '}
                {profile.nextAppointment.doctorName}
              </span>
            ) : (
              t('cabinet.noNextHint')
            )
          }
        />
      )}

      {/*
        Keyingi qabul qarz bilan BIRGA ko'rsatilmaydi: to'q karta
        bitta bo'lishi kerak, aks holda ikkalasi ham "eng muhim"
        bo'lib qoladi. Qarz bor bo'lsa qabul shu qatorda chiqadi.
      */}
      {hasDebt && profile.nextAppointment ? (
        <Card className="rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-navy dark:text-white">
              <CalendarClock size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-caption text-label-tertiary">{t('cabinet.nextVisit')}</p>
              <p className="truncate text-subhead font-medium text-label">
                {dateLong(profile.nextAppointment.startsAt)},{' '}
                {time(profile.nextAppointment.startsAt)}
              </p>
              <p className="truncate text-caption text-label-tertiary">
                {profile.nextAppointment.doctorName}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <StatStrip
        items={[
          {
            key: 'visits',
            label: t('cabinet.visitCount'),
            value: String(profile.visitCount),
            icon: <ClipboardList size={12} />,
            tone: 'accent',
          },
          {
            key: 'last',
            label: t('patient.stat.lastVisit'),
            value: profile.lastVisitAt ? dateShort(profile.lastVisitAt) : '—',
            icon: <Stethoscope size={12} />,
            tone: 'brand',
          },
        ]}
      />

      {/* --- So'nggi tashriflar --- */}
      <Card padded={false} className="rounded-[20px]">
        <div className="flex items-center justify-between gap-3 p-4 pb-3">
          <h2 className="text-subhead font-semibold text-label">
            {t('cabinet.recentVisits')}
          </h2>
          {recent.length > 0 ? (
            <Link
              to="/cabinet/visits"
              className="inline-flex shrink-0 items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          ) : null}
        </div>

        {visits.loading ? (
          <div className="space-y-3 px-4 pb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={24} strokeWidth={1.75} />}
            title={t('cabinet.noVisits')}
            description=""
            className="py-8"
          />
        ) : (
          <ul className="px-4 pb-4">
            {recent.map((visit) => (
              <li key={visit.id} className="hairline py-3 last:border-b-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-subhead font-medium text-label">
                    {visit.diagnosis || visit.serviceName || t('cabinet.visitFallback')}
                  </p>
                  <p className="shrink-0 text-caption tnum text-label-tertiary">
                    {dateShort(visit.visitedAt)}
                  </p>
                </div>
                <p className="mt-0.5 truncate text-caption text-label-tertiary">
                  {visit.doctorName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
