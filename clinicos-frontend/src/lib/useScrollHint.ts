import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Yon tomonga suriladigan qatorda "yana bor" ishorasi.
 *
 * NEGA KERAK: telefonda tablar ekranga sig'masa, oxirgisi shunchaki
 * kesilib qoladi. Odam u yerda yana band borligini bilmaydi va
 * surib ko'rmaydi — bo'lim borligini bilmay qoladi.
 *
 * Chetdagi yumshoq so'nish (`mask`) esa "davomi bor" deb turadi.
 * Ikkala chet alohida hisoblanadi: chapga surilgan bo'lsa chap
 * chetda ham so'nish paydo bo'ladi.
 */
export function useScrollHint<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return

    // 1px — yaxlitlash xatosiga yo'l qo'yamiz
    const start = el.scrollLeft > 1
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1

    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    )
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    measure()
    el.addEventListener('scroll', measure, { passive: true })

    // Kenglik o'zgarsa (ekran burilishi, matn yuklanishi) qayta o'lchanadi
    const observer = new ResizeObserver(measure)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure])

  /** Tailwind `mask-image` — chetlarni yumshoq so'ndiradi */
  const maskClass =
    edges.start && edges.end
      ? 'mask-both'
      : edges.end
        ? 'mask-end'
        : edges.start
          ? 'mask-start'
          : undefined

  return { ref, maskClass }
}
