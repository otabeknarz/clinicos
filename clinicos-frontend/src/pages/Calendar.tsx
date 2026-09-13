import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightLeft,
  CalendarOff,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'

import { getDoctorLoad, listAppointmentsRange } from '@/api/appointments'
import { listDaysOff } from '@/api/daysOff'
import { listDoctorsShort } from '@/api/doctors'
import { LoadView } from './calendar/LoadView'
import { doctorColors, STATUS_DOT, STATUS_ORDER, tint } from './calendar/colors'
import { BulkMoveModal } from './calendar/BulkMoveModal'
import { DayOffModal } from './calendar/DayOffModal'
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
import { useToast } from '@/store/toast-context'
import type { AppointmentExpanded, DayOff } from '@/types/models'

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
  const toast = useToast()
  /* Dam olish va ko'chirish oynalari */
  const [dayOffOpen, setDayOffOpen] = useState(false)
  const [moving, setMoving] = useState<{ date: string; doctorId: string | 'all' } | null>(null)

  const { data: doctors } = useAsync(() => listDoctorsShort(), [])

  const days = view === 'day' ? [anchor] : weekDays(anchor)
  const from = days[0]
  const to = days[days.length - 1]

  const { data, loading, error, reload } = useAsync(
    () => listAppointmentsRange(from, to, doctorId),
    [toISODate(from), toISODate(to), doctorId],
  )

  const rows = (data ?? []).filter((a) => a.status !== 'cancelled')

  const daysOff = useAsync(
    () => listDaysOff(toISODate(from), toISODate(to)),
    [toISODate(from), toISODate(to)],
  )

  /* Rang shifokorlar ro'yxatidagi tartibdan — izoh va kartalar mos kelsin */
  const colorOf = useMemo(() => doctorColors((doctors ?? []).map((d) => d.id)), [doctors])

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
    /* Klinika yopiq kunga forma ochilmaydi — server baribir rad etardi */
    const key = toISODate(day)
    const closed = (daysOff.data ?? []).find((d) => d.date === key && d.doctorId === null)
    if (closed) {
      toast.error(t('dayoff.clinicClosed') + (closed.reason ? ` — ${closed.reason}` : ''))
      return
    }
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

          {/*
            SHIFOKOR ISHLAMAY QOLDI — ikki qadam: kunni belgilash va
            qabullarni ko'chirish. Ikkalasi shu yerda, kalendar oldida.
          */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {can('daysoff.manage') ? (
              <Button variant="gray" size="sm" icon={<CalendarOff size={15} />} onClick={() => setDayOffOpen(true)}>
                {t('dayoff.button')}
              </Button>
            ) : null}
            {can('appointments.edit') ? (
              <Button
                variant="gray"
                size="sm"
                icon={<ArrowRightLeft size={15} />}
                onClick={() => setMoving({ date: toISODate(anchor), doctorId })}
              >
                {t('move.button')}
              </Button>
            ) : null}
          </div>
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
            <Legend
              appointments={rows}
              colorOf={colorOf}
              showDoctors={doctorId === 'all'}
              onPickDoctor={setDoctorId}
            />
            {/* Telefonda vaqt to'ri sig'maydi — ro'yxat ko'rinishi qulayroq */}
            <CalendarAgenda days={days} appointments={rows} colorOf={colorOf} daysOff={daysOff.data ?? []} className="md:hidden" />
            <CalendarGrid
              days={days}
              appointments={rows}
              colorOf={colorOf}
              daysOff={daysOff.data ?? []}
              doctorFilter={doctorId}
              canMove={can('appointments.edit')}
              onMove={(date, movingDoctor) => setMoving({ date, doctorId: movingDoctor })}
              showDoctor={doctorId === 'all'}
              canCreate={can('appointments.create')}
              onSlotClick={openSlot}
              className="hidden md:block"
            />
          </>
        )}
      </Card>

      <DayOffModal
        open={dayOffOpen}
        onClose={() => setDayOffOpen(false)}
        doctors={doctors ?? []}
        initialDate={toISODate(anchor)}
        initialDoctorId={doctorId}
        onSaved={(affected) => {
          setDayOffOpen(false)
          daysOff.reload()
          /* Shu kunlarda qabul bor — darhol ko'chirishga o'tamiz */
          if (affected && can('appointments.edit')) {
            toast.success(t('dayoff.affected', { count: affected.count }))
            setMoving({ date: affected.date, doctorId: affected.doctorId })
          }
        }}
      />

      <BulkMoveModal
        open={moving !== null}
        onClose={() => setMoving(null)}
        onDone={reload}
        doctors={doctors ?? []}
        initialDate={moving?.date ?? toISODate(anchor)}
        initialDoctorId={moving?.doctorId ?? 'all'}
      />

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
  colorOf,
  daysOff,
  doctorFilter,
  canMove,
  onMove,
  showDoctor,
  canCreate,
  onSlotClick,
  className,
}: {
  days: Date[]
  appointments: AppointmentExpanded[]
  colorOf: (doctorId: string) => string
  daysOff: DayOff[]
  /** Tanlangan shifokor — uning dam olishi ustunni to'liq yopadi */
  doctorFilter: string | 'all'
  canMove: boolean
  onMove: (date: string, doctorId: string | 'all') => void
  /** Hamma shifokor ko'rinayotganda kartada shifokor ismi ham yoziladi */
  showDoctor: boolean
  canCreate: boolean
  onSlotClick: (day: Date, time: string) => void
  className?: string
}) {
  const { t, tService } = useI18n()
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
          {days.map((day) => {
            const off = dayOffInfo(day, daysOff, doctorFilter)
            /* Ta'sir qilgan faol qabullar — ko'chirish tugmasi uchun */
            const affected = appointments.filter(
              (a) =>
                isSameDay(new Date(a.startsAt), day) &&
                (a.status === 'scheduled' || a.status === 'confirmed') &&
                (off.clinic || off.doctors.some((d) => d.doctorId === a.doctorId)),
            )
            return (
              <div key={day.toISOString()} className="px-2 py-2.5 text-center">
                <p className="text-caption-2 uppercase tracking-wide text-label-tertiary">
                  {weekLabels[day.getDay()]}
                </p>
                <p
                  className={cn(
                    'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full',
                    'text-footnote font-semibold tnum',
                    isToday(day) ? 'bg-accent text-white' : off.clinic ? 'bg-bad-soft text-bad' : 'text-label',
                  )}
                >
                  {day.getDate()}
                </p>
                {/* Kim ishlamaydi — kun sarlavhasining o'zida */}
                {off.clinic ? (
                  <p className="mt-1 truncate text-caption-2 font-semibold text-bad" title={off.clinic.reason}>
                    {t('dayoff.clinicBadge')}
                  </p>
                ) : off.doctors.length > 0 ? (
                  <p
                    className="mt-1 truncate text-caption-2 font-medium text-warn"
                    title={off.doctors.map((d) => `${d.doctorName ?? ''}${d.reason ? ` — ${d.reason}` : ''}`).join('\n')}
                  >
                    {off.doctors.length === 1
                      ? t('dayoff.doctorBadge', { name: shortName(off.doctors[0].doctorName ?? '') })
                      : t('dayoff.doctorsBadge', { count: off.doctors.length })}
                  </p>
                ) : null}
                {canMove && affected.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      onMove(
                        toISODate(day),
                        off.clinic ? 'all' : off.doctors.length === 1 ? (off.doctors[0].doctorId ?? 'all') : doctorFilter,
                      )
                    }
                    className="mx-auto mt-1 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-caption-2 font-semibold text-white hover:brightness-110"
                  >
                    <ArrowRightLeft size={10} /> {t('move.dayButton', { count: affected.length })}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* --- Vaqt to'ri --- */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          {/*
            BO'SH DAVR — bitta umumiy xabar. Ilgari har bir bo'sh ustunda
            "Qabul yo'q" yozilardi va u 08:00 katagida qabulning o'zidek
            ko'rinardi.
          */}
          {appointments.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center">
              <span className="rounded-full bg-raised px-4 py-2 text-footnote text-label-secondary shadow-sm ring-1 ring-separator">
                {canCreate ? t('calendar.emptyCreate') : t('calendar.noAppointments')}
              </span>
            </div>
          ) : null}
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
            const off = dayOffInfo(day, daysOff, doctorFilter)
            /* Klinika yopiq yoki tanlangan shifokor ishlamaydi — ustun chiziqli */
            const closedColumn = Boolean(off.clinic) || (doctorFilter !== 'all' && off.doctors.length > 0)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative border-l border-separator',
                  /* Bugungi ustun — ko'z qayerdan boshlashni darhol topsin */
                  isToday(day) && !closedColumn && 'bg-accent/[0.035]',
                )}
                style={{
                  height: totalHeight,
                  ...(closedColumn
                    ? {
                        backgroundImage:
                          'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-bad) 7%, transparent) 0 8px, transparent 8px 16px)',
                      }
                    : {}),
                }}
              >
                {/* Bo'sh slotlar — bosilsa yangi qabul */}
                {slots.map((slot, index) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSlotClick(day, slot)}
                    aria-label={`${slot}`}
                    className={cn(
                      'group absolute inset-x-0 transition-colors duration-150',
                      canCreate ? 'hover:bg-accent/[0.07]' : 'cursor-default',
                      index % 2 === 0 ? 'border-t border-separator' : 'border-t border-dashed border-separator/50',
                    )}
                    style={{ top: TOP_PAD + index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    {/*
                      Bo'sh vaqt ustiga kelganda "+ 09:30" — bosilsa shu vaqtga
                      qabul ochilishini bilmagan odam uchun.
                    */}
                    {canCreate ? (
                      <span className="pointer-events-none flex items-center gap-1 px-2 text-caption-2 font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        <Plus size={11} /> {slot}
                      </span>
                    ) : null}
                  </button>
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
                  const color = colorOf(appointment.doctor.id)
                  const status = appointment.status
                  const done = status === 'completed'
                  const missed = status === 'no_show'
                  const end = new Date(
                    new Date(appointment.startsAt).getTime() + appointment.durationMinutes * 60_000,
                  )
                  /*
                    Karta balandligiga qarab nima sig'adi:
                      < 50px — bitta qator: vaqt va bemor
                      < 70px — vaqt, bemor
                      katta  — vaqt, bemor, xizmat, shifokor
                  */
                  const compact = height < 50
                  const roomy = height >= 70

                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => navigate(`/patients/${appointment.patient.id}`)}
                      title={[
                        `${time(appointment.startsAt)}–${time(end)}`,
                        appointment.patient.fullName,
                        tService(appointment.service.name),
                        appointment.doctor.fullName,
                        t(APPOINTMENT_LABEL[status]),
                      ].join(' · ')}
                      className={cn(
                        'absolute overflow-hidden rounded-[8px] py-1 pl-2 pr-1.5 text-left',
                        'shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-[var(--surface-raised)]',
                        'transition-[transform,box-shadow] duration-150 hover:z-20 hover:-translate-y-px hover:shadow-md',
                        missed && 'opacity-70',
                      )}
                      style={{
                        top: TOP_PAD + top + 1,
                        height,
                        left: `calc(${event.left}% + 2px)`,
                        width: `calc(${event.width}% - 4px)`,
                        background: tint(color, done ? 10 : 18),
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {narrow ? null : (
                          <span
                            className="shrink-0 text-caption-2 font-semibold tnum"
                            style={{ color }}
                          >
                            {compact ? time(appointment.startsAt) : `${time(appointment.startsAt)}–${time(end)}`}
                          </span>
                        )}
                        {compact ? (
                          <span
                            className={cn(
                              'min-w-0 truncate text-caption font-semibold leading-tight text-label',
                              missed && 'line-through',
                            )}
                          >
                            {appointment.patient.fullName}
                          </span>
                        ) : null}
                        {/* Holat — rang emas, belgi: rang shifokorga band */}
                        <span className="ml-auto flex shrink-0 items-center">
                          {done ? (
                            <Check size={12} className="text-ok" strokeWidth={3} />
                          ) : (
                            <span className={cn('h-2 w-2 rounded-full ring-2 ring-[var(--surface-raised)]', STATUS_DOT[status])} />
                          )}
                        </span>
                      </span>
                      {compact ? null : (
                        <span
                          className={cn(
                            'mt-0.5 block truncate text-footnote font-semibold leading-tight text-label',
                            missed && 'line-through',
                          )}
                        >
                          {appointment.patient.fullName}
                        </span>
                      )}
                      {roomy && !narrow ? (
                        <span className="mt-0.5 block truncate text-caption-2 text-label-secondary">
                          {tService(appointment.service.name)}
                          {showDoctor ? ` · ${appointment.doctor.fullName}` : ''}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
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
  colorOf,
  daysOff,
  className,
}: {
  days: Date[]
  appointments: AppointmentExpanded[]
  colorOf: (doctorId: string) => string
  daysOff: DayOff[]
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
              {dayOffInfo(day, daysOff, 'all').clinic ? (
                <span className="rounded-full bg-bad-soft px-2 py-0.5 text-caption-2 font-semibold text-bad">
                  {t('dayoff.clinicBadge')}
                </span>
              ) : dayOffInfo(day, daysOff, 'all').doctors.length > 0 ? (
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-caption-2 font-medium text-warn">
                  {t('dayoff.doctorsBadge', { count: dayOffInfo(day, daysOff, 'all').doctors.length })}
                </span>
              ) : null}
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

                      {/* Shifokor rangi — kattalar to'ridagi bilan bir xil */}
                      <span
                        className="h-9 w-1 shrink-0 rounded-full"
                        style={{ background: colorOf(appointment.doctor.id) }}
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

/* ------------------------------------------------------------------ */
/* Izoh                                                                */
/* ------------------------------------------------------------------ */

/**
 * RANG VA BELGI IZOHI — to'r ustida.
 *
 * Rang nimani bildirishi yozilmasa, rangli kalendar kulrangidan ham
 * tushunarsizroq: odam har bir rangga o'zicha ma'no qo'yadi. Shifokor
 * nomi bosilsa, kalendar faqat o'sha shifokorga o'tadi.
 *
 * Faqat shu davrda qabuli BOR shifokorlar ko'rsatiladi — 20 kishilik
 * ro'yxat izoh emas, devor bo'lib qolardi.
 */
function Legend({
  appointments,
  colorOf,
  showDoctors,
  onPickDoctor,
}: {
  appointments: AppointmentExpanded[]
  colorOf: (doctorId: string) => string
  showDoctors: boolean
  onPickDoctor: (doctorId: string) => void
}) {
  const { t } = useI18n()

  const doctors = new Map<string, { id: string; name: string; count: number }>()
  for (const a of appointments) {
    const row = doctors.get(a.doctor.id) ?? { id: a.doctor.id, name: a.doctor.fullName, count: 0 }
    row.count += 1
    doctors.set(a.doctor.id, row)
  }
  const doctorList = [...doctors.values()].sort((a, b) => b.count - a.count)

  return (
    <div className="hairline flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-5">
      {showDoctors && doctorList.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {doctorList.map((doctor) => (
            <button
              key={doctor.id}
              type="button"
              onClick={() => onPickDoctor(doctor.id)}
              className="flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-caption font-medium text-label transition-colors hover:brightness-95"
              style={{ background: tint(colorOf(doctor.id), 14) }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(doctor.id) }} />
              {doctor.name}
              <span className="tnum text-label-tertiary">{doctor.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="ml-auto hidden flex-wrap items-center gap-3 text-caption text-label-secondary md:flex">
        {STATUS_ORDER.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            {status === 'completed' ? (
              <Check size={12} className="text-ok" strokeWidth={3} />
            ) : (
              <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
            )}
            {t(APPOINTMENT_LABEL[status])}
          </span>
        ))}
      </div>
    </div>
  )
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

/**
 * Shu kun kim ishlamaydi. Shifokor tanlangan bo'lsa — faqat o'sha
 * shifokorning dam olishi hisobga olinadi (boshqalari bu ko'rinishga
 * tegishli emas).
 */
function dayOffInfo(day: Date, daysOff: DayOff[], doctorFilter: string | 'all') {
  const key = toISODate(day)
  const rows = daysOff.filter((d) => d.date === key)
  return {
    clinic: rows.find((d) => d.doctorId === null) ?? null,
    doctors: rows.filter((d) => d.doctorId !== null && (doctorFilter === 'all' || d.doctorId === doctorFilter)),
  }
}

/** "Aziz Karimov" → "A. Karimov" — kun sarlavhasiga sig'sin */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}
