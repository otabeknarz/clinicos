import { AreaTrend } from '@/components/charts/Charts'
import { percent } from '@/lib/format'
import type { SeriesPoint } from '@/types/models'

/**
 * Bandlik dinamikasi.
 *
 * Alohida faylda — grafik kutubxonasi og'ir, u faqat "Tahlil" tabi
 * ochilganda yuklanadi.
 */
export default function OccupancyChart({ data }: { data: SeriesPoint[] }) {
  return (
    <AreaTrend
      data={data}
      height={220}
      color="var(--ios-teal)"
      gradientId="wardOccupancy"
      format={(v) => percent(v)}
      axisFormat={(v) => percent(v)}
    />
  )
}
