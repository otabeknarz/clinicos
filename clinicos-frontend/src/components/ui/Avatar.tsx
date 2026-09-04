import { cn } from '@/lib/cn'
import { colorIndex, initials } from '@/lib/format'

/**
 * Avatar — rasm o'rniga bosh harflar.
 *
 * Rang ismdan barqaror hisoblanadi: bir odam doim bir xil rangda
 * ko'rinadi, shuning uchun ro'yxatda ko'z tanib oladi.
 */

const PALETTE = [
  'bg-[color-mix(in_srgb,var(--ios-blue)_16%,transparent)] text-[var(--ios-blue)]',
  'bg-[color-mix(in_srgb,var(--ios-purple)_16%,transparent)] text-[var(--ios-purple)]',
  'bg-[color-mix(in_srgb,var(--ios-teal)_18%,transparent)] text-[var(--ios-teal)]',
  'bg-[color-mix(in_srgb,var(--ios-orange)_18%,transparent)] text-[var(--ios-orange)]',
  'bg-[color-mix(in_srgb,var(--ios-green)_18%,transparent)] text-[var(--ios-green)]',
  'bg-[color-mix(in_srgb,var(--ios-pink)_16%,transparent)] text-[var(--ios-pink)]',
  'bg-[color-mix(in_srgb,var(--ios-indigo)_16%,transparent)] text-[var(--ios-indigo)]',
]

const SIZES = {
  xs: 'h-7 w-7 text-caption-2',
  sm: 'h-9 w-9 text-caption',
  md: 'h-11 w-11 text-footnote',
  lg: 'h-16 w-16 text-title-3',
  xl: 'h-20 w-20 text-title-2',
} as const

export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        PALETTE[colorIndex(name, PALETTE.length)],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
