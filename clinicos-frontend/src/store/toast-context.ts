import { createContext, useContext } from 'react'

/** Toast konteksti. Alohida fayl — Fast Refresh uchun. */
export interface ToastValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

export const ToastContext = createContext<ToastValue | null>(null)

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast faqat <ToastProvider> ichida ishlatiladi')
  return ctx
}
