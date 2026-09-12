import { BellRing, CalendarClock } from 'lucide-react'

import { listCabinetNotices, markNoticeRead } from '@/api/notices'
import { Card } from '@/components/ui/Card'
import { dateShort } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * KABINETDAGI XABARLAR.
 *
 * Klinikadan kelgan umumiy xabar va qabuldan ikki kun oldingi
 * eslatma shu yerda turadi.
 *
 * BOSH SAHIFANING TEPASIDA: bemor kabinetga kunda bir marta ham
 * kirmaydi — u kirganda xabar birinchi ko'rinishi kerak, aks holda
 * eslatmaning ma'nosi qolmaydi. O'qilmagani ajralib turadi va
 * bosilganda o'qilgan bo'ladi.
 *
 * O'qilganlari ham qoladi (oxirgi beshtasi): "klinika 14:00 gacha
 * ishlaydi" degan xabarni odam qayta o'qimoqchi bo'lishi mumkin.
 */
export function CabinetNoticesCard() {
  const { t } = useI18n()
  const { data, reload } = useAsync(listCabinetNotices, [])

  const notices = data ?? []
  if (notices.length === 0) return null

  const unread = notices.filter((notice) => !notice.read)
  const shown = unread.length > 0 ? unread : notices.slice(0, 3)

  async function open(id: string, read: boolean) {
    if (read) return
    await markNoticeRead(id)
    reload()
  }

  return (
    <Card padded={false} className="overflow-hidden rounded-[20px]">
      <div className="flex items-center gap-2 px-4 pt-4">
        <BellRing size={16} className="text-accent" />
        <h2 className="text-headline text-label">{t('cabinet.notices')}</h2>
        {unread.length > 0 ? (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-caption-2 font-semibold text-white">
            {unread.length}
          </span>
        ) : null}
      </div>

      <ul className="mt-2 divide-y divide-separator/60">
        {shown.map((notice) => (
          <li key={notice.id}>
            <button
              type="button"
              onClick={() => void open(notice.id, notice.read)}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors duration-150',
                notice.read ? 'hover:bg-fill-4' : 'bg-accent-soft/60 hover:bg-accent-soft',
              )}
            >
              <p className="flex items-center gap-1.5 text-caption text-label-tertiary">
                {notice.kind === 'reminder' ? <CalendarClock size={13} /> : null}
                {notice.kind === 'reminder'
                  ? t('cabinet.noticeReminder')
                  : t('cabinet.noticeFromClinic')}
                <span>· {dateShort(notice.createdAt)}</span>
              </p>
              <p
                className={cn(
                  'mt-1 whitespace-pre-wrap text-subhead',
                  notice.read ? 'text-label-secondary' : 'font-medium text-label',
                )}
              >
                {notice.text}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
