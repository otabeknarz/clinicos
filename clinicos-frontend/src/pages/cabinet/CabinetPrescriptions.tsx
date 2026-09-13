import { Pill } from 'lucide-react'

import { cabinetPrescriptions } from '@/api/cabinet'
import { Card } from '@/components/ui/Card'
import { dateShort, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * KABINETDAGI RETSEPTLAR.
 *
 * Bemorga ikki narsa kerak: APTEKADA AYTADIGAN KOD va QANCHA PUL
 * olib borishi. Ikkalasi ham shu yerda — aks holda odam aptekaga
 * borib "shifokor nimadir yozgan edi" deb turib qolardi.
 *
 * Berilgan retseptlar ko'rsatilmaydi: ish tugagan, ro'yxatni
 * to'ldirishning ma'nosi yo'q.
 */
export function CabinetPrescriptionsCard() {
  const { t } = useI18n()
  const { data } = useAsync(cabinetPrescriptions, [])

  const active = (data ?? []).filter(
    (rx) => rx.status === 'sent' || rx.status === 'ready',
  )
  if (active.length === 0) return null

  return (
    <Card padded={false} className="overflow-hidden rounded-[20px]">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Pill size={16} className="text-accent" />
        <h2 className="text-headline text-label">{t('cabinet.rx')}</h2>
      </div>

      <ul className="mt-2 divide-y divide-separator/60">
        {active.map((rx) => (
          <li key={rx.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-subhead font-medium text-label">
                  {rx.pharmacyName}
                </p>
                <p className="mt-0.5 truncate text-caption text-label-tertiary">
                  {rx.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}
                </p>
                <p className="mt-0.5 text-caption text-label-tertiary">
                  {dateShort(rx.createdAt)}
                  {rx.estimatedTotal > 0 ? ` · ${money(rx.estimatedTotal)}` : ''}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="block rounded-[10px] bg-accent-soft px-2.5 py-1 text-subhead font-bold tnum tracking-wider text-accent">
                  {rx.code}
                </span>
                <span className="mt-1 block text-caption-2 text-label-tertiary">
                  {t('cabinet.rxCode')}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
