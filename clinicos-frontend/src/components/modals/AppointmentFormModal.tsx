import { useEffect, useState } from 'react'

import { createAppointment } from '@/api/appointments'
import { listDoctorsShort } from '@/api/doctors'
import { listServices, resolvePriceForPatient } from '@/api/services'
import { Button } from '@/components/ui/Button'
import { PatientPicker } from '@/components/pickers/PatientPicker'
import { Select, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { PriceHint } from '@/components/ui/PriceHint'
import { atTime, toISODate } from '@/lib/dates'
import { money } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
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
  const { session } = useAuth()
  /*
    SHIFOKOR O'ZIGA YOZADI — tanlov yo'q, server ham boshqa shifokorni rad
    etadi. Registrator va egasi uchun forma avvalgidek.
  */
  const ownDoctorId = session?.user.role === 'doctor' ? session.user.doctorId : null

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
    setDoctorId(ownDoctorId ?? presetDoctorId ?? '')
    setServiceId('')
    setDate(presetDate ?? toISODate(new Date()))
    setStartTime(presetTime ?? '09:00')
    setNotes('')
  }, [open, presetPatientId, presetDoctorId, presetDate, presetTime, ownDoctorId])

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
            disabled={Boolean(ownDoctorId)}
            options={(doctors ?? [])
              .filter((d) => d.status === 'active' || d.id === ownDoctorId)
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
