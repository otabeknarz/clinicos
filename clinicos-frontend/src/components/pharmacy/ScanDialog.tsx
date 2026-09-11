import { useEffect, useRef, useState } from 'react'
import { CameraOff } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { SCAN_FORMATS, scanSupported } from '@/lib/barcode'
import { useI18n } from '@/i18n'

/**
 * KAMERA BILAN SHTRIX-KOD O'QISH.
 *
 * Brauzerning O'Z `BarcodeDetector` imkoniyati ishlatiladi —
 * tashqi kutubxona yuklanmaydi. Sabab ikkita: apteka kompyuteri
 * ko'pincha sekin internetda ishlaydi, va o'qish kutubxonasi
 * kichik emas.
 *
 * QO'LLAB-QUVVATLANMASA — YASHIRILMAYDI, SABABI AYTILADI.
 * `BarcodeDetector` hozircha Chrome va Android'da bor, Safari'da
 * yo'q. Tugma shunchaki ishlamay tursa, farmatsevt uni bosaverib
 * dasturni buzuq deb o'ylardi.
 *
 * Kamera — QO'SHIMCHA yo'l, asosiysi emas. Aptekada odatda USB
 * skaner turadi va u klaviatura kabi ishlaydi: qidiruv maydoniga
 * o'zi yozib beradi. Kamera esa skaner buzilganda yoki telefonda
 * ishlaganda asqotadi.
 */
export function ScanDialog({
  open,
  onClose,
  onDetect,
}: {
  open: boolean
  onClose: () => void
  /** O'qilgan xom qator — GS1 bo'lishi ham mumkin */
  onDetect: (raw: string) => void
}) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (!scanSupported()) {
      setError(t('scan.unsupported'))
      return
    }

    let stream: MediaStream | null = null
    let stopped = false
    let timer: number | undefined

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          /* Orqa kamera — telefonda qutini oldiga tutib turadi */
          video: { facingMode: 'environment' },
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const Detector = (
          window as unknown as {
            BarcodeDetector: new (options: { formats: string[] }) => {
              detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
            }
          }
        ).BarcodeDetector

        const detector = new Detector({ formats: SCAN_FORMATS })

        /*
          Sekundiga ~4 marta tekshiramiz. Har kadrda o'qish
          protsessorni bekorga qizdiradi va telefonda batareya
          tez tugaydi; qo'lda ushlab turilgan quti esa shuncha
          tez o'zgarmaydi.
        */
        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const found = await detector.detect(videoRef.current)
            if (found.length > 0 && found[0].rawValue) {
              onDetect(found[0].rawValue)
              return
            }
          } catch {
            /* Bitta kadr o'qilmasa — keyingisida urinamiz */
          }
          timer = window.setTimeout(() => void tick(), 250)
        }

        void tick()
      } catch {
        setError(t('scan.noCamera'))
      }
    }

    void start()

    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [open, onDetect, t])

  return (
    <Modal open={open} onClose={onClose} title={t('scan.title')} description={t('scan.hint')}>
      {error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fill-4 text-label-tertiary">
            <CameraOff size={22} />
          </span>
          <p className="text-subhead text-label-secondary">{error}</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[14px] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full object-cover"
          />
          {/*
            Nishon ramka — kodni qayerga tutish kerakligini
            ko'rsatadi. Usiz odam qutini ekranning turli joyiga
            tutib ko'rardi.
          */}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="h-32 w-56 rounded-[12px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </span>
        </div>
      )}
    </Modal>
  )
}
