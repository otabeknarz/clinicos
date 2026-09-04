import { useState } from 'react'
import {
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Moon,
  ShieldAlert,
  ShieldQuestion,
  UserX,
} from 'lucide-react'

import { getDailyAttendance, markAttendance } from '@/api/attendance'
import { ExcusedReasonModal } from '@/components/modals/ExcusedReasonModal'
import { LateArrivalModal } from '@/components/modals/LateArrivalModal'
import { AttendanceFlagsBanner } from '@/components/staff/AttendanceFlagsBanner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { AttendanceTab } from '@/pages/staff/AttendanceTab'
import { cn } from '@/lib/cn'
import { addDays, isToday, startOfDay, toISODate } from '@/lib/dates'
import { dateLong } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { AttendanceStatus, DailyAttendanceRow } from '@/types/models'

type View = 'today' | 'board'

/** Belgilash tugmalari — bosilish tartibi ish oqimiga mos */
const OPTIONS: {
  status: AttendanceStatus
  icon: typeof CheckCircle2
  active: string
}[] = [
  { status: 'present', icon: CheckCircle2, active: 'bg-ok text-white' },
  { status: 'late', icon: Clock, active: 'bg-warn text-white' },
  { status: 'absent', icon: UserX, active: 'bg-bad text-white' },
  { status: 'excused', icon: ShieldQuestion, active: 'bg-fill-2 text-label' },
]

/**
 * DAVOMAT SAHIFASI.
 *
 * Registratura har kuni hamma xodimni shu yerda belgilaydi. Shuning
 * uchun asosiy ko'rinish — bitta kun va katta tugmalar, 21 kunlik
 * jadval emas: kunlik ish tez bajarilishi kerak.
 *
 * NEGA REGISTRATURA: klinikaga kim kelib-ketganini kun bo'yi ko'rib
 * turadigan yagona odam — registrator. Egasi esa buni faqat kuzatadi,
 * chunki o'zi har kuni klinikada bo'lmasligi mumkin.
 *
 * MOLIYA CHEKLOVI: bu yerda maosh ham, foiz ham ko'rsatilmaydi.
 * Davomat belgilash uchun ular kerak emas.
 */
export function AttendancePage() {
  const { t } = useI18n()
  const { can, session } = useAuth()
  const toast = useToast()

  const [view, setView] = useState<View>('today')
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [busy, setBusy] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [lateFor, setLateFor] = useState<DailyAttendanceRow | null>(null)
  const [excusedFor, setExcusedFor] = useState<DailyAttendanceRow | null>(null)

  const dateKey = toISODate(day)
  const canManage = can('attendance.manage')

  // Kelajakdagi kunni belgilash mantiqsiz — hali hech kim kelmagan
  const isFuture = day.getTime() > startOfDay(new Date()).getTime()

  const { data, loading, error, reload } = useAsync(
    () => getDailyAttendance(dateKey),
    [dateKey, version],
  )

  async function mark(row: DailyAttendanceRow, status: AttendanceStatus) {
    // Kechikishda kelish vaqti so'raladi — uni taxmin qilib bo'lmaydi
    if (status === 'late') {
      setLateFor(row)
      return
    }

    /*
      "Sababli" — yagona holat, u intizom ballini ham, jarimani ham
      o'chiradi. Shuning uchun sabab majburiy: yozilmasa, bu tugma
      kelmaganlikni yashirishning eng qulay yo'liga aylanadi.
    */
    if (status === 'excused') {
      setExcusedFor(row)
      return
    }

    setBusy(row.staffId)
    try {
      await markAttendance({
        staffId: row.staffId,
        date: dateKey,
        status,
        lateMinutes: 0,
        note: row.note,
        markedBy: session?.user.id,
        markedByName: session?.user.fullName,
      })
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  /** Sabab oynasidan kelgan natija */
  async function saveExcused(note: string) {
    if (!excusedFor) return
    try {
      await markAttendance({
        staffId: excusedFor.staffId,
        date: dateKey,
        status: 'excused',
        lateMinutes: 0,
        note,
        markedBy: session?.user.id,
        markedByName: session?.user.fullName,
      })
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  /** Kechikish oynasidan kelgan natija */
  async function saveLate(arrivedAt: string, lateMinutes: number, note: string) {
    if (!lateFor) return
    try {
      const saved = await markAttendance({
        staffId: lateFor.staffId,
        date: dateKey,
        status: 'late',
        lateMinutes,
        note,
        arrivedAt,
        markedBy: session?.user.id,
        markedByName: session?.user.fullName,
      })
      // Bayroqlangan yozuv sukut bilan o'tib ketmasligi kerak
      if (saved.flagged) toast.info(t('attendance.flag.willNotify'))
      else toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  /**
   * Odatiy kunda deyarli hamma keladi, shuning uchun bitta tugma bilan
   * hammani belgilab, keyin istisnolarni tuzatish tezroq.
   */
  async function markAllPresent() {
    const pending = (data?.rows ?? []).filter((r) => r.isWorkday && r.status === null)
    if (pending.length === 0) return

    setBusy('all')
    try {
      for (const row of pending) {
        await markAttendance({
          staffId: row.staffId,
          date: dateKey,
          status: 'present',
          lateMinutes: 0,
          note: '',
          markedBy: session?.user.id,
          markedByName: session?.user.fullName,
        })
      }
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title={t('attendance.title')} subtitle={t('attendance.subtitle')} />

      {/*
        Shubhali yozuvlar tasmasi — faqat egasida.
        Registratura o'zi belgilagan yozuvning bayroqlanganini
        ro'yxat bo'lib ko'rmaydi: ogohlantirish unga yozish paytida
        chiqadi, hisobot esa egasiga tegishli.
      */}
      {can('staff.manage') ? <AttendanceFlagsBanner className="mb-5" /> : null}

      <Card padded={false}>
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'today', label: t('attendance.tab.today') },
              { value: 'board', label: t('attendance.tab.board') },
            ]}
          />
        </div>

        {view === 'board' ? (
          <AttendanceTab />
        ) : (
          <>
            {/* --- Kun tanlash --- */}
            <div className="hairline flex flex-wrap items-center gap-2 p-4 sm:p-5">
              <IconButton
                label={t('action.prev')}
                onClick={() => setDay((d) => addDays(d, -1))}
              >
                <ChevronLeft size={17} />
              </IconButton>

              <Button
                variant="gray"
                size="sm"
                onClick={() => setDay(startOfDay(new Date()))}
              >
                {t('calendar.today')}
              </Button>

              <IconButton
                label={t('action.next')}
                disabled={isToday(day)}
                onClick={() => setDay((d) => addDays(d, 1))}
              >
                <ChevronRight size={17} />
              </IconButton>

              <span className="text-footnote font-medium text-label">{dateLong(day)}</span>

              {canManage && !isFuture && (data?.counts.unmarked ?? 0) > 0 ? (
                <Button
                  variant="tinted"
                  size="sm"
                  className="ml-auto"
                  icon={<CheckCheck size={15} />}
                  loading={busy === 'all'}
                  onClick={markAllPresent}
                >
                  {t('attendance.markAllPresent')}
                </Button>
              ) : null}
            </div>

            {error ? (
              <ErrorState onRetry={reload} />
            ) : loading && !data ? (
              <CardSkeleton className="m-5 border-0 shadow-none" />
            ) : !data || data.rows.length === 0 ? (
              <EmptyState title={t('attendance.noStaff')} className="py-12" />
            ) : (
              <>
                <DayCounts data={data} />

                <ul>
                  {data.rows.map((row) => (
                    <li key={row.staffId} className="hairline last:border-b-0">
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6',
                          !row.isWorkday && 'opacity-55',
                        )}
                      >
                        <Avatar name={row.fullName} size="sm" />

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-subhead font-medium text-label">
                            {row.fullName}
                          </span>
                          <span className="block truncate text-caption text-label-tertiary">
                            {row.positionTitle} · {row.shiftStart}—{row.shiftEnd}
                          </span>
                        </span>

                        {row.flagged ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-caption font-medium text-bad"
                            title={t('attendance.flag.reason.' + (row.arrivedAt ? 'backdated' : 'future'))}
                          >
                            <ShieldAlert size={13} />
                          </span>
                        ) : null}

                        {row.status === 'excused' && row.note ? (
                          <span
                            className="hidden max-w-48 shrink-0 truncate text-caption text-label-tertiary lg:block"
                            title={row.note}
                          >
                            {row.note}
                          </span>
                        ) : null}

                        {row.status === 'late' && row.lateMinutes > 0 ? (
                          <span className="shrink-0 text-right text-caption font-medium tnum text-warn">
                            {row.arrivedAt ? (
                              <span className="block">
                                {t('attendance.arrived', { time: row.arrivedAt })}
                              </span>
                            ) : null}
                            <span className="block">
                              {t('attendance.lateBy', { count: row.lateMinutes })}
                            </span>
                          </span>
                        ) : null}

                        {!row.isWorkday ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-label-tertiary">
                            <Moon size={13} />
                            {t('attendance.dayOff')}
                          </span>
                        ) : (
                          <StatusPicker
                            row={row}
                            disabled={!canManage || isFuture || busy === row.staffId}
                            onPick={(status) => mark(row, status)}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Card>

      <LateArrivalModal
        open={lateFor !== null}
        row={lateFor}
        date={dateKey}
        onClose={() => setLateFor(null)}
        onSubmit={saveLate}
      />

      <ExcusedReasonModal
        open={excusedFor !== null}
        row={excusedFor}
        onClose={() => setExcusedFor(null)}
        onSubmit={saveExcused}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Kunlik hisob                                                        */
/* ------------------------------------------------------------------ */

function DayCounts({ data }: { data: { counts: Record<string, number> } }) {
  const { t } = useI18n()
  const { counts } = data

  const rows = [
    { key: 'expected', label: t('attendance.expected'), tone: 'text-label' },
    { key: 'present', label: t('attendance.status.present'), tone: 'text-ok' },
    { key: 'late', label: t('attendance.status.late'), tone: 'text-warn' },
    { key: 'absent', label: t('attendance.status.absent'), tone: 'text-bad' },
    {
      key: 'unmarked',
      label: t('attendance.unmarked'),
      tone: counts.unmarked > 0 ? 'text-accent' : 'text-label-tertiary',
    },
  ]

  return (
    <div className="hairline flex flex-wrap gap-x-8 gap-y-3 px-5 py-4 sm:px-6">
      {rows.map((row) => (
        <div key={row.key}>
          <p className="text-caption text-label-tertiary">{row.label}</p>
          <p className={cn('mt-0.5 text-title-3 font-semibold tnum', row.tone)}>
            {counts[row.key]}
          </p>
        </div>
      ))}

      {counts.unmarked === 0 && counts.expected > 0 ? (
        <p className="ml-auto flex items-center gap-2 self-center text-footnote font-medium text-ok">
          <CheckCircle2 size={15} />
          {t('attendance.allMarked')}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Holat tanlash                                                       */
/* ------------------------------------------------------------------ */

/**
 * To'rtta holat bitta qatorda turadi — bosish uchun bitta harakat.
 *
 * Ochiladigan menyu emas: kuniga o'nlab marta bosiladigan tugmani
 * ikki bosishga aylantirish ishni sekinlashtiradi.
 */
function StatusPicker({
  row,
  disabled,
  onPick,
}: {
  row: DailyAttendanceRow
  disabled: boolean
  onPick: (status: AttendanceStatus) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = row.status === option.status

        return (
          <button
            key={option.status}
            type="button"
            disabled={disabled}
            title={t(`attendance.status.${option.status}`)}
            onClick={() => onPick(option.status)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5',
              'text-caption font-medium transition-colors duration-150',
              'disabled:pointer-events-none disabled:opacity-40',
              active ? option.active : 'bg-fill-4 text-label-secondary hover:bg-fill-3',
            )}
          >
            <Icon size={14} />
            <span className="hidden lg:inline">
              {t(`attendance.status.${option.status}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
