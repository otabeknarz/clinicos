import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarClock,
  LogIn,
  Mail,
  MapPin,
  Pause,
  Phone,
  Play,
  Receipt,
  UserRound,
  Wallet,
} from 'lucide-react'

import {
  activateTenant,
  changeTenantPlan,
  getTenant,
  listImpersonations,
  listInvoices,
  listPlans,
} from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select, TextArea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { INVOICE_TONE, TENANT_TONE } from './tone'
import { cn } from '@/lib/cn'
import {
  dateCompact,
  dateLong,
  dateRelative,
  dateTime,
  groupDigits,
  money,
  phone as fmtPhone,
} from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { Plan, Tenant } from '@/types/models'
import { UNLIMITED } from '@/types/models'
import { startImpersonation, suspendTenant } from '@/api/platform'

/**
 * KLINIKA KARTASI.
 *
 * Ro'yxatda har bir klinika bir qator, bu yerda esa uning to'liq
 * holati: obunasi, foydalanishi, to'lov tarixi va yordam uchun
 * kirishlar.
 *
 * BEMOR MA'LUMOTI YO'Q. Ko'rinadigan yagona narsa — sonlar (nechta
 * shifokor, nechta bemor), ular tarif chegarasini tekshirish va
 * klinikaning o'sishini baholash uchun kerak. Ismlar, tashxislar,
 * to'lovlar — hech biri platforma egasiga tegishli emas.
 */
export function PlatformClinicDetailPage() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const [version, setVersion] = useState(0)

  const { data, loading, error, reload } = useAsync(() => getTenant(id), [id, version])
  const { data: plans } = useAsync(() => listPlans(), [])

  const [suspending, setSuspending] = useState(false)
  const [entering, setEntering] = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="min-h-64" />
  if (!data) return <EmptyState title={t('state.notFound.title')} />

  return (
    <>
      <PageHeader
        back={
          <Link
            to="/platform/clinics"
            className="inline-flex items-center gap-1 text-footnote font-medium text-accent hover:opacity-80"
          >
            <ArrowLeft size={14} />
            {t('platform.clinics')}
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
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} />
              {data.city}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone size={13} />
              {fmtPhone(data.phone)}
            </span>
            <Badge tone={TENANT_TONE[data.status]} dot>
              {t(`platform.status.${data.status}`)}
            </Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="gray"
              icon={<LogIn size={16} />}
              disabled={data.status === 'cancelled'}
              onClick={() => setEntering(true)}
            >
              {t('platform.enter')}
            </Button>

            {data.status === 'suspended' ? (
              <Button
                icon={<Play size={16} />}
                onClick={async () => {
                  await activateTenant(data.id)
                  setVersion((v) => v + 1)
                }}
              >
                {t('platform.activate')}
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={<Pause size={16} />}
                disabled={data.status === 'cancelled'}
                onClick={() => setSuspending(true)}
              >
                {t('platform.suspend')}
              </Button>
            )}
          </div>
        }
      />

      {/* --- To'xtatilgan bo'lsa sababi tepada --- */}
      {data.status === 'suspended' && data.suspendReason ? (
        <div className="mb-5 flex items-start gap-3 rounded-[14px] bg-bad-soft px-5 py-4">
          <Ban size={18} className="mt-0.5 shrink-0 text-bad" />
          <div>
            <p className="text-subhead font-semibold text-bad">
              {t('platform.status.suspended')}
            </p>
            <p className="mt-0.5 text-footnote text-label-secondary">
              {data.suspendReason}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-5">
          <SubscriptionCard
            tenant={data}
            onChangePlan={() => setChangingPlan(true)}
          />
          <OwnerCard tenant={data} />
        </div>

        <div className="grid content-start gap-5">
          <UsageCard tenant={data} plans={plans ?? []} />
          <InvoicesCard tenantId={data.id} version={version} />
          <AccessCard tenantId={data.id} version={version} />
        </div>
      </div>

      {/* --- Formalar --- */}
      <SuspendModal
        tenant={suspending ? data : null}
        onClose={() => setSuspending(false)}
        onDone={() => setVersion((v) => v + 1)}
      />

      <EnterModal tenant={entering ? data : null} onClose={() => setEntering(false)} />

      <PlanModal
        tenant={changingPlan ? data : null}
        plans={plans ?? []}
        onClose={() => setChangingPlan(false)}
        onDone={() => setVersion((v) => v + 1)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Obuna                                                               */
/* ------------------------------------------------------------------ */

function SubscriptionCard({
  tenant,
  onChangePlan,
}: {
  tenant: Tenant
  onChangePlan: () => void
}) {
  const { t } = useI18n()

  const rows = [
    { key: 'plan', label: t('platform.plan'), value: tenant.planName },
    {
      key: 'price',
      label: t('platform.pricePerMonth'),
      value: money(tenant.pricePerMonth),
    },
    {
      key: 'since',
      label: t('platform.subscribedAt'),
      value: tenant.subscribedAt ? dateCompact(tenant.subscribedAt) : '—',
    },
    {
      key: 'next',
      label: t('platform.nextInvoice'),
      value: tenant.nextInvoiceAt ? dateCompact(tenant.nextInvoiceAt) : '—',
    },
    {
      key: 'created',
      label: t('platform.joinedAt'),
      value: dateCompact(tenant.createdAt),
    },
    {
      key: 'active',
      label: t('platform.lastActive'),
      value: tenant.lastActiveAt ? dateRelative(tenant.lastActiveAt) : '—',
    },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('platform.subscription')}
        action={
          <Button
            variant="plain"
            size="sm"
            icon={<Wallet size={14} />}
            onClick={onChangePlan}
          >
            {t('platform.changePlan')}
          </Button>
        }
      />

      {/* Sinov muddati alohida — u tugagach qaror qabul qilinadi */}
      {tenant.status === 'trial' && tenant.trialEndsAt ? (
        <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-accent-soft px-4 py-3">
          <CalendarClock size={16} className="shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-footnote font-medium text-accent">
              {t('platform.trialEnds')}
            </p>
            <p className="text-caption text-label-secondary">
              {dateLong(tenant.trialEndsAt)} · {dateRelative(tenant.trialEndsAt)}
            </p>
          </div>
        </div>
      ) : null}

      <dl className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-footnote text-label-tertiary">{row.label}</dt>
            <dd className="text-footnote font-medium tnum text-label">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Egasi                                                               */
/* ------------------------------------------------------------------ */

function OwnerCard({ tenant }: { tenant: Tenant }) {
  const { t } = useI18n()

  return (
    <Card className="min-w-0">
      <CardHeader title={t('platform.owner')} subtitle={t('platform.ownerHint')} />

      <div className="mt-4 flex items-center gap-3">
        <Avatar name={tenant.ownerName} size="md" />
        <div className="min-w-0">
          <p className="truncate text-subhead font-medium text-label">
            {tenant.ownerName}
          </p>
          <p className="truncate text-caption text-label-tertiary">
            {t('role.owner')}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Mail size={14} className="shrink-0 text-label-tertiary" />
          <dd className="min-w-0 truncate text-footnote text-label">
            {tenant.ownerEmail}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Phone size={14} className="shrink-0 text-label-tertiary" />
          <dd className="text-footnote tnum text-label">
            {fmtPhone(tenant.ownerPhone)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Foydalanish                                                         */
/* ------------------------------------------------------------------ */

/**
 * Klinika tarifidan qanchalik foydalanayotgani.
 *
 * Ikki xil savolga javob beradi:
 *   - chegaradan oshganmi (tarifni ko'tarish haqida gaplashish uchun)
 *   - umuman ishlatyaptimi (kam ishlatgan klinika ketishga yaqin)
 *
 * Ikkinchisi muhimroq: chegaradan oshgan mijoz — imkoniyat,
 * umuman kirmayotgan mijoz — yo'qotilgan pul.
 */
function UsageCard({ tenant, plans }: { tenant: Tenant; plans: Plan[] }) {
  const { t } = useI18n()
  const plan = plans.find((p) => p.id === tenant.planId)

  const bars = [
    {
      key: 'doctors',
      label: t('nav.doctors'),
      used: tenant.usage.doctors,
      cap: plan?.limits.doctors ?? UNLIMITED,
    },
    {
      key: 'staff',
      label: t('nav.staff'),
      used: tenant.usage.staff,
      cap: plan?.limits.staff ?? UNLIMITED,
    },
  ]

  const counts: { key: string; label: string; value: number; to?: string }[] = [
    {
      key: 'patients',
      label: t('nav.patients'),
      value: tenant.usage.patients,
      to: `/platform/registry?view=patients&tenant=${tenant.id}`,
    },
    {
      key: 'appointments',
      label: t('platform.appointmentsThisMonth'),
      value: tenant.usage.appointmentsThisMonth,
    },
    { key: 'users', label: t('settings.tab.users'), value: tenant.usage.users },
  ]

  const anyOver = bars.some((b) => b.cap !== UNLIMITED && b.used > b.cap)

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('platform.usage')}
        subtitle={plan ? `${plan.name} · ${money(plan.pricePerMonth)}` : undefined}
      />

      <ul className="mt-5 space-y-4">
        {bars.map((bar) => {
          const unlimited = bar.cap === UNLIMITED
          const pct = unlimited ? 0 : (bar.used / bar.cap) * 100
          const over = !unlimited && bar.used > bar.cap

          return (
            <li key={bar.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {bar.key === 'doctors' ? (
                  <Link
                    to={`/platform/registry?view=doctors&tenant=${tenant.id}`}
                    className="inline-flex items-center gap-1 text-footnote text-accent hover:opacity-80"
                  >
                    {bar.label}
                    <ArrowRight size={12} />
                  </Link>
                ) : (
                  <span className="text-footnote text-label-secondary">{bar.label}</span>
                )}
                <span
                  className={cn(
                    'text-footnote font-semibold tnum',
                    over ? 'text-bad' : 'text-label',
                  )}
                >
                  {bar.used}
                  {unlimited ? '' : ` / ${bar.cap}`}
                </span>
              </div>

              {unlimited ? (
                <p className="mt-1.5 text-caption text-label-tertiary">
                  {t('platform.unlimited')}
                </p>
              ) : (
                <ProgressBar
                  value={Math.min(100, pct)}
                  tone={over ? 'bad' : pct > 80 ? 'warn' : 'accent'}
                  className="mt-2"
                />
              )}
            </li>
          )
        })}
      </ul>

      {anyOver ? (
        <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('platform.overLimitHint')}
        </p>
      ) : null}

      {/*
        Raqamlar havolaga aylantirilgan: "537 bemor" ni ko'rgan odam
        darhol "kimlar?" deb so'raydi. Bir bosishda o'sha klinikaning
        ro'yxati ochiladi — filtrni qo'lda tanlash shart emas.
      */}
      <dl className="mt-5 grid grid-cols-3 gap-4">
        {counts.map((cell) =>
          cell.to ? (
            <Link
              key={cell.key}
              to={cell.to}
              className="rounded-[10px] transition-colors hover:bg-fill-4"
            >
              <dt className="text-caption text-label-tertiary">{cell.label}</dt>
              <dd className="mt-0.5 flex items-center gap-1 text-subhead font-semibold tnum text-accent">
                {groupDigits(cell.value)}
                <ArrowRight size={13} />
              </dd>
            </Link>
          ) : (
            <div key={cell.key}>
              <dt className="text-caption text-label-tertiary">{cell.label}</dt>
              <dd className="mt-0.5 text-subhead font-semibold tnum text-label">
                {groupDigits(cell.value)}
              </dd>
            </div>
          ),
        )}
      </dl>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* To'lov tarixi                                                       */
/* ------------------------------------------------------------------ */

function InvoicesCard({ tenantId, version }: { tenantId: string; version: number }) {
  const { t } = useI18n()
  const { data, loading } = useAsync(
    () => listInvoices({ tenantId, pageSize: 12 }),
    [tenantId, version],
  )

  if (loading) return <CardSkeleton className="min-h-44" />

  const rows = data?.items ?? []

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('platform.invoices')}
          subtitle={`${data?.total ?? 0}`}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt size={24} strokeWidth={1.75} />}
          title={t('platform.noInvoices')}
          description=""
          className="py-8"
        />
      ) : (
        <ul className="max-h-80 overflow-y-auto scroll-slim">
          {rows.map((invoice) => (
            <li key={invoice.id} className="hairline last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <span className="w-20 shrink-0 text-footnote tnum text-label-secondary">
                  {invoice.period}
                </span>

                <span className="min-w-0 flex-1 truncate text-caption text-label-tertiary">
                  {invoice.planName}
                </span>

                <Badge tone={INVOICE_TONE[invoice.status]} dot>
                  {t(`platform.invoice.${invoice.status}`)}
                </Badge>

                <span className="shrink-0 text-footnote font-semibold tnum text-label">
                  {money(invoice.amount)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Panelga kirishlar                                                   */
/* ------------------------------------------------------------------ */

function AccessCard({ tenantId, version }: { tenantId: string; version: number }) {
  const { t } = useI18n()
  const { data, loading } = useAsync(
    () => listImpersonations(10, tenantId),
    [tenantId, version],
  )

  if (loading) return <CardSkeleton className="min-h-32" />

  const rows = data ?? []

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader
          title={t('platform.accessLog')}
          subtitle={t('platform.accessLogHint')}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<LogIn size={24} strokeWidth={1.75} />}
          title={t('platform.accessLogEmpty')}
          description=""
          className="py-8"
        />
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.id} className="hairline last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <UserRound size={15} className="shrink-0 text-label-tertiary" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote text-label">
                    {row.reason}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {row.adminName}
                  </span>
                </span>

                <span className="shrink-0 text-caption tnum text-label-tertiary">
                  {dateTime(row.startedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Formalar                                                            */
/* ------------------------------------------------------------------ */

function SuspendModal({
  tenant,
  onClose,
  onDone,
}: {
  tenant: Tenant | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!tenant || !reason.trim()) return
    setSaving(true)
    try {
      await suspendTenant(tenant.id, reason.trim())
      toast.success(t('toast.saved'))
      onDone()
      onClose()
      setReason('')
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={tenant !== null}
      onClose={onClose}
      size="sm"
      title={t('platform.suspendTitle')}
      description={tenant?.name}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={!reason.trim()}
            onClick={submit}
          >
            {t('platform.suspend')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextArea
          label={t('platform.suspendReason')}
          hint={t('platform.suspendReasonHint')}
          placeholder={t('platform.suspendPlaceholder')}
          rows={3}
          required
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <p className="flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
          <Pause size={14} className="mt-0.5 shrink-0" />
          {t('platform.suspendWarning')}
        </p>
      </div>
    </Modal>
  )
}

function EnterModal({
  tenant,
  onClose,
}: {
  tenant: Tenant | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { session, enterClinic } = useAuth()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!tenant || reason.trim().length < 5) return
    setSaving(true)
    try {
      // Avval yozuv qayd etiladi, keyingina panel ochiladi
      const log = await startImpersonation(tenant.id, session?.user.fullName ?? '', reason.trim())
      toast.success(t('platform.enterStarted'))
      await enterClinic(tenant.id, tenant.name, log.token)
      onClose()
      setReason('')
      navigate('/')
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={tenant !== null}
      onClose={onClose}
      size="sm"
      title={t('platform.enterTitle')}
      description={tenant?.name}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            icon={<LogIn size={16} />}
            loading={saving}
            disabled={reason.trim().length < 5}
            onClick={submit}
          >
            {t('platform.enter')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextArea
          label={t('platform.enterReason')}
          hint={t('platform.enterReasonHint')}
          placeholder={t('platform.enterPlaceholder')}
          rows={3}
          required
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <p className="flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
          <LogIn size={14} className="mt-0.5 shrink-0" />
          {t('platform.enterWarning')}
        </p>
      </div>
    </Modal>
  )
}

/**
 * Tarifni o'zgartirish.
 *
 * Yangi narx KEYINGI hisobdan boshlab qo'llanadi — joriy oy uchun
 * chiqarilgan hisob o'zgarmaydi. Aks holda mijoz allaqachon ko'rgan
 * summa o'zgarib qolardi.
 */
function PlanModal({
  tenant,
  plans,
  onClose,
  onDone,
}: {
  tenant: Tenant | null
  plans: Plan[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [planId, setPlanId] = useState('')
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState<string | null>(null)

  // Tanlovni joriy tarifdan boshlaymiz
  if (tenant && ready !== tenant.id) {
    setReady(tenant.id)
    setPlanId(tenant.planId)
  }

  const selected = plans.find((p) => p.id === planId)
  const changed = tenant !== null && planId !== tenant.planId

  async function submit() {
    if (!tenant || !changed) return
    setSaving(true)
    try {
      await changeTenantPlan(tenant.id, planId)
      toast.success(t('toast.saved'))
      onDone()
      onClose()
      setReady(null)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={tenant !== null}
      onClose={onClose}
      size="sm"
      title={t('platform.changePlan')}
      description={tenant?.name}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!changed} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Select
          label={t('platform.plan')}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          options={plans.map((p) => ({
            value: p.id,
            label: `${p.name} — ${money(p.pricePerMonth)}`,
          }))}
        />

        {/* Yangi tarif chegarasi hozirgi foydalanishga yetadimi */}
        {selected && tenant ? (
          <div className="rounded-[12px] bg-sunken px-4 py-3">
            <p className="text-caption text-label-tertiary">
              {t('platform.newLimits')}
            </p>
            <p className="mt-1 text-footnote tnum text-label">
              {t('nav.doctors')}: {tenant.usage.doctors} /{' '}
              {selected.limits.doctors === UNLIMITED
                ? t('platform.unlimited')
                : selected.limits.doctors}
            </p>

            {selected.limits.doctors !== UNLIMITED &&
            tenant.usage.doctors > selected.limits.doctors ? (
              <p className="mt-2 flex items-start gap-2 text-caption font-medium text-warn">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {t('platform.downgradeWarning')}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-caption text-label-tertiary">
          {t('platform.editPlanHint')}
        </p>
      </div>
    </Modal>
  )
}
