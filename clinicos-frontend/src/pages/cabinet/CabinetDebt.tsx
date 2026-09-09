import { CheckCircle2, Wallet } from 'lucide-react'

import { getCabinetDebt } from '@/api/cabinet'
import { Card } from '@/components/ui/Card'
import { Hero } from '@/components/ui/Hero'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { compactNumber, currencyLabel, dateShort, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'

/**
 * Bemorning qarzi.
 *
 * TO'LOV TUGMASI YO'Q va bu ataylab. Pulni registrator oladi va
 * yozadi — bu tizimning asosiy qoidasi (vazifalar ajratilishi).
 * Kabinetdan to'lash imkoniyati qo'shilsa, to'lovni yozadigan odam
 * bilan pulni oladigan odam bir xil bo'lib qolardi. Bu ro'yxat
 * shunchaki javob beradi: qancha va nima uchun.
 */
export function CabinetDebtPage() {
  const { t, tService } = useI18n()
  const { profile } = usePatient()
  const { data, loading, error, reload } = useAsync(
    () => getCabinetDebt(profile?.patientId),
    [profile?.patientId],
  )

  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={reload} />

  if (!data || data.items.length === 0) {
    return (
      <Card className="rounded-[20px]">
        <EmptyState
          icon={<CheckCircle2 size={24} strokeWidth={1.75} />}
          title={t('cabinet.noDebt')}
          description={t('cabinet.noDebtHint')}
          className="py-10"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Hero
        eyebrow={t('cabinet.debtTotal')}
        value={compactNumber(data.total)}
        unit={currencyLabel()}
        meta={t('cabinet.debtHint')}
      />

      <Card padded={false} className="rounded-[20px]">
        <h2 className="p-4 pb-2 text-subhead font-semibold text-label">
          {t('cabinet.debtBreakdown')}
        </h2>

        <ul className="px-4 pb-4">
          {data.items.map((item) => (
            <li key={item.appointmentId} className="hairline py-3 last:border-b-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-subhead font-medium text-label">
                  {tService(item.serviceName)}
                </p>
                <p className="shrink-0 text-subhead font-semibold tnum text-bad">
                  {money(item.remaining)}
                </p>
              </div>

              <p className="mt-0.5 truncate text-caption text-label-tertiary">
                {dateShort(item.completedAt)} · {item.doctorName}
              </p>

              {/*
                Qisman to'langan bo'lsa buni aytish kerak: aks holda
                bemor "men to'lagandim-ku" deb o'ylaydi va raqam
                tushunarsiz bo'lib qoladi.
              */}
              {item.paid > 0 ? (
                <p className="mt-0.5 text-caption text-label-tertiary">
                  {t('cabinet.partlyPaid', {
                    paid: money(item.paid),
                    total: money(item.total),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <p className="flex items-start gap-2 px-1 text-caption text-label-tertiary">
        <Wallet size={14} className="mt-0.5 shrink-0" />
        {t('cabinet.payHint')}
      </p>
    </div>
  )
}
