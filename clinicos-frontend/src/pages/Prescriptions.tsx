import { useState } from 'react'
import { Check, Pill, Plus, RefreshCw, Trash2, X } from 'lucide-react'

import {
  cancelPrescription,
  createPrescription,
  listPrescriptions,
  rxOffers,
} from '@/api/prescriptions'
import type { Prescription, RxItem, RxOffer, RxStatus } from '@/api/prescriptions'
import { PageHeader } from '@/components/layout/PageHeader'
import { PatientPicker } from '@/components/pickers/PatientPicker'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextArea, TextInput } from '@/components/ui/Form'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { FilterPills } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { dateTime, money } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * ONLAYN RETSEPT.
 *
 * Shifokor dorilarni yozadi, tizim APTEKALARNI TAKLIF QILADI va
 * bittasi tanlanadi. Bemor aptekaga borib qisqa kodni aytadi.
 *
 * APTEKA QO'LDA TERILMAYDI. Ro'yxatni har safar server tuzadi:
 * oxirgi yuborilganlar chetda qoladi va tartib tasodifiy bo'ladi.
 * Sabab — onlayn retseptning tabiiy xavfi bitta apteka bilan
 * "kelishib" olishda: bemor tanlovsiz qoladi, narx esa kelishuvga
 * qarab qo'yiladi.
 *
 * NARX OLDINDAN KO'RINADI: har bir taklifda o'sha aptekaning o'z
 * narxlari bo'yicha summa turadi. Shifokor ham, bemor ham qancha
 * bo'lishini bilib turadi.
 */
const STATUSES: (RxStatus | 'all')[] = ['all', 'sent', 'ready', 'dispensed', 'cancelled']

const STATUS_TONE: Record<RxStatus, Tone> = {
  sent: 'accent',
  ready: 'warn',
  dispensed: 'ok',
  cancelled: 'neutral',
}

export function PrescriptionsPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [status, setStatus] = useState<RxStatus | 'all'>('all')
  const [version, setVersion] = useState(0)

  const { data, loading, error, reload } = useAsync(
    () => listPrescriptions(status),
    [status, version],
  )

  return (
    <>
      <PageHeader title={t('rx.title')} subtitle={t('rx.subtitle')} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <RxForm onSent={() => setVersion((v) => v + 1)} />

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
              icon={<Pill size={24} strokeWidth={1.75} />}
              title={t('rx.empty')}
              className="py-12"
            />
          ) : (
            <ul>
              {data.map((rx) => (
                <RxRow
                  key={rx.id}
                  rx={rx}
                  onCancelled={() => {
                    toast.success(t('toast.saved'))
                    setVersion((v) => v + 1)
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Yozish                                                             */
/* ------------------------------------------------------------------ */

function RxForm({ onSent }: { onSent: () => void }) {
  const { t } = useI18n()
  const toast = useToast()

  const [patientId, setPatientId] = useState<string | null>(null)
  const [items, setItems] = useState<RxItem[]>([{ name: '', qty: 1, note: '' }])
  const [note, setNote] = useState('')

  const [offers, setOffers] = useState<RxOffer[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const filled = items.filter((item) => item.name.trim().length > 0)
  const canOffer = filled.length > 0

  function setItem(index: number, patch: Partial<RxItem>) {
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    /* Dorilar o'zgardi — eski narxlar endi to'g'ri emas */
    setOffers(null)
    setChosen(null)
  }

  async function loadOffers() {
    setBusy(true)
    try {
      const list = await rxOffers(filled)
      setOffers(list)
      setChosen(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!chosen || !offers) return
    setBusy(true)
    try {
      const created = await createPrescription({
        items: filled,
        pharmacyId: chosen,
        offeredIds: offers.map((offer) => offer.pharmacyId),
        patientId: patientId ?? undefined,
        note: note.trim() || undefined,
      })
      toast.success(t('rx.sentWithCode', { code: created.code }))
      setItems([{ name: '', qty: 1, note: '' }])
      setNote('')
      setOffers(null)
      setChosen(null)
      onSent()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="self-start">
      <h2 className="text-headline font-semibold text-label">{t('rx.new')}</h2>

      <div className="mt-4 space-y-4">
        <PatientPicker value={patientId} onChange={setPatientId} />

        <Field label={t('rx.items')}>
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <TextInput
                  fieldClassName="flex-1"
                  placeholder={t('rx.medicine')}
                  value={item.name}
                  onChange={(event) => setItem(index, { name: event.target.value })}
                />
                <TextInput
                  fieldClassName="w-20"
                  type="number"
                  min={1}
                  value={String(item.qty)}
                  onChange={(event) =>
                    setItem(index, { qty: Number(event.target.value) || 1 })
                  }
                />
                {items.length > 1 ? (
                  <IconButton
                    label={t('action.delete')}
                    className="mt-1 hover:text-bad"
                    onClick={() => {
                      setItems((list) => list.filter((_, i) => i !== index))
                      setOffers(null)
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                ) : null}
              </li>
            ))}
          </ul>

          <Button
            variant="gray"
            size="sm"
            className="mt-2"
            icon={<Plus size={15} />}
            onClick={() => setItems((list) => [...list, { name: '', qty: 1, note: '' }])}
          >
            {t('rx.addItem')}
          </Button>
        </Field>

        <TextArea
          label={t('rx.note')}
          rows={2}
          placeholder={t('rx.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* --- Aptekalar --- */}
        {offers === null ? (
          <Button
            block
            disabled={!canOffer}
            loading={busy}
            icon={<RefreshCw size={15} />}
            onClick={() => void loadOffers()}
          >
            {t('rx.findPharmacies')}
          </Button>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-footnote font-medium text-label">{t('rx.choosePharmacy')}</p>
              <Button variant="gray" size="sm" loading={busy} onClick={() => void loadOffers()}>
                <RefreshCw size={13} />
                {t('rx.reshuffle')}
              </Button>
            </div>

            {/*
              RO'YXAT HAR SAFAR YANGI. Shu yozuv ataylab turadi:
              tanlov tasodifiy ekanini shifokor ham bilib tursin.
            */}
            <p className="mt-1 text-caption text-label-tertiary">{t('rx.rotationHint')}</p>

            <ul className="mt-3 space-y-2">
              {offers.map((offer) => (
                <li key={offer.pharmacyId}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-[14px] border p-3 text-left transition-colors duration-200',
                      chosen === offer.pharmacyId
                        ? 'border-accent bg-accent-soft'
                        : 'border-separator bg-sunken hover:border-accent/40',
                    )}
                    onClick={() => setChosen(offer.pharmacyId)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-subhead font-medium text-label">
                          {offer.name}
                        </span>
                        <span className="block truncate text-caption text-label-tertiary">
                          {offer.address || offer.phone}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-subhead font-semibold tnum text-label">
                          {money(offer.total)}
                        </span>
                        <span
                          className={cn(
                            'block text-caption tnum',
                            offer.availableCount === offer.itemCount
                              ? 'text-ok'
                              : 'text-warn',
                          )}
                        >
                          {t('rx.available', {
                            have: offer.availableCount,
                            all: offer.itemCount,
                          })}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <Button
              block
              className="mt-3"
              disabled={!chosen}
              loading={busy}
              onClick={() => void send()}
            >
              {t('rx.send')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function RxRow({ rx, onCancelled }: { rx: Prescription; onCancelled: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function cancel() {
    setBusy(true)
    try {
      await cancelPrescription(rx.id)
      onCancelled()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="hairline px-5 py-4 last:border-b-0 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-subhead font-medium text-label">{rx.patientName || '—'}</span>
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
            {rx.pharmacyName}
            {rx.estimatedTotal > 0 ? ` · ${money(rx.estimatedTotal)}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Kod — bemor aptekada shuni aytadi */}
          <span className="rounded-[10px] bg-fill-4 px-2.5 py-1 text-footnote font-semibold tnum tracking-wider text-label">
            {rx.code}
          </span>

          {rx.status === 'sent' || rx.status === 'ready' ? (
            <IconButton label={t('action.cancel')} className="hover:text-bad" onClick={cancel}>
              {busy ? <RefreshCw size={15} className="animate-spin" /> : <X size={15} />}
            </IconButton>
          ) : rx.status === 'dispensed' ? (
            <Check size={16} className="text-ok" />
          ) : null}
        </div>
      </div>
    </li>
  )
}
