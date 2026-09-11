import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Karta ustida sichqoncha ortidan yuradigan yumshoq yorug'lik.
 *
 * Har bir kartaga alohida tinglovchi qo'yilmaydi — bitta tinglovchi
 * karkas ildizida turadi va sichqoncha qaysi `.card` ustida bo'lsa,
 * o'shanga `--mx`/`--my` (karta ichidagi koordinata) yozadi. Yorug'likni
 * CSS chizadi (`index.css`, `.admin-soft .card`), yonib-o'chishini
 * `--spot` boshqaradi.
 *
 * Kadrga bir martadan ko'p yozilmaydi (`requestAnimationFrame`).
 * Barmoq bilan ishlatiladigan ekranda o'chiq: u yerda "sichqoncha
 * ortidan" degan narsa yo'q.
 */
export function useCardSpotlight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = ref.current
    if (!enabled || !root) return

    let frame = 0

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const target = event.target as Element | null
      const { clientX, clientY } = event

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const card = target?.closest<HTMLElement>('.card')
        if (!card) return
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${clientX - rect.left}px`)
        card.style.setProperty('--my', `${clientY - rect.top}px`)
      })
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      root.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [ref, enabled])
}
