import { useState } from 'react'
import { Check, Inbox, Package } from 'lucide-react'

import { pharmacyInbox, setInboxStatus } from '@/api/prescriptions'
import type { Prescription, RxStatus } from '@/api/prescriptions'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { FilterPills } from '@/components/ui/Tabs'
import { dateTime, money, phone as formatPhone } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

/**
 * KLINIKALARDAN KELGAN ONLAYN RETSEPTLAR.
 *
 * Apteka ularni tayyorlaydi va bemor kelganda beradi. Bemor
 * KODNI aytadi — ro'yxatda o'sha kod katta qilib yozilgan.
 *
 * Ikkita tugma: "Tayyor" (dorilar yig'ildi, bemor kelishi mumkin)
 * va "Berildi". Uchinchi holat — bekor qilish, dori topilmaganda.
 */
const STATUSES: (RxStatus | 'all')[] = ['all', 'sent', 'ready', 'dispensed', 'cancelled']

const STATUS_TONE: Record<RxStatus, Tone> = {
  sent: 'accent',
  ready: 'warn',
  dispensed: 'ok',
  cancelled: 'neutral',
}

export function PharmacyInboxPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { can } = useAuth()

  const [status, setStatus] = useState<RxStatus | 'all'>('all')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const { data, loading, error, reload } = useAsync(() => pharmacyInbox(status), [status, version])

  const canSell = can('pharmacy.sell')

  async function move(rx: Prescription, next: 'ready' | 'dispensed' | 'cancelled') {
    setBusy(rx.id)
    try {
      await setInboxStatus(rx.id, next)
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title={t('rxInbox.title')} subtitle={t('rxInbox.subtitle')} />

      <Card padded={false}>
        <div className="hairline p-4 sm:p-5">
          <FilterPills<RxStatus | 'all'>
            value={status}
            onChange={setStatus}
            options={STATUSES.map((key) => ({
              value: key,
              label: key === 'all' ? t('common.all') : t(`rx.status.${key}`),
            }))}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading && !data ? (
          <CardSkeleton className="m-5 border-0 shadow-none" />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} strokeWidth={1.75} />}
            title={t('rxInbox.empty')}
            className="py-12"
          />
        ) : (
          <ul>
            {data.map((rx) => (
              <li key={rx.id} className="hairline px-5 py-4 last:border-b-0 sm:px-6">
                <div className="flex flex-wrap items-start gap-3">
                  {/* KOD — bemor aytadigan narsa, shuning uchun eng ko'zga tashlanadigan */}
                  <span className="rounded-[12px] bg-accent-soft px-3 py-2 text-headline font-bold tnum tracking-widest text-accent">
                    {rx.code}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-subhead font-medium text-label">
                        {rx.patientName || '—'}
                      </span>
                      <Badge tone={STATUS_TONE[rx.status]} dot>
                        {t(`rx.status.${rx.status}`)}
                      </Badge>
                      <span className="text-caption tnum text-label-tertiary">
                        {dateTime(rx.createdAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-footnote text-label-secondary">
                      {rx.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}
                    </p>

                    <p className="mt-1 text-caption text-label-tertiary">
                      {rx.clinicName}
                      {rx.doctorName ? ` · ${rx.doctorName}` : ''}
                      {rx.patientPhone ? ` · ${formatPhone(rx.patientPhone)}` : ''}
                      {rx.estimatedTotal > 0 ? ` · ${money(rx.estimatedTotal)}` : ''}
                    </p>

                    {rx.note ? (
                      <p className="mt-1 text-caption text-label-tertiary">{rx.note}</p>
                    ) : null}
                  </div>

                  {canSell ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {rx.status === 'sent' ? (
                        <Button
                          size="sm"
                          variant="tinted"
                          loading={busy === rx.id}
                          icon={<Package size={14} />}
                          onClick={() => void move(rx, 'ready')}
                        >
                          {t('rxInbox.markReady')}
                        </Button>
                      ) : null}

                      {rx.status === 'sent' || rx.status === 'ready' ? (
                        <>
                          <Button
                            size="sm"
                            loading={busy === rx.id}
                            icon={<Check size={14} />}
                            onClick={() => void move(rx, 'dispensed')}
                          >
                            {t('rxInbox.markDispensed')}
                          </Button>
                          <Button
                            size="sm"
                            variant="gray"
                            loading={busy === rx.id}
                            onClick={() => void move(rx, 'cancelled')}
                          >
                            {t('action.cancel')}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
