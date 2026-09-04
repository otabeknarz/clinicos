import { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Gavel,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import {
  createPenaltyRule,
  deletePenaltyRule,
  listPenalties,
  listPenaltyRules,
  updatePenaltyRule,
  unwaivePenalty,
  waivePenalty,
} from '@/api/penalties'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { CardHeader } from '@/components/ui/Card'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Select, TextInput } from '@/components/ui/Form'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { money, monthsShort } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type {
  Penalty,
  PenaltyAmountType,
  PenaltyRule,
  PenaltyTrigger,
  StaffPosition,
} from '@/types/models'

type View = 'issued' | 'rules'

const TRIGGERS: PenaltyTrigger[] = [
  'late',
  'late_minutes',
  'absent',
  'cash_shortfall',
  'backdated_attendance',
  'discipline_below',
]

const AMOUNT_TYPES: PenaltyAmountType[] = [
  'fixed',
  'percent_of_shortfall',
  'percent_of_daily_salary',
]

/**
 * JARIMALAR — klinika egasining bo'limi.
 *
 * Ikki qism: yozilgan qoidalar ("qonunlar") va tizim ularni qo'llab
 * hisoblagan jarimalar.
 *
 * Egasi jarimani QO'LDA YOZA OLMAYDI — faqat qoida yozadi va kerak
 * bo'lsa alohida jarimani kechiradi. Shu cheklov qasddan qo'yilgan:
 * qo'lda jarima yozish imkoni bo'lsa, qoidalar bezakka aylanadi va
 * jarima yana shaxsiy munosabatga bog'lanib qoladi.
 */
export function PenaltiesTab() {
  const { t } = useI18n()
  const [view, setView] = useState<View>('issued')

  return (
    <>
      <div className="hairline px-5 pt-4 sm:px-6">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'issued', label: t('penalty.issued') },
            { value: 'rules', label: t('penalty.rules') },
          ]}
        />
      </div>

      <div className="p-5 sm:p-6">
        {view === 'issued' ? <IssuedList /> : <RulesList />}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qo'llangan jarimalar                                                */
/* ------------------------------------------------------------------ */

function IssuedList() {
  const { t } = useI18n()
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [waiving, setWaiving] = useState<Penalty | null>(null)
  // Oy oxirida hisob-kitob qilinadi, shuning uchun o'tgan oylar ham kerak
  const [offset, setOffset] = useState(0)

  const anchor = (() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + offset, 1)
  })()

  const period = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
  const { data, loading, error, reload } = useAsync(
    () => listPenalties(period),
    [period, version],
  )

  async function toggleWaive(penalty: Penalty) {
    try {
      if (penalty.status === 'waived') {
        await unwaivePenalty(penalty.id)
      } else {
        await waivePenalty(penalty.id, '')
      }
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="border-0 shadow-none" />

  const rows = data ?? []
  const applied = rows.filter((p) => p.status === 'applied')
  const total = applied.reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <CardHeader
        title={t('penalty.issued')}
        subtitle={t('penalty.autoHint')}
        action={
          <div className="flex items-center gap-2">
            {applied.length > 0 ? (
              <span className="text-subhead font-semibold tnum text-bad">
                −{money(total)}
              </span>
            ) : null}
            <IconButton label={t('action.prev')} onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <span className="min-w-24 text-center text-footnote font-medium tnum text-label">
              {monthsShort()[anchor.getMonth()]} {anchor.getFullYear()}
            </span>
            <IconButton
              label={t('action.next')}
              disabled={offset >= 0}
              onClick={() => setOffset((o) => o + 1)}
            >
              <ChevronRight size={17} />
            </IconButton>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} strokeWidth={1.75} />}
          title={t('penalty.empty')}
          description={t('penalty.emptyHint')}
          className="py-12"
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((penalty) => (
            <li
              key={penalty.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3',
                penalty.status === 'waived' ? 'bg-fill-4' : 'bg-sunken',
              )}
            >
              <Avatar name={penalty.staffName} size="xs" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-footnote font-medium text-label">
                  {penalty.staffName}
                </span>
                <span className="block truncate text-caption text-label-tertiary">
                  {penalty.ruleName} · {penalty.reason}
                </span>
              </span>

              {penalty.status === 'waived' ? (
                <Badge tone="neutral">{t('penalty.waived')}</Badge>
              ) : null}

              <span
                className={cn(
                  'shrink-0 text-subhead font-semibold tnum',
                  penalty.status === 'waived'
                    ? 'text-label-quaternary line-through'
                    : 'text-bad',
                )}
              >
                −{money(penalty.amount)}
              </span>

              <IconButton
                label={penalty.status === 'waived' ? t('penalty.restore') : t('penalty.waive')}
                onClick={() =>
                  penalty.status === 'waived' ? toggleWaive(penalty) : setWaiving(penalty)
                }
              >
                {penalty.status === 'waived' ? (
                  <RotateCcw size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={waiving !== null}
        title={t('penalty.waiveConfirm')}
        description={
          waiving
            ? `${waiving.staffName} · ${waiving.ruleName} · ${money(waiving.amount)}`
            : ''
        }
        confirmLabel={t('penalty.waive')}
        onClose={() => setWaiving(null)}
        onConfirm={() => {
          if (waiving) void toggleWaive(waiving)
          setWaiving(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qoidalar                                                            */
/* ------------------------------------------------------------------ */

function RulesList() {
  const { t } = useI18n()
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<PenaltyRule | null>(null)

  const { data, loading, error, reload } = useAsync(() => listPenaltyRules(), [version])

  async function toggleActive(rule: PenaltyRule) {
    try {
      await updatePenaltyRule(rule.id, { isActive: !rule.isActive })
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  async function remove(rule: PenaltyRule) {
    try {
      await deletePenaltyRule(rule.id)
      toast.success(t('toast.deleted'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="border-0 shadow-none" />

  const rules = data ?? []

  return (
    <>
      <CardHeader
        title={t('penalty.rules')}
        subtitle={t('penalty.rulesHint')}
        action={
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setFormOpen(true)}>
            {t('penalty.addRule')}
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={<Gavel size={24} strokeWidth={1.75} />}
          title={t('penalty.noRules')}
          description={t('penalty.noRulesHint')}
          className="py-12"
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-[10px] bg-sunken px-4 py-3',
                !rule.isActive && 'opacity-55',
              )}
            >
              <Gavel size={15} className="shrink-0 text-label-tertiary" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-footnote font-medium text-label">
                  {rule.name}
                </span>
                <span className="block truncate text-caption text-label-tertiary">
                  {t(`penalty.trigger.${rule.trigger}`)}
                  {rule.positions.length > 0
                    ? ` · ${rule.positions.map((p) => t(`staff.position.${p}`)).join(', ')}`
                    : ''}
                </span>
              </span>

              <span className="shrink-0 text-footnote font-semibold tnum text-label">
                {rule.amountType === 'fixed'
                  ? money(rule.amountValue)
                  : `${rule.amountValue}%`}
              </span>

              <button
                type="button"
                onClick={() => toggleActive(rule)}
                className="shrink-0"
                title={t(rule.isActive ? 'penalty.active' : 'penalty.inactive')}
              >
                <Badge tone={rule.isActive ? 'ok' : 'neutral'} dot>
                  {t(rule.isActive ? 'penalty.active' : 'penalty.inactive')}
                </Badge>
              </button>

              <IconButton
                label={t('action.delete')}
                className="hover:text-bad"
                onClick={() => setDeleting(rule)}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <RuleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setVersion((v) => v + 1)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t('penalty.deleteConfirm')}
        description={deleting?.name ?? ''}
        confirmLabel={t('action.delete')}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remove(deleting)
          setDeleting(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qoida formasi                                                       */
/* ------------------------------------------------------------------ */

/**
 * `threshold` ning ma'nosi triggerga qarab o'zgaradi, shuning uchun
 * maydon nomi ham o'zgaradi. Bir xil "Chegara" yozuvi turgan bo'lsa,
 * egasi u yerga nima yozishini bilmaydi.
 */
const THRESHOLD_LABEL: Partial<Record<PenaltyTrigger, string>> = {
  late: 'penalty.threshold.late',
  late_minutes: 'penalty.threshold.lateMinutes',
  cash_shortfall: 'penalty.threshold.shortfall',
  discipline_below: 'penalty.threshold.discipline',
}

function RuleFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<PenaltyTrigger>('late')
  const [threshold, setThreshold] = useState('0')
  const [amountType, setAmountType] = useState<PenaltyAmountType>('fixed')
  const [amountValue, setAmountValue] = useState('50000')
  const [position, setPosition] = useState<StaffPosition | 'all'>('all')
  const [touched, setTouched] = useState(false)

  const thresholdKey = THRESHOLD_LABEL[trigger]

  const errors = {
    name: !name.trim() ? t('valid.required') : undefined,
    amount: !amountValue || Number(amountValue) <= 0 ? t('valid.positive') : undefined,
  }
  const valid = !errors.name && !errors.amount

  const save = useAction(async () =>
    createPenaltyRule({
      name: name.trim(),
      trigger,
      threshold: Number(threshold) || 0,
      amountType,
      amountValue: Number(amountValue),
      positions: position === 'all' ? [] : [position],
      isActive: true,
    }),
  )

  async function submit() {
    setTouched(true)
    if (!valid) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('toast.created'))
    onSaved()
    onClose()
    setName('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('penalty.addRule')}
      description={t('penalty.addRuleHint')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={save.pending} onClick={submit}>
            {t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('penalty.ruleName')}
          required
          placeholder={t('penalty.ruleNamePlaceholder')}
          value={name}
          error={touched ? errors.name : undefined}
          onChange={(e) => setName(e.target.value)}
        />

        <Select
          label={t('penalty.trigger')}
          hint={t(`penalty.triggerHint.${trigger}`)}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as PenaltyTrigger)}
          options={TRIGGERS.map((value) => ({
            value,
            label: t(`penalty.trigger.${value}`),
          }))}
        />

        {/* Chegara faqat ma'noli bo'lgan triggerlarda */}
        {thresholdKey ? (
          <TextInput
            label={t(thresholdKey)}
            type="number"
            inputMode="numeric"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('penalty.amountType')}
            value={amountType}
            onChange={(e) => setAmountType(e.target.value as PenaltyAmountType)}
            options={AMOUNT_TYPES.map((value) => ({
              value,
              label: t(`penalty.amountType.${value}`),
            }))}
          />

          <TextInput
            label={amountType === 'fixed' ? t('common.amount') : t('penalty.percent')}
            type="number"
            inputMode="numeric"
            min={0}
            required
            suffix={amountType === 'fixed' ? "so'm" : '%'}
            value={amountValue}
            error={touched ? errors.amount : undefined}
            onChange={(e) => setAmountValue(e.target.value)}
          />
        </div>

        <Select
          label={t('penalty.positions')}
          hint={t('penalty.positionsHint')}
          value={position}
          onChange={(e) => setPosition(e.target.value as StaffPosition | 'all')}
          options={[
            { value: 'all', label: t('penalty.allPositions') },
            { value: 'doctor', label: t('staff.position.doctor') },
            { value: 'nurse', label: t('staff.position.nurse') },
            { value: 'receptionist', label: t('staff.position.receptionist') },
            { value: 'manager', label: t('staff.position.manager') },
          ]}
        />
      </div>
    </Modal>
  )
}
