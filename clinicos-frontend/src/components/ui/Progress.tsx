import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/status'

const STROKE: Record<Tone, string> = {
  neutral: 'var(--ios-gray)',
  accent: 'var(--ios-blue)',
  brand: 'var(--ios-purple)',
  ok: 'var(--ios-green)',
  warn: 'var(--ios-orange)',
  bad: 'var(--ios-red)',
}

/**
 * Doiraviy indikator — KPI kartaning o'ng yuqori burchagida turadi.
 *
 * Apple Activity halqalari kabi: yumaloq uchli chiziq, orqa fon —
 * o'sha rangning juda kuchsiz varianti.
 */
export function ProgressRing({
  value,
  tone = 'accent',
  size = 40,
  thickness = 4,
  label,
  className,
}: {
  /** 0…100 */
  value: number
  tone?: Tone
  size?: number
  thickness?: number
  /** Markazdagi matn (bo'lmasa — bo'sh) */
  label?: string
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={thickness}
          opacity={0.16}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.6s var(--ease-out-soft)' }}
        />
      </svg>
      {label ? (
        <span className="absolute text-caption-2 font-semibold tnum text-label-secondary">
          {label}
        </span>
      ) : null}
    </span>
  )
}

/** Gorizontal progress — "Klinika ko'rsatkichlari" blokida */
export function ProgressBar({
  value,
  tone = 'accent',
  className,
}: {
  value: number
  tone?: Tone
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      // Platforma panelida chiziq chapdan o'ngga to'ladi
      data-motion="line"
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill-4', className)}
    >
      <span
        className="block h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: STROKE[tone],
          transition: 'width 0.6s var(--ease-out-soft)',
        }}
      />
    </div>
  )
}
