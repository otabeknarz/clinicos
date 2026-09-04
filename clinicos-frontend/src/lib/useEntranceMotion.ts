import { useEffect, useState } from 'react'

/**
 * Sahifa ochilgandagi kirish animatsiyasi uchun qisqa oyna.
 *
 * MUAMMO NIMA EDI: animatsiya CSS orqali doimiy yoqilgan bo'lsa, u
 * har bir qayta chizishda takrorlanadi. Qidiruvga bitta harf yozilsa,
 * jadval qatorlari yana noldan chiqadi — ekran o'chib-yonadi.
 *
 * YECHIM: animatsiya faqat sahifa ochilgandan keyingi qisqa oynada
 * yoqiladi, keyin sinf olib tashlanadi. Shundan keyin filtr, qidiruv
 * va sahifalash hech narsani qayta chizmaydi.
 *
 * `key` o'zgarganda (odatda yo'l) oyna qaytadan ochiladi.
 */
export function useEntranceMotion(key: string, duration = 1400): boolean {
  const [active, setActive] = useState(true)

  useEffect(() => {
    setActive(true)
    const timer = setTimeout(() => setActive(false), duration)
    return () => clearTimeout(timer)
  }, [key, duration])

  return active
}
