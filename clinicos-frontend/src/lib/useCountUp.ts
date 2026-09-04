import { useEffect, useRef, useState } from 'react'

/**
 * Raqamni noldan berilgan qiymatgacha sanab chiqish.
 *
 * NEGA KERAK: analitika sahifasida eng muhim narsa — raqam. U shunchaki
 * paydo bo'lsa, ko'z uni o'qimay o'tib ketadi. Sanalib chiqsa, e'tibor
 * o'sha raqamda to'xtaydi va odam uni haqiqatan ham o'qiydi.
 *
 * Egri chiziq `easeOutExpo`: boshida tez, oxirida sekin. Bu raqamning
 * "joyiga o'tirishi" hissini beradi — chiziqli sanash mexanik ko'rinadi.
 *
 * QURILMANI AYAMAYDI: `requestAnimationFrame` ishlatiladi va komponent
 * yopilganda to'xtatiladi.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const frame = useRef(0)

  useEffect(() => {
    // Harakatga sezgir foydalanuvchida sanash bo'lmaydi
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /*
      MUHIM: sahifa ko'rinmayotgan bo'lsa (boshqa vkladka, yig'ilgan
      oyna) brauzer `requestAnimationFrame` ni UMUMAN chaqirmaydi.
      U holda sanash boshlanmay, raqam 0 da qotib qoladi — odam
      qaytib kelganda moliyaviy ko'rsatkich o'rnida NOL ko'radi.

      Shuning uchun ko'rinmaydigan sahifada animatsiya qilinmaydi:
      raqam darrov o'z qiymatini oladi. Chala animatsiyadan ko'ra
      to'g'ri raqam muhimroq.
    */
    if (reduced || !Number.isFinite(target) || document.visibilityState === 'hidden') {
      setValue(target)
      return
    }

    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      setValue(target * eased)

      if (progress < 1) frame.current = requestAnimationFrame(tick)
      else setValue(target)
    }

    frame.current = requestAnimationFrame(tick)

    // Sanash o'rtasida sahifa yashirilsa — to'xtatib, oxirgi qiymatga o'tamiz
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(frame.current)
        setValue(target)
      }
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelAnimationFrame(frame.current)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [target, duration])

  return value
}
