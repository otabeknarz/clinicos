import { useState } from 'react'
import { FileText, Stethoscope } from 'lucide-react'

import { dispensePrescription, listPrescriptions, onDutyNow } from '@/api/pharmacy'
import type { Prescription } from '@/types/pharmacy'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Tabs'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import type { Tone } from '@/lib/status'
import { dateTime } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

const TONE: Record<Prescription['status'], Tone> = {
  pending: 'warn',
  dispensed: 'ok',
  expired: 'neutral',
}

/**
 * RETSEPTLAR — KLINIKADAN APTEKAGA.
 *
 * Bu ikki biznesni bir-biriga bog'laydigan YAGONA nuqta va aynan
 * shuning uchun apteka klinika ichida turibdi. Shifokor tashrifda
 * dori yozadi, farmatsevt uni shu yerda ko'radi: bemor qog'oz
 * ko'tarib yurmaydi va farmatsevt qo'lyozmani o'qib o'tirmaydi.
 *
 * DORI NOMI MATN, katalogga bog'lanish EMAS. Shifokor katalogda
 * yo'q dorini ham yozishi mumkin — bemor uni boshqa aptekadan
 * oladi. Bog'lanish majburiy bo'lsa, shifokor o'z tavsiyasini
 * aptekaning zaxirasiga moslashtirishga majbur bo'lardi.
 */
export function PharmacyPrescriptionsPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<'all' | Prescription['status']>('pending')

  const { data, loading, reload } = useAsync(() => listPrescriptions(status), [status])
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('nav.pharmacyPrescriptions')}
          subtitle={loading ? undefined : t('pharmacy.rxCount', { count: rows.length })}
          action={
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: t('pharmacy.rxPending') },
                { value: 'dispensed', label: t('pharmacy.rxDispensed') },
                { value: 'all', label: t('common.all') },
              ]}
            />
          }
        />
      </Card>

      {loading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={22} />}
            title={t('pharmacy.rxNone')}
            description={t('pharmacy.rxNoneHint')}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <RxCard key={row.id} row={row} onDone={reload} toastText={t('pharmacy.rxDone')} />
          ))}
        </div>
      )}

    </div>
  )
}

function RxCard({
  row,
  onDone,
  toastText,
}: {
  row: Prescription
  onDone: () => void
  toastText: string
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { can } = useAuth()

  /*
    Dorini SMENADAGI odam beradi.

    Ro'yxatning o'zi hammaga ochiq — rahbar ham ko'radi, navbatdan
    tashqaridagi sotuvchi ham. Lekin "berildi" deb belgilashni
    faqat kassani ushlab turgan odam qila oladi: bermagan odam
    belgilasa, ro'yxat haqiqatni ko'rsatishni to'xtatardi.
  */
  const duty = useAsync(onDutyNow, [])
  const onDuty = !duty.data?.holder || duty.data.isMe

  const dispense = useAction(async () => {
    await dispensePrescription(row.id)
  })

  async function submit() {
    const done = await dispense.run()
    if (done === null) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(toastText)
    onDone()
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-headline font-semibold text-label">{row.patientName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-label-tertiary">
            <Stethoscope size={12} />
            {row.doctorName} · {dateTime(row.createdAt)}
          </p>
        </div>
        <Badge tone={TONE[row.status]} dot>
          {t(`pharmacy.rxStatus.${row.status}`)}
        </Badge>
      </div>

      <ul className="hairline-t divide-y divide-separator">
        {row.items.map((item, index) => (
          <li key={index} className="py-2.5 first:pt-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-subhead font-medium text-label">
                {item.medicineName}
              </p>
              <p className="shrink-0 text-subhead tabular-nums text-label-secondary">
                × {item.quantity}
              </p>
            </div>
            {/*
              Qabul qilish tartibi — retseptning eng muhim qismi.
              Dorining nomi javondan topiladi, tartibni esa
              faqat shifokor aytadi.
            */}
            <p className="mt-0.5 text-caption text-label-secondary">{item.dosage}</p>
          </li>
        ))}
      </ul>

      {/*
        "Berildi" tugmasi FAQAT SOTUVCHIDA.

        Rahbar retseptlarni ko'radi — nima yozilyapti, qaysi
        shifokordan qancha kelyapti — lekin dorini u bermaydi.
        Bermagan odam "berdim" deb belgilay olsa, ro'yxat
        haqiqatni ko'rsatishni to'xtatardi.
      */}
      {row.status === 'pending' && can('pharmacy.sell') ? (
        onDuty ? (
          <Button loading={dispense.pending} onClick={() => void submit()}>
            {t('pharmacy.rxDispense')}
          </Button>
        ) : (
          <p className="text-caption text-label-tertiary">
            {t('pharmacy.rxNotOnDuty', {
              name: duty.data?.holder?.fullName ?? '',
            })}
          </p>
        )
      ) : null}
    </Card>
  )
}
