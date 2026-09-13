import { useCallback, useEffect, useRef, useState } from 'react'

import { enrollFace, faceVerify } from '@/api/face'
import type { FaceCheckInResult } from '@/api/face'
import { FaceScanner } from '@/components/face/FaceScanner'
import type { ScanState } from '@/components/face/FaceScanner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { loadFace, readFace, snapshot, startCamera, stopCamera } from '@/lib/face'
import { useI18n } from '@/i18n'

/**
 * "KELDI" TUGMASINING YUZ TASDIG'I.
 *
 * NEGA: kelish vaqtini registrator yozganda nazorat odamda
 * qoladi — kelmagan hamkasbini "keldi" deb belgilab qo'yish hech
 * kimga qiyin emas. Kamera bu ishni tizim tomoniga oladi: yozuv
 * uchun xodimning O'ZI kamera oldida turishi kerak.
 *
 * BIRINCHI MARTA — SHU YERDA RO'YXATDAN O'TADI. Yuzi hali
 * olinmagan xodimda oyna avval uchta kadr yig'adi, keyin darhol
 * tasdiqlaydi. Alohida "yuzni ro'yxatdan o'tkazish" qadamini
 * kutib o'tirish kerak emas: odam allaqachon kamera oldida
 * turibdi, eng qulay payt shu.
 *
 * SERVER HAM ISHONMAYDI: yuz bu yerda emas, serverda
 * solishtiriladi va butun jamoaga qarab tekshiriladi — kamera
 * oldidagi odam boshqa xodim bo'lsa, yozuv rad etiladi.
 *
 * KAMERA ISHLAMASA ish to'xtamaydi: qo'lda belgilash yo'li ochiq
 * qoladi (u yozuv suratsiz bo'ladi va egasi buni ko'radi).
 */

/** Kadrlar orasidagi vaqt */
const TICK_MS = 350
/** Tasdiqlash uchun ketma-ket shuncha kadr */
const STREAK = 3
/** Ro'yxatdan o'tkazishda shuncha namuna olinadi */
const SAMPLES = 3

export function FaceConfirmModal({
  open,
  staff,
  enrolled,
  onClose,
  onConfirmed,
  onManual,
}: {
  open: boolean
  staff: { id: string; fullName: string } | null
  /** Yuzi allaqachon olinganmi — yo'q bo'lsa shu yerda olinadi */
  enrolled: boolean
  onClose: () => void
  onConfirmed: (result: FaceCheckInResult) => void
  /** Kamera ochilmaganda — eski yo'l bilan belgilash */
  onManual: () => void
}) {
  const { t } = useI18n()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busy = useRef(false)
  const streak = useRef(0)
  /* Ro'yxatdan o'tkazishda yig'ilayotgan namunalar */
  const samples = useRef<number[][]>([])

  const [state, setState] = useState<ScanState>('loading')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')

  const staffId = staff?.id ?? null
  const staffName = staff?.fullName ?? ''
  /* Yuzi yo'q bo'lsa avval uni olamiz, keyin tasdiqlaymiz */
  const needsEnroll = !enrolled

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || !staffId || busy.current) return

    const reading = await readFace(video)
    if (!reading || reading.size < 0.02) {
      streak.current = 0
      samples.current = []
      setProgress(0)
      setState('scanning')
      return
    }

    /* --- Birinchi marta: namunalar yig'iladi --- */
    if (needsEnroll && samples.current.length < SAMPLES) {
      samples.current.push(reading.descriptor)
      setProgress(samples.current.length / SAMPLES)
      setState('holding')
      if (samples.current.length < SAMPLES) return

      busy.current = true
      try {
        await enrollFace({ staffId, fullName: staffName, descriptors: samples.current })
        busy.current = false
        streak.current = STREAK
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t('toast.error'))
        setState('error')
        samples.current = []
        setTimeout(() => {
          busy.current = false
          setProgress(0)
          setState('scanning')
        }, 2000)
        return
      }
    }

    /* --- Tasdiqlash --- */
    streak.current += 1
    setProgress(Math.min(streak.current / STREAK, 1))
    if (streak.current < STREAK) {
      setState('holding')
      return
    }

    busy.current = true
    setState('holding')
    try {
      const result = await faceVerify(staffId, reading.descriptor, snapshot(video))
      setState('success')
      /* Yashil belgi ko'rinib ulgursin */
      setTimeout(() => onConfirmed(result), 900)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('toast.error'))
      setState('error')
      streak.current = 0
      setProgress(0)
      /* Qisqa pauza — bir xil kadrni qayta-qayta yubormaslik uchun */
      setTimeout(() => {
        busy.current = false
        setState('scanning')
      }, 2000)
    }
  }, [needsEnroll, onConfirmed, staffId, staffName, t])

  useEffect(() => {
    if (!open) return
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    setState('loading')
    setMessage('')
    setProgress(0)
    streak.current = 0
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

  const cameraBroken = state === 'error' && message === t('face.cameraError')

  const hint =
    state === 'success'
      ? t('face.confirmed')
      : state === 'loading'
        ? t('face.loading')
        : state === 'error'
          ? message
          : needsEnroll && samples.current.length < SAMPLES
            ? t('face.firstTime')
            : state === 'holding'
              ? t('face.hold')
              : t('face.look')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('face.confirmTitle')}
      description={staffName}
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
          {cameraBroken ? (
            <Button variant="tinted" onClick={onManual}>
              {t('face.manual')}
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
