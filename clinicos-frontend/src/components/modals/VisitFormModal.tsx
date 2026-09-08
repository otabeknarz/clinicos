import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import { createVisit } from '@/api/visits'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea, TextInput } from '@/components/ui/Form'
import { addDays, toISODate } from '@/lib/dates'
import { money } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { AppointmentExpanded } from '@/types/models'

/**
 * Shifokorning tashrif yozuvi.
 *
 * MVP doirasi ataylab tor: shikoyat, tashxis, davolash, izoh va
 * takroriy tashrif sanasi. To'liq elektron tibbiy karta EMAS.
 *
 * Saqlanganda qabul avtomatik "yakunlangan" holatiga o'tadi.
 */
export function VisitFormModal({
  open,
  onClose,
  onSaved,
  appointment,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  appointment: AppointmentExpanded | null
}) {
  const { t, tService } = useI18n()
  const toast = useToast()

  const [complaint, setComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [treatment, setTreatment] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [followUpReason, setFollowUpReason] = useState('')
  const [touched, setTouched] = useState(false)

  /*
    NARXNI SHIFOKOR BELGILAYDIGAN XIZMAT.

    Summa shu yerda kiritiladi va ko'rik yozuvida muzlaydi. Registrator
    keyin aynan shu raqamni oladi — pulni oladigan odam summani o'zi
    belgilamaydi.
  */
  const doctorSet = appointment?.service.priceMode === 'doctor_set'
  const minPrice = appointment?.service.minPrice ?? 0
  const maxPrice = appointment?.service.maxPrice ?? 0
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setPrice('')
    setComplaint('')
    setDiagnosis('')
    setTreatment('')
    setNotes('')
    setFollowUp('')
    setFollowUpReason('')
  }, [open])

  const save = useAction(async () => {
    if (!appointment) return null
    return createVisit({
      appointmentId: appointment.id,
      patientId: appointment.patient.id,
      doctorId: appointment.doctor.id,
      price: doctorSet ? Number(price) : undefined,
      complaint: complaint.trim(),
      diagnosis: diagnosis.trim(),
      treatment: treatment.trim(),
      notes: notes.trim(),
      followUpDate: followUp || null,
      followUpReason: followUpReason.trim(),
    })
  })

  const diagnosisError = touched && !diagnosis.trim() ? t('valid.required') : undefined

  /*
    Oraliqni FORMA emas, server hal qiladi — bu yerdagi tekshiruv
    shunchaki shifokorga darrov aytish uchun.
  */
  const priceValue = Number(price)
  const priceError = !doctorSet
    ? undefined
    : !price || priceValue <= 0
      ? t('valid.positive')
      : priceValue < minPrice || priceValue > maxPrice
        ? t('visit.priceRangeError', {
            min: money(minPrice),
            max: money(maxPrice),
          })
        : undefined

  async function submit() {
    setTouched(true)
    if (!diagnosis.trim()) return
    if (doctorSet && priceError) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('toast.saved'))
    onSaved()
    onClose()
  }

  if (!appointment) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('visit.title')}
      description={`${appointment.patient.fullName} · ${tService(appointment.service.name)}`}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={save.pending}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-caption font-medium text-warn">
          <ShieldAlert size={13} />
          {t('patient.medicalNotice')}
        </p>

        {/*
          Narxni shifokor belgilaydigan xizmat: summa shu yerda
          kiritiladi va ko'rik yozuvida muzlaydi. Registrator keyin
          aynan shuni oladi.
        */}
        {doctorSet ? (
          <TextInput
            label={t('visit.price')}
            type="number"
            inputMode="numeric"
            min={minPrice}
            max={maxPrice}
            step={10000}
            required
            suffix="so'm"
            hint={t('visit.priceHint', { min: money(minPrice), max: money(maxPrice) })}
            value={price}
            error={touched ? priceError : undefined}
            onChange={(e) => setPrice(e.target.value)}
          />
        ) : null}

        <TextInput
          label={t('visit.complaint')}
          placeholder={t('visit.complaintPh')}
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
        />

        <TextArea
          label={t('visit.diagnosis')}
          required
          rows={2}
          value={diagnosis}
          error={diagnosisError}
          onChange={(e) => setDiagnosis(e.target.value)}
        />

        <TextArea
          label={t('visit.treatment')}
          rows={3}
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
        />

        <TextArea
          label={t('visit.notes')}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* --- Takroriy tashrif --- */}
        <div className="rounded-[14px] bg-sunken p-4">
          <p className="mb-3 text-footnote font-medium text-label">
            {t('patient.nextFollowUp')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              type="date"
              value={followUp}
              min={toISODate(addDays(new Date(), 1))}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <TextInput
              placeholder={t('visit.followUpReasonPh')}
              value={followUpReason}
              disabled={!followUp}
              onChange={(e) => setFollowUpReason(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
