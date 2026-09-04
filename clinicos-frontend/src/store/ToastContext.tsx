import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Info } from 'lucide-react'

import { ToastContext } from './toast-context'
import type { ToastValue } from './toast-context'
import { cn } from '@/lib/cn'

/**
 * Qisqa xabarlar (toast).
 *
 * Muvaffaqiyatli amaldan keyin tasdiq ko'rsatish uchun — spec talabi:
 * "success feedback" har bir formada bo'lishi kerak.
 */

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}


const ICONS: Record<ToastKind, ReactNode> = {
  success: <Check size={15} strokeWidth={2.5} />,
  error: <AlertTriangle size={15} strokeWidth={2.25} />,
  info: <Info size={15} strokeWidth={2.25} />,
}

const ICON_TONES: Record<ToastKind, string> = {
  success: 'bg-ok text-white',
  error: 'bg-bad text-white',
  info: 'bg-accent text-white',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3200)
  }, [])

  const value = useMemo<ToastValue>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4',
                'material-thick shadow-popover animate-rise',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  ICON_TONES[toast.kind],
                )}
              >
                {ICONS[toast.kind]}
              </span>
              <span className="text-footnote font-medium text-label">{toast.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

