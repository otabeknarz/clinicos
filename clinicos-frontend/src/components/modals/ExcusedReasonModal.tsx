import { useEffect, useState } from 'react'
import { ShieldQuestion } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea } from '@/components/ui/Form'
import { useI18n } from '@/i18n'
import type { DailyAttendanceRow } from '@/types/models'

/** Sabab shundan qisqa bo'lsa, u sabab emas — "ok", "-" kabi belgilar */
const MIN_REASON_LENGTH = 5

/**
 * "SABABLI" BELGILASHDA SABAB SO'RASH.
 *
 * NEGA MAJBURIY: "sababli" — davomatdagi yagona holat, u intizom
 * ballini ham tushirmaydi, jarimaga ham olib kelmaydi. Ya'ni kelmagan
 * odamni "sababli" deb belgilash — hamma oqibatni o'chirib yuborish
 * demak.
 *
 * Agar sabab yozilmasa, bu tugma kelmaganlikni yashirishning eng
 * qulay yo'liga aylanadi. Yozilgan sabab esa keyinchalik tekshirish
 * mumkin bo'lgan izni qoldiradi: kim, qachon, nima deb yozgan.
 *
 * Tizim sababning ROSTLIGINI tekshira olmaydi — bu odamning ishi.
 * Lekin sababsiz o'tkazib yuborishga yo'l qo'ymaydi.
 */
export function ExcusedReasonModal({
  open,
  row,
  onClose,
  onSubmit,
}: {
  open: boolean
  row: DailyAttendanceRow | null
  onClose: () => void
  onSubmit: (note: string) => Promise<void>
}) {
  const { t } = useI18n()

  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !row) return
    setSaving(false)
    setTouched(false)
    setNote(row.note)
  }, [open, row])

  if (!row) return null

  const trimmed = note.trim()
  const valid = trimmed.length >= MIN_REASON_LENGTH

  const error = touched && !valid ? t('attendance.excusedRequired') : undefined

  async function submit() {
    setTouched(true)
    if (!valid) return

    setSaving(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('attendance.excusedTitle')}
      description={row.fullName}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextArea
          label={t('attendance.excusedReason')}
          placeholder={t('attendance.excusedPlaceholder')}
          hint={t('attendance.excusedHint')}
          rows={3}
          required
          autoFocus
          value={note}
          error={error}
          onChange={(e) => setNote(e.target.value)}
        />

        <p className="flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
          <ShieldQuestion size={14} className="mt-0.5 shrink-0" />
          {t('attendance.excusedWarning')}
        </p>
      </div>
    </Modal>
  )
}
