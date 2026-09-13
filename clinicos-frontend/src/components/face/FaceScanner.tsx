import type { RefObject } from 'react'
import { Check, ScanFace, X } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * YUZ SKANERI — KO'RINISH QISMI.
 *
 * Face ID dagi kabi: dumaloq oyna, atrofida to'ladigan halqa va
 * o'rtada bitta qisqa yozuv. Boshqa hech narsa yo'q — kamera
 * oldida turgan odam o'qib o'tirmaydi, u faqat "bo'ldimi yoki
 * yo'qmi" ni ko'rishi kerak.
 *
 * FAQAT CHIZADI: kamera, o'qish va qaror qabul qilish chaqiruvchida.
 * Uchta joyda ishlatiladi (kiosk sahifasi, "Keldi" tasdig'i va
 * ro'yxatdan o'tkazish oynasi) va ularning mantig'i boshqa-boshqa,
 * ko'rinishi esa bir xil bo'lishi kerak.
 */
export type ScanState = 'loading' | 'scanning' | 'holding' | 'success' | 'error'

export function FaceScanner({
  videoRef,
  state,
  /** 0 dan 1 gacha — halqa shuncha to'ladi */
  progress,
  title,
  hint,
  size = 'md',
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  state: ScanState
  progress: number
  /** Katta yozuv: tanilgan odamning ismi yoki holat */
  title?: string
  hint?: string
  size?: 'md' | 'lg'
}) {
  /* Halqa uzunligi — `stroke-dashoffset` shundan hisoblanadi */
  const RADIUS = 47
  const LENGTH = 2 * Math.PI * RADIUS
  const filled = state === 'success' ? 1 : Math.min(Math.max(progress, 0), 1)

  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col items-center',
        size === 'lg' ? 'max-w-sm' : 'max-w-[15rem]',
      )}
    >
      <div className="relative aspect-square w-full">
        {/* Kamera — dumaloq oynada, ko'zgu ko'rinishida */}
        <div
          className={cn(
            'absolute inset-[6%] overflow-hidden rounded-full bg-fill-3 transition-transform duration-500',
            state === 'success' && 'scale-[0.97]',
          )}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />

          {/* Natija — yuzning ustiga yopiladi */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-2 text-center transition-opacity duration-300',
              state === 'success'
                ? 'bg-ok/85 opacity-100'
                : state === 'error'
                  ? 'bg-bad/85 opacity-100'
                  : 'pointer-events-none opacity-0',
            )}
          >
            {state === 'success' ? (
              <Check size={44} strokeWidth={3} className="face-pop text-white" />
            ) : (
              <X size={40} strokeWidth={3} className="face-pop text-white" />
            )}
          </div>
        </div>

        {/*
          HALQA. Sekundlarni sanamaydi — u qancha o'qish
          yig'ilganini ko'rsatadi: odam kameraga qaragan zahoti
          to'la boshlaydi va bir-ikki soniyada yopiladi.
        */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="2.5"
            className="stroke-separator"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH * (1 - filled)}
            className={cn(
              'transition-[stroke-dashoffset,stroke] duration-300 ease-out',
              state === 'success'
                ? 'stroke-ok'
                : state === 'error'
                  ? 'stroke-bad'
                  : 'stroke-accent',
            )}
          />
        </svg>

        {/* Qidirayotgan payt halqa ustida yumshoq nur aylanadi */}
        {state === 'scanning' || state === 'loading' ? (
          <span className="face-sweep pointer-events-none absolute inset-0 rounded-full" />
        ) : null}
      </div>

      <div className="mt-5 min-h-[3.5rem] text-center">
        {title ? (
          <p
            className={cn(
              'text-title-3 font-bold text-label',
              state === 'success' && 'face-pop',
            )}
          >
            {title}
          </p>
        ) : (
          <p className="flex items-center justify-center gap-2 text-subhead text-label-secondary">
            <ScanFace size={17} className="text-accent" />
            {hint}
          </p>
        )}
        {title && hint ? (
          <p className="mt-1 text-subhead text-label-secondary">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
