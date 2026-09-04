import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'

import { getDoctorLoad, listAppointmentsRange } from '@/api/appointments'
import { listDoctorsShort } from '@/api/doctors'
import { LoadView } from './calendar/LoadView'
import { AppointmentFormModal } from '@/components/modals/AppointmentFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import {
  addDays,
  isSameDay,
  isToday,
  minutesToTime,
  startOfWeek,
  toISODate,
  weekDays,
} from '@/lib/dates'
import { dateCompact, dateLong, time, weekdaysShort } from '@/lib/format'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '@/lib/status'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import type { AppointmentExpanded, AppointmentStatus } from '@/types/models'

type View = 'day' | 'week' | 'load'

/** Kalendar shkalasi: 08:00 dan 20:00 gacha, 30 daqiqalik qadam */
const DAY_START = 8 * 60
const DAY_END = 20 * 60
const STEP = 30
/** Bir 30 daqiqalik blok balandligi (px) */
const SLOT_HEIGHT = 44
/**
 * Yuqoridan bo'sh joy.
 *
 * Vaqt yorlig'i o'z chizig'ining O'RTASIDA turadi (-translate-y-1/2).
 * Birinchi yorliq (08:00) top=0 da bo'lgani uchun yarmi konteynerdan
 * chiqib ketardi va ko'rinmasdi. Shuning uchun butun to'rni pastga
 * suramiz.
 */
const TOP_PAD = 14

export function CalendarPage() {
  const { t } = useI18n()
  const { can, session } = useAuth()

  // Egasi qabul yozmaydi — unga vaqt to'ri emas, yuklama xaritasi kerak.
  // Shuning uchun boshlang'ich ko'rinish rolga qarab tanlanadi.
  const [view, setView] = useState<View>(() => (can('appointments.create') ? 'day' : 'load'))
  const [anchor, setAnchor] = useState(() => new Date())
  const [doctorId, setDoctorId] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [preset, setPreset] = useState<{ date: string; time: string } | null>(null)

  const { data: doctors } = useAsync(() => listDoctorsShort(), [])

  const days = view === 'day' ? [anchor] : weekDays(anchor)
  const from = days[0]
  const to = days[days.length - 1]

  const { data, loading, error, reload } = useAsync(
    () => listAppointmentsRange(from, to, doctorId),
    [toISODate(from), toISODate(to), doctorId],
  )

  const rows = (data ?? []).filter((a) => a.status !== 'cancelled')

  // Yuklama ko'rinishi uchun 14 kunlik oyna
  const loadFrom = startOfWeek(anchor)
  const loadTo = addDays(loadFrom, 13)
  const load = useAsync(
    () => getDoctorLoad(loadFrom, loadTo),
    [toISODate(loadFrom), toISODate(loadTo)],
    { skip: view !== 'load' },
  )

  function shift(direction: number) {
    setAnchor((current) => addDays(current, view === 'day' ? direction : direction * 7))
  }

  function openSlot(day: Date, slotTime: string) {
    if (!can('appointments.create')) return
    setPreset({ date: toISODate(day), time: slotTime })
    setFormOpen(true)
  }

  const rangeLabel =
    view === 'day'
      ? dateLong(anchor)
      : view === 'week'
        ? `${dateCompact(startOfWeek(anchor))} — ${dateCompact(addDays(startOfWeek(anchor), 6))}`
        : `${dateCompact(loadFrom)} — ${dateCompact(loadTo)}`

  return (
    <>
      <PageHeader
        title={t('calendar.title')}
        subtitle={rangeLabel}
        actions={
          can('appointments.create') ? (
            <Button
              icon={<CalendarPlus size={16} />}
              onClick={() => {
                setPreset(null)
                setFormOpen(true)
              }}
            >
              <span className="hidden sm:inline">{t('appts.add')}</span>
            </Button>
          ) : undefined
        }
      />

      <Card padded={false}>
        {/* --- Boshqaruv paneli --- */}
        <div className="hairline flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-1">
            <IconButton label={t('action.prev')} onClick={() => shift(-1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <Button variant="gray" size="sm" onClick={() => setAnchor(new Date())}>
              {t('calendar.today')}
            </Button>
            <IconButton label={t('action.next')} onClick={() => shift(1)}>
              <ChevronRight size={17} />
            </IconButton>
          </div>

          <Segmented<View>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: t('calendar.view.day') },
              { value: 'week', label: t('calendar.view.week') },
              { value: 'load', label: t('calendar.view.load') },
            ]}
          />

          {session?.user.role !== 'doctor' ? (
            <Select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              options={[
                { value: 'all', label: t('calendar.allDoctors') },
                ...(doctors ?? []).map((d) => ({ value: d.id, label: d.fullName })),
              ]}
              className="sm:w-56"
              placeholder={t('calendar.allDoctors')}
            />
          ) : null}
        </div>

        {/* --- To'r --- */}
        {view === 'load' ? (
          load.error ? (
            <ErrorState onRetry={load.reload} />
          ) : load.loading || !load.data ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-[10px]" />
              ))}
            </div>
          ) : (
            <LoadView data={load.data} />
          )
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-[10px]" />
            ))}
          </div>
        ) : (
          <>
            {/* Telefonda vaqt to'ri sig'maydi — ro'yxat ko'rinishi qulayroq */}
            <CalendarAgenda days={days} appointments={rows} className="md:hidden" />
            <CalendarGrid
              days={days}
              appointments={rows}
              onSlotClick={openSlot}
              className="hidden md:block"
            />
          </>
        )}
      </Card>

      <AppointmentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        presetDate={preset?.date}
        presetTime={preset?.time}
        presetDoctorId={doctorId !== 'all' ? doctorId : undefined}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* To'r                                                                */
/* ------------------------------------------------------------------ */

function CalendarGrid({
  days,
  appointments,
  onSlotClick,
  className,
}: {
  days: Date[]
  appointments: AppointmentExpanded[]
  onSlotClick: (day: Date, time: string) => void
  className?: string
}) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const slots = useMemo(() => {
    const out: string[] = []
    for (let m = DAY_START; m < DAY_END; m += STEP) out.push(minutesToTime(m))
    return out
  }, [])

  const weekLabels = weekdaysShort()
  const gridHeight = ((DAY_END - DAY_START) / STEP) * SLOT_HEIGHT
  const totalHeight = gridHeight + TOP_PAD * 2

  return (
    <div className={cn('scroll-slim overflow-x-auto', className)}>
      <div className="min-w-[640px]">
        {/* --- Kun sarlavhalari --- */}
        <div
          className="hairline sticky top-0 z-10 grid bg-raised"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="px-2 py-2.5 text-center">
              <p className="text-caption-2 uppercase tracking-wide text-label-tertiary">
                {weekLabels[day.getDay()]}
              </p>
              <p
                className={cn(
                  'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full',
                  'text-footnote font-semibold tnum',
                  isToday(day) ? 'bg-accent text-white' : 'text-label',
                )}
              >
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* --- Vaqt to'ri --- */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          {/* Vaqt ustuni */}
          <div className="relative" style={{ height: totalHeight }}>
            {slots.map((slot, index) =>
              index % 2 === 0 ? (
                <span
                  key={slot}
                  className="absolute right-2 -translate-y-1/2 text-caption-2 tnum text-label-tertiary"
                  style={{ top: TOP_PAD + index * SLOT_HEIGHT }}
                >
                  {slot}
                </span>
              ) : null,
            )}
          </div>

          {/* Kun ustunlari */}
          {days.map((day) => {
            const dayAppointments = appointments.filter((a) =>
              isSameDay(new Date(a.startsAt), day),
            )

            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-separator"
                style={{ height: totalHeight }}
              >
                {/* Bo'sh slotlar — bosilsa yangi qabul */}
                {slots.map((slot, index) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSlotClick(day, slot)}
                    aria-label={`${slot}`}
                    className={cn(
                      'absolute inset-x-0 transition-colors duration-150 hover:bg-fill-4',
                      index % 2 === 0 ? 'border-t border-separator' : 'border-t border-separator/40',
                    )}
                    style={{ top: TOP_PAD + index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  />
                ))}

                {/* Hozirgi vaqt chizig'i */}
                {isToday(day) ? <NowLine /> : null}

                {/* Qabullar — ustma-ust tushganlari yonma-yon */}
                {placeEvents(dayAppointments).map((event) => {
                  const { appointment } = event
                  const top = ((event.startMin - DAY_START) / STEP) * SLOT_HEIGHT
                  const height = Math.max(
                    26,
                    ((event.endMin - event.startMin) / STEP) * SLOT_HEIGHT - 3,
                  )
                  const narrow = event.width < 20

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                      title={`${time(appointment.startsAt)} · ${appointment.patient.fullName} · ${appointment.doctor.fullName}`}
                      className={cn(
                        'absolute overflow-hidden rounded-[7px] px-1.5 py-0.5 text-left',
                        'ring-1 ring-[var(--surface-raised)]',
                        'transition-[transform,box-shadow] duration-150 hover:z-20 hover:shadow-md',
                        EVENT_STYLE[appointment.status],
                      )}
                      style={{
                        top: TOP_PAD + top + 1,
                        height,
                        left: `calc(${event.left}% + 2px)`,
                        width: `calc(${event.width}% - 4px)`,
                      }}
                    >
                      {narrow ? null : (
                        <span className="block truncate text-caption-2 font-semibold tnum opacity-80">
                          {time(appointment.startsAt)}
                        </span>
                      )}
                      <span className="block truncate text-caption font-medium leading-tight">
                        {appointment.patient.fullName}
                      </span>
                      {height > 58 && !narrow ? (
                        <span className="block truncate text-caption-2 opacity-70">
                          {appointment.doctor.fullName}
                        </span>
                      ) : null}
                    </button>
                  )
                })}

                {dayAppointments.length === 0 ? (
                  <p className="pointer-events-none absolute inset-x-0 top-8 text-center text-caption text-label-quaternary">
                    {t('calendar.noAppointments')}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



/* ------------------------------------------------------------------ */
/* Telefon uchun agenda ko'rinishi                                     */
/* ------------------------------------------------------------------ */

/**
 * Telefonda 12 soatlik vaqt to'rini ko'rsatib bo'lmaydi — u gorizontal
 * skrollga majbur qiladi va barmoq bilan ishlash noqulay.
 *
 * O'rniga oddiy ro'yxat: kun bo'yicha guruhlangan, vaqt chapda, holat
 * o'ngda. Bu shifokor uchun eng kerakli ko'rinish — "bugun kim keladi".
 */
function CalendarAgenda({
  days,
  appointments,
  className,
}: {
  days: Date[]
  appointments: AppointmentExpanded[]
  className?: string
}) {
  const { t, tService } = useI18n()
  const navigate = useNavigate()
  const weekLabels = weekdaysShort()

  return (
    <div className={className}>
      {days.map((day) => {
        const dayRows = appointments
          .filter((a) => isSameDay(new Date(a.startsAt), day))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

        return (
          <section key={day.toISOString()}>
            {/* Kun sarlavhasi — skroll qilganda tepada qoladi */}
            <header className="material hairline sticky top-16 z-10 flex items-center gap-2 px-5 py-2">
              <span
                className={cn(
                  'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5',
                  'text-caption font-semibold tnum',
                  isToday(day) ? 'bg-accent text-white' : 'bg-fill-4 text-label',
                )}
              >
                {day.getDate()}
              </span>
              <span className="text-footnote font-medium text-label-secondary">
                {weekLabels[day.getDay()]}
              </span>
              <span className="ml-auto text-caption tnum text-label-tertiary">
                {dayRows.length}
              </span>
            </header>

            {dayRows.length === 0 ? (
              <p className="px-5 py-6 text-center text-footnote text-label-tertiary">
                {t('calendar.noAppointments')}
              </p>
            ) : (
              <ul>
                {dayRows.map((appointment) => (
                  <li key={appointment.id} className="hairline last:border-b-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                      className="row-press flex w-full items-center gap-3 px-5 py-3 text-left"
                    >
                      <span className="w-12 shrink-0">
                        <span className="block text-subhead font-semibold tnum text-label">
                          {time(appointment.startsAt)}
                        </span>
                        <span className="block text-caption-2 tnum text-label-tertiary">
                          {appointment.durationMinutes} {t('common.min')}
                        </span>
                      </span>

                      {/* Holatni bildiruvchi rangli chiziq */}
                      <span
                        className={cn(
                          'h-9 w-1 shrink-0 rounded-full',
                          STATUS_STRIPE[appointment.status],
                        )}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-subhead font-medium text-label">
                          {appointment.patient.fullName}
                        </span>
                        <span className="block truncate text-caption text-label-tertiary">
                          {appointment.doctor.fullName} · {tService(appointment.service.name)}
                        </span>
                      </span>

                      <Badge tone={APPOINTMENT_TONE[appointment.status]}>
                        {t(APPOINTMENT_LABEL[appointment.status])}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

const STATUS_STRIPE: Record<AppointmentStatus, string> = {
  scheduled: 'bg-neutral',
  confirmed: 'bg-accent',
  checked_in: 'bg-warn',
  completed: 'bg-ok',
  cancelled: 'bg-fill-2',
  no_show: 'bg-bad',
}

/* ------------------------------------------------------------------ */
/* Ustma-ust tushgan qabullarni joylashtirish                          */
/* ------------------------------------------------------------------ */

interface PlacedEvent {
  appointment: AppointmentExpanded
  startMin: number
  endMin: number
  /** Chapdan foizda */
  left: number
  /** Kenglik foizda */
  width: number
}

/**
 * Bir vaqtga to'g'ri kelgan qabullar (turli shifokorlarda) bir-birining
 * ustiga chiqmasligi kerak — ular yonma-yon ustunlarga bo'linadi.
 *
 * Ishlash tartibi:
 *   1. Boshlanish vaqti bo'yicha saralaymiz.
 *   2. Vaqti kesishadigan qabullarni bitta "guruh"ga yig'amiz.
 *   3. Guruh ichida har birini bo'sh ustunga joylashtiramiz.
 *   4. Kenglik = 100% / guruhdagi ustunlar soni.
 */
function placeEvents(appointments: AppointmentExpanded[]): PlacedEvent[] {
  const items = appointments
    .map((appointment) => {
      const start = new Date(appointment.startsAt)
      const startMin = start.getHours() * 60 + start.getMinutes()
      return {
        appointment,
        startMin,
        // Juda qisqa qabullar ham bosilishi uchun eng kami 20 daqiqa
        endMin: startMin + Math.max(20, appointment.durationMinutes),
      }
    })
    .filter((item) => item.startMin >= DAY_START && item.startMin < DAY_END)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const placed: PlacedEvent[] = []
  let group: typeof items = []
  let groupEnd = -1

  const flush = () => {
    if (group.length === 0) return

    // Guruh ichida ustunlarga taqsimlash
    const columns: number[] = [] // har bir ustunning oxirgi tugash vaqti
    const columnOf = new Map<number, number>()

    group.forEach((item, index) => {
      let column = columns.findIndex((end) => end <= item.startMin)
      if (column === -1) {
        column = columns.length
        columns.push(item.endMin)
      } else {
        columns[column] = item.endMin
      }
      columnOf.set(index, column)
    })

    const width = 100 / columns.length
    group.forEach((item, index) => {
      const column = columnOf.get(index) ?? 0
      placed.push({ ...item, left: column * width, width })
    })

    group = []
    groupEnd = -1
  }

  for (const item of items) {
    if (group.length > 0 && item.startMin >= groupEnd) flush()
    group.push(item)
    groupEnd = Math.max(groupEnd, item.endMin)
  }
  flush()

  return placed
}

/**
 * Holat ranglari — ataylab kuchsiz. Kalendar rang-barang bo'lib
 * ketmasligi kerak, chunki asosiy ma'lumot — vaqt va ism.
 */
const EVENT_STYLE: Record<AppointmentStatus, string> = {
  scheduled: 'bg-fill-3 text-label',
  confirmed: 'bg-accent-soft text-accent',
  checked_in: 'bg-warn-soft text-warn',
  completed: 'bg-ok-soft text-ok',
  cancelled: 'bg-fill-4 text-label-tertiary line-through',
  no_show: 'bg-bad-soft text-bad',
}

function NowLine() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < DAY_START || minutes > DAY_END) return null

  const top = TOP_PAD + ((minutes - DAY_START) / STEP) * SLOT_HEIGHT

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top }}
      aria-hidden
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-bad" />
      <span className="h-px flex-1 bg-bad" />
    </div>
  )
}
