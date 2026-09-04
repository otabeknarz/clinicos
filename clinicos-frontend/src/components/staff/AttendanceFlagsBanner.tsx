import { useState } from 'react'
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'

import { listAttendanceFlags } from '@/api/attendance'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { dateCompact, dateTime } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * SHUBHALI DAVOMAT YOZUVLARI — egasi uchun ogohlantirish tasmasi.
 *
 * Registrator kelish vaqtini odam kelgan paytda emas, ancha keyin
 * yozgan bo'lsa, yozuv shu yerga tushadi. Egasi davomat bo'limini
 * ochishi bilan tepada ko'radi.
 *
 * NEGA AYBLOV EMAS: haqiqiy sabablar ham bo'ladi — registrator band
 * bo'lgan, tizim ishlamagan, odam keyinroq aytgan. Shuning uchun bu
 * "jazo ro'yxati" emas, e'tibor talab qiladigan yozuvlar ro'yxati.
 * Qaror egasiniki.
 *
 * Hech narsa bo'lmasa, tasma umuman ko'rinmaydi — bo'sh ogohlantirish
 * odamni befarq qiladi.
 */
export function AttendanceFlagsBanner({ className }: { className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const { data } = useAsync(() => listAttendanceFlags(20), [])

  if (!data || data.length === 0) return null

  return (
    <section
      className={cn(
        'squircle overflow-hidden rounded-[14px] bg-warn-soft',
        'ring-1 ring-inset ring-warn/20',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-warn/15 text-warn">
          <ShieldAlert size={18} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-subhead font-semibold text-label">
            {t('attendance.flag.title')}
          </span>
          <span className="block truncate text-caption text-label-secondary">
            {t('attendance.flag.subtitle')}
          </span>
        </span>

        <Badge tone="warn">{t('attendance.flag.count', { count: data.length })}</Badge>

        {open ? (
          <ChevronUp size={17} className="shrink-0 text-label-tertiary" />
        ) : (
          <ChevronDown size={17} className="shrink-0 text-label-tertiary" />
        )}
      </button>

      {open ? (
        <ul className="border-t border-warn/15">
          {data.map((flag) => (
            <li key={flag.id} className="border-b border-warn/10 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Avatar name={flag.staffName} size="xs" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote font-medium text-label">
                    {flag.staffName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {dateCompact(flag.date)}
                    {flag.arrivedAt
                      ? ` · ${t('attendance.arrived', { time: flag.arrivedAt })}`
                      : ''}
                    {' · '}
                    {t('attendance.flag.markedBy', { name: flag.markedByName })}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-caption font-medium text-warn">
                    {t(`attendance.flag.reason.${flag.reason || 'backdated'}`)}
                  </span>
                  <span className="block text-caption-2 tnum text-label-tertiary">
                    {flag.reason === 'future'
                      ? dateTime(flag.markedAt)
                      : t('attendance.flag.gap', {
                          hours: Math.max(1, Math.floor(flag.gapMinutes / 60)),
                        })}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
