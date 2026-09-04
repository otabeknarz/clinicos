import { useEffect, useState } from 'react'
import { AlertTriangle, Banknote, Check } from 'lucide-react'

import { closeShift } from '@/api/cashControl'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

/**
 * SMENANI YOPISH.
 *
 * Bu kassa nazoratining ikkinchi yarmi. Egasi hisobotni ko'radi,
 * administrator esa kun oxirida kassadagi jismoniy pulni sanab kiritadi.
 *
 * NEGA MUHIM: tizimdagi summa bilan qo'ldagi pul solishtiriladi. Farq
 * yo'qolmaydi — u xodim nomi bilan qayd etiladi va egasining hisobotiga
 * tushadi. Halol xodim uchun bu bir daqiqalik ish, lekin pulni olib
 * qolish imkonini yopadi.
 *
 * Tizim summasi ATAYLAB oldindan ko'rsatiladi: maqsad xodimni "tutish"
 * emas, hisobni to'g'ri yuritish. Yashirish faqat ishonchsizlik hissini
 * tug'diradi.
 */
export function ShiftCloseModal({
  open,
  onClose,
  onClosed,
  expectedCash,
}: {
  open: boolean
  onClose: () => void
  onClosed: () => void
  /** Tizim hisobiga ko'ra kassada bo'lishi kerak bo'lgan naqd pul */
  expectedCash: number
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { session } = useAuth()

  const [declared, setDeclared] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setDeclared('')
    setNote('')
  }, [open])

  const declaredValue = Number(declared) || 0
  const difference = declared === '' ? 0 : declaredValue - expectedCash
  const hasDifference = declared !== '' && difference !== 0

  // Farq bo'lsa sabab majburiy — bu keyinchalik tekshirishni osonlashtiradi
  const noteError =
    touched && hasDifference && !note.trim() ? t('shift.noteRequired') : undefined

  const save = useAction(async () =>
    closeShift({
      userId: session?.user.id ?? '',
      userName: session?.user.fullName ?? '',
      expectedCash,
      declaredCash: declaredValue,
      note: note.trim(),
    }),
  )

  async function submit() {
    setTouched(true)
    if (declared === '') return
    if (hasDifference && !note.trim()) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('shift.closed'))
    onClosed()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('shift.closeTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            icon={<Check size={16} />}
            loading={save.pending}
            disabled={declared === ''}
            onClick={submit}
          >
            {t('shift.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {/* --- Tizim hisobi --- */}
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-sunken px-4 py-3">
          <span className="inline-flex items-center gap-2 text-footnote text-label-secondary">
            <Banknote size={15} />
            {t('shift.expected')}
          </span>
          <span className="text-title-3 font-bold tnum text-label">
            {money(expectedCash)}
          </span>
        </div>

        {/* --- Sanab kiritish --- */}
        <TextInput
          label={t('shift.declared')}
          hint={t('shift.declaredHint')}
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          required
          autoFocus
          suffix="so'm"
          value={declared}
          onChange={(e) => setDeclared(e.target.value)}
        />

        {/* --- Farq --- */}
        {declared !== '' ? (
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-[12px] px-4 py-3',
              difference === 0
                ? 'bg-ok-soft'
                : difference < 0
                  ? 'bg-bad-soft'
                  : 'bg-warn-soft',
            )}
          >
            <span
              className={cn(
                'text-footnote font-medium',
                difference === 0 ? 'text-ok' : difference < 0 ? 'text-bad' : 'text-warn',
              )}
            >
              {difference === 0
                ? t('shift.exact')
                : difference < 0
                  ? t('shift.short')
                  : t('shift.over')}
            </span>

            {difference !== 0 ? (
              <span
                className={cn(
                  'text-title-3 font-bold tnum',
                  difference < 0 ? 'text-bad' : 'text-warn',
                )}
              >
                {difference > 0 ? '+' : '−'}
                {money(Math.abs(difference))}
              </span>
            ) : (
              <Check size={20} className="text-ok" />
            )}
          </div>
        ) : null}

        {/* --- Izoh --- */}
        <TextArea
          label={t('shift.note')}
          placeholder={t('shift.notePlaceholder')}
          rows={2}
          required={hasDifference}
          error={noteError}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* --- Ogohlantirish --- */}
        <p className="flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('shift.warning')}
        </p>
      </div>
    </Modal>
  )
}
