import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Suzuvchi asosiy tugma — faqat telefonda.
 *
 * NEGA KERAK: telefon ekrani uzun, yuqori o'ng burchak bosh barmoq
 * yetmaydigan joy. Sahifaning asosiy amali (bemor qo'shish, qabul
 * yozish) eng ko'p bosiladigan tugma bo'lgani uchun u pastda,
 * barmoq tabiiy turadigan joyda bo'lishi kerak.
 *
 * Yozuvi bilan ("pill" ko'rinishida) — klinikada ishlaydigan odam
 * uchun yalang'och ikonka jumboq bo'lib qolmasin.
 *
 * Pastki menyu ustida turadi: `bottom` uning balandligi va telefon
 * pastki xavfsiz maydonidan hisoblanadi.
 */
export function Fab({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed right-4 z-30 md:hidden',
        'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]',
        'flex items-center gap-2 rounded-full bg-accent pl-4 pr-5 py-3.5',
        'text-callout font-semibold text-white shadow-lg',
        'transition-transform duration-150 active:scale-95',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}
