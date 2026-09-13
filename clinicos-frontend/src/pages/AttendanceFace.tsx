import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraOff, ShieldCheck } from 'lucide-react'

import { faceCheckIn } from '@/api/face'
import type { FaceCheckInResult } from '@/api/face'
import { FaceScanner } from '@/components/face/FaceScanner'
import type { ScanState } from '@/components/face/FaceScanner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { loadFace, readFace, snapshot, startCamera, stopCamera } from '@/lib/face'
import { useI18n } from '@/i18n'

/**
 * YUZ BILAN DAVOMAT — KAMERA SAHIFASI.
 *
 * Registraturaning planshetida ochiq turadi. Xodim kelib qaraydi,
 * bir-ikki soniyada ismi chiqadi va davomat yoziladi. HECH NARSA
 * BOSILMAYDI: qo'li band odam tugma qidirib o'tirmasligi kerak,
 * aks holda tizimdan foydalanishning o'zi ishga aylanadi.
 *
 * TEZLIK — ASOSIY TALAB. Kadr har 350 ms da o'qiladi va KETMA-KET
 * uchta kadrda yuz ko'rinsa, qaror qabul qilinadi: ~1 soniya.
 * Bitta kadrga ishonmaslikning sababi oddiy — yonidan o'tib
 * ketayotgan odam ham bir kadrga tushib qoladi.
 *
 * KO'Z QISISH TALABI OLIB TASHLANDI. U bosma suratdan himoya
 * qilardi, lekin har bir xodimdan har kuni ortiqcha harakat
 * so'rardi va sahifa "qiyin" bo'lib qolardi. O'rniga: har bir
 * belgilashning KADRI SAQLANADI va egasi uni ko'radi — suratni
 * ko'tarib turgan odam o'sha kadrda ko'rinib qoladi, ya'ni
 * qasddan aldash izsiz qolmaydi.
 *
 * KAMERA TASVIRI QAYTA ISHLANMAYDI: yuz shu qurilmada 128 ta
 * songa aylanadi, serverga o'sha sonlar va bitta kadr ketadi.
 */

/** Kadrlar orasidagi vaqt. Qisqartirilsa brauzer ulgurmaydi. */
const TICK_MS = 350
/** Qaror uchun ketma-ket shuncha kadr kerak */
const STREAK = 3
/** Natijadan keyin qancha kutiladi — keyingi odam uchun */
const RESET_AFTER = 3500

export function AttendanceFacePage() {
  const { t } = useI18n()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busy = useRef(false)
  /* Ketma-ket nechta kadrda yuz ko'rindi */
  const streak = useRef(0)

  const [state, setState] = useState<ScanState>('loading')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<FaceCheckInResult | null>(null)
  const [message, setMessage] = useState('')

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || busy.current) return

    const reading = await readFace(video)

    /* Juda uzoqda turgan odam hali "kelgan" deb hisoblanmaydi */
    if (!reading || reading.size < 0.015) {
      streak.current = 0
      setProgress(0)
      setState('scanning')
      return
    }

    streak.current += 1
    setProgress(streak.current / STREAK)
    if (streak.current < STREAK) {
      setState('holding')
      return
    }

    busy.current = true
    try {
      const checked = await faceCheckIn(reading.descriptor, snapshot(video))
      setResult(checked)
      setMessage('')
      setState('success')
    } catch (error) {
      setResult(null)
      setMessage(error instanceof Error ? error.message : t('toast.error'))
      setState('error')
    } finally {
      /* Keyingi odam uchun bo'shatamiz */
      setTimeout(() => {
        streak.current = 0
        busy.current = false
        setProgress(0)
        setResult(null)
        setMessage('')
        setState('scanning')
      }, RESET_AFTER)
    }
  }, [t])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

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
        /* Brauzer xatosi ingliz tilida keladi — o'z matnimizni ko'rsatamiz */
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
  }, [tick, t])

  const hint = result
    ? result.alreadyMarked
      ? t('face.already', { time: result.arrivedAt ?? '' })
      : t(result.status === 'late' ? 'face.late' : 'face.present', {
          time: result.arrivedAt ?? '',
        })
    : state === 'loading'
      ? t('face.loading')
      : state === 'holding'
        ? t('face.hold')
        : state === 'error'
          ? message || t('face.cameraError')
          : t('face.look')

  return (
    <>
      <PageHeader title={t('face.title')} subtitle={t('face.subtitle')} />

      <Card className="mx-auto max-w-xl py-8">
        {/* Tanilgan odamning ismi — eng katta yozuv */}
        <FaceScanner
          videoRef={videoRef}
          state={state}
          progress={progress}
          size="lg"
          title={result?.fullName}
          hint={hint}
        />

        <div className="mt-6 flex items-start justify-center gap-2 px-4 text-center">
          {state === 'error' && !result ? (
            <CameraOff size={14} className="mt-0.5 shrink-0 text-bad" />
          ) : (
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-label-quaternary" />
          )}
          <p className="text-caption text-label-tertiary">{t('face.privacy')}</p>
        </div>
      </Card>
    </>
  )
}
