import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { fromISODate, isToday } from '@/lib/dates'
import { weekdaysShort } from '@/lib/format'
import { useI18n } from '@/i18n'
import type { AdmissionStatus, BedBoard as BedBoardData } from '@/types/models'

/**
 * SHAXMATKA — koyka × kun jadvali.
 *
 * Klassik statsionar ko'rinishi: chapda koykalar, tepada kunlar, ichida
 * band davrlar uzluksiz blok sifatida. Bir qarashda ko'rinadi:
 *   - qaysi koyka hozir bo'sh,
 *   - qaysisi qachon bo'shaydi,
 *   - qayerda "teshik" bor (bo'sh turgan kunlar = yo'qotilgan pul).
 */

/** Bitta kun ustunining kengligi (px) */
const DAY_WIDTH = 46
/** Bitta koyka qatorining balandligi (px) */
const ROW_HEIGHT = 38
/** Chapdagi qotib turadigan ustun kengligi (px) */
const LABEL_WIDTH = 116

const SPAN_STYLE: Record<AdmissionStatus, string> = {
  active: 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/25',
  planned: 'bg-fill-3 text-label-secondary ring-1 ring-inset ring-separator',
  discharged: 'bg-ok-soft text-ok ring-1 ring-inset ring-ok/20',
}

export function BedBoard({ data }: { data: BedBoardData }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const weekLabels = weekdaysShort()

  const boardWidth = data.days.length * DAY_WIDTH

  return (
    <div className="scroll-slim overflow-x-auto">
      <div style={{ minWidth: LABEL_WIDTH + boardWidth }}>
        {/* --- Kunlar sarlavhasi --- */}
        <div className="hairline flex">
          <div
            className="shrink-0 bg-raised px-3 pb-2 pt-1 text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary"
            style={{ width: LABEL_WIDTH }}
          >
            {t('ward.bed')}
          </div>

          <div className="flex" style={{ width: boardWidth }}>
            {data.days.map((day) => {
              const date = fromISODate(day)
              const today = isToday(date)
              return (
                <div
                  key={day}
                  className="shrink-0 pb-2 pt-1 text-center"
                  style={{ width: DAY_WIDTH }}
                >
                  <p className="text-caption-2 uppercase text-label-tertiary">
                    {weekLabels[date.getDay()]}
                  </p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full',
                      'text-caption font-semibold tnum',
                      today ? 'bg-accent text-white' : 'text-label',
                    )}
                  >
                    {date.getDate()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* --- Koyka qatorlari --- */}
        <div>
          {data.rows.map((row, rowIndex) => {
            // Xona o'zgarganda ajratuvchi chiziq qo'yamiz
            const previousRoom = rowIndex > 0 ? data.rows[rowIndex - 1].room.id : null
            const newRoom = previousRoom !== row.room.id

            return (
              <div
                key={row.bed.id}
                className={cn('flex', newRoom && rowIndex > 0 && 'border-t border-separator')}
              >
                {/* Koyka nomi — skrollda joyida qoladi */}
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-raised px-3"
                  style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      row.bed.status === 'occupied'
                        ? 'bg-accent'
                        : row.bed.status === 'maintenance'
                          ? 'bg-warn'
                          : 'bg-ok',
                    )}
                  />
                  <span className="truncate text-footnote font-medium tnum text-label">
                    {row.bed.label}
                  </span>
                  <span className="ml-auto shrink-0 text-caption-2 text-label-tertiary">
                    {t(`ward.category.${row.room.category}`).slice(0, 3)}
                  </span>
                </div>

                {/* Kunlar maydoni */}
                <div className="relative" style={{ width: boardWidth, height: ROW_HEIGHT }}>
                  {/* Kun to'ri */}
                  {data.days.map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        'absolute top-0 h-full border-l border-separator/50',
                        isToday(fromISODate(day)) && 'bg-accent-soft/30',
                      )}
                      style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  ))}

                  {/* Band davrlar */}
                  {row.spans.map((span) => {
                    const left = span.fromIndex * DAY_WIDTH
                    const width = (span.toIndex - span.fromIndex + 1) * DAY_WIDTH

                    return (
                      <button
                        key={span.admissionId}
                        type="button"
                        onClick={() => navigate(`/patients/${span.patientId}`)}
                        title={`${span.patientName} · ${span.doctorName}`}
                        className={cn(
                          'absolute top-1 flex items-center overflow-hidden px-2',
                          'text-caption font-medium transition-transform duration-150',
                          'hover:z-20 hover:scale-[1.01]',
                          SPAN_STYLE[span.status],
                          // Oraliqdan tashqariga chiqsa — o'sha tomonni tekis qoldiramiz
                          span.continuesBefore ? 'rounded-l-none' : 'rounded-l-[7px]',
                          span.continuesAfter ? 'rounded-r-none' : 'rounded-r-[7px]',
                        )}
                        style={{
                          left: left + 2,
                          width: width - 4,
                          height: ROW_HEIGHT - 8,
                        }}
                      >
                        <span className="truncate">{span.patientName}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Shaxmatka ostidagi izoh */
export function BedBoardLegend() {
  const { t } = useI18n()

  const items: { key: AdmissionStatus | 'free'; label: string; className: string }[] = [
    { key: 'active', label: t('ward.status.active'), className: 'bg-accent-soft ring-accent/25' },
    {
      key: 'planned',
      label: t('ward.status.planned'),
      className: 'bg-fill-3 ring-separator',
    },
    {
      key: 'discharged',
      label: t('ward.status.discharged'),
      className: 'bg-ok-soft ring-ok/20',
    },
    { key: 'free', label: t('ward.bedStatus.free'), className: 'bg-transparent ring-separator' },
  ]

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 sm:px-6">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span className={cn('h-3 w-6 rounded-[4px] ring-1 ring-inset', item.className)} />
          <span className="text-caption text-label-secondary">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
