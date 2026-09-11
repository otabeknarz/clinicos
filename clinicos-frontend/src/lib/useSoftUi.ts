import { useEffect } from 'react'

/**
 * Ish panellarining ko'rinishi (`index.css`, "YUMSHOQ KO'RINISH").
 *
 * Klass `body` ga beriladi, karkas `div` iga emas: modal oynalar va
 * ochiladigan menyular `createPortal` bilan to'g'ridan-to'g'ri `body`
 * ga chiziladi. Klass karkasda turganda ular eski ko'rinishda qolib
 * ketardi (oq-kulrang maydonlar, yorqin ko'k tugma).
 *
 * Karkas yopilganda (chiqish, kirish sahifasi) klass olib tashlanadi —
 * kirish sahifasi va bemor kabineti o'z dizaynida qoladi.
 */
export function useSoftUi() {
  useEffect(() => {
    document.body.classList.add('soft-ui')
    return () => document.body.classList.remove('soft-ui')
  }, [])
}
