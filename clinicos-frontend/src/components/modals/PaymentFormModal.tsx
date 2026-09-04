import { useEffect, useState } from 'react'

import { createPayment } from '@/api/payments'
import { listDoctorsShort } from '@/api/doctors'
import { listPatients } from '@/api/patients'
import { listServices, resolvePriceForPatient } from '@/api/services'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PriceHint } from '@/components/ui/PriceHint'
import { RadioGroup, Select, TextArea, TextInput } from '@/components/ui/Form'
import { money } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { PaymentMethod } from '@/types/models'

/**
 * To'lov qo'shish.
 *
 * Xizmat tanlanganda summa avtomatik to'ldiriladi, lekin uni qo'lda
 * o'zgartirish mumkin (chegirma yoki qo'shimcha uchun).
 */
export function PaymentFormModal({
  open,
  onClose,
  onSaved,
  preset,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /**
   * Navbatdan to'g'ridan-to'g'ri to'lov olish uchun.
   *
   * Registrator bemorni ro'yxatdan qayta qidirmasligi kerak: navbatdagi
   * qatorda "To'lov olish" bosilsa, forma to'ldirilgan holda ochiladi.
   * `appointmentId` esa to'lovni qabulga bog'laydi — kassa nazorati
   * aynan shu bog'lanish orqali "xizmat ko'rsatildi, puli olindimi"
   * degan savolga javob beradi.
   */
  preset?: {
    patientId: string
    /** Bemor ro'yxatning birinchi sahifasida bo'lmasligi mumkin */
    patientName: string
    doctorId?: string
    serviceId?: string
    appointmentId?: string
  } | null
}) {
  const { t, tService } = useI18n()
  const toast = useToast()

  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  const { data: patients } = useAsync(() => listPatients({ pageSize: 200 }), [])
  const { data: doctors } = useAsync(() => listDoctorsShort(), [])
  const { data: services } = useAsync(() => listServices('', 'all', 'active'), [])

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setPatientId(preset?.patientId ?? '')
    setDoctorId(preset?.doctorId ?? '')
    setServiceId(preset?.serviceId ?? '')
    setAmount('')
    setMethod('cash')
    setNotes('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /**
   * Bemor uchun narx — sodiqlik chegirmasi hisobga olingan holda.
   *
   * Chegirma qo'lda kiritilmaydi: bemorning shu xizmatdan necha marta
   * foydalanganiga qarab tizim o'zi hisoblaydi.
   */
  const { data: price } = useAsync(
    () => resolvePriceForPatient(serviceId, patientId || null),
    [serviceId, patientId],
    { skip: !serviceId },
  )

  // Hisoblangan narxni summa maydoniga qo'yamiz
  useEffect(() => {
    if (price) setAmount(String(price.price))
  }, [price])

  /**
   * Bemorlar ro'yxati sahifalab keladi, shuning uchun navbatdan
   * kelgan bemor unda bo'lmasligi mumkin. Bunday holatda uni
   * ro'yxatga qo'shib qo'yamiz — aks holda tanlov bo'sh ko'rinadi.
   */
  const patientOptions = (() => {
    const options = (patients?.items ?? []).map((p) => ({
      value: p.id,
      label: p.fullName,
    }))
    if (preset && !options.some((o) => o.value === preset.patientId)) {
      options.unshift({ value: preset.patientId, label: preset.patientName })
    }
    return options
  })()

  const errors = {
    patient: !patientId ? t('valid.required') : undefined,
    doctor: !doctorId ? t('valid.required') : undefined,
    service: !serviceId ? t('valid.required') : undefined,
    amount: !amount || Number(amount) <= 0 ? t('valid.positive') : undefined,
  }
  const valid = !errors.patient && !errors.doctor && !errors.service && !errors.amount

  const save = useAction(async () =>
    createPayment({
      patientId,
      doctorId,
      serviceId,
      appointmentId: preset?.appointmentId ?? null,
      amount: Number(amount),
      method,
      status: 'paid',
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
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payments.add')}
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
        <Select
          label={t('common.patient')}
          required
          value={patientId}
          error={touched ? errors.patient : undefined}
          onChange={(e) => setPatientId(e.target.value)}
          options={patientOptions}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('common.doctor')}
            required
            value={doctorId}
            error={touched ? errors.doctor : undefined}
            onChange={(e) => setDoctorId(e.target.value)}
            options={(doctors ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
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

        {/* Chegirma va to'lov turi */}
        {price ? <PriceHint preview={price} /> : null}

        <TextInput
          label={t('common.amount')}
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          required
          suffix="so'm"
          value={amount}
          error={touched ? errors.amount : undefined}
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

        <TextArea
          label={t('common.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}
