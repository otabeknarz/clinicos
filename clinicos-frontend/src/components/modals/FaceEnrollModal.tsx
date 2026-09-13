import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { deleteFace, enrollFace } from '@/api/face'
import { FaceScanner } from '@/components/face/FaceScanner'
import type { ScanState } from '@/components/face/FaceScanner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { loadFace, readFace, startCamera, stopCamera } from '@/lib/face'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * XODIMNING YUZINI RO'YXATDAN O'TKAZISH.
 *
 * HECH NARSA BOSILMAYDI: odam kameraga qaraydi, halqa to'ladi va
 * saqlanadi. Ilgari har bir namuna uchun "Suratga olish" tugmasi
 * bosilardi — kamera oldidagi odam bilan tugma orasida turgan
 * qo'l bu ishni uzaytirardi va kadrlar qimirlab chiqardi.
 *
 * UCHTA NAMUNA olinadi. Bittasi yetmaydi: yorug'lik o'zgarganda
 * yoki odam boshini burganda bitta namunali iz tanilmay qolardi.
 *
 * RASM SAQLANMAYDI: kadr shu yerda 128 ta songa aylanadi va
 * serverga faqat o'sha sonlar ketadi.
 */
const TICK_MS = 350
const SAMPLES = 3

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
  const samples = useRef<number[][]>([])
  const busy = useRef(false)

  const [state, setState] = useState<ScanState>('loading')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')

  const staffId = staff?.id ?? null
  const staffName = staff?.fullName ?? ''

  const remove = useAction(async () => {
    if (!staffId) return null
    await deleteFace(staffId)
    return true
  })

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || !staffId || busy.current) return

    const reading = await readFace(video)
    if (!reading || reading.size < 0.02) {
      samples.current = []
      setProgress(0)
      setState('scanning')
      return
    }

    samples.current.push(reading.descriptor)
    setProgress(samples.current.length / SAMPLES)
    setState('holding')
    if (samples.current.length < SAMPLES) return

    busy.current = true
    try {
      await enrollFace({ staffId, fullName: staffName, descriptors: samples.current })
      setState('success')
      setTimeout(() => {
        toast.success(t('face.saved'))
        onSaved()
        onClose()
      }, 900)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('toast.error'))
      setState('error')
      samples.current = []
      setTimeout(() => {
        busy.current = false
        setProgress(0)
        setState('scanning')
      }, 2000)
    }
  }, [onClose, onSaved, staffId, staffName, t, toast])

  useEffect(() => {
    if (!open) return
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    setState('loading')
    setMessage('')
    setProgress(0)
    samples.current = []
    busy.current = false

    async function begin() {
      try {
        await loadFace()
        if (cancelled || !videoRef.current) return
        streamRef.current = await startCamera(videoRef.current)
        if (cancelled) {
          stopCamera(streamRef.current)
          return
        }
        setState('scanning')
        timer = setInterval(() => void tick(), TICK_MS)
      } catch {
        setState('error')
        setMessage(t('face.cameraError'))
      }
    }

    void begin()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [open, tick, t])

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

  const hint =
    state === 'success'
      ? t('face.saved')
      : state === 'loading'
        ? t('face.loading')
        : state === 'error'
          ? message
          : state === 'holding'
            ? t('face.hold')
            : t('face.look')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('face.enrollTitle')}
      description={staffName}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          {enrolled ? (
            <Button variant="danger" loading={remove.pending} onClick={() => void drop()}>
              <Trash2 size={15} />
              {t('face.remove')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="pb-2">
        <FaceScanner
          videoRef={videoRef}
          state={state}
          progress={progress}
          title={state === 'success' ? staffName : undefined}
          hint={hint}
        />

        <p className="mt-4 text-center text-caption text-label-tertiary">
          {t('face.privacy')}
        </p>
      </div>
    </Modal>
  )
}
