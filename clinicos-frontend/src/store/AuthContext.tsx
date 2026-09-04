import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import * as authApi from '@/api/auth'
import { setApiContext, setAuthToken } from '@/api/client'
import { can as canCheck, scopedDoctorId } from '@/lib/permissions'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { AuthContext } from './auth-context'
import type { AuthValue } from './auth-context'
import type { Permission, Session } from '@/types/models'

/**
 * Sessiya holati.
 *
 * MOCK REJIM: localStorage'da faqat foydalanuvchi id'si saqlanadi —
 * bu demo uchun kifoya.
 *
 * HAQIQIY BACKEND bilan: sessiyani HttpOnly cookie'da saqlash tavsiya
 * etiladi, u holda bu yerda hech narsa saqlanmaydi — `/auth/me` so'rovi
 * sessiyani o'zi tiklaydi (`restore()` allaqachon shunday yozilgan).
 */

const STORAGE_KEY = 'clinicos.session.userId'

/**
 * Kirilgan klinika sahifa yangilanganda ham saqlanadi.
 *
 * Yordam berayotgan odam sahifani yangilasa, u yana platforma
 * paneliga tushib qolmasligi kerak — ish yarim qoladi.
 */
const IMPERSONATE_KEY = 'clinicos.session.impersonating'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useLocalStorage<string | null>(STORAGE_KEY, null)
  const [impersonating, setImpersonating] = useLocalStorage<{
    tenantId: string
    tenantName: string
  } | null>(IMPERSONATE_KEY, null)
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sessiya o'zgarganda api qatlamiga kontekstni uzatamiz:
  // qaysi klinika va (shifokor bo'lsa) qaysi shifokorning ma'lumoti.
  useEffect(() => {
    if (!session) {
      setAuthToken(null)
      return
    }
    setAuthToken(session.token)

    /*
      Klinika paneliga kirilgan bo'lsa, butun API qatlami O'SHA
      klinikaga qaraydi. Shu bir joyda almashtirish yetarli —
      qolgan hamma so'rov `apiContext()` orqali o'tadi.

      DASTURCHIGA: haqiqiy tizimda buni mijoz hal qilmaydi. Server
      muddatli, cheklangan token beradi va o'sha token qaysi klinika
      ekanini o'zi biladi. Mijoz tomonidagi `clinicId` ga ishonib
      bo'lmaydi.
    */
    setApiContext({
      clinicId: impersonating?.tenantId ?? session.clinic.id,
      scopeDoctorId: impersonating ? null : scopedDoctorId(session),
    })
  }, [session, impersonating])

  // Sahifa ochilganda sessiyani tiklash
  useEffect(() => {
    let cancelled = false

    authApi
      .me(userId ?? undefined)
      .then((restored) => {
        if (cancelled) return
        if (restored) {
          setApiContext({
            clinicId: restored.clinic.id,
            scopeDoctorId: scopedDoctorId(restored),
          })
          setSession(restored)
        }
      })
      .catch(() => {
        /* sessiya tiklanmadi — kirish sahifasi ko'rsatiladi */
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
    // Faqat bir marta, ilova ochilganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      setError(null)
      try {
        const next = await authApi.login({ email, password })
        setApiContext({ clinicId: next.clinic.id, scopeDoctorId: scopedDoctorId(next) })
        setSession(next)
        setUserId(next.user.id)
      } catch (e) {
        // Xato matni i18n kaliti sifatida qaytadi
        setError(e instanceof Error ? e.message : 'auth.invalid')
        throw e
      } finally {
        setLoading(false)
      }
    },
    [setUserId],
  )

  /** Sessiyani serverdan qayta o'qish — profil tahrirlangandan keyin */
  const refresh = useCallback(async () => {
    if (!userId) return
    const restored = await authApi.me(userId)
    if (restored) setSession(restored)
  }, [userId])

  const logout = useCallback(async () => {
    await authApi.logout()
    setSession(null)
    setUserId(null)
    setImpersonating(null)
    setAuthToken(null)
  }, [setUserId, setImpersonating])

  /**
   * Klinika paneliga kirish.
   *
   * Yozuv serverda allaqachon qayd etilgan (`startImpersonation`),
   * bu yerda faqat interfeys o'sha klinikaga qaraydi.
   */
  const enterClinic = useCallback(
    (tenantId: string, tenantName: string) => {
      setImpersonating({ tenantId, tenantName })
    },
    [setImpersonating],
  )

  const exitClinic = useCallback(() => {
    setImpersonating(null)
  }, [setImpersonating])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready,
      loading,
      error,
      login,
      logout,
      refresh,
      can: (permission: Permission) => canCheck(session, permission),
      impersonating,
      enterClinic,
      exitClinic,
    }),
    [
      session,
      ready,
      loading,
      error,
      login,
      logout,
      refresh,
      impersonating,
      enterClinic,
      exitClinic,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

