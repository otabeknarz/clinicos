import { createContext, useContext } from 'react'

import type { CabinetProfile } from '@/types/models'

/**
 * BEMOR SESSIYASI — XODIMNIKIDAN ALOHIDA.
 *
 * `AuthContext` ni qayta ishlatmadim va bu ataylab. U yerdagi `Session`
 * ichida `User`, `Clinic` va ruxsatlar ro'yxati bor — bemorda
 * bularning hech biri yo'q. Bemorni o'sha shaklga tiqish uchun unga
 * soxta rol va bo'sh ruxsatlar berish kerak bo'lardi, va o'shandan
 * keyin har bir `can(...)` chaqiruvi "bu bemormi?" degan savolni
 * qaytadan so'rashi kerak edi. Bitta unutilgan joy — bemor xodim
 * sahifasini ochib qo'yadi.
 *
 * Ikki kontekst alohida turganda esa chegara TUZILISHDA: bemor
 * kabineti xodim marshrutlariga umuman kirmaydi.
 *
 * Alohida fayl — Fast Refresh uchun (`auth-context.ts` izohiga qarang).
 */
export interface PatientValue {
  profile: CabinetProfile | null
  /** Sessiya tiklanib bo'ldimi */
  ready: boolean
  /** Demo rejim uchun: qaysi bemor sifatida kirish */
  enter: (patientId: string) => Promise<void>
  leave: () => void
  reload: () => void
}

export const PatientContext = createContext<PatientValue | null>(null)

export function usePatient(): PatientValue {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('usePatient faqat <PatientProvider> ichida ishlatiladi')
  return ctx
}
