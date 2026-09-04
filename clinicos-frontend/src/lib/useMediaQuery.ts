import { useEffect, useState } from 'react'

/**
 * Ekran kengligiga qarab boshqa narsa chizish uchun.
 *
 * NEGA CSS YETMAYDI: `hidden sm:block` bilan yashirilgan narsa DOM da
 * qolaveradi. Bir xil boshqaruvlarni ikki joyda (sahifada va varaqda)
 * chizsak, ikkalasi ham DOM ga tushib, bir xil `id` va bir xil
 * maydonlar takrorlanardi. Shu sababli qaysi birini chizishni JS
 * hal qiladi — DOM da doim bittasi bo'ladi.
 *
 * Serverda chizish yo'q, shuning uchun boshlang'ich qiymat darrov
 * o'lchanadi va ekran kengligi o'zgarsa yangilanadi.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)

    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Telefon kengligi — Tailwind `sm` chegarasidan pastda */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 639px)')
}
