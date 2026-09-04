import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { cn } from '@/lib/cn'
import { compactNumber, groupDigits } from '@/lib/format'
import type { SeriesPoint } from '@/types/models'

/**
 * Grafiklar.
 *
 * Apple tamoyili: grafik — bezak emas, ma'lumot. Shuning uchun:
 *   - to'r chiziqlari yo'q yoki juda kuchsiz,
 *   - o'q belgilari kichik va kulrang,
 *   - bitta rang, gradient faqat maydonni to'ldirish uchun,
 *   - tooltip — material fonli kichik kartochka.
 *
 * Ranglar CSS o'zgaruvchilaridan olinadi, shuning uchun qorong'i rejimda
 * o'zi moslashadi.
 */

const AXIS_STYLE = {
  fontSize: 11,
  fill: 'var(--label-tertiary)',
} as const

const CHART_COLORS = [
  'var(--ios-blue)',
  'var(--ios-purple)',
  'var(--ios-teal)',
  'var(--ios-orange)',
  'var(--ios-green)',
  'var(--ios-pink)',
  'var(--ios-indigo)',
  'var(--ios-yellow)',
]

type Formatter = (value: number) => string

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

interface TooltipPayload {
  payload?: { label?: string; value?: number; name?: string }
  value?: number
}

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  format: Formatter
}) {
  if (!active || !payload?.length) return null
  const value = payload[0].value ?? 0

  return (
    <div className="material-thick rounded-[10px] px-3 py-2 shadow-popover">
      <p className="text-caption-2 text-label-tertiary">{label}</p>
      <p className="text-footnote font-semibold tnum text-label">{format(value)}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Maydonli grafik (asosiy — daromad dinamikasi)                       */
/* ------------------------------------------------------------------ */

export function AreaTrend({
  data,
  height = 240,
  color = 'var(--ios-blue)',
  format = (v) => groupDigits(v),
  axisFormat = (v) => compactNumber(v),
  gradientId = 'areaFill',
}: {
  data: SeriesPoint[]
  height?: number
  color?: string
  format?: Formatter
  axisFormat?: Formatter
  gradientId?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          minTickGap={24}
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          width={52}
          tickFormatter={axisFormat}
        />
        <Tooltip
          cursor={{ stroke: 'var(--separator)', strokeWidth: 1 }}
          content={<ChartTooltip format={format} />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-raised)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Ustunli grafik                                                      */
/* ------------------------------------------------------------------ */

export function BarTrend({
  data,
  height = 240,
  color = 'var(--ios-blue)',
  format = (v) => groupDigits(v),
  axisFormat = (v) => compactNumber(v),
}: {
  data: SeriesPoint[]
  height?: number
  color?: string
  format?: Formatter
  axisFormat?: Formatter
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          minTickGap={20}
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          width={52}
          tickFormatter={axisFormat}
        />
        <Tooltip
          cursor={{ fill: 'var(--fill-quaternary)' }}
          content={<ChartTooltip format={format} />}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Doiraviy (to'lov usullari taqsimoti)                                */
/* ------------------------------------------------------------------ */

export function DonutChart({
  data,
  height = 200,
  format = (v) => groupDigits(v),
}: {
  data: { label: string; value: number }[]
  height?: number
  format?: Formatter
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip format={format} />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ */
/* Gorizontal taqsimot (shifokorlar / xizmatlar bo'yicha)              */
/* ------------------------------------------------------------------ */

/**
 * Bu recharts'siz — oddiy div'lar. Reyting ro'yxati uchun shundoq
 * aniqroq va yengilroq chiqadi.
 */
export function RankedBars({
  items,
  format,
  colorful = false,
  className,
}: {
  items: { id: string; label: ReactNode; value: number; sharePct: number }[]
  format: Formatter
  /** Har bir qator o'z rangida (taqsimot) yoki hammasi ko'k (reyting) */
  colorful?: boolean
  className?: string
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-footnote text-label-tertiary">—</p>
  }

  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className={cn('space-y-3.5', className)}>
      {items.map((item, index) => (
        <li key={item.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-subhead text-label">{item.label}</span>
            <span className="shrink-0 text-footnote font-semibold tnum text-label">
              {format(item.value)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-4">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background: colorful
                    ? CHART_COLORS[index % CHART_COLORS.length]
                    : 'var(--ios-blue)',
                  transition: 'width 0.6s var(--ease-out-soft)',
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-caption tnum text-label-tertiary">
              {item.sharePct.toFixed(0)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Doiraviy grafik yonidagi izoh */
export function ChartLegend({
  items,
  format,
}: {
  items: { id: string; label: ReactNode; value: number }[]
  format: Formatter
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item.id} className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
          />
          <span className="min-w-0 flex-1 truncate text-footnote text-label-secondary">
            {item.label}
          </span>
          <span className="shrink-0 text-footnote font-medium tnum text-label">
            {format(item.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Sparkline — KPI karta ichidagi kichik chiziq */
export function Sparkline({
  data,
  color = 'var(--ios-blue)',
  height = 36,
}: {
  data: number[]
  color?: string
  height?: number
}) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / span) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
