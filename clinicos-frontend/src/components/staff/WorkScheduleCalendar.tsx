import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Info } from 'lucide-react'

import { getDoctorWorkSchedule, getWorkSchedule } from '@/api/staff'
import { IconButton } from '@/components/ui/Button'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { fromISODate, isToday } from '@/lib/dates'
import { monthsShort, weekdaysShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { AttendanceStatus, WorkScheduleDay } from '@/types/models'

/** Dushanbadan boshlanadigan hafta — O'zbekistonda odatiy tartib */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: 'bg-ok',
  late: 'bg-warn',
  absent: 'bg-bad',
  excused: 'bg-label-quaternary',
  day_off: 'bg-transparent',
}

/**
 * XODIMNING ISH JADVALI KALENDARI.
 *
 * Ish kunlarini klinika egasi belgilaydi, xodim esa shu kalendarda
 * ko'radi: qaysi kunlar ishlaydi, smenasi necha soat, o'tgan kunlarda
 * davomati qanday bo'lgan.
 *
 * FAQAT KO'RISH: bu yerdan hech narsa o'zgartirilmaydi. Jadvalni
 * o'zgartirish — egasining xodim kartasidagi ishi, davomat belgilash
 * esa registraturaning ishi. Har bir amal o'z joyida turishi kerak.
 */
export function WorkScheduleCalendar({
  staffId,
  doctorId,
  className,
}: {
  /** Xodim kartasi bo'yicha */
  staffId?: string
  /** Shifokor bo'yicha — xodim kartasi ichkarida topiladi */
  doctorId?: string
  className?: string
}) {
  const { t } = useI18n()
  const [offset, setOffset] = useState(0)

  const anchor = (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + offset, 1)
  })()

  const month = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`

  const { data, loading, error, reload } = useAsync(
    () =>
      doctorId
        ? getDoctorWorkSchedule(doctorId, month)
        : getWorkSchedule(staffId ?? '', month),
    [staffId, doctorId, month],
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="border-0 shadow-none" />
  if (!data) return <EmptyState title={t('state.notFound.title')} />

  const weekLabels = weekdaysShort()
  const monthLabel = `${monthsShort()[anchor.getMonth()]} ${anchor.getFullYear()}`

  // Oy boshidagi bo'sh kataklar — dushanbadan sanaladi
  const firstWeekday = fromISODate(data.days[0].date).getDay()
  const leading = WEEK_ORDER.indexOf(firstWeekday)

  return (
    <div className={className}>
      {/* --- Oy tanlash --- */}
      <div className="flex max-w-md items-center gap-2">
        <IconButton label={t('action.prev')} onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft size={17} />
        </IconButton>
        <span className="min-w-32 text-center text-subhead font-semibold text-label">
          {monthLabel}
        </span>
        <IconButton label={t('action.next')} onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight size={17} />
        </IconButton>

        <span className="ml-auto inline-flex items-center gap-1.5 text-footnote tnum text-label-secondary">
          <Clock size={14} />
          {data.shiftStart}—{data.shiftEnd}
        </span>
      </div>

      {/* --- Hafta sarlavhasi --- */}
      <div className="mt-4 grid max-w-md grid-cols-7 gap-1">
        {WEEK_ORDER.map((weekday) => (
          <span
            key={weekday}
            className="pb-1 text-center text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary"
          >
            {weekLabels[weekday]}
          </span>
        ))}
      </div>

      {/* --- Kunlar --- */}
      <div className="grid max-w-md grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}

        {data.days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>

      {/* --- Xulosa --- */}
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <dt className="text-caption text-label-tertiary">{t('schedule.plannedDays')}</dt>
          <dd className="mt-0.5 text-subhead font-semibold tnum text-label">
            {data.plannedDays}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-label-tertiary">{t('schedule.workedDays')}</dt>
          <dd className="mt-0.5 text-subhead font-semibold tnum text-ok">{data.workedDays}</dd>
        </div>
        <div>
          <dt className="text-caption text-label-tertiary">{t('staff.workRate')}</dt>
          <dd className="mt-0.5 text-subhead font-semibold tnum text-label">
            {data.workRate}
          </dd>
        </div>
      </dl>

      {/* --- Izoh --- */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-accent-soft ring-1 ring-inset ring-accent/30" />
          <span className="text-caption text-label-secondary">{t('schedule.workday')}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-fill-4" />
          <span className="text-caption text-label-secondary">{t('schedule.dayOff')}</span>
        </li>
        {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', STATUS_DOT[status])} />
            <span className="text-caption text-label-secondary">
              {t(`attendance.status.${status}`)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
        <Info size={14} className="mt-0.5 shrink-0" />
        {t('schedule.readOnly')}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DayCell({ day }: { day: WorkScheduleDay }) {
  const { t } = useI18n()
  const date = fromISODate(day.date)
  const today = isToday(date)

  const title = day.planned
    ? day.status
      ? `${day.date} · ${t(`attendance.status.${day.status}`)}`
      : `${day.date} · ${t('schedule.workday')}`
    : `${day.date} · ${t('schedule.dayOff')}`

  return (
    <span
      title={title}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-1 rounded-[8px]',
        'text-footnote font-medium tnum',
        day.planned
          ? 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/25'
          : 'bg-fill-4 text-label-quaternary',
        today && 'ring-2 ring-accent',
      )}
    >
      {date.getDate()}

      {/* Davomat natijasi — faqat belgilangan kunlarda */}
      <span
        className={cn(
          'size-1.5 rounded-full',
          day.status ? STATUS_DOT[day.status] : 'bg-transparent',
        )}
      />
    </span>
  )
}
