import { createContext, useContext } from 'react'

import type { Permission, Session } from '@/types/models'

/**
 * Sessiya konteksti.
 *
 * NEGA ALOHIDA FAYL: React Fast Refresh qoidasi — bitta fayl yo FAQAT
 * komponent, yo FAQAT oddiy qiymat eksport qilishi kerak. Aks holda kod
 * o'zgarganda kontekst qayta yaratiladi va "useAuth faqat <AuthProvider>
 * ichida ishlatiladi" xatosi chiqadi.
 */
export interface AuthValue {
  session: Session | null
  /** Boshlang'ich tiklash tugadimi */
  ready: boolean
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Profil o'zgargach sessiyani qayta o'qiydi */
  refresh: () => Promise<void>
  can: (permission: Permission) => boolean

  /* --- Klinika paneliga kirish (faqat platforma egasi) --- */
  /**
   * Hozir qaysi klinika paneliga kirilgan.
   *
   * `null` — oddiy ish rejimi. Qiymat bo'lsa, platforma egasi
   * yordam uchun klinika panelini ochib turibdi va buni ekranda
   * ko'rinib turishi shart.
   */
  impersonating: { tenantId: string; tenantName: string } | null
  /** Klinika paneliga kirish */
  enterClinic: (tenantId: string, tenantName: string) => void
  /** Ortga — platforma paneliga qaytish */
  exitClinic: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth faqat <AuthProvider> ichida ishlatiladi')
  return ctx
}
