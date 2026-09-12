import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraOff, CheckCircle2, Clock, ScanFace } from 'lucide-react'

import { faceCheckIn } from '@/api/face'
import type { FaceCheckInResult } from '@/api/face'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { loadFace, readFace, snapshot, startCamera, stopCamera } from '@/lib/face'
import { useI18n } from '@/i18n'

/**
 * YUZ BILAN DAVOMAT — KAMERA SAHIFASI.
 *
 * Klinikaning planshetida ochiq turadi: xodim kelib qaraydi va
 * davomat o'zi belgilanadi. Hech narsa bosilmaydi — qo'li band
 * odam tugma qidirib o'tirmasligi kerak.
 *
 * JONLILIK TEKSHIRUVI: yuz topilgach "ko'zingizni qisib qo'ying"
 * deyiladi. Bosma surat ko'z qismaydi. Bu mutlaq himoya emas
 * (telefondagi video aldashi mumkin), lekin eng oddiy aldashni
 * to'sadi — shuning uchun har bir belgilash jurnalga tushadi.
 *
 * KAMERA TASVIRI HECH QAYERGA YUBORILMAYDI: barcha hisob-kitob
 * shu qurilmada bajariladi, serverga faqat 128 ta son ketadi.
 */

/** Ko'z shu qiymatdan pastga tushsa — qisilgan deb hisoblanadi */
const BLINK_LEVEL = 0.19
/** Ko'z qisilgandan keyin shuncha vaqt "jonli" deb hisoblanadi */
const BLINK_WINDOW = 5000
/** Natijadan keyin qancha kutiladi — keyingi odam uchun */
const RESET_AFTER = 5000

type Stage = 'loading' | 'searching' | 'blink' | 'checking' | 'done' | 'error'

export function AttendanceFacePage() {
  const { t } = useI18n()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const blinkedAt = useRef(0)
  const busy = useRef(false)

  const [stage, setStage] = useState<Stage>('loading')
  const [result, setResult] = useState<FaceCheckInResult | null>(null)
  const [message, setMessage] = useState('')

  /* Bitta o'qish: yuz bormi, ko'z qisildimi, tanilsinmi */
  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || busy.current) return

    const reading = await readFace(video)
    if (!reading) {
      setStage((current) => (current === 'done' ? current : 'searching'))
      return
    }

    if (reading.eyeOpenness < BLINK_LEVEL) blinkedAt.current = Date.now()
    const alive = Date.now() - blinkedAt.current < BLINK_WINDOW

    if (!alive) {
      setStage((current) => (current === 'done' ? current : 'blink'))
      return
    }

    busy.current = true
    setStage('checking')
    try {
      const checked = await faceCheckIn(reading.descriptor, snapshot(video))
      setResult(checked)
      setMessage('')
      setStage('done')
      /* Keyingi odam uchun bo'shatamiz */
      setTimeout(() => {
        setResult(null)
        blinkedAt.current = 0
        busy.current = false
        setStage('searching')
      }, RESET_AFTER)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('toast.error'))
      setStage('searching')
      blinkedAt.current = 0
      /* Xatodan keyin qisqa pauza — bir xil yuzni qayta-qayta yubormaslik uchun */
      setTimeout(() => {
        busy.current = false
      }, 2000)
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
        setStage('searching')
        timer = setInterval(() => void tick(), 700)
      } catch {
        /* Sabab holat qatorida o'zbekcha yoziladi */
        setMessage('')
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
  }, [tick])

  return (
    <>
      <PageHeader title={t('face.title')} subtitle={t('face.subtitle')} />

      <Card className="mx-auto max-w-2xl">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-black">
          {/* Ko'zgu ko'rinishi: odam o'zini oynadagidek ko'radi */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
            aria-label={t('face.title')}
          />

          {stage === 'done' && result ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-6 text-center">
              <CheckCircle2 size={44} className="text-ok" />
              <p className="text-title-3 font-bold text-white">{result.fullName}</p>
              <p className="text-subhead text-white/80">
                {result.alreadyMarked
                  ? t('face.already', { time: result.arrivedAt ?? '' })
                  : t(result.status === 'late' ? 'face.late' : 'face.present', {
                      time: result.arrivedAt ?? '',
                    })}
              </p>
            </div>
          ) : null}
        </div>

        {/* Holat qatori */}
        <div
          className={cn(
            'mt-4 flex items-center gap-3 rounded-[14px] px-4 py-3',
            stage === 'error' ? 'bg-bad-soft' : 'bg-sunken',
          )}
        >
          {stage === 'error' ? (
            <CameraOff size={18} className="shrink-0 text-bad" />
          ) : stage === 'checking' ? (
            <Clock size={18} className="shrink-0 text-accent" />
          ) : (
            <ScanFace size={18} className="shrink-0 text-accent" />
          )}
          <p className="text-subhead text-label">
            {stage === 'loading' ? t('face.loading') : null}
            {stage === 'searching' ? t('face.look') : null}
            {stage === 'blink' ? t('face.blink') : null}
            {stage === 'checking' ? t('face.checking') : null}
            {stage === 'done' ? t('face.next') : null}
            {stage === 'error' ? t('face.cameraError') : null}
          </p>
        </div>

        {message ? <p className="mt-2 text-footnote text-bad">{message}</p> : null}

        <p className="mt-4 text-caption text-label-tertiary">{t('face.privacy')}</p>
      </Card>
    </>
  )
}
