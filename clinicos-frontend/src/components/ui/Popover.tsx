import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Ochiladigan panel (dropdown).
 *
 * Tashqariga bosilsa yoki Escape bosilsa yopiladi.
 * Apple uslubi: material fon (xiralashuv), yumshoq soya, kichik radius.
 */
export function Popover({
  trigger,
  children,
  align = 'end',
  width = 'w-72',
  className,
}: {
  /** Ochish tugmasi. `open` holatini bilishi uchun funksiya sifatida beriladi. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (props: { close: () => void }) => ReactNode
  align?: 'start' | 'end'
  width?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open ? (
        <div
          className={cn(
            'absolute top-[calc(100%+8px)] z-40',
            align === 'end' ? 'right-0' : 'left-0',
            width,
            'animate-scale-in origin-top rounded-[16px] p-1.5',
            'material-thick shadow-popover',
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  )
}

/** Panel ichidagi bosiladigan qator */
export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
  meta,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  active?: boolean
  meta?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left',
        'text-subhead transition-colors duration-150',
        danger ? 'text-bad hover:bg-bad-soft' : 'text-label hover:bg-fill-4',
        active && !danger && 'bg-fill-4',
      )}
    >
      {icon ? <span className="shrink-0 text-label-secondary">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? <span className="shrink-0 text-footnote text-label-tertiary">{meta}</span> : null}
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1.5 h-px bg-separator" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-caption-2 font-semibold uppercase tracking-wide text-label-tertiary">
      {children}
    </p>
  )
}
