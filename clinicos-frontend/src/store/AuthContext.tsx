import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import * as authApi from '@/api/auth'
import * as platformApi from '@/api/platform'
import { getAuthToken, setApiContext, setAuthToken, USE_MOCK } from '@/api/client'
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

/*
  Klinika paneliga kirganda platforma tokeni SHU YERDA turadi.

  Kirish paytida joriy token nishon klinikaning qisqa muddatli
  tokeniga almashadi. Chiqishda eskisini qaytarish kerak — aks
  holda platforma egasi o'z panelidan ham chiqib ketardi.

  localStorage'da, chunki kirilgan holatda sahifa yangilanishi
  mumkin va o'shanda ham qaytadigan joy bo'lishi kerak.
*/
const PLATFORM_TOKEN_KEY = 'clinicos.session.platformToken'

function readPlatformToken(): string | null {
  try {
    return localStorage.getItem(PLATFORM_TOKEN_KEY)
  } catch {
    return null
  }
}

function writePlatformToken(token: string | null) {
  try {
    if (token) localStorage.setItem(PLATFORM_TOKEN_KEY, token)
    else localStorage.removeItem(PLATFORM_TOKEN_KEY)
  } catch {
    /* saqlanmasa ham joriy sessiya ishlaydi */
  }
}

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
    /*
      Sessiya yo'q bo'lsa tokenni O'CHIRMAYMIZ. Ilova endigina
      ochilganda `session` hali null bo'ladi — bu yerda tozalasak,
      saqlangan token quyidagi `restore()` ishga tushgunicha yo'q
      bo'lib ketardi va har yangilashda kirish sahifasi chiqardi.
      Token faqat chiqishda tozalanadi (`logout`).
    */
    if (!session) return
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

    /*
      Kirish tokenining muddati 30 daqiqa. Sahifa o'shandan keyin
      yangilansa `me()` bo'sh qaytadi — bunda platforma tokeniga
      qaytamiz, aks holda platforma egasi butunlay chiqib ketardi
      va qaytadan parol terishga majbur bo'lardi.
    */
    const restoreSession = async () => {
      const first = await authApi.me(userId ?? undefined)
      if (first) return first

      const platformToken = readPlatformToken()
      if (USE_MOCK || !platformToken) return null

      setAuthToken(platformToken)
      writePlatformToken(null)
      setImpersonating(null)
      return authApi.me(userId ?? undefined)
    }

    restoreSession()
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
    writePlatformToken(null)
  }, [setUserId, setImpersonating])

  /**
   * Klinika paneliga kirish.
   *
   * Yozuv serverda allaqachon qayd etilgan (`startImpersonation`),
   * bu yerda faqat interfeys o'sha klinikaga qaraydi.
   */
  /**
   * Klinika paneliga kirish.
   *
   * Server bergan QISQA MUDDATLI tokenga almashamiz va sessiyani
   * qaytadan o'qiymiz — endi u nishon klinikaniki bo'lib keladi,
   * ruxsatlari esa faqat ko'rish.
   *
   * Demo rejimda token tushunchasi yo'q: u yerda mock qatlami
   * `apiContext()` dagi klinikaga qarab filtrlaydi, shuning uchun
   * faqat holatni o'zgartiramiz.
   */
  const enterClinic = useCallback(
    async (tenantId: string, tenantName: string, token?: string) => {
      if (!USE_MOCK && token) {
        // Platforma tokenini saqlab qo'yamiz — chiqishda kerak
        writePlatformToken(getAuthToken())
        setAuthToken(token)

        const restored = await authApi.me()
        if (restored) setSession(restored)
      }
      setImpersonating({ tenantId, tenantName })
    },
    [setImpersonating],
  )

  /**
   * Klinika panelidan chiqish.
   *
   * Avval serverda kirish yozuvi yopiladi (shundan keyin kirish
   * tokeni yaroqsiz), keyin platforma tokeni qaytariladi.
   *
   * Tartib muhim: token avval qaytarilsa, yopish so'rovi platforma
   * tokeni bilan ketardi va server "siz klinika panelida emassiz"
   * deb rad etardi — yozuv ochiq qolib ketardi.
   */
  const exitClinic = useCallback(async () => {
    if (!USE_MOCK) {
      const platformToken = readPlatformToken()

      try {
        await platformApi.endImpersonation()
      } catch {
        /*
          Yopilmasa ham chiqamiz: token muddati o'tgan bo'lishi
          mumkin, u holda yozuv baribir ishlatib bo'lmaydigan
          holatda. Odamni panelda qamab qo'yishdan ma'no yo'q.
        */
      }

      if (platformToken) {
        setAuthToken(platformToken)
        writePlatformToken(null)
        const restored = await authApi.me()
        if (restored) setSession(restored)
      }
    }
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

