import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  CreditCard,
  LockKeyhole,
  PhoneCall,
  Search,
  Stethoscope,
  UserPlus,
  UserX,
  Wallet,
} from 'lucide-react'

import { setAppointmentStatus } from '@/api/appointments'
import { getReceptionSummary } from '@/api/reception'
import { getMyWorkSchedule } from '@/api/staff'
import { AppointmentFormModal } from '@/components/modals/AppointmentFormModal'
import { PatientFormModal } from '@/components/modals/PatientFormModal'
import { PaymentFormModal } from '@/components/modals/PaymentFormModal'
import { ShiftCloseModal } from '@/components/modals/ShiftCloseModal'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateLong, money, moneyShort, phone as fmtPhone, time } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { ReceptionQueueItem, ReceptionSummary } from '@/types/models'

/** Panel o'zini yangilab turadi — navbat tez o'zgaradi */
const REFRESH_MS = 45_000

/**
 * REGISTRATURA PANELI.
 *
 * Egasining paneli "qanday ketyapti" degan savolga javob beradi.
 * Registratura paneli esa boshqa savolga: "hozir nima qilishim kerak".
 *
 * Shuning uchun bu yerda grafik ham, oylik daromad ham yo'q. Faqat
 * navbat, keyingi qabullar, e'tibor talab qiladigan ishlar va o'z
 * kassasi.
 *
 * MOLIYA CHEKLOVI: registrator faqat O'ZI qabul qilgan bugungi pulni
 * ko'radi. Klinikaning daromadi, boshqa smenalar, kassa nazorati
 * hisoboti unga ko'rinmaydi — bu spec talabi.
 */
export function ReceptionPage() {
  const { t } = useI18n()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  const { data, loading, error, reload } = useAsync(
    () => getReceptionSummary(userId),
    [userId],
  )

  // Navbat o'zgaradi — panel o'zi yangilanib turadi
  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  const [patientOpen, setPatientOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [shiftOpen, setShiftOpen] = useState(false)
  const [payFor, setPayFor] = useState<ReceptionQueueItem | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  const firstName = session?.user.fullName.split(' ')[0] ?? ''

  function openPayment(item: ReceptionQueueItem | null) {
    setPayFor(item)
    setPayOpen(true)
  }

  return (
    <>
      <PageHeader
        title={`${t('reception.title')}, ${firstName}`}
        subtitle={
          data ? t('reception.subtitle', { count: data.today.total }) : t('common.loading')
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden rounded-[10px] bg-fill-4 px-3 py-2 text-footnote font-medium text-label-secondary lg:inline-block">
              {dateLong(new Date())}
            </span>
            <ShiftButton summary={data} onOpen={() => setShiftOpen(true)} />
          </div>
        }
      />

      <QuickActions
        onNewPatient={() => setPatientOpen(true)}
        onNewAppointment={() => setAppointmentOpen(true)}
        onNewPayment={() => openPayment(null)}
      />

      {error ? (
        <Card className="mt-5">
          <ErrorState onRetry={reload} />
        </Card>
      ) : loading && !data ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <CardSkeleton className="min-h-96" />
          <CardSkeleton className="min-h-96" />
        </div>
      ) : data ? (
        <>
          <AttentionRow data={data} onPay={() => openPayment(null)} />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <QueueCard data={data} onReload={reload} onPay={openPayment} />

            <div className="grid content-start gap-5">
              <TodayProgressCard data={data} />
              <CashboxCard data={data} onClose={() => setShiftOpen(true)} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <UpcomingCard data={data} onReload={reload} />
            <MyScheduleCard />
          </div>
        </>
      ) : null}

      {/* --- Formalar --- */}
      <PatientFormModal
        open={patientOpen}
        onClose={() => setPatientOpen(false)}
        onSaved={() => {
          setPatientOpen(false)
          reload()
        }}
      />

      <AppointmentFormModal
        open={appointmentOpen}
        onClose={() => setAppointmentOpen(false)}
        onSaved={() => {
          setAppointmentOpen(false)
          reload()
        }}
      />

      <PaymentFormModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSaved={reload}
        preset={
          payFor
            ? {
                patientId: payFor.patientId,
                patientName: payFor.patientName,
                doctorId: payFor.doctorId,
                serviceId: payFor.serviceId,
                appointmentId: payFor.appointmentId,
              }
            : null
        }
      />

      <ShiftCloseModal
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        onClosed={reload}
        expectedCash={data?.cash.cash ?? 0}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Mening ish jadvalim                                                 */
/* ------------------------------------------------------------------ */

/**
 * Registratorning o'z ish kunlari.
 *
 * NEGA SHU YERDA: "ertaga ishlaymanmi?" degan savol kun davomida
 * paydo bo'ladi. Uni birovdan so'rash yoki menyu kezish o'rniga
 * xodim o'z panelida ko'radi.
 *
 * Jadvalni klinika egasi belgilaydi — bu yerdan o'zgartirilmaydi.
 */
function MyScheduleCard() {
  const { t } = useI18n()
  const { session } = useAuth()

  const month = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const { data, loading } = useAsync(
    () => getMyWorkSchedule(session?.user.email ?? '', month),
    [session?.user.email, month],
  )

  // Xodim kartasi bo'lmasa, karta umuman ko'rsatilmaydi —
  // bo'sh blok panelni faqat cho'zadi
  if (loading || !data) return null

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('schedule.mine')}
        action={
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            {t('action.viewAll')}
            <ArrowRight size={14} />
          </Link>
        }
      />
      <WorkScheduleCalendar staffId={data.staffId} className="mt-4" />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Smenani yopish tugmasi                                              */
/* ------------------------------------------------------------------ */

function ShiftButton({
  summary,
  onOpen,
}: {
  summary: ReceptionSummary | null
  onOpen: () => void
}) {
  const { t } = useI18n()

  if (summary?.cash.shiftClosed) {
    return (
      <Badge tone="ok" dot>
        <CheckCircle2 size={11} />
        {t('reception.shiftDone')}
      </Badge>
    )
  }

  return (
    <Button variant="tinted" icon={<Wallet size={16} />} onClick={onOpen}>
      {t('shift.close')}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* Tezkor amallar                                                      */
/* ------------------------------------------------------------------ */

/**
 * Registratorning kunlik ishining 90% shu to'rtta tugma.
 *
 * Ular sahifaning eng tepasida turadi: menyudan qidirish shart emas.
 */
function QuickActions({
  onNewPatient,
  onNewAppointment,
  onNewPayment,
}: {
  onNewPatient: () => void
  onNewAppointment: () => void
  onNewPayment: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const actions = [
    {
      key: 'appointment',
      icon: <CalendarPlus size={20} />,
      label: t('reception.newAppointment'),
      tone: 'bg-accent-soft text-accent',
      onClick: onNewAppointment,
    },
    {
      key: 'patient',
      icon: <UserPlus size={20} />,
      label: t('reception.newPatient'),
      tone: 'bg-brand-soft text-brand',
      onClick: onNewPatient,
    },
    {
      key: 'payment',
      icon: <CreditCard size={20} />,
      label: t('reception.takePayment'),
      tone: 'bg-ok-soft text-ok',
      onClick: onNewPayment,
    },
    {
      key: 'search',
      icon: <Search size={20} />,
      label: t('reception.findPatient'),
      tone: 'bg-fill-3 text-label-secondary',
      onClick: () => navigate('/patients'),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className="card squircle flex items-center gap-3 p-4 text-left transition-transform duration-150 active:scale-[0.98] hover:bg-fill-4"
        >
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-[10px]',
              action.tone,
            )}
          >
            {action.icon}
          </span>
          <span className="min-w-0 text-subhead font-medium text-label">{action.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* E'tibor talab qiladiganlar                                          */
/* ------------------------------------------------------------------ */

/**
 * Kun davomida "esdan chiqadigan" ishlar shu yerda to'planadi.
 *
 * Eng tepada oldindan to'lov olinmaganlar turadi: bemor allaqachon
 * klinikada, shifokorga kirib ketishi mumkin, lekin puli olinmagan.
 */
function AttentionRow({ data, onPay }: { data: ReceptionSummary; onPay: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { attention } = data

  const items = [
    attention.prepaidUnpaid.count > 0 && {
      key: 'prepaid',
      tone: 'bad' as const,
      icon: <LockKeyhole size={16} />,
      title: t('reception.prepaidUnpaid', { count: attention.prepaidUnpaid.count }),
      hint: t('reception.prepaidUnpaidHint'),
      amount: attention.prepaidUnpaid.amount,
      action: t('reception.takePayment'),
      onClick: onPay,
    },
    attention.unpaid.count > 0 && {
      key: 'unpaid',
      tone: 'warn' as const,
      icon: <Banknote size={16} />,
      title: t('reception.unpaid', { count: attention.unpaid.count }),
      hint: '',
      amount: attention.unpaid.amount,
      action: t('reception.unpaidAction'),
      onClick: onPay,
    },
    attention.unconfirmed > 0 && {
      key: 'unconfirmed',
      tone: 'accent' as const,
      icon: <PhoneCall size={16} />,
      title: t('reception.unconfirmed', { count: attention.unconfirmed }),
      hint: '',
      amount: 0,
      action: t('reception.unconfirmedAction'),
      onClick: () => navigate('/appointments'),
    },
    attention.unmarkedAttendance > 0 && {
      key: 'attendance',
      tone: 'accent' as const,
      icon: <CalendarCheck size={16} />,
      title: t('attendance.reception', { count: attention.unmarkedAttendance }),
      hint: '',
      amount: 0,
      action: t('attendance.receptionAction'),
      onClick: () => navigate('/attendance'),
    },
    attention.followUps > 0 && {
      key: 'followups',
      tone: 'brand' as const,
      icon: <Clock size={16} />,
      title: t('reception.followUps', { count: attention.followUps }),
      hint: '',
      amount: 0,
      action: t('reception.followUpsAction'),
      onClick: () => navigate('/patients'),
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item))

  if (items.length === 0) {
    return (
      <Card className="mt-5 flex items-center gap-3 bg-ok-soft">
        <CheckCircle2 size={20} className="shrink-0 text-ok" />
        <span className="text-subhead font-medium text-ok">
          {t('reception.attentionEmpty')}
        </span>
      </Card>
    )
  }

  const TONE_ICON: Record<string, string> = {
    bad: 'bg-bad-soft text-bad',
    warn: 'bg-warn-soft text-warn',
    accent: 'bg-accent-soft text-accent',
    brand: 'bg-brand-soft text-brand',
  }

  return (
    <Card className="mt-5" padded={false}>
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <CardHeader title={t('reception.attention')} />
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.key} className="hairline last:border-b-0">
            {/*
              Telefonda ikki qatorga bo'linadi: yuqorida yozuv (to'liq,
              kesilmasdan), pastda summa va amal tugmasi.

              NEGA: bitta qatorda yozuv 90px ga siqilib "2 ta ..."
              bo'lib qolardi — registrator nima qilishi kerakligini
              o'qiy olmasdi. Kengroq ekranda hammasi bitta qatorda.
            */}
            <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-[9px]',
                    TONE_ICON[item.tone],
                  )}
                >
                  {item.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-subhead font-medium text-label sm:truncate">
                    {item.title}
                  </span>
                  {item.hint ? (
                    <span className="block text-caption text-label-tertiary sm:truncate">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pl-12 sm:ml-auto sm:shrink-0 sm:pl-0">
                {item.amount > 0 ? (
                  <span className="text-subhead font-semibold tnum text-label">
                    {moneyShort(item.amount)}
                  </span>
                ) : null}

                <Button variant="plain" size="sm" onClick={item.onClick}>
                  {item.action}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Navbat                                                              */
/* ------------------------------------------------------------------ */

/**
 * Hozir klinikada o'tirib, shifokorni kutayotganlar.
 *
 * Tartib — kutish vaqti bo'yicha: eng uzoq kutgan tepada. Registrator
 * "kim keyingi" degan savolni o'ylab o'tirmaydi.
 *
 * Oldindan to'lanadigan xizmatga puli olinmagan bemor qizil bilan
 * ajratiladi va uning qatorida "Shifokorga" tugmasi yo'q — avval
 * to'lov. Bu CEO tomonda xizmatga qo'yilgan sozlamaning bevosita
 * natijasi.
 */
function QueueCard({
  data,
  onReload,
  onPay,
}: {
  data: ReceptionSummary
  onReload: () => void
  onPay: (item: ReceptionQueueItem) => void
}) {
  const { t, tService } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  async function advance(item: ReceptionQueueItem, status: 'completed' | 'no_show') {
    setBusy(item.appointmentId)
    try {
      await setAppointmentStatus(item.appointmentId, status)
      onReload()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('reception.queue')}
          subtitle={
            data.waiting.length > 0
              ? t('reception.queueHint')
              : undefined
          }
          action={
            <span className="rounded-[8px] bg-fill-4 px-2.5 py-1 text-footnote font-semibold tnum text-label">
              {data.waiting.length}
            </span>
          }
        />
      </div>

      {data.waiting.length === 0 ? (
        <EmptyState
          icon={<Stethoscope size={24} strokeWidth={1.75} />}
          title={t('reception.queueEmpty')}
          description=""
          className="py-12"
        />
      ) : (
        <ul className="max-h-[560px] overflow-y-auto scroll-slim">
          {data.waiting.map((item) => {
            const blocked = item.prepaid && item.paymentStatus !== 'paid'

            return (
              <li
                key={item.appointmentId}
                className={cn('hairline last:border-b-0', blocked && 'bg-bad-soft/40')}
              >
                <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${item.patientId}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar name={item.patientName} size="sm" />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-subhead font-medium text-label">
                        {item.patientName}
                      </span>
                      <span className="block truncate text-caption text-label-tertiary">
                        {item.doctorName} · {tService(item.serviceName)}
                      </span>
                    </span>
                  </button>

                  {/* Kutish vaqti — 20 daqiqadan oshsa diqqatni tortadi */}
                  <span
                    className={cn(
                      'shrink-0 text-caption font-medium tnum',
                      item.waitingMinutes >= 20 ? 'text-warn' : 'text-label-tertiary',
                    )}
                  >
                    {t('reception.waitingFor', { count: item.waitingMinutes })}
                  </span>

                  {blocked ? (
                    <>
                      <Badge tone="bad" dot>
                        <LockKeyhole size={11} />
                        {t('reception.blocked')}
                      </Badge>
                      <Button size="sm" onClick={() => onPay(item)}>
                        {money(item.price)}
                      </Button>
                    </>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="gray"
                        size="sm"
                        icon={<UserX size={14} />}
                        disabled={busy === item.appointmentId}
                        onClick={() => advance(item, 'no_show')}
                      >
                        <span className="hidden sm:inline">{t('reception.noShow')}</span>
                      </Button>
                      <Button
                        variant="tinted"
                        size="sm"
                        icon={<CheckCircle2 size={14} />}
                        loading={busy === item.appointmentId}
                        onClick={() => advance(item, 'completed')}
                      >
                        {t('reception.complete')}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Bugungi jadval                                                      */
/* ------------------------------------------------------------------ */

function TodayProgressCard({ data }: { data: ReceptionSummary }) {
  const { t } = useI18n()
  const { today } = data

  const donePct = today.total > 0 ? (today.completed / today.total) * 100 : 0

  const rows = [
    { key: 'done', label: t('reception.done'), value: today.completed, tone: 'text-ok' },
    { key: 'left', label: t('reception.left'), value: today.remaining, tone: 'text-label' },
    {
      key: 'noshow',
      label: t('appts.status.no_show'),
      value: today.noShow,
      tone: today.noShow > 0 ? 'text-bad' : 'text-label-tertiary',
    },
    {
      key: 'cancelled',
      label: t('appts.status.cancelled'),
      value: today.cancelled,
      tone: 'text-label-tertiary',
    },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader title={t('reception.progress')} subtitle={t('common.today')} />

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-title-1 font-bold tnum text-label">{today.completed}</span>
        <span className="text-subhead text-label-tertiary">/ {today.total}</span>
      </div>

      <ProgressBar value={donePct} tone="ok" className="mt-2" />

      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-footnote text-label-secondary">{row.label}</span>
            <span className={cn('text-footnote font-semibold tnum', row.tone)}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Kassa                                                               */
/* ------------------------------------------------------------------ */

/**
 * Faqat shu registrator qabul qilgan bugungi pul.
 *
 * Klinikaning umumiy daromadi bu yerda YO'Q va bo'lmasligi ham kerak:
 * registrator o'z smenasi uchun javob beradi, klinikaning moliyasi
 * uchun emas. Shu ajratish korrupsiya imkonini toraytiradi.
 */
function CashboxCard({ data, onClose }: { data: ReceptionSummary; onClose: () => void }) {
  const { t } = useI18n()
  const { cash } = data

  const rows = [
    { key: 'cash', label: t('payments.method.cash'), value: cash.cash },
    { key: 'card', label: t('payments.method.card'), value: cash.card },
    { key: 'transfer', label: t('payments.method.transfer'), value: cash.transfer },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader title={t('reception.cashbox')} subtitle={t('reception.cashboxHint')} />

      <p className="mt-4 text-title-1 font-bold tnum text-label">{money(cash.total)}</p>

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-3">
            <span className="text-footnote text-label-secondary">{row.label}</span>
            <span className="text-footnote font-semibold tnum text-label">
              {money(row.value)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {cash.shiftClosed ? (
          <p className="flex items-center gap-2 rounded-[10px] bg-ok-soft px-3 py-2.5 text-footnote font-medium text-ok">
            <CheckCircle2 size={15} />
            {t('reception.shiftDone')}
          </p>
        ) : (
          <Button variant="tinted" block icon={<Wallet size={16} />} onClick={onClose}>
            {t('shift.close')}
          </Button>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Keyingi qabullar                                                    */
/* ------------------------------------------------------------------ */

/**
 * Hali kelmagan bemorlar. Bu yerdagi asosiy amal — "Keldi".
 *
 * Bemor kelganda registrator shu tugmani bosadi, qabul navbatga
 * o'tadi va kutish vaqti sanay boshlaydi.
 */
function UpcomingCard({ data, onReload }: { data: ReceptionSummary; onReload: () => void }) {
  const { t, tService } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)

  async function checkIn(item: ReceptionQueueItem) {
    setBusy(item.appointmentId)
    try {
      await setAppointmentStatus(item.appointmentId, 'checked_in')
      onReload()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-4">
        <CardHeader
          title={t('reception.next')}
          action={
            <Link
              to="/appointments"
              className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
            >
              {t('action.viewAll')}
              <ArrowRight size={14} />
            </Link>
          }
        />
      </div>

      {data.upcoming.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} strokeWidth={1.75} />}
          title={t('reception.nextEmpty')}
          description=""
          className="py-10"
        />
      ) : (
        <ul>
          {data.upcoming.map((item) => (
            <li key={item.appointmentId} className="hairline last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <span className="w-12 shrink-0 text-footnote font-semibold tnum text-label">
                  {time(item.startsAt)}
                </span>

                <button
                  type="button"
                  onClick={() => navigate(`/patients/${item.patientId}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar name={item.patientName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-subhead font-medium text-label">
                      {item.patientName}
                    </span>
                    <span className="block truncate text-caption text-label-tertiary">
                      {fmtPhone(item.patientPhone)} · {tService(item.serviceName)}
                    </span>
                  </span>
                </button>

                {/* Oldindan to'lov kerakligi qabuldan oldin ko'rinadi */}
                {item.prepaid && item.paymentStatus !== 'paid' ? (
                  <Badge tone="warn" dot>
                    <AlertTriangle size={11} />
                    {t('reception.needsPayment')}
                  </Badge>
                ) : null}

                {/* Kechikkanlar ajralib tursin — qo'ng'iroq qilish kerak */}
                {item.delayMinutes > 5 ? (
                  <span className="shrink-0 text-caption font-medium tnum text-warn">
                    {t('reception.late', { count: item.delayMinutes })}
                  </span>
                ) : null}

                <Button
                  variant="tinted"
                  size="sm"
                  icon={<CheckCircle2 size={14} />}
                  loading={busy === item.appointmentId}
                  onClick={() => checkIn(item)}
                >
                  {t('reception.checkIn')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
