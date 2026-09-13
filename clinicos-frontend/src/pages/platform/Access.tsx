import { useState } from 'react'
import { Ban, Clock, Lock, Trash2, Wrench } from 'lucide-react'

import {
  listRestrictions,
  listTrialPolicies,
  removeRestriction,
  setRestriction,
  setTrialPolicy,
} from '@/api/access'
import type { BlockReason } from '@/api/access'
import { listTenants } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Select, TextInput } from '@/components/ui/Form'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/status'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * IMKONIYATLAR VA SINOV SHARTLARI.
 *
 * Ikkalasi ham SOTUV qurollari va shuning uchun adminning
 * qo'lida turadi — ilgari ikkalasi ham kodda qat'iy yozilgan edi.
 *
 * CHEKLOV bo'limni yopadi va sababini aytadi. Sabab tanlovi qisqa
 * va aniq: "tez kunda", "tarifingizda yo'q", "texnik ishlar",
 * "yopiq". Erkin matn bo'lganda har safar boshqacha yozilardi va
 * mijoz bir xil holatni ikki xil ko'rardi.
 *
 * "Hamma uchun" va "bitta klinika uchun" — ikki daraja.
 * Klinikaniki umumiysidan ustun: bo'lim hamma uchun "tez kunda"
 * bo'lsa ham, sinovdagi mijozga ochib berish mumkin.
 */
const REASONS: BlockReason[] = ['soon', 'plan', 'maintenance', 'off']

const REASON_TONE: Record<BlockReason, Tone> = {
  soon: 'accent',
  plan: 'warn',
  maintenance: 'neutral',
  off: 'bad',
}

const REASON_ICON = {
  soon: Clock,
  plan: Lock,
  maintenance: Wrench,
  off: Ban,
}

export function PlatformAccessPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [version, setVersion] = useState(0)
  const access = useAsync(listRestrictions, [version])
  const trials = useAsync(listTrialPolicies, [version])
  const tenants = useAsync(() => listTenants({ pageSize: 100 }), [])

  /* --- Yangi cheklov --- */
  const [module, setModule] = useState('')
  const [reason, setReason] = useState<BlockReason>('soon')
  const [clinicId, setClinicId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const modules = access.data?.modules ?? []

  async function add() {
    if (!module) return
    setBusy(true)
    try {
      await setRestriction({
        module,
        reason,
        clinicId: clinicId || undefined,
        note: note.trim() || undefined,
      })
      toast.success(t('toast.saved'))
      setNote('')
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  async function drop(id: string) {
    try {
      await removeRestriction(id)
      toast.success(t('toast.deleted'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  return (
    <>
      <PageHeader title={t('access.title')} subtitle={t('access.subtitle')} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* ================= Yangi cheklov ================= */}
        <Card className="self-start">
          <h2 className="text-headline font-semibold text-label">{t('access.new')}</h2>

          <div className="mt-4 space-y-4">
            <Select
              label={t('access.module')}
              value={module}
              onChange={(e) => setModule(e.target.value)}
              options={[
                { value: '', label: t('access.pickModule') },
                ...modules.map((key) => ({ value: key, label: t(`module.${key}`) })),
              ]}
            />

            <Select
              label={t('access.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value as BlockReason)}
              options={REASONS.map((key) => ({
                value: key,
                label: t(`access.reason.${key}`),
              }))}
            />

            {/*
              KIMGA. Bo'sh qolsa — hammaga. Bu eng ko'p ishlatiladigan
              holat, shuning uchun u BIRINCHI variant.
            */}
            <Select
              label={t('access.target')}
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              options={[
                { value: '', label: t('access.everyone') },
                ...(tenants.data?.items ?? []).map((tenant) => ({
                  value: tenant.id,
                  label: tenant.name,
                })),
              ]}
            />

            <TextInput
              label={t('access.note')}
              placeholder={t('access.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <Button block disabled={!module} loading={busy} onClick={() => void add()}>
              {t('access.apply')}
            </Button>
          </div>
        </Card>

        {/* ================= Amaldagi cheklovlar ================= */}
        <Card padded={false}>
          <CardHeader title={t('access.current')} />

          {(access.data?.items ?? []).length === 0 ? (
            <EmptyState title={t('access.empty')} className="py-10" />
          ) : (
            <ul>
              {(access.data?.items ?? []).map((item) => {
                const Icon = REASON_ICON[item.reason]
                return (
                  <li
                    key={item.id}
                    className="hairline flex items-center gap-3 px-5 py-3 last:border-b-0 sm:px-6"
                  >
                    <Icon size={16} className="shrink-0 text-label-tertiary" />

                    <div className="min-w-0 flex-1">
                      <p className="text-subhead font-medium text-label">
                        {t(`module.${item.module}`)}
                      </p>
                      <p className="truncate text-caption text-label-tertiary">
                        {item.clinicId ? item.clinicName : t('access.everyone')}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                    </div>

                    <Badge tone={REASON_TONE[item.reason]}>
                      {t(`access.reason.${item.reason}`)}
                    </Badge>

                    <IconButton
                      label={t('action.delete')}
                      className="hover:text-bad"
                      onClick={() => void drop(item.id)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ================= Sinov shartlari ================= */}
      <Card padded={false} className="mt-5">
        <CardHeader title={t('access.trialTitle')} subtitle={t('access.trialSubtitle')} />

        <ul>
          {(trials.data?.items ?? []).map((policy) => (
            <TrialRow
              key={policy.direction}
              policy={policy}
              modules={trials.data?.modules ?? []}
              onSaved={() => {
                toast.success(t('toast.saved'))
                setVersion((v) => v + 1)
              }}
            />
          ))}
        </ul>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */

function TrialRow({
  policy,
  modules,
  onSaved,
}: {
  policy: { direction: string; days: number; disabledModules: string[]; custom: boolean }
  modules: string[]
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [days, setDays] = useState(String(policy.days))
  const [closed, setClosed] = useState<string[]>(policy.disabledModules)
  const [busy, setBusy] = useState(false)

  const dirty =
    Number(days) !== policy.days ||
    closed.length !== policy.disabledModules.length ||
    closed.some((one) => !policy.disabledModules.includes(one))

  async function save() {
    setBusy(true)
    try {
      await setTrialPolicy({
        direction: policy.direction,
        days: Math.max(1, Number(days) || 1),
        disabledModules: closed,
      })
      onSaved()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="hairline px-5 py-4 last:border-b-0 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-subhead font-medium text-label">
          {policy.direction === 'default'
            ? t('access.defaultDirection')
            : t(`direction.${policy.direction}`)}
        </span>

        {!policy.custom ? (
          <Badge tone="neutral">{t('access.fromCode')}</Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <TextInput
            type="number"
            min={1}
            fieldClassName="w-24"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            suffix={t('access.days')}
          />
          <Button size="sm" disabled={!dirty} loading={busy} onClick={() => void save()}>
            {t('action.save')}
          </Button>
        </div>
      </div>

      {/*
        SINOVDA YOPIQ BO'LIMLAR. Belgilangani — yopiq: ro'yxat
        "nima berilmaydi" degan savolga javob beradi, chunki
        sotuvda aynan shu qaror qilinadi.
      */}
      <Field label={t('access.trialClosed')} className="mt-3">
        <div className="flex flex-wrap gap-2">
          {modules.map((key) => {
            const active = closed.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setClosed((list) =>
                    active ? list.filter((one) => one !== key) : [...list, key],
                  )
                }
                className={cn(
                  'rounded-full px-3 py-1.5 text-caption font-medium transition-colors duration-200',
                  active
                    ? 'bg-bad-soft text-bad'
                    : 'bg-fill-4 text-label-secondary hover:bg-fill-3',
                )}
              >
                {t(`module.${key}`)}
              </button>
            )
          })}
        </div>
      </Field>
    </li>
  )
}
