import { useRef, useState } from 'react'
import { ImagePlus, ShieldCheck, X } from 'lucide-react'

import {
  leaveCabinetFeedback,
  listCabinetFeedback,
  uploadCabinetImage,
} from '@/api/cabinet'
import type { CabinetFeedbackItem } from '@/api/cabinet'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Stars } from '@/components/ui/Stars'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { dateShort } from '@/lib/format'
import { prepareMedicalImage } from '@/lib/image'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'
import { useToast } from '@/store/toast-context'

/**
 * KO'RIK HAQIDA FIKR.
 *
 * Fikr ANONIM: klinika uni kim yozganini ko'rmaydi. Buni bemorga
 * ochiq aytamiz — aks holda u rostini yozishdan cho'chiydi va
 * yig'ilgan baholar hech narsani anglatmay qoladi.
 *
 * Shifokor fikrni DARHOL ko'rmaydi: server uni 1-14 kun kechiktirib
 * ochadi. Aniq kun bo'lsa, shifokor "bu o'sha kungi bemordan" deb
 * hisoblab topardi.
 */
export function CabinetFeedbackPage() {
  const { t } = useI18n()
  /* Demo rejimda kim kirgani kontekstda — haqiqiy so‘rovda u tokendan */
  const { profile } = usePatient()
  const { data, loading, error, reload } = useAsync(
    () => listCabinetFeedback(profile?.patientId),
    [profile?.patientId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />

  const items = data ?? []

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('cabinet.feedbackNone')}
          description={t('cabinet.feedbackNoneHint')}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-[12px] bg-ok-soft px-3 py-2.5 text-caption text-ok">
        <ShieldCheck size={15} className="mt-px shrink-0" />
        {t('cabinet.feedbackAnonymous')}
      </p>

      {items.map((item) => (
        <VisitFeedback key={item.appointmentId} item={item} onSaved={reload} />
      ))}
    </div>
  )
}

function VisitFeedback({
  item,
  onSaved,
}: {
  item: CabinetFeedbackItem
  onSaved: () => void
}) {
  const { t, tService } = useI18n()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  /* Rasmlar: ko'rsatish uchun `dataUrl`, serverga esa `key` ketadi */
  const [images, setImages] = useState<{ dataUrl: string; key: string }[]>([])
  const [uploading, setUploading] = useState(false)

  const save = useAction(async () => {
    await leaveCabinetFeedback({
      appointmentId: item.appointmentId,
      rating,
      text: text.trim(),
      imageKeys: images.map((i) => i.key),
    })
  })

  async function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      /*
        Brauzerda kichraytiriladi: telefondan olingan 5 MB lik
        rasmni o'sha holicha yuborish shart emas.
      */
      const prepared = await prepareMedicalImage(file)
      if (!prepared.ok || !prepared.blob) {
        toast.error(t('visit.imageBad'))
        return
      }
      const { key } = await uploadCabinetImage(prepared.blob)
      setImages((current) => [...current, { dataUrl: prepared.dataUrl, key }])
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (rating === 0) return
    const result = await save.run()
    if (result === null) {
      toast.error(save.error?.message ?? t('toast.error'))
      return
    }
    toast.success(t('cabinet.feedbackThanks'))
    onSaved()
  }

  const header = (
    <>
      <p className="text-subhead font-semibold text-label">
        {tService(item.serviceName)}
      </p>
      <p className="mt-0.5 text-caption text-label-secondary">
        {item.doctorName} · {dateShort(item.visitedAt)}
      </p>
    </>
  )

  /* --- Fikr allaqachon yozilgan --- */
  if (item.feedback) {
    return (
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">{header}</div>
          <Stars value={item.feedback.rating} />
        </div>

        {item.feedback.text ? (
          <p className="text-subhead break-words text-label">{item.feedback.text}</p>
        ) : null}

        {item.feedback.images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.feedback.images.map((image) => (
              <img
                key={image.id}
                src={image.imageUrl}
                alt=""
                className="h-20 w-20 rounded-[10px] object-cover"
              />
            ))}
          </div>
        ) : null}

        {item.feedback.reply ? (
          <div className="rounded-[10px] bg-raised px-3 py-2.5">
            <p className="text-caption font-medium text-label-secondary">
              {t('cabinet.clinicReply')}
            </p>
            <p className="mt-1 text-subhead break-words text-label">
              {item.feedback.reply}
            </p>
          </div>
        ) : null}
      </Card>
    )
  }

  /* --- Yangi fikr --- */
  return (
    <Card className="space-y-4">
      <div className="min-w-0">{header}</div>

      <div className="flex justify-center">
        <Stars value={rating} onChange={setRating} size={32} />
      </div>

      <textarea
        value={text}
        rows={3}
        maxLength={2000}
        placeholder={t('cabinet.feedbackPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-none rounded-[10px] border border-transparent bg-raised px-3.5 py-2.5 text-subhead text-label outline-none transition-colors duration-150 focus:border-accent"
      />

      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <span key={image.key} className="relative">
              <img
                src={image.dataUrl}
                alt=""
                className="h-20 w-20 rounded-[10px] object-cover"
              />
              <IconButton
                label={t('action.delete')}
                className="absolute -right-2 -top-2 h-6 w-6 bg-fill-2"
                onClick={() =>
                  setImages((current) => current.filter((i) => i.key !== image.key))
                }
              >
                <X size={12} />
              </IconButton>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickImage(e)}
        />
        <Button
          variant="gray"
          loading={uploading}
          disabled={images.length >= 5}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={16} />
          {t('cabinet.addPhoto')}
        </Button>

        <Button
          className="ml-auto"
          disabled={rating === 0}
          loading={save.pending}
          onClick={() => void submit()}
        >
          {t('action.save')}
        </Button>
      </div>
    </Card>
  )
}
