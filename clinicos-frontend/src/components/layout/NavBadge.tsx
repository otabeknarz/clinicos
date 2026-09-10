import { cn } from '@/lib/cn'

/**
 * BO'LIM YONIDAGI YANGILIK SONI.
 *
 * NEGA UMUMAN KERAK: xodim bo'limga kirmasdan turib u yerda yangi
 * narsa borligini bilmasdi. Yangi izoh kelib turardi-yu, "Izohlar"
 * bandi hech qanday belgi bermasdi — shoshib turgan odam esa uni
 * ochib ham ko'rmaydi. Bildirishnomalar qo'ng'iroqcha ostida bor,
 * lekin ularni ko'rish uchun ham bosish kerak.
 *
 * NOL KO'RSATILMAYDI. "0" yozuvi ham e'tibor tortadi va bir necha
 * kundan keyin odam butun belgilar tizimiga qaramay qo'yadi.
 *
 * 99 dan ortig'i "99+" bo'ladi: aniq son bu yerda hech narsani
 * o'zgartirmaydi, kenglik esa bandning nomini qisqartirib qo'yardi.
 */
export function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null

  return (
    <span
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center',
        'rounded-full px-1.5 text-caption-2 font-semibold tabular-nums',
        'bg-accent text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Pastki paneldagi ikonka ustidagi nuqta — son sig'maydi */
export function NavDot({ count }: { count?: number }) {
  if (!count || count <= 0) return null

  return (
    <span
      aria-hidden
      className="absolute right-0 top-0 h-2 w-2 rounded-full bg-bad ring-2 ring-[var(--color-raised)]"
    />
  )
}
