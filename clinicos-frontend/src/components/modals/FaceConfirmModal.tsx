import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraOff, ScanFace, ShieldCheck } from 'lucide-react'

import { faceVerify } from '@/api/face'
import type { FaceCheckInResult } from '@/api/face'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { loadFace, readFace, snapshot, startCamera, stopCamera } from '@/lib/face'
import { useI18n } from '@/i18n'

/**
 * "KELDI" TUGMASINING YUZ TASDIG'I.
 *
 * NEGA: kelish vaqtini registrator yozganda, nazorat odamda
 * qoladi — kelmagan hamkasbini "keldi" deb belgilab qo'yish
 * hech kimga qiyin emas. Kamera bu ishni tizim tomoniga oladi:
 * yozuv uchun xodimning O'ZI kamera oldida turishi kerak.
 *
 * SERVER HAM ISHONMAYDI: yuz bu yerda emas, serverda
 * solishtiriladi va butun jamoaga qarab tekshiriladi — kamera
 * oldidagi odam boshqa xodim bo'lsa, yozuv rad etiladi.
 *
 * KAMERA ISHLAMASA — ish to'xtamaydi: qo'lda belgilash yo'li
 * ochiq qoladi (u yozuv suratsiz bo'ladi va egasi buni ko'radi).
 */

/** Ko'z shu qiymatdan pastga tushsa — qisilgan deb hisoblanadi */
const BLINK_LEVEL = 0.19
/** Ko'z qisilgandan keyin shuncha vaqt "jonli" deb hisoblanadi */
const BLINK_WINDOW = 5000

type Stage = 'loading' | 'searching' | 'blink' | 'checking' | 'error'

export function FaceConfirmModal({
  open,
  staff,
  onClose,
  onConfirmed,
  onManual,
}: {
  open: boolean
  staff: { id: string; fullName: string } | null
  onClose: () => void
  onConfirmed: (result: FaceCheckInResult) => void
  /** Kamera ochilmaganda — eski yo'l bilan belgilash */
  onManual: () => void
}) {
  const { t } = useI18n()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const blinkedAt = useRef(0)
  const busy = useRef(false)

  const [stage, setStage] = useState<Stage>('loading')
  const [message, setMessage] = useState('')

  const staffId = staff?.id ?? null

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || !staffId || busy.current) return

    const reading = await readFace(video)
    if (!reading) {
      setStage('searching')
      return
    }

    if (reading.eyeOpenness < BLINK_LEVEL) blinkedAt.current = Date.now()
    if (Date.now() - blinkedAt.current > BLINK_WINDOW) {
      setStage('blink')
      return
    }

    busy.current = true
    setStage('checking')
    try {
      const result = await faceVerify(staffId, reading.descriptor, snapshot(video))
      onConfirmed(result)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('toast.error'))
      setStage('searching')
      blinkedAt.current = 0
      /* Qisqa pauza — bir xil kadrni qayta-qayta yubormaslik uchun */
      setTimeout(() => {
        busy.current = false
      }, 2000)
    }
  }, [onConfirmed, staffId, t])

  useEffect(() => {
    if (!open) return
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    setStage('loading')
    setMessage('')
    blinkedAt.current = 0
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
        setStage('searching')
        timer = setInterval(() => void tick(), 700)
      } catch {
        /* Brauzer xatosi ingliz tilida keladi — o'z matnimizni ko'rsatamiz */
        setStage('error')
      }
    }

    void begin()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      stopCamera(streamRef.current)
      streamRef.current = null
    }
  }, [open, tick])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('face.confirmTitle')}
      description={staff?.fullName}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          {/*
            QO'LDA BELGILASH FAQAT KAMERA OCHILMAGANDA.
            Doim ko'rinib tursa, tasdiqlashning ma'nosi qolmasdi —
            har safar shu tugma bosilardi.
          */}
          {stage === 'error' ? (
            <Button variant="tinted" onClick={onManual}>
              {t('face.manual')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="pb-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-black">
          {/* Ko'zgu ko'rinishi: odam o'zini oynadagidek ko'radi */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        </div>

        <div
          className={cn(
            'mt-3 flex items-center gap-3 rounded-[14px] px-4 py-3',
            stage === 'error' ? 'bg-bad-soft' : 'bg-sunken',
          )}
        >
          {stage === 'error' ? (
            <CameraOff size={18} className="shrink-0 text-bad" />
          ) : stage === 'checking' ? (
            <ShieldCheck size={18} className="shrink-0 text-accent" />
          ) : (
            <ScanFace size={18} className="shrink-0 text-accent" />
          )}
          <p className="text-footnote text-label">
            {stage === 'loading' ? t('face.loading') : null}
            {stage === 'searching' ? t('face.look') : null}
            {stage === 'blink' ? t('face.blink') : null}
            {stage === 'checking' ? t('face.checking') : null}
            {stage === 'error' ? t('face.cameraError') : null}
          </p>
        </div>

        {message ? <p className="mt-2 text-footnote text-bad">{message}</p> : null}
        <p className="mt-3 text-caption text-label-tertiary">{t('face.privacy')}</p>
      </div>
    </Modal>
  )
}
