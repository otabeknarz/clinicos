import { useEffect, useState } from 'react'
import { ImagePlus, ShieldAlert, X } from 'lucide-react'

/** Bitta tashrifga biriktiriladigan eng ko'p rasm — serverdagi chegara bilan bir xil */
const MAX_IMAGES = 10

import { createVisit } from '@/api/visits'
import { uploadImage } from '@/api/uploads'
import { cn } from '@/lib/cn'
import { prepareMedicalImage } from '@/lib/image'
import { Button, IconButton } from '@/components/ui/Button'
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

  /*
    BIRIKTIRILGAN RASMLAR.

    Rasm tanlangan zahoti serverga yuboriladi va KALIT qaytadi;
    yozuv saqlanganda faqat kalitlar ketadi. Shuning uchun bu yerda
    ikkalasi ham saqlanadi: `preview` — darhol ko'rsatish uchun,
    `key` — yozuvga yoziladigan qiymat.
  */
  const [images, setImages] = useState<{ preview: string; key: string }[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setPrice('')
    setImages([])
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
      imageKeys: images.map((image) => image.key),
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

  /**
   * Tanlangan rasmlarni yuklaydi.
   *
   * Har biri alohida yuboriladi: bittasi yiqilsa qolganlari
   * saqlanib qoladi va shifokor faqat o'shani qayta tanlaydi.
   */
  async function pickImages(files: FileList | null) {
    if (!files || files.length === 0) return

    const room = MAX_IMAGES - images.length
    if (room <= 0) {
      toast.error(t('visit.imagesFull', { count: MAX_IMAGES }))
      return
    }

    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const prepared = await prepareMedicalImage(file)
        if (!prepared.ok || !prepared.blob) {
          toast.error(t('visit.imageBad'))
          continue
        }
        try {
          const uploaded = await uploadImage('visits', prepared.blob, prepared.dataUrl)
          setImages((current) => [
            ...current,
            { preview: prepared.dataUrl, key: uploaded.key },
          ])
        } catch {
          // Fayl xotirasi sozlanmagan bo'lsa server 503 qaytaradi
          toast.error(t('visit.imageFailed'))
        }
      }
    } finally {
      setUploading(false)
    }
  }

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

        {/*
          --- Rasmlar ---

          Ixtiyoriy. Rasm faqat SHU PAYTDA biriktiriladi: yozuv
          saqlangach o'zgarmaydi, shuning uchun keyin qo'shib
          bo'lmaydi. Buni izohda aytib qo'yamiz.
        */}
        <div>
          <p className="text-footnote font-medium text-label-secondary">
            {t('visit.images')}
          </p>
          <p className="mt-0.5 text-caption text-label-tertiary">
            {t('visit.imagesHint')}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((image, index) => (
              <div key={image.key} className="relative">
                <img
                  src={image.preview}
                  alt=""
                  className="size-20 rounded-[10px] object-cover"
                />
                <IconButton
                  label={t('action.delete')}
                  className="absolute -right-1.5 -top-1.5 size-6 rounded-full bg-bad text-white hover:bg-bad"
                  onClick={() =>
                    setImages((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <X size={12} />
                </IconButton>
              </div>
            ))}

            {images.length < MAX_IMAGES ? (
              <label
                className={cn(
                  'grid size-20 cursor-pointer place-items-center rounded-[10px]',
                  'bg-sunken text-label-tertiary hover:text-label',
                  uploading && 'pointer-events-none opacity-50',
                )}
              >
                <ImagePlus size={20} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void pickImages(e.target.files)
                    // Bir xil faylni qayta tanlash ishlasin
                    e.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>

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
