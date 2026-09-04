import { useEffect, useState } from 'react'

import { createPatient, updatePatient } from '@/api/patients'
import { listDoctorsShort } from '@/api/doctors'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PhoneInput, RadioGroup, Select, TextArea, TextInput } from '@/components/ui/Form'
import { phoneToE164 } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { Gender, Patient } from '@/types/models'

/**
 * Bemor yaratish / tahrirlash oynasi.
 *
 * Validatsiya frontendda ham bor, lekin bu QULAYLIK uchun.
 * Serverda barcha maydonlar qaytadan tekshirilishi shart.
 */
export function PatientFormModal({
  open,
  onClose,
  onSaved,
  patient,
}: {
  open: boolean
  onClose: () => void
  onSaved: (patient: Patient) => void
  /** Berilsa — tahrirlash rejimi */
  patient?: Patient | null
}) {
  const { t, tSpecialty } = useI18n()
  const toast = useToast()
  const editing = Boolean(patient)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [touched, setTouched] = useState(false)

  const { data: doctors } = useAsync(() => listDoctorsShort(), [])

  // Oyna ochilganda maydonlarni to'ldiramiz/tozalaymiz
  useEffect(() => {
    if (!open) return
    setTouched(false)
    setFullName(patient?.fullName ?? '')
    setPhone(patient?.phone ?? '+998 ')
    setBirthDate(patient?.birthDate ?? '')
    setGender(patient?.gender ?? 'male')
    setAddress(patient?.address ?? '')
    setNotes(patient?.notes ?? '')
    setDoctorId(patient?.primaryDoctorId ?? '')
  }, [open, patient])

  const digits = phone.replace(/\D/g, '')
  const errors = {
    fullName: !fullName.trim() ? t('valid.required') : undefined,
    phone: digits.length < 12 ? t('valid.phone') : undefined,
    birthDate: !birthDate ? t('valid.required') : undefined,
  }
  const valid = !errors.fullName && !errors.phone && !errors.birthDate

  const save = useAction(async () => {
    const payload = {
      fullName: fullName.trim(),
      phone: phoneToE164(phone),
      birthDate,
      gender,
      address: address.trim(),
      notes: notes.trim(),
      primaryDoctorId: doctorId || null,
    }
    return editing && patient
      ? updatePatient(patient.id, payload)
      : createPatient(payload)
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(editing ? t('toast.updated') : t('patientForm.created'))
    onSaved(result)
    onClose()
  }

  const doctorOptions = (doctors ?? []).map((doctor) => ({
    value: doctor.id,
    label: `${doctor.fullName} — ${tSpecialty(doctor.specialty)}`,
  }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('action.edit') : t('patientForm.title')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            onClick={(e) => submit(e as unknown as React.FormEvent)}
            loading={save.pending}
            disabled={touched && !valid}
          >
            {editing ? t('action.save') : t('patientForm.submit')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4 pb-2">
        <TextInput
          label={t('patientForm.fullName')}
          placeholder={t('patientForm.fullNamePh')}
          required
          value={fullName}
          error={touched ? errors.fullName : undefined}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput
            label={t('patientForm.phone')}
            required
            value={phone}
            error={touched ? errors.phone : undefined}
            onChange={setPhone}
          />

          <TextInput
            label={t('patientForm.birthDate')}
            type="date"
            required
            value={birthDate}
            error={touched ? errors.birthDate : undefined}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RadioGroup<Gender>
            label={t('patientForm.gender')}
            value={gender}
            onChange={setGender}
            options={[
              { value: 'male', label: t('patient.gender.male') },
              { value: 'female', label: t('patient.gender.female') },
            ]}
          />

          <Select
            label={t('patientForm.doctor')}
            value={doctorId}
            options={doctorOptions}
            onChange={(e) => setDoctorId(e.target.value)}
          />
        </div>

        <TextInput
          label={t('patientForm.address')}
          placeholder={t('patientForm.addressPh')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        {/*
          Bu maydon REGISTRATURA uchun: "telefonni ko'tarmaydi",
          "chegirma kartasi bor" kabi eslatmalar. Tashxis bu yerda
          yozilmasligi kerak — uni shifokor tashrif yozuvida
          belgilaydi va u boshqa ruxsat ostida turadi.
        */}
        <TextArea
          label={t('patientForm.notes')}
          hint={t('patientForm.notesHint')}
          placeholder={t('patientForm.notesPh')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Enter bosilganda ham forma yuborilsin */}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  )
}
