import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { Button, IconButton } from './Button'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'

/**
 * Modal oyna.
 *
 * Apple uslubi: orqa fon xiralashadi (backdrop-blur), oyna sal kattalashib
 * chiqadi. Escape yopadi, fon bosilsa ham yopiladi.
 *
 * Telefonda pastdan chiqadigan varaq (sheet) ko'rinishida.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape bilan yopish + fon skrollini to'xtatish
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Fokusni oyna ichiga olib kiramiz
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button',
      )
      focusable?.focus()
    }, 60)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  const widths = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-3xl',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Fon */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Oyna */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col',
          'animate-scale-in bg-overlay shadow-lg',
          'rounded-t-[22px] sm:rounded-[20px]',
          widths[size],
          'sm:mx-4',
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-title-3 text-label">{title}</h2>
            {description ? (
              <p className="mt-1 text-footnote text-label-secondary">{description}</p>
            ) : null}
          </div>
          <IconButton label="close" onClick={onClose} className="-mr-2 -mt-1">
            <X size={18} />
          </IconButton>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
          {children}
        </div>

        {footer ? (
          <footer
            className={cn(
              'hairline-t flex items-center gap-2 px-5 py-4 sm:px-6',
              // Telefonda tugmalar keng va bir xil — barmoq bilan bosish oson
              'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4',
              '[&>button]:flex-1 sm:[&>button]:flex-none sm:justify-end',
            )}
          >
            {footer}
          </footer>
        ) : (
          <div className="pb-6" />
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ */
/* Tasdiqlash oynasi                                                   */
/* ------------------------------------------------------------------ */

/**
 * Qaytarib bo'lmaydigan amallar uchun.
 * Spec talabi: o'chirish har doim tasdiqlashdan o'tadi.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = true,
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  pending?: boolean
}) {
  const { t } = useI18n()

  const handleConfirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title ?? t('confirm.delete.title')}
      description={description ?? t('confirm.delete.desc')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'filled'}
            loading={pending}
            onClick={handleConfirm}
          >
            {confirmLabel ?? t('action.delete')}
          </Button>
        </>
      }
    >
      <div className="pb-2" />
    </Modal>
  )
}
