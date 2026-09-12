import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Trash2 } from 'lucide-react'

import { deleteFace, enrollFace } from '@/api/face'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { loadFace, readFace, startCamera, stopCamera } from '@/lib/face'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * XODIMNING YUZINI RO'YXATDAN O'TKAZISH.
 *
 * UCHTA NAMUNA olinadi va har birida bosh holati boshqacha
 * bo'lishi so'raladi. Bitta suratda olingan iz yorug'lik
 * o'zgarganda yoki odam boshini burganda tanilmay qolardi.
 *
 * RASM SAQLANMAYDI: kadr shu yerda 128 ta songa aylanadi va
 * serverga faqat o'sha sonlar ketadi.
 */
const STEPS = 3

export function FaceEnrollModal({
  open,
  staff,
  enrolled,
  onClose,
  onSaved,
}: {
  open: boolean
  staff: { id: string; fullName: string } | null
  /** Yuz izi allaqachon bormi — shunda o'chirish tugmasi chiqadi */
  enrolled: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [ready, setReady] = useState(false)
  const [samples, setSamples] = useState<number[][]>([])
  const [hint, setHint] = useState('')
  const [capturing, setCapturing] = useState(false)

  const save = useAction(async () => {
    if (!staff) return null
    await enrollFace({ staffId: staff.id, fullName: staff.fullName, descriptors: samples })
    return true
  })
  const remove = useAction(async () => {
    if (!staff) return null
    await deleteFace(staff.id)
    return true
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setSamples([])
    setHint('')
    setReady(false)

    async function begin() {
      try {
        await loadFace()
        if (cancelled || !videoRef.current) return
        streamRef.current = await startCamera(videoRef.current)
        if (cancelled) {
          stopCamera(streamRef.current)
          return
        }
        setReady(true)
      } catch {
        /* Brauzer xatosi ingliz tilida keladi — o'z matnimizni ko'rsatamiz */
        setHint(t('face.cameraError'))
      }
    }

    void begin()

    return () => {
      cancelled = true
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [open, t])

  async function capture() {
    if (!videoRef.current) return
    setCapturing(true)
    setHint('')
    try {
      const reading = await readFace(videoRef.current)
      if (!reading) {
        setHint(t('face.notFound'))
        return
      }
      if (reading.size < 0.02) {
        setHint(t('face.tooFar'))
        return
      }
      setSamples((current) => [...current, reading.descriptor])
    } finally {
      setCapturing(false)
    }
  }

  async function submit() {
    const done = await save.run()
    if (!done) {
      toast.error(save.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('face.saved'))
    onSaved()
    onClose()
  }

  async function drop() {
    const done = await remove.run()
    if (!done) {
      toast.error(remove.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('face.removed'))
    onSaved()
    onClose()
  }

  const step = Math.min(samples.length, STEPS - 1)
  const stepHints = [t('face.step1'), t('face.step2'), t('face.step3')]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('face.enrollTitle')}
      description={staff?.fullName}
      footer={
        <>
          {enrolled ? (
            <Button variant="danger" loading={remove.pending} onClick={() => void drop()}>
              <Trash2 size={15} />
              {t('face.remove')}
            </Button>
          ) : (
            <Button variant="gray" onClick={onClose}>
              {t('action.cancel')}
            </Button>
          )}
          <Button
            loading={save.pending}
            disabled={samples.length < STEPS}
            onClick={() => void submit()}
          >
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <div className="aspect-[4/3] overflow-hidden rounded-[16px] bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        </div>

        {/* Namunalar */}
        <div className="mt-3 flex items-center gap-2">
          {Array.from({ length: STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-caption font-semibold',
                index < samples.length
                  ? 'bg-ok text-white'
                  : 'bg-fill-4 text-label-tertiary',
              )}
            >
              {index < samples.length ? <Check size={14} /> : index + 1}
            </span>
          ))}
          <p className="ml-1 text-footnote text-label-secondary">
            {samples.length < STEPS ? stepHints[step] : t('face.allDone')}
          </p>
        </div>

        <Button
          className="mt-3 w-full"
          variant="gray"
          icon={<Camera size={16} />}
          disabled={!ready || samples.length >= STEPS}
          loading={capturing}
          onClick={() => void capture()}
        >
          {t('face.capture')}
        </Button>

        {hint ? <p className="mt-2 text-footnote text-bad">{hint}</p> : null}
        <p className="mt-3 text-caption text-label-tertiary">{t('face.privacy')}</p>
      </div>
    </Modal>
  )
}
