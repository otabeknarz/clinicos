import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react'

import { bulkMoveAppointments, listAppointmentsRange } from '@/api/appointments'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { addDays, toISODate } from '@/lib/dates'
import { time } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { BulkMoveResult, Doctor } from '@/types/models'

/**
 * QABULLARNI KO'CHIRISH.
 *
 * Shifokor kasal bo'lib qolgan kunning ikki odatiy yechimi:
 *   "Boshqa kunga"       — vaqti saqlanadi (09:30 → yangi kunda 09:30)
 *   "Boshqa shifokorga"  — o'sha kun, o'sha vaqt, boshqa shifokor
 *
 * Qaysi qabullar ko'chishini registrator belgilaydi — hammasi oldindan
 * belgilangan. Band vaqtga tushganlari server tomonidan o'tkazilmaydi va
 * natija oynasida sababi bilan ko'rinadi: ularni qo'lda joylash kerak.
 */
export function BulkMoveModal({
  open,
  onClose,
  onDone,
  doctors,
  initialDate,
  initialDoctorId,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
  doctors: Doctor[]
  initialDate: string
  initialDoctorId: string | 'all'
}) {
  const { t, tService } = useI18n()
  const toast = useToast()

  const [sourceDate, setSourceDate] = useState(initialDate)
  const [sourceDoctor, setSourceDoctor] = useState<string>(initialDoctorId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'date' | 'doctor'>('date')
  const [targetDate, setTargetDate] = useState('')
  const [targetDoctor, setTargetDoctor] = useState('')
  const [notify, setNotify] = useState(true)
  const [result, setResult] = useState<BulkMoveResult | null>(null)

  useEffect(() => {
    if (!open) return
    setSourceDate(initialDate)
    setSourceDoctor(initialDoctorId)
    setMode('date')
    setTargetDate(toISODate(addDays(new Date(`${initialDate}T12:00:00`), 1)))
    setTargetDoctor('')
    setNotify(true)
    setResult(null)
  }, [open, initialDate, initialDoctorId])

  const source = useAsync(
    async () => {
      if (!open || !sourceDate) return []
      const day = new Date(`${sourceDate}T12:00:00`)
      const rows = await listAppointmentsRange(day, day, sourceDoctor)
      return rows.filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
    },
    [open, sourceDate, sourceDoctor],
  )
  const rows = useMemo(() => source.data ?? [], [source.data])

  /* Ro'yxat yangilanganda — hammasi belgilangan */
  useEffect(() => {
    setSelected(new Set(rows.map((r) => r.id)))
  }, [rows])

  const move = useAction(async () =>
    bulkMoveAppointments({
      ids: [...selected],
      mode,
      date: mode === 'date' ? targetDate : undefined,
      doctorId: mode === 'doctor' ? targetDoctor : undefined,
      notify,
    }),
  )

  const targetMissing = mode === 'date' ? !targetDate : !targetDoctor
  const canSubmit = selected.size > 0 && !targetMissing

  async function submit() {
    if (!canSubmit) return
    const done = await move.run()
    if (!done) {
      toast.error(move.lastError()?.message || t('toast.error'))
      return
    }
    setResult(done)
    if (done.moved.length > 0) onDone()
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('move.title')}
      description={result ? undefined : t('move.hint')}
      footer={
        result ? (
          <Button onClick={onClose}>{t('action.close')}</Button>
        ) : (
          <>
            <Button variant="gray" onClick={onClose}>
              {t('action.close')}
            </Button>
            <Button icon={<ArrowRightLeft size={16} />} loading={move.pending} disabled={!canSubmit} onClick={submit}>
              {t('move.submit', { count: selected.size })}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4 pb-2">
          <div className="flex items-center gap-3 rounded-[12px] bg-ok-soft px-4 py-3 text-ok">
            <CheckCircle2 size={18} />
            <span className="text-subhead font-medium">{t('move.moved', { count: result.moved.length })}</span>
          </div>
          {result.skipped.length > 0 ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-footnote font-medium text-warn">
                <AlertTriangle size={15} /> {t('move.skipped', { count: result.skipped.length })}
              </p>
              <ul className="divide-y divide-separator rounded-[12px] ring-1 ring-separator">
                {result.skipped.map((row) => (
                  <li key={row.id} className="px-3 py-2">
                    <p className="text-subhead text-label">
                      {row.time ? <span className="tnum text-label-secondary">{time(row.time)} · </span> : null}
                      {row.patientName}
                    </p>
                    <p className="text-caption text-warn">{row.reason}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-label-tertiary">{t('move.skippedHint')}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {/* --- Qaysi qabullar --- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('move.sourceDate')}
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
            />
            <Select
              label={t('move.sourceDoctor')}
              value={sourceDoctor === 'all' ? '' : sourceDoctor}
              onChange={(e) => setSourceDoctor(e.target.value || 'all')}
              placeholder={t('calendar.allDoctors')}
              options={doctors.map((d) => ({ value: d.id, label: d.fullName }))}
            />
          </div>

          <Field label={t('move.appointments', { count: rows.length })}>
            {source.loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-[10px]" />
                <Skeleton className="h-10 w-full rounded-[10px]" />
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-[12px] bg-sunken px-4 py-3 text-footnote text-label-tertiary">{t('move.empty')}</p>
            ) : (
              <div className="rounded-[12px] ring-1 ring-separator">
                <label className="hairline flex cursor-pointer items-center gap-3 px-3 py-2 text-footnote text-label-secondary">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                  {t('move.selectAll')}
                </label>
                <ul className="scroll-slim max-h-56 divide-y divide-separator overflow-y-auto">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-fill-4">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                        <span className="w-11 shrink-0 text-subhead font-semibold tnum text-label">
                          {time(row.startsAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-subhead text-label">{row.patient.fullName}</span>
                          <span className="block truncate text-caption text-label-tertiary">
                            {row.doctor.fullName} · {tService(row.service.name)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Field>

          {/* --- Qayerga --- */}
          <Field label={t('move.where')}>
            <Segmented<'date' | 'doctor'>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'date', label: t('move.mode.date') },
                { value: 'doctor', label: t('move.mode.doctor') },
              ]}
            />
          </Field>

          {mode === 'date' ? (
            <TextInput
              label={t('move.targetDate')}
              hint={t('move.targetDateHint')}
              type="date"
              min={toISODate(new Date())}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          ) : (
            <Select
              label={t('move.targetDoctor')}
              hint={t('move.targetDoctorHint')}
              value={targetDoctor}
              onChange={(e) => setTargetDoctor(e.target.value)}
              options={doctors
                .filter((d) => d.id !== sourceDoctor)
                .map((d) => ({ value: d.id, label: d.fullName }))}
            />
          )}

          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-[12px] px-3.5 py-3',
              notify ? 'bg-accent-soft' : 'bg-sunken',
            )}
          >
            <input type="checkbox" className="mt-0.5" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>
              <span className="block text-subhead font-medium text-label">{t('move.notify')}</span>
              <span className="block text-caption text-label-secondary">{t('move.notifyHint')}</span>
            </span>
          </label>
        </div>
      )}
    </Modal>
  )
}
