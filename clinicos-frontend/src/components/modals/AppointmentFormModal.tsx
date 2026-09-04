import { useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'

import { createAppointment } from '@/api/appointments'
import { listDoctorsShort } from '@/api/doctors'
import { listPatients } from '@/api/patients'
import { listServices, resolvePriceForPatient } from '@/api/services'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { PriceHint } from '@/components/ui/PriceHint'
import { cn } from '@/lib/cn'
import { atTime, toISODate } from '@/lib/dates'
import { money, phone as formatPhone } from '@/lib/format'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { Appointment } from '@/types/models'

/**
 * Qabul yaratish.
 *
 * Registratura tezligi muhim: bemor qidiruvi jonli, sana bugundan
 * boshlanadi, xizmat tanlanganda davomiyligi avtomatik olinadi.
 */
export function AppointmentFormModal({
  open,
  onClose,
  onSaved,
  presetPatientId,
  presetDoctorId,
  presetDate,
  presetTime,
}: {
  open: boolean
  onClose: () => void
  onSaved: (appointment: Appointment) => void
  presetPatientId?: string
  presetDoctorId?: string
  presetDate?: string
  presetTime?: string
}) {
  const { t, tSpecialty, tService } = useI18n()
  const toast = useToast()

  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setPatientId(presetPatientId ?? '')
    setDoctorId(presetDoctorId ?? '')
    setServiceId('')
    setDate(presetDate ?? toISODate(new Date()))
    setStartTime(presetTime ?? '09:00')
    setNotes('')
  }, [open, presetPatientId, presetDoctorId, presetDate, presetTime])

  const { data: doctors } = useAsync(() => listDoctorsShort(), [])
  const { data: services } = useAsync(() => listServices('', 'all', 'active'), [])

  const errors = {
    patient: !patientId ? t('valid.required') : undefined,
    doctor: !doctorId ? t('valid.required') : undefined,
    service: !serviceId ? t('valid.required') : undefined,
    date: !date ? t('valid.required') : undefined,
  }
  const valid = !errors.patient && !errors.doctor && !errors.service && !errors.date

  const selectedService = (services ?? []).find((s) => s.id === serviceId)

  /**
   * Bemor va xizmat tanlangach, narxni hisoblab ko'rsatamiz.
   *
   * Registrator qabulni yozayotganda darhol bilishi kerak: bu xizmat
   * oldindan to'lanadimi va bemorga chegirma tegadimi.
   */
  const { data: price } = useAsync(
    () => resolvePriceForPatient(serviceId, patientId || null),
    [serviceId, patientId],
    { skip: !serviceId },
  )

  const save = useAction(async () =>
    createAppointment({
      patientId,
      doctorId,
      serviceId,
      startsAt: atTime(new Date(date), startTime).toISOString(),
      notes: notes.trim(),
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
    onSaved(result)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('appts.add')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={save.pending}>
            {t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {presetPatientId ? null : (
          <PatientPicker
            value={patientId}
            onChange={setPatientId}
            error={touched ? errors.patient : undefined}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('common.doctor')}
            required
            value={doctorId}
            error={touched ? errors.doctor : undefined}
            onChange={(e) => setDoctorId(e.target.value)}
            options={(doctors ?? [])
              .filter((d) => d.status === 'active')
              .map((d) => ({
                value: d.id,
                label: `${d.fullName} — ${tSpecialty(d.specialty)}`,
              }))}
          />

          <Select
            label={t('common.service')}
            required
            value={serviceId}
            error={touched ? errors.service : undefined}
            onChange={(e) => setServiceId(e.target.value)}
            options={(services ?? []).map((s) => ({
              value: s.id,
              label: `${tService(s.name)} — ${money(s.price)}`,
            }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('common.date')}
            type="date"
            required
            value={date}
            error={touched ? errors.date : undefined}
            onChange={(e) => setDate(e.target.value)}
          />

          <TextInput
            label={t('common.time')}
            type="time"
            required
            step={300}
            value={startTime}
            hint={
              selectedService
                ? `${selectedService.durationMinutes} ${t('common.min')}`
                : undefined
            }
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        {/* Narx, chegirma va to'lov turi */}
        {price ? <PriceHint preview={price} /> : null}

        <TextArea
          label={t('common.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Bemor tanlagich                                                     */
/* ------------------------------------------------------------------ */

/**
 * Jonli qidiruvli bemor tanlagich.
 * Oddiy `<select>` yuzlab bemor bilan ishlatib bo'lmaydi.
 */
function PatientPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 200)

  const { data } = useAsync(
    () => listPatients({ search: debounced, pageSize: 8 }),
    [debounced],
  )

  const rows = useMemo(() => data?.items ?? [], [data])
  const selected = rows.find((p) => p.id === value)

  return (
    <Field label={t('common.patient')} required error={error}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute inset-y-0 left-3 my-auto text-label-tertiary"
        />
        <input
          type="search"
          value={selected && !query ? selected.fullName : query}
          placeholder={t('patients.search')}
          onChange={(e) => {
            setQuery(e.target.value)
            if (value) onChange('')
          }}
          className={cn(
            'h-10 w-full rounded-[10px] bg-sunken pl-10 pr-3.5 text-subhead text-label',
            'border outline-none placeholder:text-label-tertiary',
            'transition-colors duration-150 focus:bg-raised',
            error ? 'border-bad' : 'border-transparent focus:border-accent',
          )}
        />
      </div>

      {rows.length > 0 ? (
        <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto scroll-slim rounded-[12px] bg-sunken p-1.5">
          {rows.map((patient) => {
            const active = patient.id === value
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(patient.id)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left',
                    'transition-colors duration-150 hover:bg-fill-4',
                    active && 'bg-accent-soft',
                  )}
                >
                  <Avatar name={patient.fullName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-subhead text-label">
                      {patient.fullName}
                    </span>
                    <span className="block truncate text-caption text-label-tertiary tnum">
                      {formatPhone(patient.phone)}
                    </span>
                  </span>
                  {active ? <Check size={15} className="shrink-0 text-accent" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Field>
  )
}
