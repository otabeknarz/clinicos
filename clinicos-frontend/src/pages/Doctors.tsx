import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, Search, TrendingUp, Users } from 'lucide-react'

import { listDoctors } from '@/api/doctors'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { groupDigits, moneyShort } from '@/lib/format'
import { DOCTOR_LABEL, DOCTOR_TONE } from '@/lib/status'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import type { DoctorWithStats } from '@/types/models'

export function DoctorsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search, 250)

  const { data, loading, error, reload } = useAsync(() => listDoctors(debounced), [debounced])
  const rows = data ?? []

  return (
    <>
      <PageHeader
        title={t('doctors.title')}
        subtitle={loading ? undefined : `${rows.length}`}
        actions={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('action.search')}
            icon={<Search size={16} />}
            className="w-44 sm:w-64"
          />
        }
      />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} className="min-h-44" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </>
  )
}

function DoctorCard({ doctor }: { doctor: DoctorWithStats }) {
  const { t, tSpecialty } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()

  const stats = [
    {
      icon: <CalendarCheck size={14} />,
      value: groupDigits(doctor.stats.appointmentsToday),
      label: t('doctors.appointmentsToday'),
    },
    {
      icon: <Users size={14} />,
      value: groupDigits(doctor.stats.patientsThisMonth),
      label: t('doctors.patientsMonth'),
    },
    // Shifokor qancha daromad keltirgani — faqat egasiga.
    // Registratura shifokorning pulini bilmasligi kerak: bu ish
    // munosabatlariga ham, kassadagi bosimga ham ta'sir qiladi.
    ...(can('revenue.view')
      ? [
          {
            icon: <TrendingUp size={14} />,
            value: moneyShort(doctor.stats.revenueThisMonth),
            label: t('doctors.revenueMonth'),
          },
        ]
      : []),
  ]

  return (
    <button
      type="button"
      onClick={() => navigate(`/doctors/${doctor.id}`)}
      className="card card-interactive squircle p-5 text-left"
    >
      <div className="flex items-start gap-3">
        <Avatar name={doctor.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline text-label">{doctor.fullName}</p>
          <p className="truncate text-footnote text-label-secondary">
            {tSpecialty(doctor.specialty)}
          </p>
        </div>
        <Badge tone={DOCTOR_TONE[doctor.status]} dot>
          {t(DOCTOR_LABEL[doctor.status])}
        </Badge>
      </div>

      <dl className="mt-5 space-y-2.5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-fill-4 text-label-tertiary">
              {stat.icon}
            </span>
            <dd className="text-subhead font-semibold tnum text-label">{stat.value}</dd>
            <dt className="min-w-0 truncate text-caption text-label-tertiary">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </button>
  )
}
