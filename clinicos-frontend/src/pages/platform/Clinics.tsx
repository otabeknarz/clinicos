import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  Building2,
  KeyRound,
  LogIn,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react'

import {
  activateTenant,
  archiveTenant,
  createTenant,
  deleteTenant,
  listBillingTerms,
  listPlans,
  listTenants,
  resetOwnerPassword,
  startImpersonation,
  suspendTenant,
  undeleteTenant,
  updateTenant,
} from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PhoneInput, SearchInput, Select, TextArea, TextInput } from '@/components/ui/Form'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { TENANT_TONE } from './tone'
import { cn } from '@/lib/cn'
import { dateRelative, groupDigits, moneyShort, phoneToE164 } from '@/lib/format'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type {
  ClinicKind,
  OwnerPasswordReset,
  Tenant,
  TenantCreated,
  TenantStatus,
} from '@/types/models'
import { CLINIC_KINDS } from '@/types/models'
import { UNLIMITED } from '@/types/models'

/*
  `deleted` — obuna holati EMAS. O'chirilgan klinikalar odatdagi
  ro'yxatda umuman chiqmaydi; ularni ko'rish uchun ataylab shu filtr
  tanlanadi. Arxivlangan (`cancelled`) esa ro'yxatda qolaveradi —
  u "ketgan mijoz", o'chirilgan emas.
*/
const STATUSES: (TenantStatus | 'all' | 'deleted')[] = [
  'all',
  'active',
  'trial',
  'past_due',
  'suspended',
  'cancelled',
  'deleted',
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

  const status = (searchParams.get('status') as TenantStatus | 'deleted') ?? 'all'
  const planId = searchParams.get('plan') ?? 'all'

  const { data: plans } = useAsync(() => listPlans(), [])

  const { data, loading, error, reload } = useAsync(
    () => listTenants({ search: debounced, status, planId, page }),
    [debounced, status, planId, page, version],
  )

  const [suspending, setSuspending] = useState<Tenant | null>(null)
  const [entering, setEntering] = useState<Tenant | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [archiving, setArchiving] = useState<Tenant | null>(null)
  const [restoring, setRestoring] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState<Tenant | null>(null)
  const [undeleting, setUndeleting] = useState<Tenant | null>(null)
  const [resetting, setResetting] = useState<Tenant | null>(null)

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
            {moneyShort(row.termPrice)}/{row.termMonths} {t('platform.monthsShort')}
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
            label={t('platform.editClinic')}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(row)
            }}
          >
            <Pencil size={15} />
          </IconButton>

          <IconButton
            label={t('platform.resetOwner')}
            onClick={(e) => {
              e.stopPropagation()
              setResetting(row)
            }}
          >
            <KeyRound size={15} />
          </IconButton>

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

          {/*
            O'chirilgan klinikani TIKLASH. Arxivlash ogohlantirishida
            "keyin qaytarish mumkin" deyilgan, lekin tugmasi yo'q edi:
            `activate` faqat `suspended` da chiqardi va arxivlangan
            klinika boshi berk ko'chaga tushib qolardi.
          */}
          {row.deletedAt ? (
            /* O'chirilgan klinikada faqat bitta amal qoladi — qaytarish */
            <IconButton
              label={t('platform.undelete')}
              className="hover:text-ok"
              onClick={(e) => {
                e.stopPropagation()
                setUndeleting(row)
              }}
            >
              <Undo2 size={15} />
            </IconButton>
          ) : row.status === 'cancelled' ? (
            <IconButton
              label={t('platform.restore')}
              className="hover:text-ok"
              onClick={(e) => {
                e.stopPropagation()
                setRestoring(row)
              }}
            >
              <Play size={15} />
            </IconButton>
          ) : row.status === 'suspended' ? (
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
              onClick={(e) => {
                e.stopPropagation()
                setSuspending(row)
              }}
            >
              <Pause size={15} />
            </IconButton>
          )}

          {/*
            ARXIVLASH va O'CHIRISH — ikki xil amal.

            Arxiv: "mijoz ketdi, qaytishi mumkin" — obuna `cancelled`
            bo'ladi, klinika ro'yxatda turaveradi.
            O'chirish: klinika ro'yxatdan chiqadi va xodimlari kira
            olmaydi. Ma'lumot ikkalasida ham bazada qoladi.
          */}
          {row.deletedAt || row.status === 'cancelled' ? null : (
            <IconButton
              label={t('platform.archive')}
              className="hover:text-bad"
              onClick={(e) => {
                e.stopPropagation()
                setArchiving(row)
              }}
            >
              <Archive size={15} />
            </IconButton>
          )}

          {row.deletedAt ? null : (
            <IconButton
              label={t('platform.delete')}
              className="hover:text-bad"
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(row)
              }}
            >
              <Trash2 size={15} />
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
        actions={
          <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            {t('platform.newClinic')}
          </Button>
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

          <FilterPills<TenantStatus | 'all' | 'deleted'>
            value={status}
            onChange={(v: TenantStatus | 'all' | 'deleted') => setFilter('status', v)}
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

      <NewClinicModal
        open={creating}
        plans={plans ?? []}
        onClose={() => setCreating(false)}
        onDone={() => setVersion((v) => v + 1)}
      />

      <EditClinicModal
        tenant={editing}
        onClose={() => setEditing(null)}
        onDone={() => setVersion((v) => v + 1)}
      />

      <ArchiveModal
        tenant={archiving}
        onClose={() => setArchiving(null)}
        onDone={() => setVersion((v) => v + 1)}
      />

      {/*
        Tiklash — tasdiq bilan: ma'lumot o'zgarmaydi, lekin klinika
        xodimlari yana tizimga kira boshlaydi.
      */}
      <ConfirmDialog
        open={Boolean(restoring)}
        danger={false}
        title={t('platform.restoreTitle')}
        description={t('platform.restoreWarning')}
        confirmLabel={t('platform.restore')}
        onClose={() => setRestoring(null)}
        onConfirm={async () => {
          if (!restoring) return
          await activateTenant(restoring.id)
          setRestoring(null)
          setVersion((v) => v + 1)
        }}
      />

      {/*
        O'chirish — sabab bilan. Arxivlash oynasi bilan bir xil shakl,
        lekin boshqa amal: klinika ro'yxatdan chiqadi.
      */}
      <DeleteModal
        tenant={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => setVersion((v) => v + 1)}
      />

      <ConfirmDialog
        open={Boolean(undeleting)}
        danger={false}
        title={t('platform.undeleteTitle')}
        description={t('platform.undeleteWarning')}
        confirmLabel={t('platform.undelete')}
        onClose={() => setUndeleting(null)}
        onConfirm={async () => {
          if (!undeleting) return
          await undeleteTenant(undeleting.id)
          setUndeleting(null)
          setVersion((v) => v + 1)
        }}
      />

      <ResetOwnerModal tenant={resetting} onClose={() => setResetting(null)} />
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

/* ------------------------------------------------------------------ */
/* Yangi klinika                                                       */
/* ------------------------------------------------------------------ */

/**
 * YANGI KLINIKA OCHISH.
 *
 * Klinika, egasi va obuna serverda BITTA tranzaksiyada yaratiladi.
 * Ilgari bu forma umuman yo'q edi: klinika faqat `seed.ts` yoki
 * serverdagi `npm run bootstrap` orqali paydo bo'lardi, ya'ni
 * mijozni tizimga qo'shish uchun serverga kirish kerak edi.
 *
 * Yaratilgach egasining boshlang'ich paroli BIR MARTA ko'rsatiladi —
 * bazada uning xeshi saqlanadi, keyin qayta ko'rsatib bo'lmaydi.
 */
function NewClinicModal({
  open,
  plans,
  onClose,
  onDone,
}: {
  open: boolean
  plans: { id: string; name: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [planId, setPlanId] = useState('')
  /* Tur saqlanmaydi — u faqat bo’limlarning boshlang’ich to’plamini beradi */
  const [kind, setKind] = useState<ClinicKind>('general')
  const [termMonths, setTermMonths] = useState(3)

  const { data: terms } = useAsync(() => listBillingTerms(), [])
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('+998 ')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<TenantCreated | null>(null)

  const chosenPlan = planId || plans[0]?.id || ''
  const valid =
    name.trim().length > 1 &&
    address.trim().length > 1 &&
    ownerName.trim().length > 1 &&
    /.+@.+\..+/.test(ownerEmail) &&
    chosenPlan

  function reset() {
    setName('')
    setPhone('+998 ')
    setAddress('')
    setCity('')
    setPlanId('')
    setKind('general')
    setTermMonths(3)
    setOwnerName('')
    setOwnerEmail('')
    setOwnerPhone('+998 ')
    setCreated(null)
  }

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await createTenant({
        name: name.trim(),
        phone: phoneToE164(phone),
        address: address.trim(),
        city: city.trim(),
        planId: chosenPlan,
        kind,
        termMonths,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPhone: phoneToE164(ownerPhone),
      })
      setCreated(result)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  /* Yaratilgandan keyin — faqat parol ko'rsatiladi */
  if (created) {
    return (
      <Modal
        open
        onClose={() => {
          reset()
          onClose()
        }}
        title={t('platform.created')}
        footer={
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t('action.close')}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-subhead text-label">{created.name}</p>

          <div className="rounded-[12px] bg-fill-4 p-4">
            <p className="text-caption text-label-tertiary">{t('platform.ownerEmailLabel')}</p>
            <p className="mt-0.5 text-callout font-medium text-label">{created.ownerEmail}</p>

            <p className="mt-3 text-caption text-label-tertiary">
              {t('platform.passwordOnce')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="text-callout font-semibold tnum text-label">
                {created.ownerPassword}
              </code>
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.ownerPassword ?? '')
                  toast.success(t('platform.copied'))
                }}
              >
                {t('action.copy')}
              </Button>
            </div>
          </div>

          <p className="text-caption text-bad">{t('platform.passwordOnceHint')}</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('platform.newClinicTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-caption text-label-tertiary">{t('platform.createHint')}</p>

        <p className="text-footnote font-medium text-label-secondary">
          {t('platform.clinicInfo')}
        </p>
        <TextInput label={t('platform.clinic')} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
          <TextInput label={t('platform.cityLabel')} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <TextInput
          label={t('platform.address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Select
          label={t('platform.plan')}
          value={chosenPlan}
          onChange={(e) => setPlanId(e.target.value)}
          options={plans.map((p) => ({ value: p.id, label: p.name }))}
        />

        {/*
          Necha oyga obuna. Chegirma muddatga biriktirilgan va narxga
          o'sha paytda qo'llanib, obunada muzlatiladi.
        */}
        <Select
          label={t('platform.term')}
          value={String(termMonths)}
          onChange={(e) => setTermMonths(Number(e.target.value))}
          options={(terms ?? []).map((row) => ({
            value: String(row.months),
            label:
              row.discountPct > 0
                ? `${t('platform.termMonths', { count: row.months })} — ${row.discountPct}%`
                : t('platform.termMonths', { count: row.months }),
          }))}
        />

        {/*
          Klinika turi — bo'limlarning boshlang'ich to'plami.
          Tur saqlanmaydi: keyin har bir bo'lim klinika kartasida
          alohida yoqib-o'chiriladi.
        */}
        <Select
          label={t('platform.kind')}
          hint={t('platform.kindHint')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ClinicKind)}
          options={CLINIC_KINDS.map((value) => ({
            value,
            label: t(`platform.kind.${value}`),
          }))}
        />

        <p className="pt-2 text-footnote font-medium text-label-secondary">
          {t('platform.ownerInfo')}
        </p>
        <TextInput
          label={t('platform.ownerNameLabel')}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('platform.ownerEmailLabel')}
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            required
          />
          <PhoneInput
            label={t('platform.ownerPhoneLabel')}
            value={ownerPhone}
            onChange={setOwnerPhone}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Tahrirlash                                                          */
/* ------------------------------------------------------------------ */

/** Klinika ma'lumotlari. Tarif va egasi bu yerdan o'zgarmaydi. */
function EditClinicModal({
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
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  const key = tenant?.id ?? ''
  const [loadedFor, setLoadedFor] = useState('')
  if (tenant && loadedFor !== key) {
    setLoadedFor(key)
    setName(tenant.name)
    setPhone(tenant.phone)
    setCity(tenant.city)
  }

  async function submit() {
    if (!tenant || name.trim().length < 2) return
    setSaving(true)
    try {
      await updateTenant(tenant.id, {
        name: name.trim(),
        phone: phoneToE164(phone),
        city: city.trim(),
      })
      toast.success(t('toast.saved'))
      onDone()
      onClose()
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
      title={t('platform.editClinicTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput label={t('platform.clinic')} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
          <TextInput label={t('platform.cityLabel')} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Arxivlash                                                           */
/* ------------------------------------------------------------------ */

/**
 * ARXIVLASH — O'CHIRISH EMAS.
 *
 * Serverda `DELETE` endpointi ATAYLAB yo'q: tibbiy yozuvni
 * o'chirish odatda qonun bilan taqiqlanadi va tasodifiy
 * bosishning narxi qaytarib bo'lmas. Klinika "Ketgan" holatiga
 * o'tadi, ma'lumoti joyida qoladi, keyin qaytarish mumkin.
 */
function ArchiveModal({
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
    if (!tenant || reason.trim().length < 5) return
    setSaving(true)
    try {
      await archiveTenant(tenant.id, reason.trim())
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
      title={t('platform.archiveTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={reason.trim().length < 5}
            onClick={submit}
          >
            {t('platform.archive')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-subhead text-label">{tenant?.name}</p>
        <TextArea
          label={t('platform.archiveReason')}
          hint={t('platform.archiveReasonHint')}
          placeholder={t('platform.archivePlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <p className="text-caption text-label-tertiary">{t('platform.archiveWarning')}</p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Egasining parolini tiklash                                          */
/* ------------------------------------------------------------------ */

/**
 * KLINIKA EGASINING PAROLINI TIKLASH.
 *
 * Klinika egasi `Staff` yozuvi emas va pochta xizmati ham yo'q —
 * ya'ni parolini unutsa, tizimga qaytadigan boshqa yo'l yo'q.
 *
 * XAVFSIZLIK CHEGARASI: parolni tiklagan platforma admini o'sha
 * parol bilan egasi nomidan kira oladi, ya'ni "klinika paneliga
 * faqat ko'rish uchun kirish" qoidasi chetlab o'tiladi. Tiklash
 * yo'li bo'lgan har qanday tizimda shunday. Shuning uchun amal
 * audit jurnaliga yoziladi va egasi kirgach parolni almashtirishga
 * majbur bo'ladi — bexabar qolmaydi.
 */
function ResetOwnerModal({
  tenant,
  onClose,
}: {
  tenant: Tenant | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<OwnerPasswordReset | null>(null)

  async function submit() {
    if (!tenant) return
    setSaving(true)
    try {
      setResult(await resetOwnerPassword(tenant.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  function close() {
    setResult(null)
    onClose()
  }

  return (
    <Modal
      open={tenant !== null}
      onClose={close}
      title={t('platform.resetOwnerTitle')}
      footer={
        result ? (
          <Button onClick={close}>{t('action.close')}</Button>
        ) : (
          <>
            <Button variant="gray" onClick={close}>
              {t('action.cancel')}
            </Button>
            <Button variant="danger" loading={saving} onClick={submit}>
              {t('platform.resetOwnerConfirm')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-[12px] bg-fill-4 p-4">
            <p className="text-caption text-label-tertiary">{result.ownerName}</p>
            <p className="mt-0.5 text-callout font-medium text-label">
              {result.ownerEmail}
            </p>

            <p className="mt-3 text-caption text-label-tertiary">
              {t('platform.resetOwnerDone')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="text-callout font-semibold tnum text-label">
                {result.password}
              </code>
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.password)
                  toast.success(t('platform.copied'))
                }}
              >
                {t('action.copy')}
              </Button>
            </div>
          </div>

          <p className="text-caption text-bad">{t('platform.passwordOnceHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-subhead text-label">{tenant?.name}</p>
          <p className="text-caption text-label-tertiary">{tenant?.ownerEmail}</p>
          <p className="rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
            {t('platform.resetOwnerWarning')}
          </p>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Klinikani o'chirish                                                 */
/* ------------------------------------------------------------------ */

/**
 * KLINIKANI O'CHIRISH — arxivlashdan boshqa amal.
 *
 * Arxiv: "mijoz ketdi, qaytishi mumkin" — obuna `cancelled` bo'ladi
 * va klinika ro'yxatda turaveradi.
 * O'chirish: klinika platformaning ish ro'yxatidan chiqadi va
 * xodimlari tizimga kira olmay qoladi.
 *
 * IKKALASIDA HAM MA'LUMOT BAZADA QOLADI: bemorlar, tashriflar,
 * to'lovlar va audit jurnali joyida. Bazadan yo'qotadigan `DELETE`
 * yo'q — tibbiy yozuvni o'chirish odatda qonun bilan taqiqlanadi.
 */
function DeleteModal({
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
    if (!tenant || reason.trim().length < 5) return
    setSaving(true)
    try {
      await deleteTenant(tenant.id, reason.trim())
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
      title={t('platform.deleteTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={reason.trim().length < 5}
            onClick={submit}
          >
            {t('platform.delete')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-subhead text-label">{tenant?.name}</p>
        <TextArea
          label={t('platform.deleteReason')}
          hint={t('platform.deleteReasonHint')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <p className="text-caption text-label-tertiary">{t('platform.deleteWarning')}</p>
      </div>
    </Modal>
  )
}
