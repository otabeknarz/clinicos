import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, KeyRound, MapPin, Pause, Pencil, Phone, Play } from 'lucide-react'

import { USE_MOCK } from '@/api/client'
import { activatePharmacy, getPharmacy, WATCH_DAYS } from '@/api/platformPharmacy'
import type { PharmacyDetail } from '@/api/platformPharmacy'
import { AreaTrend } from '@/components/charts/Charts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  dateCompact,
  dateRelative,
  dateShort,
  groupDigits,
  money,
  phone as fmtPhone,
} from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import {
  EditPharmacyModal,
  PharmacyNotConnected,
  ResetPharmacyOwnerModal,
  SuspendPharmacyModal,
} from './PharmacyModals'

/**
 * APTEKA KARTASI — platforma egasining nazorati.
 *
 * To'rt savolga javob beradi:
 *   - pul: qancha sotyapti, o'sayaptimi (tushum va grafik)
 *   - kassa: pul to'g'ri topshirilyaptimi (farqli smenalar)
 *   - javon: muddati o'tgan dori turibdimi (zaxira holati)
 *   - odamlar: kim ishlayapti, kim kirmay qo'ygan (xodimlar)
 *
 * DORI NOMLARI VA XARIDORLAR YO'Q. Platforma egasiga aptekaning
 * savdo siri tegishli emas — faqat biznes sog'lommi, shu.
 */
export function PlatformPharmacyDetailPage() {
  if (!USE_MOCK) return <PharmacyNotConnected />
  return <PharmacyDetailScreen />
}

function PharmacyDetailScreen() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const { can } = useAuth()
  const canManage = can('platform.manage')

  const [version, setVersion] = useState(0)
  const { data, loading, error, reload } = useAsync(() => getPharmacy(id), [id, version])

  const [editing, setEditing] = useState(false)
  const [suspending, setSuspending] = useState(false)
  const [resetting, setResetting] = useState(false)
  const refresh = () => setVersion((v) => v + 1)

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="min-h-64" />
  if (!data) return <EmptyState title={t('state.notFound.title')} />

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/platform/pharmacies"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            <ArrowLeft size={14} />
            {t('pharmacies.title')}
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={data.name} size="lg" />
            <span>{data.name}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {data.city || data.address ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} />
                {[data.city, data.address].filter(Boolean).join(', ')}
              </span>
            ) : null}
            {data.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={13} />
                {fmtPhone(data.phone)}
              </span>
            ) : null}
            <Badge tone={data.status === 'active' ? 'ok' : 'bad'} dot>
              {t(`pharmacies.status.${data.status}`)}
            </Badge>
          </span>
        }
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="gray" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
                {t('pharmacies.edit')}
              </Button>
              <Button
                variant="gray"
                icon={<KeyRound size={16} />}
                onClick={() => setResetting(true)}
              >
                {t('pharmacies.resetOwner')}
              </Button>
              {data.status === 'suspended' ? (
                <Button
                  icon={<Play size={16} />}
                  onClick={async () => {
                    await activatePharmacy(data.id)
                    refresh()
                  }}
                >
                  {t('pharmacies.activate')}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  icon={<Pause size={16} />}
                  onClick={() => setSuspending(true)}
                >
                  {t('pharmacies.suspend')}
                </Button>
              )}
            </div>
          ) : null
        }
      />

      {/* --- To'xtatilgan bo'lsa sababi tepada --- */}
      {data.status === 'suspended' ? (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] bg-bad-soft px-5 py-4">
          <Ban size={18} className="mt-0.5 shrink-0 text-bad" />
          <div>
            <p className="text-subhead font-semibold text-bad">
              {t('pharmacies.status.suspended')}
            </p>
            <p className="mt-0.5 text-footnote text-label-secondary">
              {data.suspendReason || t('pharmacies.suspendWarning')}
            </p>
          </div>
        </div>
      ) : null}

      {/* --- Pul --- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t('pharmacies.kpi.revenue')} value={money(data.revenue)} />
        <Metric label={t('pharmacies.kpi.receipts')} value={groupDigits(data.receipts)} />
        <Metric label={t('pharmacies.kpi.avg')} value={money(data.avgReceipt)} />
        <Metric label={t('pharmacies.kpi.profit')} value={money(data.profit)} />
      </div>

      <Card className="mb-5">
        <CardHeader
          title={t('pharmacies.trend')}
          subtitle={t('pharmacies.trendHint', { days: WATCH_DAYS })}
        />
        <div className="mt-4">
          <AreaTrend
            data={data.daily.map((day) => ({
              label: dateCompact(day.date),
              value: day.revenue,
            }))}
            height={220}
            format={(v) => money(v)}
            gradientId="pharmacyRevenue"
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <CashCard data={data} />
        <StockCard data={data} />
        <StaffCard data={data} />
      </div>

      <EditPharmacyModal
        pharmacy={editing ? data : null}
        onClose={() => setEditing(false)}
        onDone={refresh}
      />
      <SuspendPharmacyModal
        pharmacy={suspending ? data : null}
        onClose={() => setSuspending(false)}
        onDone={refresh}
      />
      <ResetPharmacyOwnerModal
        pharmacy={resetting ? data : null}
        onClose={() => setResetting(false)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Kassa                                                               */
/* ------------------------------------------------------------------ */

/**
 * Faqat FARQLI smenalar ko'rsatiladi.
 *
 * To'g'ri yopilgan smenalar ro'yxatni to'ldirib, kerakli qatorlarni
 * pastga surib yuborardi. Ularning soni sarlavhada turadi — "30
 * smenadan 27 tasi farqsiz" degan gap o'zi yetarli.
 */
function CashCard({ data }: { data: PharmacyDetail }) {
  const { t } = useI18n()
  const gaps = data.shifts.filter((s) => s.difference !== 0)

  return (
    <Card className="min-w-0">
      <CardHeader title={t('pharmacies.cashTitle')} subtitle={t('pharmacies.cashHint')} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label={t('pharmacies.cashShifts')} value={String(data.shifts.length)} />
        <MiniStat
          label={t('pharmacies.cashFlagged')}
          value={String(data.flaggedShifts)}
          tone={data.flaggedShifts ? 'bad' : undefined}
        />
        <MiniStat
          label={t('pharmacies.cashShortTotal')}
          value={money(data.cashShort)}
          tone={data.cashShort ? 'warn' : undefined}
        />
      </div>

      {gaps.length === 0 ? (
        <p className="mt-4 text-footnote text-label-tertiary">{t('pharmacies.noGaps')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-separator">
          {gaps.map((shift) => (
            <li key={shift.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-footnote text-label">
                  {dateShort(shift.date)} · {shift.sellerName}
                  {shift.flagged ? (
                    <Badge tone="bad">{t('pharmacies.cashFlaggedBadge')}</Badge>
                  ) : null}
                </p>
                {shift.handedToName ? (
                  <p className="text-caption text-label-tertiary">
                    {t('pharmacy.handedTo', { name: shift.handedToName })}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    'block text-footnote font-semibold tnum',
                    shift.difference < 0 ? 'text-bad' : 'text-warn',
                  )}
                >
                  {money(Math.abs(shift.difference))}
                </span>
                <span className="block text-caption text-label-tertiary">
                  {shift.difference < 0 ? t('pharmacies.gapShort') : t('pharmacies.gapOver')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Zaxira                                                              */
/* ------------------------------------------------------------------ */

function StockCard({ data }: { data: PharmacyDetail }) {
  const { t } = useI18n()

  const rows: { label: string; value: string; tone?: 'bad' | 'warn' }[] = [
    { label: t('pharmacies.stock.medicines'), value: groupDigits(data.medicines) },
    { label: t('pharmacies.stock.value'), value: money(data.stockValue) },
    {
      label: t('pharmacies.stock.expired'),
      value: String(data.expiredBatches),
      tone: data.expiredBatches ? 'bad' : undefined,
    },
    {
      label: t('pharmacies.stock.expiring'),
      value: String(data.expiringBatches),
      tone: data.expiringBatches ? 'warn' : undefined,
    },
    { label: t('pharmacies.stock.low'), value: String(data.lowStock) },
    { label: t('pharmacies.stock.out'), value: String(data.outOfStock) },
    { label: t('pharmacies.stock.rx'), value: String(data.pendingPrescriptions) },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader title={t('pharmacies.stockTitle')} subtitle={t('pharmacies.stockHint')} />
      <dl className="mt-4 divide-y divide-separator">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-footnote text-label-secondary">{row.label}</dt>
            <dd
              className={cn(
                'text-footnote font-semibold tnum',
                row.tone === 'bad' && 'text-bad',
                row.tone === 'warn' && 'text-warn',
                !row.tone && 'text-label',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Xodimlar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Oxirgi kirish har bir odamda ko'rinadi.
 *
 * Bir haftadan beri kirmagan sotuvchi — yo ketgan, yo boshqa
 * birovning hisobida ishlayapti. Ikkinchisi kassa nazoratini
 * ma'nosiz qiladi: kamomad kimga yozilayotgani noma'lum bo'ladi.
 */
function StaffCard({ data }: { data: PharmacyDetail }) {
  const { t } = useI18n()

  return (
    <Card className="min-w-0 xl:col-span-2">
      <CardHeader
        title={t('pharmacies.staffTitle')}
        subtitle={t('pharmacies.staffHint', { count: data.staffCount })}
      />
      <ul className="mt-4 divide-y divide-separator">
        {data.staff.map((person) => (
          <li
            key={person.id}
            className={cn(
              'flex items-center gap-3 py-2.5',
              person.status === 'fired' && 'opacity-50',
            )}
          >
            <Avatar name={person.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-footnote font-medium text-label">
                {person.fullName}
                <Badge tone={person.role === 'pharmacy_owner' ? 'brand' : 'neutral'}>
                  {t(`role.${person.role}`)}
                </Badge>
                {person.status === 'fired' ? (
                  <Badge tone="neutral">{t('pharmacies.fired')}</Badge>
                ) : null}
              </p>
              <p className="truncate text-caption text-label-tertiary">
                {person.login} · {person.shiftStart} — {person.shiftEnd}
              </p>
            </div>
            <span className="hidden shrink-0 text-caption text-label-tertiary sm:block">
              {person.lastLoginAt
                ? t('pharmacies.lastLogin', { when: dateRelative(person.lastLoginAt) })
                : t('pharmacies.neverLoggedIn')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Kichik bloklar                                                      */
/* ------------------------------------------------------------------ */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p className="mt-1 truncate text-callout font-bold tnum text-label sm:text-title-3">
        {value}
      </p>
    </Card>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'bad' | 'warn'
}) {
  return (
    <div className="min-w-0 rounded-[10px] bg-fill-4 px-3 py-2.5">
      <p className="truncate text-caption-2 text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-footnote font-semibold tnum',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
          !tone && 'text-label',
        )}
      >
        {value}
      </p>
    </div>
  )
}
