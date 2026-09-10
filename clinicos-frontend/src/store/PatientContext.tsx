import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { cabinetSignIn, getCabinetProfile } from '@/api/cabinet'
import type { CabinetClinicChoice } from '@/api/cabinet'
import { setPatientToken, USE_MOCK } from '@/api/client'
import { announceReady, initData, insideTelegram } from '@/lib/telegram'
import { PatientContext } from './patient-context'
import type { CabinetProfile } from '@/types/models'

/**
 * Bemor sessiyasi.
 *
 * HAQIQIY YO'L: kabinet Telegram mini app ichida ochiladi, ilova
 * imzolangan `initData` ni serverga yuboradi, server uni BEMOR
 * BOTINING tokeni bilan tekshiradi va bemor tokenini qaytaradi.
 * Bemor hech qanday parol kiritmaydi — Telegram uni allaqachon
 * tasdiqlagan.
 *
 * Kirish HAR OCHILGANDA qaytariladi: token 12 soat yashaydi va
 * `initData` doim qo'l ostida, ya'ni qayta kirish ko'rinmas.
 * Saqlangan token esa sahifa yangilanganda darhol ishlatiladi —
 * bemor bo'sh ekranga qaramasin.
 *
 * DEMO REJIM: bot yo'q, shuning uchun `localStorage` da faqat
 * bemor id'si saqlanadi va "Bemor" tugmasi orqali kiriladi.
 */
const STORAGE_KEY = 'clinicos.cabinet.patientId'

export function PatientProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CabinetProfile | null>(null)
  const [ready, setReady] = useState(false)
  const [clinics, setClinics] = useState<CabinetClinicChoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  /** Demo rejimdagi kirish */
  const enter = useCallback(async (patientId: string) => {
    localStorage.setItem(STORAGE_KEY, patientId)
    const next = await getCabinetProfile(patientId)
    setProfile(next)
  }, [])

  const leave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setPatientToken(null)
    setProfile(null)
    setClinics(null)
  }, [])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  /**
   * Klinika tanlash — bir odam ikki klinikada bemor bo'lsa.
   *
   * Bittasini o'zboshimchalik bilan tanlab qo'ysak, bemor
   * ikkinchi klinikadagi kartasini umuman ko'ra olmasdi.
   */
  const chooseClinic = useCallback(async (clinicId: string) => {
    const signed = initData()
    if (!signed) return
    const result = await cabinetSignIn(signed, clinicId)
    if (!result.token) return
    setPatientToken(result.token)
    setClinics(null)
    setProfile(await getCabinetProfile())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      /* Demo rejim: eski yo'l saqlanadi */
      if (USE_MOCK) {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return
        setProfile(await getCabinetProfile(stored))
        return
      }

      announceReady()

      /*
        Saqlangan token bilan urinib ko'ramiz. Ishlasa — bemor
        kutib o'tirmaydi; muddati tugagan bo'lsa quyidagi qayta
        kirish uni jimgina yangilaydi.
      */
      try {
        setProfile(await getCabinetProfile())
        return
      } catch {
        setPatientToken(null)
      }

      const signed = initData()
      if (!signed) {
        if (!cancelled) {
          setError(
            insideTelegram()
              ? 'Telegram ma’lumotini o‘qib bo‘lmadi'
              : 'Kabinet Telegram bot ichida ochiladi',
          )
        }
        return
      }

      const result = await cabinetSignIn(signed)

      if (result.clinics && result.clinics.length > 0) {
        if (!cancelled) setClinics(result.clinics)
        return
      }

      if (!result.token) return
      setPatientToken(result.token)
      if (!cancelled) setProfile(await getCabinetProfile())
    }

    boot()
      .catch((e: unknown) => {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY)
          setPatientToken(null)
          setProfile(null)
          setError(e instanceof Error ? e.message : null)
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
    () => ({ profile, ready, clinics, error, enter, leave, reload, chooseClinic }),
    [profile, ready, clinics, error, enter, leave, reload, chooseClinic],
  )

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}
