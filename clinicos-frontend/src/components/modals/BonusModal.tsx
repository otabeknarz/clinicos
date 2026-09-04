import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'

import { createBonus, currentPeriod } from '@/api/bonuses'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { money, percent } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import { effectiveSalary } from '@/types/models'
import type { StaffWithPerformance } from '@/types/models'

/** Tayyor summalar — egasi tez tanlashi uchun */
const QUICK_PERCENTS = [5, 10, 15, 20]

/**
 * Bonus berish.
 *
 * Egasi summani qo'lda yozadi yoki maoshning foizidan tez tanlaydi.
 * Yonida xodimning ko'rsatkichlari turadi — qaror shunga qarab qabul
 * qilinsin.
 */
export function BonusModal({
  open,
  onClose,
  onSaved,
  staff,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  staff: StaffWithPerformance | null
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setAmount('')
    setReason('')
  }, [open])

  const save = useAction(async () => {
    if (!staff) return null
    return createBonus({
      staffId: staff.id,
      staffName: staff.fullName,
      period: currentPeriod(),
      amount: Number(amount),
      reason: reason.trim(),
      source: 'manual',
      ruleId: null,
    })
  })

  if (!staff) return null

  const salary = effectiveSalary(staff)
  const amountError =
    touched && (!amount || Number(amount) <= 0) ? t('valid.positive') : undefined

  async function submit() {
    setTouched(true)
    if (!amount || Number(amount) <= 0) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('bonus.given'))
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('bonus.add').replace('+ ', '')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button icon={<Gift size={16} />} onClick={submit} loading={save.pending}>
            {t('action.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {/* --- Xodim --- */}
        <div className="flex items-center gap-3 rounded-[14px] bg-sunken p-3">
          <Avatar name={staff.fullName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-subhead font-medium text-label">{staff.fullName}</p>
            <p className="truncate text-caption text-label-tertiary">
              {staff.positionTitle} · {money(salary)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-callout font-semibold tnum text-label">
              {staff.performance.rating !== null
                ? staff.performance.rating.toFixed(1)
                : '—'}
            </p>
            <p className="text-caption-2 text-label-tertiary">{t('staff.rating')}</p>
          </div>
        </div>

        {/* --- Ko'rsatkichlar --- */}
        {staff.performance.performancePct !== null ? (
          <p className="text-footnote text-label-secondary">
            {t('staff.performance')}:{' '}
            <span className="font-semibold tnum text-label">
              {percent(staff.performance.performancePct)}
            </span>
          </p>
        ) : null}

        <TextInput
          label={t('bonus.amount')}
          type="number"
          inputMode="numeric"
          min={0}
          step={50000}
          required
          suffix="so'm"
          value={amount}
          error={amountError}
          onChange={(e) => setAmount(e.target.value)}
        />

        {/* --- Tez tanlash --- */}
        {salary > 0 ? (
          <div className="flex flex-wrap gap-2">
            {QUICK_PERCENTS.map((pct) => {
              const value = Math.round((salary * pct) / 100)
              const active = Number(amount) === value
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className={cn(
                    'h-9 rounded-full px-3.5 text-footnote font-medium transition-colors duration-150',
                    active
                      ? 'bg-accent text-white'
                      : 'bg-fill-4 text-label-secondary hover:text-label',
                  )}
                >
                  {pct}% · {money(value)}
                </button>
              )
            })}
          </div>
        ) : null}

        <TextArea
          label={t('bonus.reason')}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  )
}
