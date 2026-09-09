import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { getCabinetProfile } from '@/api/cabinet'
import { PatientContext } from './patient-context'
import type { CabinetProfile } from '@/types/models'

/**
 * Bemor sessiyasi.
 *
 * DEMO REJIM: `localStorage` da faqat bemor id'si saqlanadi. Haqiqiy
 * botda bu qadam butunlay boshqacha bo'ladi — Telegram `initData` ni
 * yuboradi, server uni bot tokeni bilan tekshiradi va bemor tokenini
 * qaytaradi. Ya'ni bu yerdagi "kirish" vaqtinchalik: mazmuni
 * o'zgaradi, kabinet sahifalari esa o'zgarmaydi.
 */
const STORAGE_KEY = 'clinicos.cabinet.patientId'

export function PatientProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CabinetProfile | null>(null)
  const [ready, setReady] = useState(false)
  const [tick, setTick] = useState(0)

  const enter = useCallback(async (patientId: string) => {
    localStorage.setItem(STORAGE_KEY, patientId)
    const next = await getCabinetProfile(patientId)
    setProfile(next)
  }, [])

  const leave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setProfile(null)
  }, [])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  /* Sahifa yangilanganda sessiyani tiklaymiz */
  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      setProfile(null)
      setReady(true)
      return
    }

    getCabinetProfile(stored)
      .then((next) => {
        if (!cancelled) setProfile(next)
      })
      .catch(() => {
        /* Bemor o'chirilgan bo'lsa sessiya ham yopiladi */
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY)
          setProfile(null)
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const value = useMemo(
    () => ({ profile, ready, enter, leave, reload }),
    [profile, ready, enter, leave, reload],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}
