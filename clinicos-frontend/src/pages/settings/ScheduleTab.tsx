import { CalendarOff } from 'lucide-react'

import { getMyWorkSchedule } from '@/api/staff'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * XODIMNING O'Z ISH JADVALI.
 *
 * Har bir xodim — registrator, hamshira, farrosh — o'z profilida
 * qaysi kunlar ishlashini ko'radi. Jadvalni klinika egasi belgilaydi,
 * bu yerda faqat ko'rsatiladi.
 *
 * NEGA KERAK: ish kunlari og'zaki aytilsa, unutiladi va nizo chiqadi.
 * Yozilgan jadval esa bahsni yopadi.
 */
export function ScheduleTab() {
  const { t } = useI18n()
  const { session } = useAuth()

  const month = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const { data, loading, error, reload } = useAsync(
    () => getMyWorkSchedule(session?.user.email ?? '', month),
    [session?.user.email, month],
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="border-0 shadow-none" />

  // Klinika egasi shtatda bo'lmasligi mumkin — u holda jadval ham yo'q
  if (!data) {
    return (
      <EmptyState
        icon={<CalendarOff size={24} strokeWidth={1.75} />}
        title={t('schedule.noStaffRecord')}
        description=""
        className="py-10"
      />
    )
  }

  return <WorkScheduleCalendar staffId={data.staffId} />
}
