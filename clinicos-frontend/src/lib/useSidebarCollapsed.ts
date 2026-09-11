import { useCallback, useState } from 'react'

/*
  Yon menyu yig'ilganmi — BRAUZERDA eslab qolinadi.

  Serverda emas: bu shu kompyuterdagi ekran kengligiga bog'liq odat.
  Kichik noutbukda yig'ib qo'ygan odam katta monitorda ham yig'iq
  menyu ko'rishni istamasligi mumkin.

  `localStorage` ba'zi holatlarda xato beradi (yashirin oyna, sayt
  ma'lumotlari bloklangan) — shunda menyu shunchaki to'liq ochiladi.
*/
const KEY = 'clinicos.sidebar.collapsed'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read)

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        /* saqlanmasa ham menyu ishlayveradi */
      }
      return next
    })
  }, [])

  return { collapsed, toggle }
}
