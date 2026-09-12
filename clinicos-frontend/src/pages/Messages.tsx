import { useState } from 'react'
import { Check, Send, Users } from 'lucide-react'

import { listPatients } from '@/api/patients'
import { broadcastAudience, listBroadcasts, sendBroadcast } from '@/api/notices'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { SearchInput, TextArea, TextInput } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/States'
import { FilterPills } from '@/components/ui/Tabs'
import { dateTime } from '@/lib/format'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

const MAX_LENGTH = 600

/**
 * BEMORLARGA XABAR.
 *
 * Ikki yo'l bilan yuboriladi:
 *
 *   1. QABULGA YOZILGANLARGA — sana oralig'idagi barcha bemorga.
 *      "Ertaga svet bo'lmaydi", "shifokor kasal bo'lib qoldi" kabi
 *      xabar aynan shu odamlarga kerak.
 *   2. TANLANGANLARGA — qidirib, belgilab olinadi.
 *
 * "Hamma bemorga" degan tugma ATAYLAB yo'q: klinikada yillar
 * davomida yig'ilgan minglab yozuv bor va ularning hammasiga
 * yuborilgan xabar reklamaga aylanadi — natijada odamlar botni
 * bloklaydi va haqiqiy eslatma ham yetib bormay qoladi.
 */
export function MessagesPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [scope, setScope] = useState<'appointments' | 'patients'>('appointments')
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(addDays(today(), 7))
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  const audience = useAsync(
    () =>
      scope === 'appointments'
        ? broadcastAudience('appointments', { from, to })
        : Promise.resolve({ total: Object.keys(selected).length, telegram: 0 }),
    [scope, from, to, Object.keys(selected).length],
  )

  const history = useAsync(listBroadcasts, [])

  const send = useAction(async () =>
    sendBroadcast({
      text: text.trim(),
      scope,
      ...(scope === 'appointments'
        ? { from, to }
        : { patientIds: Object.keys(selected) }),
    }),
  )

  const count = scope === 'appointments' ? (audience.data?.total ?? 0) : Object.keys(selected).length
  const ready = text.trim().length >= 5 && count > 0

  async function submit() {
    const result = await send.run()
    setConfirming(false)
    if (!result) {
      toast.error(send.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('messages.sent', { count: result.total }))
    setText('')
    setSelected({})
    history.reload()
  }

  return (
    <>
      <PageHeader title={t('messages.title')} subtitle={t('messages.subtitle')} />

      <Card className="mb-5">
        <CardHeader title={t('messages.audience')} subtitle={t('messages.audienceHint')} />

        <div className="mt-4">
          <FilterPills
            value={scope}
            onChange={(next) => setScope(next as 'appointments' | 'patients')}
            options={[
              { value: 'appointments', label: t('messages.scope.appointments') },
              { value: 'patients', label: t('messages.scope.patients') },
            ]}
          />
        </div>

        {scope === 'appointments' ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <TextInput
              label={t('exchange.from')}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              fieldClassName="w-44"
            />
            <TextInput
              label={t('exchange.to')}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              fieldClassName="w-44"
            />
          </div>
        ) : (
          <PatientPicker selected={selected} onChange={setSelected} />
        )}

        <p className="mt-4 flex items-center gap-2 text-subhead text-label">
          <Users size={16} className="text-accent" />
          {t('messages.count', { count })}
          {scope === 'appointments' && audience.data ? (
            <span className="text-footnote text-label-tertiary">
              {t('messages.telegramCount', { count: audience.data.telegram })}
            </span>
          ) : null}
        </p>
      </Card>

      <Card className="mb-5">
        <CardHeader title={t('messages.text')} subtitle={t('messages.textHint')} />

        <div className="mt-4">
          <TextArea
            rows={5}
            value={text}
            maxLength={MAX_LENGTH}
            placeholder={t('messages.placeholder')}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-caption text-label-tertiary">
              {text.length} / {MAX_LENGTH}
            </span>
            <Button
              icon={<Send size={16} />}
              disabled={!ready}
              loading={send.pending}
              onClick={() => setConfirming(true)}
            >
              {t('messages.send')}
            </Button>
          </div>
        </div>
      </Card>

      {/* --- Tarix --- */}
      <Card>
        <CardHeader title={t('messages.history')} />
        {history.data && history.data.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {history.data.map((record, index) => (
              <li key={`${record.sentAt}-${index}`} className="rounded-[14px] bg-sunken px-4 py-3">
                <p className="whitespace-pre-wrap text-subhead text-label">{record.text}</p>
                <p className="mt-1 text-caption text-label-tertiary">
                  {dateTime(record.sentAt)} · {record.sentBy} ·{' '}
                  {t('messages.delivered', { count: record.delivered, total: record.total })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('messages.noHistory')} />
        )}
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void submit()}
        danger={false}
        title={t('messages.confirmTitle')}
        description={t('messages.confirmText', { count })}
        confirmLabel={t('messages.send')}
        pending={send.pending}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

/** Bemorlarni qidirib, belgilab olish */
function PatientPicker({
  selected,
  onChange,
}: {
  selected: Record<string, string>
  onChange: (next: Record<string, string>) => void
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search, 250)

  const { data } = useAsync(
    () => listPatients({ search: debounced, page: 1, pageSize: 20 }),
    [debounced],
  )

  function toggle(id: string, name: string) {
    const next = { ...selected }
    if (next[id]) delete next[id]
    else next[id] = name
    onChange(next)
  }

  return (
    <div className="mt-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('messages.searchPatient')}
      />

      {Object.keys(selected).length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(selected).map(([id, name]) => (
            <li key={id}>
              <button type="button" onClick={() => toggle(id, name)}>
                <Badge tone="accent">{name} ✕</Badge>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto scroll-slim">
        {(data?.items ?? []).map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              onClick={() => toggle(patient.id, patient.fullName)}
              className="flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-fill-4"
            >
              <span className="min-w-0">
                <span className="block truncate text-subhead text-label">{patient.fullName}</span>
                <span className="block text-caption text-label-tertiary">{patient.phone}</span>
              </span>
              {selected[patient.id] ? <Check size={16} className="text-accent" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function today(): string {
  return toInput(new Date())
}

function addDays(value: string, days: number): string {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return toInput(date)
}

function toInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
