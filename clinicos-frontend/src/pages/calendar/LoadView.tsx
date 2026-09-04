import { useNavigate } from 'react-router-dom'

import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { fromISODate, isToday } from '@/lib/dates'
import { percent, weekdaysShort } from '@/lib/format'
import { useI18n } from '@/i18n'
import type { DoctorLoad } from '@/types/models'

/**
 * YUKLAMA XARITASI.
 *
 * Egasi qabul yozmaydi — unga vaqt to'ri kerak emas. Unga kerak bo'lgani
 * boshqa savol: "kim to'la band, qayerda bo'sh soat qolyapti?"
 *
 * Har bir katak — bitta shifokorning bitta kuni. Rang qanchalik quyuq
 * bo'lsa, shuncha band. Oq katak — bo'sh kun, ya'ni yo'qotilgan daromad.
 */

const CELL_WIDTH = 40
const ROW_HEIGHT = 52
const LABEL_WIDTH = 200

export function LoadView({ data }: { data: DoctorLoad }) {
  const { t, tSpecialty } = useI18n()
  const navigate = useNavigate()
  const weekLabels = weekdaysShort()

  const boardWidth = data.days.length * CELL_WIDTH

  return (
    <div className="scroll-slim overflow-x-auto">
      <div style={{ minWidth: LABEL_WIDTH + boardWidth + 130 }}>
        {/* --- Sarlavha --- */}
        <div className="hairline flex items-end">
          <div
            className="shrink-0 px-5 pb-2 text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary sm:px-6"
            style={{ width: LABEL_WIDTH }}
          >
            {t('common.doctor')}
          </div>

          <div className="flex" style={{ width: boardWidth }}>
            {data.days.map((day) => {
              const date = fromISODate(day)
              return (
                <div
                  key={day}
                  className="shrink-0 pb-2 text-center"
                  style={{ width: CELL_WIDTH }}
                >
                  <p className="text-caption-2 uppercase text-label-tertiary">
                    {weekLabels[date.getDay()][0]}
                  </p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full',
                      'text-caption-2 font-semibold tnum',
                      isToday(date) ? 'bg-accent text-white' : 'text-label',
                    )}
                  >
                    {date.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          <div
            className="shrink-0 px-3 pb-2 text-right text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary"
            style={{ width: 130 }}
          >
            {t('calendar.load.utilization')}
          </div>
        </div>

        {/* --- Qatorlar --- */}
        <ul>
          {data.rows.map((row) => (
            <li key={row.doctorId} className="hairline flex items-center last:border-b-0">
              {/* Shifokor */}
              <button
                type="button"
                onClick={() => navigate(`/doctors/${row.doctorId}`)}
                className="row-press flex shrink-0 items-center gap-2.5 px-5 text-left sm:px-6"
                style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
              >
                <Avatar name={row.doctorName} size="xs" />
                <span className="min-w-0">
                  <span className="block truncate text-footnote font-medium text-label">
                    {row.doctorName}
                  </span>
                  <span className="block truncate text-caption-2 text-label-tertiary">
                    {tSpecialty(row.specialty)}
                  </span>
                </span>
              </button>

              {/* Kunlar */}
              <div className="flex" style={{ width: boardWidth, height: ROW_HEIGHT }}>
                {data.days.map((day, index) => {
                  const count = row.counts[index] ?? 0
                  const util = row.utilization[index] ?? 0

                  return (
                    <div
                      key={day}
                      className="flex shrink-0 items-center justify-center"
                      style={{ width: CELL_WIDTH }}
                      title={`${row.doctorName} · ${day} · ${count} · ${percent(util)}`}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-[8px]',
                          'text-caption font-semibold tnum transition-colors duration-150',
                          count === 0
                            ? 'bg-fill-4 text-label-quaternary'
                            : 'text-white',
                        )}
                        style={
                          count === 0
                            ? undefined
                            : {
                                // Bandlik qanchalik yuqori bo'lsa, rang shuncha quyuq
                                background: `color-mix(in srgb, var(--ios-blue) ${Math.max(
                                  22,
                                  Math.round(util),
                                )}%, var(--surface-sunken))`,
                                color: util > 55 ? '#fff' : 'var(--label-primary)',
                              }
                        }
                      >
                        {count || ''}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* O'rtacha bandlik */}
              <div className="shrink-0 px-3" style={{ width: 130 }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-caption tnum text-label-tertiary">
                    {row.total}
                  </span>
                  <span className="text-footnote font-semibold tnum text-label">
                    {percent(row.averageUtilization)}
                  </span>
                </div>
                <ProgressBar
                  value={row.averageUtilization}
                  tone={
                    row.averageUtilization > 80
                      ? 'warn'
                      : row.averageUtilization < 35
                        ? 'bad'
                        : 'ok'
                  }
                  className="mt-1.5"
                />
              </div>
            </li>
          ))}
        </ul>

        {/* --- Izoh --- */}
        <p className="px-5 py-3 text-caption text-label-tertiary sm:px-6">
          {t('calendar.load.hint')}
        </p>
      </div>
    </div>
  )
}
