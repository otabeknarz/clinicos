import { useEffect, useState } from 'react'

import { collectDebt } from '@/api/debts'
import { Button } from '@/components/ui/Button'
import { RadioGroup, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { addDays, toISODate } from '@/lib/dates'
import { money } from '@/lib/format'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { PaymentMethod, VisitDebt, WardDebt } from '@/types/models'

/**
 * QARZNI UNDIRISH.
 *
 * Oddiy to'lov formasidan farqi: bemor, shifokor va xizmat tanlanmaydi —
 * ular qarzning o'zidan olinadi. Shuning uchun uni egasi va shifokor ham
 * ishlata oladi (ularda shifokorlar ro'yxatini ko'rish huquqi bo'lmasligi
 * mumkin). Summa qolgan qarzdan oshmaydi.
 *
 * Qisman to'lovda qolganini qachongacha to'lashi so'raladi — shu kuni
 * bemorga botda eslatma boradi.
 */
export function DebtCollectModal({
  debt,
  onClose,
  onSaved,
}: {
  debt: VisitDebt | WardDebt | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t, tService } = useI18n()
  const toast = useToast()

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!debt) return
    setAmount(String(debt.remaining))
    setMethod('cash')
    setDueDate(debt.dueDate ?? toISODate(addDays(new Date(), 7)))
    setNotes('')
    setError('')
  }, [debt])

  const value = Number(amount) || 0
  const partial = debt !== null && value > 0 && value < debt.remaining
  const tooMuch = debt !== null && value > debt.remaining

  async function submit() {
    if (!debt || value <= 0 || tooMuch || pending) return
    setPending(true)
    setError('')
    try {
      await collectDebt({
        appointmentId: 'appointmentId' in debt ? debt.appointmentId : undefined,
        admissionId: 'admissionId' in debt ? debt.admissionId : undefined,
        amount: value,
        method,
        notes: notes.trim(),
        dueDate: partial && dueDate ? dueDate : undefined,
      })
      toast.success(t('debts.collected'))
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('toast.error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={debt !== null}
      onClose={onClose}
      title={t('debts.collectTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={pending} disabled={value <= 0 || tooMuch}>
            {t('debts.collect')}
          </Button>
        </>
      }
    >
      {debt ? (
        <div className="space-y-4 pb-2">
          <div className="rounded-[12px] bg-sunken px-4 py-3">
            <p className="text-subhead font-medium text-label">{debt.patientName}</p>
            <p className="mt-0.5 text-caption text-label-secondary">
              {'serviceName' in debt ? tService(debt.serviceName) : `№ ${debt.roomNumber}`} ·{' '}
              {t('debts.remaining')}:{' '}
              <span className="font-semibold tnum text-bad">{money(debt.remaining)}</span>
            </p>
          </div>

          <TextInput
            label={t('common.amount')}
            grouped
            required
            suffix="so'm"
            value={amount}
            error={
              tooMuch
                ? t('debts.tooMuch', { amount: money(debt.remaining) })
                : error || undefined
            }
            onChange={(e) => setAmount(e.target.value)}
          />

          <RadioGroup<PaymentMethod>
            label={t('payments.col.method')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 'cash', label: t('payments.method.cash') },
              { value: 'card', label: t('payments.method.card') },
              { value: 'transfer', label: t('payments.method.transfer') },
            ]}
          />

          {partial ? (
            <div className="rounded-[12px] bg-warn-soft p-3.5">
              <TextInput
                label={t('debts.dueForRest', { amount: money(debt.remaining - value) })}
                type="date"
                value={dueDate}
                min={toISODate(new Date())}
                hint={t('debts.dueHint')}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          ) : null}

          <TextArea
            label={t('common.notes')}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      ) : null}
    </Modal>
  )
}
