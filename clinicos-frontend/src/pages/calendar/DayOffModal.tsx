import { useEffect, useState } from 'react'
import { CalendarOff, Check, Trash2 } from 'lucide-react'

import { createDayOff, deleteDayOff, listDaysOff } from '@/api/daysOff'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Tabs'
import { addDays, toISODate } from '@/lib/dates'
import { dateLong } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { Doctor } from '@/types/models'

/**
 * DAM OLISH KUNINI BELGILASH.
 *
 * Ikki holat bir oynada, chunki registrator uchun savol bitta — "shu kun
 * kim ishlamaydi": butun klinika (bayram, sanitariya kuni) yoki bitta
 * shifokor (kasal, ta'til, safar).
 *
 * Saqlangach shu kunlarda yozilgan qabul bo'lsa, oyna O'ZI "ko'chirish"
 * ga o'tkazadi — dam olish belgilanib, bemorlar eski vaqtda qolib ketishi
 * eng yomon natija bo'lardi.
 */
export function DayOffModal({
  open,
  onClose,
  onSaved,
  doctors,
  initialDate,
  initialDoctorId,
}: {
  open: boolean
  onClose: () => void
  /** `affected` — ko'chirish kerak bo'lgan birinchi kun (bo'lsa) */
  onSaved: (affected: { date: string; doctorId: string | 'all'; count: number } | null) => void
  doctors: Doctor[]
  initialDate: string
  initialDoctorId: string | 'all'
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [scope, setScope] = useState<'clinic' | 'doctor'>('doctor')
  const [doctorId, setDoctorId] = useState('')
  const [from, setFrom] = useState(initialDate)
  const [to, setTo] = useState(initialDate)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setScope(initialDoctorId === 'all' ? 'clinic' : 'doctor')
    setDoctorId(initialDoctorId === 'all' ? '' : initialDoctorId)
    setFrom(initialDate)
    setTo(initialDate)
    setReason('')
    setTouched(false)
  }, [open, initialDate, initialDoctorId])

  const today = toISODate(new Date())
  const upcoming = useAsync(
    () => (open ? listDaysOff(today, toISODate(addDays(new Date(), 90))) : Promise.resolve([])),
    [open],
  )

  const errors = {
    doctor: scope === 'doctor' && !doctorId ? t('dayoff.error.doctor') : undefined,
    range: from && to && from <= to ? undefined : t('dayoff.error.range'),
  }

  const save = useAction(async () =>
    createDayOff({ from, to, doctorId: scope === 'doctor' ? doctorId : undefined, reason }),
  )
  const remove = useAction(async (id: string) => deleteDayOff(id))

  async function submit() {
    setTouched(true)
    if (errors.doctor || errors.range) return
    const result = await save.run()
    if (!result) {
      toast.error(save.lastError()?.message || t('toast.error'))
      return
    }
    toast.success(t('dayoff.saved'))
    onSaved(
      result.affectedAppointments > 0
        ? {
            date: result.affectedDays[0],
            doctorId: scope === 'doctor' ? doctorId : 'all',
            count: result.affectedAppointments,
          }
        : null,
    )
  }

  const doctorName = new Map(doctors.map((d) => [d.id, d.fullName]))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('dayoff.title')}
      description={t('dayoff.hint')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.close')}
          </Button>
          <Button icon={<Check size={16} />} loading={save.pending} onClick={submit}>
            {t('dayoff.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmented<'clinic' | 'doctor'>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'doctor', label: t('dayoff.scope.doctor') },
            { value: 'clinic', label: t('dayoff.scope.clinic') },
          ]}
        />

        {scope === 'doctor' ? (
          <Select
            label={t('dayoff.doctor')}
            required
            value={doctorId}
            error={touched ? errors.doctor : undefined}
            onChange={(e) => setDoctorId(e.target.value)}
            options={doctors.map((d) => ({ value: d.id, label: d.fullName }))}
          />
        ) : (
          <p className="rounded-[12px] bg-warn-soft px-3.5 py-3 text-footnote text-warn">
            {t('dayoff.clinicWarning')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('dayoff.from')}
            type="date"
            min={today}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              if (e.target.value > to) setTo(e.target.value)
            }}
          />
          <TextInput
            label={t('dayoff.to')}
            type="date"
            min={from || today}
            value={to}
            error={touched ? errors.range : undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <TextInput
          label={t('dayoff.reason')}
          placeholder={scope === 'doctor' ? t('dayoff.reasonDoctor') : t('dayoff.reasonClinic')}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* --- Oldindagi dam olish kunlari --- */}
        <Field label={t('dayoff.upcoming')}>
          {(upcoming.data ?? []).length === 0 ? (
            <p className="text-footnote text-label-tertiary">{t('dayoff.none')}</p>
          ) : (
            <ul className="divide-y divide-separator rounded-[12px] ring-1 ring-separator">
              {(upcoming.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                  <CalendarOff size={15} className={row.doctorId ? 'text-warn' : 'text-bad'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-subhead text-label">
                      {dateLong(row.date)} ·{' '}
                      {row.doctorId
                        ? (row.doctorName ?? doctorName.get(row.doctorId) ?? '—')
                        : t('dayoff.scope.clinic')}
                    </p>
                    {row.reason ? (
                      <p className="truncate text-caption text-label-tertiary">{row.reason}</p>
                    ) : null}
                  </div>
                  <IconButton
                    label={t('action.delete')}
                    onClick={async () => {
                      const ok = await remove.run(row.id)
                      if (ok === null) toast.error(t('toast.error'))
                      else upcoming.reload()
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
    </Modal>
  )
}
