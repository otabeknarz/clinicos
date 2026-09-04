import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

/**
 * Tugma — Apple uslubida.
 *
 * `filled`   — asosiy harakat, ko'k fon (bir ekranda bittadan ko'p bo'lmasin)
 * `tinted`   — ikkilamchi, ko'kning yumshoq foni
 * `plain`    — fon yo'q, faqat matn
 * `gray`     — neytral (Bekor qilish)
 * `danger`   — o'chirish kabi qaytarib bo'lmaydigan amallar
 */
export type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'gray' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  filled: 'bg-accent text-white hover:brightness-110 active:brightness-95 shadow-xs',
  tinted: 'bg-accent-soft text-accent hover:brightness-95 active:brightness-90',
  plain: 'text-accent hover:bg-fill-4 active:bg-fill-3',
  gray: 'bg-fill-3 text-label hover:bg-fill-2 active:bg-fill',
  danger: 'bg-bad text-white hover:brightness-110 active:brightness-95 shadow-xs',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-footnote gap-1.5 rounded-[8px]',
  md: 'h-10 px-4 text-subhead gap-2 rounded-[10px]',
  lg: 'h-12 px-6 text-callout gap-2 rounded-[12px]',
}

interface BaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Butun kenglikni egallaydi */
  block?: boolean
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
  className?: string
}

export interface ButtonProps
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> {}

function classes({ variant = 'filled', size = 'md', block, className }: BaseProps) {
  return cn(
    'inline-flex items-center justify-center font-medium select-none',
    'transition-[background-color,filter,transform] duration-150',
    'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
    'whitespace-nowrap',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  )
}

export function Button({
  variant = 'filled',
  size = 'md',
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={classes({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

/** Marshrutga o'tuvchi tugma — ko'rinishi bir xil */
export function ButtonLink({
  to,
  variant = 'filled',
  size = 'md',
  block,
  icon,
  children,
  className,
}: BaseProps & { to: string }) {
  return (
    <Link to={to} className={classes({ variant, size, block, className })}>
      {icon}
      {children}
    </Link>
  )
}

/** Faqat ikonkali dumaloq tugma — panel va jadval qatorlari uchun */
export function IconButton({
  children,
  className,
  label,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        // Apple HIG: eng kichik teginish maydoni 44×44pt.
        // Telefonda 44px, sichqoncha bilan ishlatiladigan desktopda 36px.
        'inline-flex h-11 w-11 items-center justify-center rounded-[10px] sm:h-9 sm:w-9',
        'text-label-secondary transition-colors duration-150',
        'hover:bg-fill-4 hover:text-label active:bg-fill-3',
        'disabled:opacity-40 disabled:pointer-events-none',
        active && 'bg-fill-3 text-label',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 shrink-0 animate-spin rounded-full',
        'border-2 border-current border-t-transparent opacity-70',
        className,
      )}
      aria-hidden
    />
  )
}
