import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HandCoins } from 'lucide-react'

import { listDebts, waiveDebt } from '@/api/debts'
import { PaymentFormModal } from '@/components/modals/PaymentFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { TextArea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { money, phone as fmtPhone } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { VisitDebt, WardDebt } from '@/types/models'

/** Jadval qator kaliti uchun `id` qo’shilgan ko’rinishi */
type VisitRow = VisitDebt & { id: string }
type WardRow = WardDebt & { id: string }

/**
 * QARZDORLAR.
 *
 * Qarz saqlanmaydi — xizmat narxi minus to'langan summa. Shuning uchun
 * bu sahifada "qarz qo'shish" degan amal yo'q: qarz to'lov yozilishi
 * bilan kamayadi va nolga yetganda o'zi yo'qoladi.
 *
 * Ikkita ro'yxat ataylab ALOHIDA: ko'rik qarzining ustunlari
 * (shifokor, xizmat) statsionarnikiga (palata, yotgan kun) o'xshamaydi.
 */
export function DebtsPage() {
  const { t, tService } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const { data, loading, error, reload } = useAsync(() => listDebts(), [])

  const [payFor, setPayFor] = useState<VisitDebt | null>(null)
  const [waiveFor, setWaiveFor] = useState<VisitDebt | WardDebt | null>(null)
  const [note, setNote] = useState('')

  const mayWaive = can('debts.waive')

  /*
    `DataTable` qatordan `id` talab qiladi (React kaliti uchun).
    Qarzning o'z id'si yo'q — u hisoblanadi, saqlanmaydi. Shuning uchun
    kalit sifatida qabul/yotqizish id'si ishlatiladi: bitta qabulda
    bittadan ortiq qarz bo'lmaydi.
  */
  const visitRows = (data?.visits ?? []).map((row) => ({ ...row, id: row.appointmentId }))
  const wardRows = (data?.ward ?? []).map((row) => ({ ...row, id: row.admissionId }))

  const waive = useAction(async () => {
    if (!waiveFor) return null
    return waiveDebt({
      appointmentId: 'appointmentId' in waiveFor ? waiveFor.appointmentId : undefined,
      admissionId: 'admissionId' in waiveFor ? waiveFor.admissionId : undefined,
      note: note.trim(),
    })
  })

  async function confirmWaive() {
    const result = await waive.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('debts.waived'))
    setWaiveFor(null)
    setNote('')
    reload()
  }

  /* ---------------- Ustunlar ---------------- */

  const visitColumns: Column<VisitRow>[] = [
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-label">{row.patientName}</p>
          <p className="truncate text-caption text-label-tertiary">
            {fmtPhone(row.patientPhone)}
          </p>
        </div>
      ),
    },
    {
      key: 'service',
      header: t('common.service'),
      hideBelow: 'md',
      render: (row) => (
        <span className="text-label-secondary">{tService(row.serviceName)}</span>
      ),
    },
    {
      key: 'doctor',
      header: t('common.doctor'),
      hideBelow: 'xl',
      render: (row) => <span className="text-label-secondary">{row.doctorName}</span>,
    },
    {
      key: 'age',
      header: t('debts.age'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <Badge tone={row.daysOverdue >= 30 ? 'bad' : row.daysOverdue >= 7 ? 'warn' : 'neutral'}>
          {t('debts.days', { count: row.daysOverdue })}
        </Badge>
      ),
    },
    {
      key: 'paid',
      header: t('debts.paid'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="tnum text-label-tertiary">
          {money(row.paid)} / {money(row.total)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: t('debts.remaining'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold tnum text-bad">{money(row.remaining)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-56',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => setPayFor(row)}>
            {t('reception.takePayment')}
          </Button>
          {mayWaive ? (
            <Button size="sm" variant="gray" onClick={() => setWaiveFor(row)}>
              {t('debts.waive')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const wardColumns: Column<WardRow>[] = [
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-label">{row.patientName}</p>
          <p className="truncate text-caption text-label-tertiary">
            {fmtPhone(row.patientPhone)}
          </p>
        </div>
      ),
    },
    {
      key: 'room',
      header: t('ward.room'),
      hideBelow: 'md',
      render: (row) => <span className="text-label-secondary">№ {row.roomNumber}</span>,
    },
    {
      key: 'age',
      header: t('debts.age'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <Badge tone={row.daysOverdue >= 30 ? 'bad' : row.daysOverdue >= 7 ? 'warn' : 'neutral'}>
          {t('debts.days', { count: row.daysOverdue })}
        </Badge>
      ),
    },
    {
      key: 'paid',
      header: t('debts.paid'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="tnum text-label-tertiary">
          {money(row.paid)} / {money(row.total)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: t('debts.remaining'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold tnum text-bad">{money(row.remaining)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-56',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {/*
            Statsionar to'lovi Statsionar bo'limidan olinadi — u yerda
            hisob, yotgan kunlar va chiqarish bir joyda turadi. Bu yerda
            takror forma yasash ikkita joyda ikki xil hisob degani.
          */}
          <Link to="/ward">
            <Button size="sm" variant="gray">
              {t('debts.openWard')}
            </Button>
          </Link>
          {mayWaive ? (
            <Button size="sm" variant="gray" onClick={() => setWaiveFor(row)}>
              {t('debts.waive')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const empty = data && data.visits.length === 0 && data.ward.length === 0

  return (
    <>
      <PageHeader
        title={t('debts.title')}
        subtitle={data ? money(data.totals.all) : undefined}
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : loading ? (
        <CardSkeleton />
      ) : empty ? (
        <Card className="flex items-center gap-3 bg-ok-soft">
          <HandCoins size={20} className="shrink-0 text-ok" />
          <span className="text-subhead font-medium text-ok">{t('debts.empty')}</span>
        </Card>
      ) : (
        <div className="space-y-5">
          {data && data.visits.length > 0 ? (
            <Card padded={false}>
              <div className="p-5 pb-3 sm:p-6 sm:pb-3">
                <CardHeader
                  title={t('debts.visits')}
                  action={
                    <span className="font-semibold tnum text-label">
                      {money(data.totals.visits)}
                    </span>
                  }
                />
              </div>
              <DataTable
                rows={visitRows}
                columns={visitColumns}
                emptyState={<EmptyState />}
                renderMobile={(row) => (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-label">{row.patientName}</p>
                      <p className="truncate text-caption text-label-tertiary">
                        {tService(row.serviceName)} ·{' '}
                        {t('debts.days', { count: row.daysOverdue })}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tnum text-bad">
                      {money(row.remaining)}
                    </span>
                  </div>
                )}
              />
            </Card>
          ) : null}

          {data && data.ward.length > 0 ? (
            <Card padded={false}>
              <div className="p-5 pb-3 sm:p-6 sm:pb-3">
                <CardHeader
                  title={t('debts.ward')}
                  action={
                    <span className="font-semibold tnum text-label">
                      {money(data.totals.ward)}
                    </span>
                  }
                />
              </div>
              <DataTable
                rows={wardRows}
                columns={wardColumns}
                emptyState={<EmptyState />}
                renderMobile={(row) => (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-label">{row.patientName}</p>
                      <p className="truncate text-caption text-label-tertiary">
                        № {row.roomNumber} · {t('debts.days', { count: row.daysOverdue })}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tnum text-bad">
                      {money(row.remaining)}
                    </span>
                  </div>
                )}
              />
            </Card>
          ) : null}
        </div>
      )}

      <PaymentFormModal
        open={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        onSaved={reload}
        preset={
          payFor
            ? {
                patientId: payFor.patientId,
                patientName: payFor.patientName,
                doctorId: payFor.doctorId,
                serviceId: payFor.serviceId,
                appointmentId: payFor.appointmentId,
              }
            : null
        }
      />

      <Modal
        open={Boolean(waiveFor)}
        onClose={() => setWaiveFor(null)}
        title={t('debts.waive')}
        description={waiveFor ? waiveFor.patientName : undefined}
        footer={
          <>
            <Button variant="gray" onClick={() => setWaiveFor(null)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={confirmWaive} loading={waive.pending}>
              {t('debts.waive')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-2">
          <p className="text-footnote text-label-secondary">{t('debts.waiveHint')}</p>
          <TextArea
            label={t('debts.waiveNote')}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
