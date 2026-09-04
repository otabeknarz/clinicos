import { CalendarOff } from 'lucide-react'

import { getMyWorkSchedule } from '@/api/staff'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * "MENING ISH JADVALIM" — alohida bo'lim.
 *
 * NEGA ALOHIDA SAHIFA: ish kunlarini xodim istalgan vaqtda, hech kimdan
 * so'ramasdan ko'rishi kerak. Sozlamalar ichida turgan jadvalni topish
 * uchun ikki-uch bosish kerak bo'ladi — menyudagi band esa bir bosish.
 *
 * Jadvalni klinika egasi belgilaydi, bu yerda faqat ko'rsatiladi.
 */
export function SchedulePage() {
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

  return (
    <>
      <PageHeader title={t('schedule.mine')} subtitle={t('schedule.pageSubtitle')} />

      <Card className="max-w-2xl">
        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading && !data ? (
          <CardSkeleton className="border-0 shadow-none" />
        ) : !data ? (
          // Klinika egasi shtatda bo'lmasligi mumkin — u holda jadval ham yo'q
          <EmptyState
            icon={<CalendarOff size={24} strokeWidth={1.75} />}
            title={t('schedule.noStaffRecord')}
            description=""
            className="py-10"
          />
        ) : (
          <>
            <CardHeader title={data.fullName} subtitle={data.positionTitle} />
            <WorkScheduleCalendar staffId={data.staffId} className="mt-5" />
          </>
        )}
      </Card>
    </>
  )
}
