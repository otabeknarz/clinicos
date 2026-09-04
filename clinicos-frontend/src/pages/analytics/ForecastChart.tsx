import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { compactNumber, money } from '@/lib/format'
import { useI18n } from '@/i18n'
import type { Forecast } from '@/types/models'

/**
 * Prognoz grafigi.
 *
 * Chap tomonda — haqiqiy raqamlar (to'liq chiziq), o'ngda — prognoz
 * (uzuq chiziq) va uning ishonch oralig'i (soyalangan maydon).
 * Ikkisi orasida vertikal chiziq: "bugundan keyingisi taxmin".
 */
export default function ForecastChart({ forecast }: { forecast: Forecast }) {
  const { t } = useI18n()

  const data = forecast.revenue.map((point, index) => {
    const expense = forecast.expenses[index]
    const profit = forecast.profit[index]

    return {
      label: point.label,
      actualRevenue: point.actual,
      actualExpenses: expense.actual,
      forecastRevenue: point.forecast,
      forecastExpenses: expense.forecast,
      // Maydon uchun [past, yuqori] juftligi
      range: point.forecast !== null ? [point.low ?? 0, point.high ?? 0] : null,
      profit: profit.actual ?? profit.forecast,
    }
  })

  // Haqiqiy va prognoz chegarasi
  const boundary = forecast.revenue.findIndex((p) => p.forecast !== null)
  const boundaryLabel = boundary > 0 ? forecast.revenue[boundary - 1].label : undefined

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="forecastRange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ios-blue)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--ios-blue)" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="var(--separator)" strokeDasharray="3 3" vertical={false} />

        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }}
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--label-tertiary)' }}
          width={56}
          tickFormatter={(value: number) => compactNumber(value)}
        />

        <Tooltip
          cursor={{ stroke: 'var(--separator)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as (typeof data)[number]
            const isForecast = row.forecastRevenue !== null

            return (
              <div className="material-thick rounded-[10px] px-3 py-2 shadow-popover">
                <p className="text-caption-2 text-label-tertiary">
                  {label} · {isForecast ? t('forecast.projected') : t('forecast.actual')}
                </p>
                <p className="mt-1 text-footnote font-semibold tnum text-label">
                  {money(row.actualRevenue ?? row.forecastRevenue ?? 0)}
                </p>
                <p className="text-caption tnum text-label-secondary">
                  −{money(row.actualExpenses ?? row.forecastExpenses ?? 0)}
                </p>
                <p
                  className={
                    (row.profit ?? 0) >= 0
                      ? 'text-caption font-medium tnum text-ok'
                      : 'text-caption font-medium tnum text-bad'
                  }
                >
                  = {money(row.profit ?? 0)}
                </p>
              </div>
            )
          }}
        />

        {/* Ishonch oralig'i */}
        <Area
          type="monotone"
          dataKey="range"
          stroke="none"
          fill="url(#forecastRange)"
          isAnimationActive={false}
        />

        {/* Haqiqiy daromad */}
        <Line
          type="monotone"
          dataKey="actualRevenue"
          stroke="var(--ios-blue)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
        />
        {/* Prognoz daromad — uzuq chiziq */}
        <Line
          type="monotone"
          dataKey="forecastRevenue"
          stroke="var(--ios-blue)"
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={{ r: 3 }}
          connectNulls
        />

        {/* Xarajatlar */}
        <Line
          type="monotone"
          dataKey="actualExpenses"
          stroke="var(--ios-orange)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="forecastExpenses"
          stroke="var(--ios-orange)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
        />

        {/* Bugundan keyingisi — taxmin */}
        {boundaryLabel ? (
          <ReferenceLine
            x={boundaryLabel}
            stroke="var(--label-tertiary)"
            strokeDasharray="2 4"
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
