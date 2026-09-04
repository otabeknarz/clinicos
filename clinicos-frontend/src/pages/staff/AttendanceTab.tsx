import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { listStaff } from '@/api/staff'
import { markAttendance } from '@/api/attendance'
import { getDb } from '@/mock/db'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { addDays, eachDay, isToday, startOfDay, toISODate } from '@/lib/dates'
import { dateCompact, percent, weekdaysShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { AttendanceStatus, StaffWithPerformance } from '@/types/models'

/**
 * DAVOMAT JADVALI — xodim × kun.
 *
 * Bu farrosh, qorovul kabi xodimlar uchun yagona o'lchov: reyting shundan
 * hisoblanadi. Administratsiya har kuni belgilaydi, egasi kuzatadi.
 */

const CELL = 30
const ROW = 46
const LABEL_WIDTH = 210
const DAYS = 21

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-ok text-white',
  late: 'bg-warn text-white',
  absent: 'bg-bad text-white',
  excused: 'bg-fill-2 text-label-secondary',
  day_off: 'bg-transparent text-label-quaternary',
}

const STATUS_LETTER: Record<AttendanceStatus, string> = {
  present: '',
  late: 'K',
  absent: 'Y',
  excused: 'S',
  day_off: '',
}

export function AttendanceTab() {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const [anchor, setAnchor] = useState(() => startOfDay(addDays(new Date(), -(DAYS - 1))))
  const [version, setVersion] = useState(0)

  const days = eachDay(anchor, addDays(anchor, DAYS - 1))
  const dayKeys = days.map(toISODate)
  const weekLabels = weekdaysShort()

  const { data, loading, error, reload } = useAsync(
    () => listStaff({ status: 'active' }),
    [version],
  )

  const canManage = can('attendance.manage')

  /**
   * Davomat yozuvlarini to'g'ridan-to'g'ri mock bazadan o'qiymiz.
   *
   * DASTURCHIGA: haqiqiy backendda bu bitta so'rov bo'ladi —
   * `GET /attendance?from=&to=` va u xodim id'si bo'yicha guruhlangan
   * ma'lumot qaytaradi. Bu yerdagi to'g'ridan-to'g'ri murojaat faqat
   * demo uchun.
   */
  const attendanceMap = useAsync(
    async () => {
      const rows = getDb()
        .attendance.all()
        .filter((a) => a.date >= dayKeys[0] && a.date <= dayKeys[dayKeys.length - 1])

      const map = new Map<string, { status: AttendanceStatus; lateMinutes: number }>()
      for (const row of rows) {
        map.set(`${row.staffId}|${row.date}`, {
          status: row.status,
          lateMinutes: row.lateMinutes,
        })
      }
      return map
    },
    [dayKeys[0], version],
  )

  async function setStatus(staffId: string, date: string, status: AttendanceStatus) {
    await markAttendance({
      staffId,
      date,
      status,
      lateMinutes: status === 'late' ? 15 : 0,
      note: '',
    })
    toast.success(t('toast.saved'))
    setVersion((v) => v + 1)
  }

  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data || !attendanceMap.data) {
    return <CardSkeleton className="m-5 border-0 shadow-none" />
  }
  if (data.length === 0) return <EmptyState />

  const boardWidth = days.length * CELL

  return (
    <>
      {/* --- Boshqaruv --- */}
      <div className="hairline flex items-center gap-2 p-4 sm:p-5">
        <IconButton
          label={t('action.prev')}
          onClick={() => setAnchor((d) => addDays(d, -DAYS))}
        >
          <ChevronLeft size={17} />
        </IconButton>
        <Button
          variant="gray"
          size="sm"
          onClick={() => setAnchor(startOfDay(addDays(new Date(), -(DAYS - 1))))}
        >
          {t('calendar.today')}
        </Button>
        <IconButton
          label={t('action.next')}
          onClick={() => setAnchor((d) => addDays(d, DAYS))}
        >
          <ChevronRight size={17} />
        </IconButton>

        <span className="ml-auto text-footnote tnum text-label-secondary">
          {dateCompact(days[0])} — {dateCompact(days[days.length - 1])}
        </span>
      </div>

      {/* --- Jadval --- */}
      <div className="scroll-slim overflow-x-auto">
        <div style={{ minWidth: LABEL_WIDTH + boardWidth + 110 }}>
          {/* Sarlavha */}
          <div className="hairline flex items-end">
            <div
              className="shrink-0 px-5 pb-2 text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary sm:px-6"
              style={{ width: LABEL_WIDTH }}
            >
              {t('staff.col.employee')}
            </div>

            <div className="flex" style={{ width: boardWidth }}>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="shrink-0 pb-2 text-center"
                  style={{ width: CELL }}
                >
                  <p className="text-caption-2 uppercase text-label-tertiary">
                    {weekLabels[day.getDay()][0]}
                  </p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full',
                      'text-caption-2 font-semibold tnum',
                      isToday(day) ? 'bg-accent text-white' : 'text-label',
                    )}
                  >
                    {day.getDate()}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="shrink-0 px-3 pb-2 text-right text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary"
              style={{ width: 110 }}
            >
              {t('attendance.discipline')}
            </div>
          </div>

          {/* Qatorlar */}
          <ul>
            {data.map((person: StaffWithPerformance) => (
              <li key={person.id} className="hairline flex items-center last:border-b-0">
                <div
                  className="flex shrink-0 items-center gap-2.5 px-5 sm:px-6"
                  style={{ width: LABEL_WIDTH, height: ROW }}
                >
                  <Avatar name={person.fullName} size="xs" />
                  <span className="min-w-0">
                    <span className="block truncate text-footnote font-medium text-label">
                      {person.fullName}
                    </span>
                    <span className="block truncate text-caption-2 text-label-tertiary">
                      {person.positionTitle}
                    </span>
                  </span>
                </div>

                <div className="flex" style={{ width: boardWidth, height: ROW }}>
                  {dayKeys.map((key, index) => {
                    const record = attendanceMap.data?.get(`${person.id}|${key}`)
                    const status = record?.status ?? 'day_off'
                    const isWorkday = person.workdays.includes(days[index].getDay())

                    const cell = (
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-[7px]',
                          'text-caption-2 font-bold',
                          status === 'day_off' && !isWorkday
                            ? 'bg-fill-4/40'
                            : STATUS_STYLE[status],
                        )}
                      >
                        {STATUS_LETTER[status]}
                      </span>
                    )

                    if (!canManage || !isWorkday) {
                      return (
                        <div
                          key={key}
                          className="flex shrink-0 items-center justify-center"
                          style={{ width: CELL }}
                          title={`${key} · ${t(`attendance.status.${status}`)}`}
                        >
                          {cell}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={key}
                        className="flex shrink-0 items-center justify-center"
                        style={{ width: CELL }}
                      >
                        <Popover
                          width="w-44"
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              title={`${key} · ${t(`attendance.status.${status}`)}`}
                              className="transition-transform duration-150 hover:scale-110"
                            >
                              {cell}
                            </button>
                          )}
                        >
                          {({ close }) => (
                            <>
                              {(
                                ['present', 'late', 'absent', 'excused'] as AttendanceStatus[]
                              ).map((option) => (
                                <MenuItem
                                  key={option}
                                  active={status === option}
                                  onClick={() => {
                                    void setStatus(person.id, key, option)
                                    close()
                                  }}
                                >
                                  {t(`attendance.status.${option}`)}
                                </MenuItem>
                              ))}
                            </>
                          )}
                        </Popover>
                      </div>
                    )
                  })}
                </div>

                <div
                  className="shrink-0 px-3 text-right"
                  style={{ width: 110 }}
                >
                  <p className="text-footnote font-semibold tnum text-label">
                    {person.performance.attendance
                      ? percent(person.performance.attendance.disciplineScore)
                      : '—'}
                  </p>
                  {person.performance.attendance &&
                  person.performance.attendance.late > 0 ? (
                    <p className="text-caption-2 tnum text-warn">
                      {person.performance.attendance.late} {t('attendance.late').toLowerCase()}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {/* Izoh */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 sm:px-6">
            {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((status) => (
              <li key={status} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-[6px] text-caption-2 font-bold',
                    STATUS_STYLE[status],
                  )}
                >
                  {STATUS_LETTER[status]}
                </span>
                <span className="text-caption text-label-secondary">
                  {t(`attendance.status.${status}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
