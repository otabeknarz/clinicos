import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, LogIn, Pause, Play } from 'lucide-react'

import {
  activateTenant,
  listPlans,
  listTenants,
  startImpersonation,
  suspendTenant,
} from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput, Select, TextArea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { TENANT_TONE } from './tone'
import { cn } from '@/lib/cn'
import { dateRelative, groupDigits, moneyShort } from '@/lib/format'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { Tenant, TenantStatus } from '@/types/models'
import { UNLIMITED } from '@/types/models'

const STATUSES: (TenantStatus | 'all')[] = [
  'all',
  'active',
  'trial',
  'past_due',
  'suspended',
  'cancelled',
]

/**
 * KLINIKALAR RO'YXATI — platformaning asosiy ish sahifasi.
 *
 * Har bir qatorda uchta savolga javob bor: qaysi tarifda, qanday
 * holatda, chegaradan oshganmi. To'rtinchisi — nima qilish kerak —
 * o'ng tomondagi tugmalarda.
 */
export function PlatformClinicsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)

  const status = (searchParams.get('status') as TenantStatus) ?? 'all'
  const planId = searchParams.get('plan') ?? 'all'

  const { data: plans } = useAsync(() => listPlans(), [])

  const { data, loading, error, reload } = useAsync(
    () => listTenants({ search: debounced, status, planId, page }),
    [debounced, status, planId, page, version],
  )

  const [suspending, setSuspending] = useState<Tenant | null>(null)
  const [entering, setEntering] = useState<Tenant | null>(null)

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const columns = [
    {
      key: 'clinic',
      header: t('platform.clinic'),
      render: (row: Tenant) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-subhead font-medium text-label">{row.name}</p>
            <p className="truncate text-caption text-label-tertiary">
              {row.city} · {row.ownerName}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: t('platform.plan'),
      hideBelow: 'md' as const,
      render: (row: Tenant) => (
        <div>
          <p className="text-footnote text-label">{row.planName}</p>
          <p className="text-caption tnum text-label-tertiary">
            {moneyShort(row.pricePerMonth)}/{t('platform.perMonth')}
          </p>
        </div>
      ),
    },
    {
      key: 'usage',
      header: t('platform.usage'),
      hideBelow: 'lg' as const,
      render: (row: Tenant) => <UsageCell tenant={row} plans={plans ?? []} />,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'center' as const,
      render: (row: Tenant) => (
        <div className="flex flex-col items-center gap-1">
          <Badge tone={TENANT_TONE[row.status]} dot>
            {t(`platform.status.${row.status}`)}
          </Badge>
          {row.status === 'trial' && row.trialEndsAt ? (
            <span className="text-caption-2 text-label-tertiary">
              {dateRelative(row.trialEndsAt)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'activity',
      header: t('platform.lastActive'),
      align: 'right' as const,
      hideBelow: 'xl' as const,
      render: (row: Tenant) => (
        <span className="text-caption text-label-tertiary">
          {row.lastActiveAt ? dateRelative(row.lastActiveAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      width: 'w-24',
      render: (row: Tenant) => (
        <div className="flex justify-end gap-1">
          <IconButton
            label={t('platform.enter')}
            disabled={row.status === 'cancelled'}
            onClick={(e) => {
              e.stopPropagation()
              setEntering(row)
            }}
          >
            <LogIn size={15} />
          </IconButton>

          {row.status === 'suspended' ? (
            <IconButton
              label={t('platform.activate')}
              className="hover:text-ok"
              onClick={async (e) => {
                e.stopPropagation()
                await activateTenant(row.id)
                setVersion((v) => v + 1)
              }}
            >
              <Play size={15} />
            </IconButton>
          ) : (
            <IconButton
              label={t('platform.suspend')}
              className="hover:text-bad"
              disabled={row.status === 'cancelled'}
              onClick={(e) => {
                e.stopPropagation()
                setSuspending(row)
              }}
            >
              <Pause size={15} />
            </IconButton>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('platform.clinics')}
        subtitle={
          data ? t('platform.clinicCount', { count: data.total }) : t('common.loading')
        }
      />

      <Card padded={false}>
        <div className="hairline space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('platform.searchPlaceholder')}
              className="sm:max-w-xs"
            />

            <Select
              value={planId}
              onChange={(e) => setFilter('plan', e.target.value)}
              className="sm:max-w-48"
              options={[
                { value: 'all', label: t('platform.allPlans') },
                ...(plans ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <FilterPills<TenantStatus | 'all'>
            value={status}
            onChange={(v: TenantStatus | 'all') => setFilter('status', v)}
            options={STATUSES.map((value) => ({
              value,
              label: value === 'all' ? t('common.all') : t(`platform.status.${value}`),
            }))}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <>
            <DataTable<Tenant>
              rows={data?.items ?? []}
              columns={columns}
              loading={loading}
              onRowClick={(row) => navigate(`/platform/clinics/${row.id}`)}
              emptyState={
                <EmptyState
                  icon={<Building2 size={24} strokeWidth={1.75} />}
                  title={t('platform.noClinics')}
                  description=""
                />
              }
            />

            <Pagination
              page={page}
              pageSize={20}
              total={data?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <SuspendModal
        tenant={suspending}
        onClose={() => setSuspending(null)}
        onDone={() => setVersion((v) => v + 1)}
      />

      <EnterModal tenant={entering} onClose={() => setEntering(null)} />

    </>
  )
}

/* ------------------------------------------------------------------ */
/* Foydalanish va chegara                                              */
/* ------------------------------------------------------------------ */

/**
 * Klinika tarif chegarasidan oshganmi.
 *
 * Oshgan bo'lsa qizil ko'rsatiladi, lekin ishi TO'XTATILMAYDI:
 * klinikaning ishini to'xtatish uning bemorlariga zarar, bizga esa
 * foyda emas. Bu — tarifni ko'tarish haqida gaplashish uchun sabab.
 */
function UsageCell({ tenant, plans }: { tenant: Tenant; plans: { id: string; limits: { doctors: number; staff: number } }[] }) {
  const { t } = useI18n()
  const plan = plans.find((p) => p.id === tenant.planId)

  const cap = plan?.limits.doctors ?? UNLIMITED
  const over = cap !== UNLIMITED && tenant.usage.doctors > cap

  return (
    <div>
      <p className={cn('text-footnote tnum', over ? 'font-semibold text-bad' : 'text-label')}>
        {tenant.usage.doctors}
        {cap === UNLIMITED ? '' : ` / ${cap}`}
        <span className="ml-1 text-caption text-label-tertiary">
          {t('nav.doctors').toLowerCase()}
        </span>
      </p>
      <p className="text-caption tnum text-label-tertiary">
        {groupDigits(tenant.usage.patients)} {t('nav.patients').toLowerCase()}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* To'xtatish                                                          */
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

/* ------------------------------------------------------------------ */
/* Klinika paneliga kirish                                             */
/* ------------------------------------------------------------------ */

/**
 * Yordam uchun klinika paneliga kirish.
 *
 * Sabab majburiy va yozuv o'chirilmaydi — klinika egasi kim, qachon
 * va nima uchun kirganini ko'ra oladi.
 */
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
      // Avval yozuv qayd etiladi, keyingina panel ochiladi —
      // teskarisi bo'lsa, yozuvsiz kirish imkoni paydo bo'ladi
      const log = await startImpersonation(
        tenant.id,
        session?.user.fullName ?? '',
        reason.trim(),
      )
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
