import { useState } from 'react'
import { Check, Minus, Pencil } from 'lucide-react'

import { listBillingTerms, listPlans, updateBillingTerm, updatePlan } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { TextInput } from '@/components/ui/Form'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { BillingTerm, ID, Plan, PlanFeature } from '@/types/models'
import { termTotal, UNLIMITED } from '@/types/models'

/** Barcha imkoniyatlar — jadval ustunlari uchun */
const ALL_FEATURES: PlanFeature[] = [
  'ward',
  'analytics',
  'staff',
  'cashControl',
  'chat',
  'api',
]

/**
 * TARIFLAR.
 *
 * Uchta tarif yonma-yon: narx, chegara, imkoniyatlar. Solishtirish
 * uchun aynan shu ko'rinish qulay — mijozga ko'rsatiladigan sahifa
 * ham shunday tuziladi.
 *
 * Yangi tarif QO'SHISH bu yerda yo'q: tarif qo'shish narx siyosatini
 * o'zgartirish demak, u kamdan-kam bo'ladi va shoshilinch qaror
 * emas. Mavjudlarini tahrirlash yetarli.
 */
export function PlatformPlansPage() {
  const { t } = useI18n()
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<Plan | null>(null)

  const { data, loading, error, reload } = useAsync(() => listPlans(), [version])

  if (error) {
    return (
      <>
        <PageHeader title={t('platform.plans')} />
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('platform.plans')} subtitle={t('platform.plansSubtitle')} />

      {loading || !data ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <CardSkeleton className="min-h-96" />
          <CardSkeleton className="min-h-96" />
          <CardSkeleton className="min-h-96" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {data.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </div>
      )}

      {/*
        MUDDAT × TARIF JADVALI.

        Chegirma muddatga biriktirilgan, shuning uchun u qatorda
        turadi va barcha ustunga bir xil qo'llanadi. Katakda —
        o'sha muddat uchun JAMI summa, ya'ni mijoz bir marta
        to'laydigan raqam.
      */}
      {data && data.length > 0 ? (
        <TermMatrix plans={data} onSaved={() => setVersion((v) => v + 1)} />
      ) : null}

      <EditModal
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function PlanCard({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
  const { t } = useI18n()

  const limitLabel = (value: number) =>
    value === UNLIMITED ? t('platform.unlimited') : String(value)

  return (
    <Card className={cn('min-w-0', !plan.isActive && 'opacity-60')}>
      <CardHeader
        title={plan.name}
        subtitle={t(`platform.tier.${plan.tier}`)}
        action={
          <IconButton label={t('action.edit')} onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
        }
      />

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-title-1 font-bold tnum text-label">
          {money(plan.pricePerMonth)}
        </span>
        <span className="text-footnote text-label-tertiary">
          / {t('platform.perMonth')}
        </span>
      </p>

      {!plan.isActive ? (
        <Badge tone="neutral" className="mt-3">
          {t('platform.planInactive')}
        </Badge>
      ) : null}

      {/* --- Chegaralar --- */}
      <dl className="mt-5 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-footnote text-label-secondary">{t('nav.doctors')}</dt>
          <dd className="text-footnote font-semibold tnum text-label">
            {limitLabel(plan.limits.doctors)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-footnote text-label-secondary">{t('nav.staff')}</dt>
          <dd className="text-footnote font-semibold tnum text-label">
            {limitLabel(plan.limits.staff)}
          </dd>
        </div>
      </dl>

      {/* --- Imkoniyatlar --- */}
      <ul className="mt-5 space-y-2">
        {ALL_FEATURES.map((feature) => {
          const included = plan.features.includes(feature)

          return (
            <li key={feature} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full',
                  included ? 'bg-ok-soft text-ok' : 'bg-fill-4 text-label-quaternary',
                )}
              >
                {included ? <Check size={12} strokeWidth={3} /> : <Minus size={12} />}
              </span>
              <span
                className={cn(
                  'text-footnote',
                  included ? 'text-label' : 'text-label-quaternary',
                )}
              >
                {t(`platform.feature.${feature}`)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Tarifni tahrirlash.
 *
 * Narx o'zgarsa, u KEYINGI hisobdan boshlab qo'llanadi — allaqachon
 * chiqarilgan hisoblar o'zgarmaydi. Aks holda mijoz ko'rgan summa
 * keyin boshqacha bo'lib qolardi.
 */
function EditModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [price, setPrice] = useState('')
  const [doctors, setDoctors] = useState('')
  const [staff, setStaff] = useState('')
  const [features, setFeatures] = useState<PlanFeature[]>([])
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState<string | null>(null)

  // Forma qiymatlarini tanlangan tarifdan olamiz
  if (plan && ready !== plan.id) {
    setReady(plan.id)
    setPrice(String(plan.pricePerMonth))
    setDoctors(plan.limits.doctors === UNLIMITED ? '' : String(plan.limits.doctors))
    setStaff(plan.limits.staff === UNLIMITED ? '' : String(plan.limits.staff))
    setFeatures(plan.features)
  }

  async function submit() {
    if (!plan) return
    setSaving(true)
    try {
      await updatePlan(plan.id, {
        pricePerMonth: Number(price) || 0,
        limits: {
          doctors: doctors.trim() === '' ? UNLIMITED : Number(doctors),
          staff: staff.trim() === '' ? UNLIMITED : Number(staff),
        },
        features,
      })
      toast.success(t('toast.saved'))
      onSaved()
      onClose()
      setReady(null)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  function toggle(feature: PlanFeature) {
    setFeatures((current) =>
      current.includes(feature)
        ? current.filter((f) => f !== feature)
        : [...current, feature],
    )
  }

  return (
    <Modal
      open={plan !== null}
      onClose={onClose}
      title={plan?.name ?? ''}
      description={t('platform.editPlanHint')}
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
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('platform.pricePerMonth')}
          type="number"
          inputMode="numeric"
          min={0}
          step={100000}
          suffix="so'm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('nav.doctors')}
            type="number"
            inputMode="numeric"
            min={0}
            hint={t('platform.emptyUnlimited')}
            value={doctors}
            onChange={(e) => setDoctors(e.target.value)}
          />
          <TextInput
            label={t('nav.staff')}
            type="number"
            inputMode="numeric"
            min={0}
            hint={t('platform.emptyUnlimited')}
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          />
        </div>

        <div>
          <p className="text-footnote font-medium text-label">
            {t('platform.features')}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ALL_FEATURES.map((feature) => {
              const on = features.includes(feature)

              return (
                <button
                  key={feature}
                  type="button"
                  onClick={() => toggle(feature)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5',
                    'text-caption font-medium transition-colors duration-150',
                    on
                      ? 'bg-accent-soft text-accent'
                      : 'bg-fill-4 text-label-secondary hover:bg-fill-3',
                  )}
                >
                  {on ? <Check size={12} strokeWidth={3} /> : <Minus size={12} />}
                  {t(`platform.feature.${feature}`)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Muddat × tarif jadvali                                              */
/* ------------------------------------------------------------------ */

/**
 * TO'LOV MUDDATLARI VA CHEGIRMALARI.
 *
 * Chegirma MUDDATGA biriktirilgan, tarifga emas: "6 oy — 10%" barcha
 * tariflarga bir xil qo'llanadi. Har tarifda alohida saqlansa, bitta
 * qoida uch joyda yotardi va ular ertami-kechmi farq qilib qolardi.
 *
 * Katakdagi raqam — o'sha muddat uchun JAMI summa (oylik narx × oylar,
 * chegirma qo'llangan holda), ya'ni mijoz bir marta to'laydigan pul.
 *
 * Chegirmani o'zgartirish MAVJUD OBUNALARGA TEGMAYDI: ularda narx ham,
 * foiz ham obuna paytida muzlatilgan.
 */
function TermMatrix({ plans, onSaved }: { plans: Plan[]; onSaved: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState<ID | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const { data: terms } = useAsync(() => listBillingTerms(), [version])

  async function save(term: BillingTerm) {
    const raw = draft[term.id]
    if (raw === undefined) return

    const value = Number(raw)
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      toast.error(t('platform.termRangeError'))
      return
    }
    if (value === term.discountPct) return

    setSaving(term.id)
    try {
      await updateBillingTerm(term.id, { discountPct: value })
      setDraft((current) => {
        const next = { ...current }
        delete next[term.id]
        return next
      })
      setVersion((v) => v + 1)
      onSaved()
      toast.success(t('toast.saved'))
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(null)
    }
  }

  if (!terms) return null

  return (
    <Card className="mt-5" padded={false}>
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <CardHeader title={t('platform.terms')} subtitle={t('platform.termsHint')} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-subhead">
          <thead>
            <tr className="hairline text-caption text-label-tertiary">
              <th className="px-5 py-2 text-left font-medium sm:px-6">
                {t('platform.term')}
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-4 py-2 text-left font-medium">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <tr key={term.id} className="hairline last:border-b-0">
                <td className="px-5 py-3 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="text-label">
                      {t('platform.termMonths', { count: term.months })}
                    </span>

                    {/*
                      Chegirma 0 dan 100 gacha. Maydon o'zgarganda emas,
                      fokus ketganda yoki Enter bosilganda saqlanadi —
                      har bosilgan raqamga so'rov yuborilmasin.
                    */}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft[term.id] ?? String(term.discountPct)}
                      disabled={saving !== null}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, [term.id]: e.target.value }))
                      }
                      onBlur={() => void save(term)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      className={cn(
                        'h-7 w-14 rounded-[8px] bg-sunken px-2 text-center text-caption tnum',
                        'text-label outline-none focus:ring-2 focus:ring-accent',
                      )}
                    />
                    <span className="text-caption text-label-tertiary">%</span>
                  </div>
                </td>

                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">
                    <span className="tnum text-label">
                      {money(termTotal(plan.pricePerMonth, term.months, term.discountPct))}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
