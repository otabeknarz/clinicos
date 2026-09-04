import { useState } from 'react'
import { ChevronLeft, ChevronRight, Gift, Percent, TrendingUp, Wallet } from 'lucide-react'

import { getDoctorEarnings } from '@/api/doctors'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { CardHeader } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateCompact, groupDigits, money, monthsShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { DoctorEarnings } from '@/types/models'

/**
 * SHIFOKORNING MOLIYA BO'LIMI.
 *
 * Shifokor "bu oyda qancha ishladim" degan savolga o'zi javob oladi:
 * maoshi, foizi, bonuslari va ular qanday hisoblangani.
 *
 * NEGA OCHIQ KO'RSATAMIZ: foizli modelda ishlaydigan shifokor pulini
 * mustaqil hisoblab bo'lmaydi — unga qancha bemor qabul qilgani va
 * har biridan qancha tushum bo'lgani kerak. Bu ma'lumot tizimda bor.
 * Yashirilsa, har oy oxirida bahs boshlanadi; ko'rsatilsa, bahs
 * umuman chiqmaydi.
 *
 * BU YERDA YO'Q: klinikaning umumiy daromadi, boshqa shifokorlar,
 * xarajatlar. Faqat shu shifokorga tegishli summalar.
 */
export function EarningsTab({ doctorId }: { doctorId: string }) {
  const { t } = useI18n()
  const [offset, setOffset] = useState(0)

  const anchor = (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + offset, 1)
  })()

  const period = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`

  const { data, loading, error, reload } = useAsync(
    () => getDoctorEarnings(doctorId, period),
    [doctorId, period],
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="border-0 shadow-none" />
  if (!data) return <EmptyState title={t('state.notFound.title')} />

  return (
    <>
      <CardHeader
        title={t('earnings.title')}
        subtitle={t(`staff.payType.${data.payType}`)}
        action={
          <div className="flex items-center gap-1">
            <IconButton label={t('action.prev')} onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <span className="min-w-24 text-center text-footnote font-medium tnum text-label">
              {monthsShort()[anchor.getMonth()]} {anchor.getFullYear()}
            </span>
            <IconButton
              label={t('action.next')}
              disabled={offset >= 0}
              onClick={() => setOffset((o) => o + 1)}
            >
              <ChevronRight size={17} />
            </IconButton>
          </div>
        }
      />

      {/* --- Jami --- */}
      <div className="mt-5 rounded-[14px] bg-ok-soft px-5 py-4">
        <p className="text-footnote text-label-secondary">{t('earnings.total')}</p>
        <p className="mt-1 text-title-1 font-bold tnum text-ok">{money(data.total)}</p>
      </div>

      {/* --- Qismlar --- */}
      <Breakdown data={data} />

      {/* --- Qanday hisoblangani --- */}
      <WorkloadRow data={data} />

      {/* --- Bonuslar --- */}
      {data.bonuses.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-subhead font-semibold text-label">{t('bonus.title')}</h3>
          <ul className="mt-3 space-y-2">
            {data.bonuses.map((bonus) => (
              <li
                key={bonus.id}
                className="flex flex-wrap items-center gap-3 rounded-[10px] bg-sunken px-4 py-3"
              >
                <Gift size={15} className="shrink-0 text-ok" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote text-label">
                    {bonus.reason || t('bonus.title')}
                  </span>
                  <span className="block text-caption text-label-tertiary">
                    {dateCompact(bonus.createdAt)}
                  </span>
                </span>
                <Badge tone={bonus.status === 'paid' ? 'ok' : 'neutral'} dot>
                  {t(`bonus.status.${bonus.status}`)}
                </Badge>
                <span className="shrink-0 text-footnote font-semibold tnum text-ok">
                  +{money(bonus.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Jami summa nimalardan yig'ilgani.
 *
 * Faqat tegishli qatorlar ko'rsatiladi: sof maoshda ishlaydigan
 * shifokorga "foiz 0 so'm" qatorini ko'rsatish chalg'itadi.
 */
function Breakdown({ data }: { data: DoctorEarnings }) {
  const { t } = useI18n()

  const rows = [
    data.payType !== 'percent' && {
      key: 'salary',
      icon: <Wallet size={15} />,
      label: t('staff.payType.salary'),
      hint: data.workRate !== 1 ? t('earnings.rateHint', { rate: data.workRate }) : '',
      value: data.baseSalary,
      tone: 'text-label',
    },
    data.payType !== 'salary' && {
      key: 'percent',
      icon: <Percent size={15} />,
      label: t('earnings.percentShare'),
      hint: t('earnings.percentHint', {
        rate: data.percentRate,
        revenue: money(data.generatedRevenue),
      }),
      value: data.percentEarnings,
      tone: 'text-label',
    },
    data.bonusTotal > 0 && {
      key: 'bonus',
      icon: <Gift size={15} />,
      label: t('bonus.title'),
      hint: '',
      value: data.bonusTotal,
      tone: 'text-ok',
    },
  ].filter((row): row is Exclude<typeof row, false> => Boolean(row))

  return (
    <ul className="mt-4 space-y-2">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex flex-wrap items-center gap-3 rounded-[10px] bg-sunken px-4 py-3"
        >
          <span className="shrink-0 text-label-tertiary">{row.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-footnote font-medium text-label">{row.label}</span>
            {row.hint ? (
              <span className="block text-caption text-label-tertiary">{row.hint}</span>
            ) : null}
          </span>
          <span className={cn('shrink-0 text-subhead font-semibold tnum', row.tone)}>
            {money(row.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Foiz qaysi raqamdan hisoblangani.
 *
 * MUHIM: tushum TO'LOVLARDAN olinadi, qabullardan emas. Xizmat
 * ko'rsatilgan, lekin puli olinmagan qabul foizga kirmaydi — aks
 * holda foiz hali kelmagan puldan hisoblanadi.
 */
function WorkloadRow({ data }: { data: DoctorEarnings }) {
  const { t } = useI18n()

  const cells = [
    {
      key: 'appointments',
      label: t('appts.status.completed'),
      value: groupDigits(data.completedAppointments),
    },
    {
      key: 'revenue',
      label: t('earnings.generated'),
      value: money(data.generatedRevenue),
    },
    {
      key: 'check',
      label: t('revenue.averageCheck'),
      value: money(data.averageCheck),
    },
  ]

  return (
    <>
      <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.key}>
            <dt className="text-caption text-label-tertiary">{cell.label}</dt>
            <dd className="mt-0.5 text-subhead font-semibold tnum text-label">{cell.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
        <TrendingUp size={14} className="mt-0.5 shrink-0" />
        {t('earnings.paidOnlyHint')}
      </p>
    </>
  )
}
