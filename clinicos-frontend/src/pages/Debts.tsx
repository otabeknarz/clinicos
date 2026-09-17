import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, HandCoins } from 'lucide-react'

import { listDebts, setDebtDue, waiveDebt } from '@/api/debts'
import { DebtCollectModal } from '@/components/modals/DebtCollectModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { addDays, toISODate } from '@/lib/dates'
import { dateShort, money, phone as fmtPhone } from '@/lib/format'
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

  const [payFor, setPayFor] = useState<VisitDebt | WardDebt | null>(null)
  const [waiveFor, setWaiveFor] = useState<VisitDebt | WardDebt | null>(null)
  const [note, setNote] = useState('')
  const [dueFor, setDueFor] = useState<VisitDebt | WardDebt | null>(null)
  const [dueValue, setDueValue] = useState('')
  const [dueSaving, setDueSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'nodue'>('all')

  const mayWaive = can('debts.waive')
  const mayCollect = can('debts.collect')

  /*
    MUDDAT FILTRI. "Muddati o'tgan" — kelishilgan kun o'tib ketgan, ya'ni
    bugun qo'ng'iroq qilish kerak bo'lganlar. "Muddatsiz" — hali hech kim
    bemor bilan gaplashmagan qarzlar.
  */
  const byFilter = (row: VisitDebt | WardDebt) =>
    filter === 'all' ||
    (filter === 'overdue' && row.overdueDays !== null && row.overdueDays > 0) ||
    (filter === 'nodue' && row.dueDate === null)

  function openDue(row: VisitDebt | WardDebt) {
    setDueFor(row)
    setDueValue(row.dueDate ?? toISODate(addDays(new Date(), 7)))
  }

  async function saveDue(value: string | null) {
    if (!dueFor) return
    setDueSaving(true)
    try {
      await setDebtDue({
        appointmentId: 'appointmentId' in dueFor ? dueFor.appointmentId : undefined,
        admissionId: 'admissionId' in dueFor ? dueFor.admissionId : undefined,
        dueDate: value,
      })
      toast.success(t('toast.saved'))
      setDueFor(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('toast.error'))
    } finally {
      setDueSaving(false)
    }
  }

  /** Muddat nishoni — bosilsa muddat oynasi ochiladi */
  const dueCell = (row: VisitDebt | WardDebt) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openDue(row)
      }}
      className="inline-flex"
    >
      {row.dueDate === null ? (
        <Badge tone="neutral">
          <CalendarClock size={12} className="mr-1" />
          {t('debts.setDue')}
        </Badge>
      ) : row.overdueDays !== null && row.overdueDays > 0 ? (
        <Badge tone="bad">{t('debts.overdueBy', { count: row.overdueDays })}</Badge>
      ) : row.overdueDays === 0 ? (
        <Badge tone="warn">{t('debts.dueToday')}</Badge>
      ) : (
        <Badge tone="accent">{t('debts.dueOn', { date: dateShort(row.dueDate) })}</Badge>
      )}
    </button>
  )

  /*
    `DataTable` qatordan `id` talab qiladi (React kaliti uchun).
    Qarzning o'z id'si yo'q — u hisoblanadi, saqlanmaydi. Shuning uchun
    kalit sifatida qabul/yotqizish id'si ishlatiladi: bitta qabulda
    bittadan ortiq qarz bo'lmaydi.
  */
  const visitRows = (data?.visits ?? [])
    .filter(byFilter)
    .map((row) => ({ ...row, id: row.appointmentId }))
  const wardRows = (data?.ward ?? []).filter(byFilter).map((row) => ({ ...row, id: row.admissionId }))

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
      hideBelow: 'xl',
      render: (row) => (
        <Badge tone={row.daysOverdue >= 30 ? 'bad' : row.daysOverdue >= 7 ? 'warn' : 'neutral'}>
          {t('debts.days', { count: row.daysOverdue })}
        </Badge>
      ),
    },
    {
      key: 'due',
      header: t('debts.due'),
      hideBelow: 'md',
      render: dueCell,
    },
    {
      key: 'paid',
      header: t('debts.paid'),
      align: 'right',
      hideBelow: 'xl',
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
          {mayCollect ? (
            <Button size="sm" onClick={() => setPayFor(row)}>
              {t('reception.takePayment')}
            </Button>
          ) : null}
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
      hideBelow: 'xl',
      render: (row) => (
        <Badge tone={row.daysOverdue >= 30 ? 'bad' : row.daysOverdue >= 7 ? 'warn' : 'neutral'}>
          {t('debts.days', { count: row.daysOverdue })}
        </Badge>
      ),
    },
    {
      key: 'due',
      header: t('debts.due'),
      hideBelow: 'md',
      render: dueCell,
    },
    {
      key: 'paid',
      header: t('debts.paid'),
      align: 'right',
      hideBelow: 'xl',
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
          {mayCollect ? (
            <Button size="sm" onClick={() => setPayFor(row)}>
              {t('reception.takePayment')}
            </Button>
          ) : (
            <Link to="/ward">
              <Button size="sm" variant="gray">
                {t('debts.openWard')}
              </Button>
            </Link>
          )}
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
          <FilterPills<'all' | 'overdue' | 'nodue'>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('common.all') },
              {
                value: 'overdue',
                label: `${t('debts.filterOverdue')} (${
                  [...(data?.visits ?? []), ...(data?.ward ?? [])].filter(
                    (r) => r.overdueDays !== null && r.overdueDays > 0,
                  ).length
                })`,
              },
              { value: 'nodue', label: t('debts.filterNoDue') },
            ]}
          />
          {visitRows.length === 0 && wardRows.length === 0 ? (
            <Card>
              <EmptyState title={t('debts.filterEmpty')} />
            </Card>
          ) : null}
          {data && visitRows.length > 0 ? (
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
                      <div className="mt-1">{dueCell(row)}</div>
                    </div>
                    <span className="shrink-0 font-semibold tnum text-bad">
                      {money(row.remaining)}
                    </span>
                  </div>
                )}
              />
            </Card>
          ) : null}

          {data && wardRows.length > 0 ? (
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
                      <div className="mt-1">{dueCell(row)}</div>
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

      <DebtCollectModal debt={payFor} onClose={() => setPayFor(null)} onSaved={reload} />

      <Modal
        open={dueFor !== null}
        onClose={() => setDueFor(null)}
        title={t('debts.dueTitle')}
        description={dueFor ? `${dueFor.patientName} · ${money(dueFor.remaining)}` : undefined}
        footer={
          <>
            {dueFor?.dueDate ? (
              <Button variant="gray" onClick={() => saveDue(null)} disabled={dueSaving}>
                {t('debts.clearDue')}
              </Button>
            ) : null}
            <Button onClick={() => saveDue(dueValue || null)} loading={dueSaving} disabled={!dueValue}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-2">
          <TextInput
            label={t('debts.dueLabel')}
            type="date"
            value={dueValue}
            hint={t('debts.dueHint')}
            onChange={(e) => setDueValue(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {[3, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDueValue(toISODate(addDays(new Date(), days)))}
                className="h-8 rounded-full bg-fill-4 px-3 text-caption font-medium text-label-secondary hover:text-label"
              >
                {t('debts.inDays', { count: days })}
              </button>
            ))}
          </div>
        </div>
      </Modal>

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
