import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, Send } from 'lucide-react'

import { checkArrivalTime, lateMinutesFrom } from '@/api/attendance'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import type { DailyAttendanceRow } from '@/types/models'

/**
 * KECHIKKAN XODIMNING KELISH VAQTI.
 *
 * Registrator "Kechikdi" ni bosganda soatni qo'lda kiritadi — tizim
 * kechikish daqiqalarini smena boshiga nisbatan o'zi hisoblaydi.
 *
 * ANTI-KORRUPSIYA: kelish vaqti orqaga surib yozilsa (odam allaqachon
 * kelib ketgan, lekin soat ertalabgi qilib yoziladi), ekranda
 * ogohlantirish chiqadi va yozuv klinika egasiga signal bo'lib boradi.
 * Tizim yozuvni TO'SMAYDI: haqiqiy sabablar ham bo'ladi. Lekin uni
 * yashirmaydi ham — registrator nima yozayotganini bilib turadi.
 */
export function LateArrivalModal({
  open,
  row,
  date,
  onClose,
  onSubmit,
}: {
  open: boolean
  row: DailyAttendanceRow | null
  date: string
  onClose: () => void
  onSubmit: (arrivedAt: string, lateMinutes: number, note: string) => Promise<void>
}) {
  const { t } = useI18n()

  const [arrivedAt, setArrivedAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !row) return
    setSaving(false)
    setNote(row.note)
    /*
      Allaqachon "kechikdi" deb belgilangan bo'lsa — avvalgi vaqtni
      tahrirlash uchun qo'yamiz. Boshqa holatda hozirgi vaqt: odam
      hozir keldi, registrator hozir belgilayapti.

      MUHIM: bu yerda xodimning boshqa holatdagi (masalan "keldi")
      vaqtini olib bo'lmaydi — u smena boshiga teng bo'lib, tungi
      smenada kelajakdagi vaqt bo'lib qoladi.
    */
    setArrivedAt(row.status === 'late' && row.arrivedAt ? row.arrivedAt : currentTime())
  }, [open, row])

  if (!row) return null

  const valid = /^\d{2}:\d{2}$/.test(arrivedAt)
  const lateMinutes = valid
    ? lateMinutesFrom(row.shiftStart, arrivedAt, row.shiftEnd)
    : 0

  // Smena boshidan oldin kelgan bo'lsa, bu kechikish emas
  const notLate = valid && lateMinutes === 0

  /*
    Shubha tekshiruvi faqat haqiqiy kechikishda ko'rsatiladi.
    "Kechikish emas" xatosi allaqachon saqlashni to'sgan — ustiga
    ikkinchi ogohlantirish qo'yish faqat chalg'itadi.
  */
  const check = valid && !notLate ? checkArrivalTime(date, arrivedAt) : null

  async function submit() {
    if (!valid || notLate) return
    setSaving(true)
    try {
      await onSubmit(arrivedAt, lateMinutes, note.trim())
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
      title={t('attendance.lateAsk')}
      description={`${row.fullName} · ${t('attendance.shift')} ${row.shiftStart}—${row.shiftEnd}`}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid || notLate} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('attendance.arrivedAt')}
          type="time"
          required
          autoFocus
          value={arrivedAt}
          onChange={(e) => setArrivedAt(e.target.value)}
          error={notLate ? t('attendance.notLate') : undefined}
        />

        {/* --- Hisoblangan kechikish --- */}
        {valid && lateMinutes > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] bg-warn-soft px-4 py-3">
            <span className="inline-flex items-center gap-2 text-footnote font-medium text-warn">
              <Clock size={15} />
              {t('attendance.late')}
            </span>
            <span className="text-title-3 font-bold tnum text-warn">
              {t('attendance.lateBy', { count: lateMinutes })}
            </span>
          </div>
        ) : null}

        <TextArea
          label={t('common.notes')}
          placeholder={t('attendance.notePlaceholder')}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* --- Shubhali vaqt ogohlantirishi --- */}
        {check?.flagged ? (
          <div
            className={cn(
              'rounded-[12px] p-3.5',
              check.reason === 'future' ? 'bg-bad-soft' : 'bg-warn-soft',
            )}
          >
            <p
              className={cn(
                'flex items-start gap-2 text-footnote font-semibold',
                check.reason === 'future' ? 'text-bad' : 'text-warn',
              )}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {check.reason === 'future'
                ? t('attendance.flag.future')
                : t('attendance.flag.backdated', {
                    hours: Math.floor(check.gapMinutes / 60),
                  })}
            </p>

            <p className="mt-2 flex items-start gap-2 text-caption text-label-secondary">
              <Send size={13} className="mt-0.5 shrink-0" />
              {t('attendance.flag.willNotify')}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

/** Hozirgi vaqt "HH:MM" ko'rinishida */
function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
