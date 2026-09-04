import { BadgePercent, Clock, Wallet } from 'lucide-react'

import { Badge } from './Badge'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useI18n } from '@/i18n'
import type { PricePreview } from '@/types/models'

/**
 * Xizmat narxi — chegirma va to'lov turi bilan.
 *
 * Registratura pul so'rashdan oldin aynan shuni ko'radi:
 *   - qancha to'lanadi,
 *   - chegirma bormi va nechada,
 *   - pulni HOZIR olish kerakmi yoki ko'rikdan keyin.
 *
 * Qabul yozish va to'lov qabul qilish formalarida bir xil ko'rinadi —
 * shuning uchun alohida komponent.
 */
export function PriceHint({
  preview,
  className,
}: {
  preview: PricePreview
  className?: string
}) {
  const { t, tService } = useI18n()

  const discounted = preview.discountPct > 0
  const prepaid = preview.paymentTiming === 'prepaid'

  return (
    <div
      className={cn(
        'rounded-[12px] p-3.5',
        prepaid ? 'bg-warn-soft' : 'bg-sunken',
        className,
      )}
    >
      {/* --- Narx --- */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-footnote text-label-secondary">
          {tService(preview.serviceName)}
        </span>

        <span className="flex items-baseline gap-2">
          {discounted ? (
            <span className="text-footnote tnum text-label-tertiary line-through">
              {money(preview.basePrice)}
            </span>
          ) : null}
          <span
            className={cn(
              'text-title-3 font-bold tnum',
              discounted ? 'text-ok' : 'text-label',
            )}
          >
            {money(preview.price)}
          </span>
        </span>
      </div>

      {/* --- Belgilar --- */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Badge tone={prepaid ? 'warn' : 'neutral'} dot>
          {prepaid ? <Wallet size={11} /> : <Clock size={11} />}
          {t(`serviceForm.${preview.paymentTiming}`)}
        </Badge>

        {discounted ? (
          <Badge tone="ok">
            <BadgePercent size={11} />
            −{preview.discountPct}%
          </Badge>
        ) : null}

        {preview.visitCount > 0 ? (
          <span className="text-caption text-label-tertiary">
            {t('patients.visits', { count: preview.visitCount })}
          </span>
        ) : null}
      </div>

      {/* --- Keyingi pog'ona --- */}
      {preview.nextTierIn !== null && preview.nextTierPct !== null ? (
        <p className="mt-2 text-caption text-label-tertiary">
          {t('price.nextTier', {
            count: preview.nextTierIn,
            pct: preview.nextTierPct,
          })}
        </p>
      ) : null}

      {/* --- Oldindan to'lov ogohlantirishi --- */}
      {prepaid ? (
        <p className="mt-2 text-caption font-medium text-warn">
          {t('price.prepaidWarning')}
        </p>
      ) : null}
    </div>
  )
}
