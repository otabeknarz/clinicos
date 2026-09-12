import { useState } from 'react'
import { Check, Copy, Download, Link2, Trash2 } from 'lucide-react'

import {
  createExportLink,
  downloadExport,
  listExportDatasets,
  listExportLinks,
  revokeExportLink,
} from '@/api/exports'
import { API_BASE } from '@/api/client'
import { GoogleSheetsCard } from '@/components/data/GoogleSheetsCard'
import { ImportCard } from '@/components/data/ImportCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select, TextInput } from '@/components/ui/Form'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { dateShort } from '@/lib/format'
import { DATED_DATASETS, EXPORT_DATASETS } from '@/lib/exportDatasets'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

/**
 * MA'LUMOT ALMASHISH.
 *
 * Excel'da ishlaydigan biznes uchun eng qisqa yo'l: bo'limni tanlab,
 * faylni yuklab olish. Google Sheets esa havola orqali O'ZI o'qiydi —
 * jadval har ochilganda yangilanadi, hech kim qo'lda ko'chirmaydi.
 *
 * Bo'limlar ro'yxati SERVERDAN keladi: kimda qaysi ruxsat borligini
 * server hal qiladi, interfeys esa faqat chizadi.
 */
export function DataExchangePage() {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /*
    QAYSI bo'lim yuklanayotgani. Ilgari `pending` bitta edi va bitta
    tugma bosilganda HAMMA tugma "yuklanmoqda" bo'lib qolardi —
    tashqaridan qaraganda hammasi birdan yuklanayotgandek ko'rinardi.
  */
  const [busy, setBusy] = useState<string | null>(null)

  const datasets = useAsync(listExportDatasets, [])
  const links = useAsync(listExportLinks, [])

  const allowed = (datasets.data ?? [])
    .map((row) => EXPORT_DATASETS.find((d) => d.key === row.key))
    .filter((d): d is (typeof EXPORT_DATASETS)[number] => Boolean(d) && can(d!.permission))

  const download = useAction(async (key: string) => {
    await downloadExport(key, {
      from: DATED_DATASETS.has(key) ? from || undefined : undefined,
      to: DATED_DATASETS.has(key) ? to || undefined : undefined,
    })
  })

  async function runDownload(key: string) {
    setBusy(key)
    const ok = await download.run(key)
    setBusy(null)
    if (ok === null) {
      toast.error(download.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('exchange.downloaded'))
  }

  return (
    <>
      <PageHeader title={t('exchange.title')} subtitle={t('exchange.subtitle')} />

      {datasets.error ? <ErrorState onRetry={datasets.reload} /> : null}

      {/* --- Fayl qilib yuklash --- */}
      <Card className="mb-5">
        <CardHeader title={t('exchange.export.title')} subtitle={t('exchange.export.hint')} />

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
          <p className="text-caption text-label-tertiary">{t('exchange.rangeHint')}</p>
        </div>

        {allowed.length === 0 && !datasets.loading ? (
          <EmptyState title={t('exchange.empty')} />
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {allowed.map((dataset) => (
              <li
                key={dataset.key}
                className="flex items-center justify-between gap-3 rounded-[14px] bg-sunken px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-subhead font-medium text-label">
                    {t(`dataset.${dataset.key}`)}
                  </p>
                  {DATED_DATASETS.has(dataset.key) ? (
                    <p className="text-caption text-label-tertiary">{t('exchange.dated')}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="gray"
                  icon={<Download size={15} />}
                  loading={busy === dataset.key}
                  disabled={busy !== null && busy !== dataset.key}
                  onClick={() => void runDownload(dataset.key)}
                >
                  {t('exchange.download')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --- Excel'dan ko'chirish --- */}
      {can('data.import') ? <ImportCard /> : null}

      {/* --- Google Sheets: hisob ulanadi, jadval o'zi yangilanadi --- */}
      <GoogleSheetsCard
        datasets={allowed.filter((d) => d.sheet)}
        range={{ from: from || undefined, to: to || undefined }}
      />

      {/*
        MAXFIY HAVOLA — boshqa yo'l.

        Google hisobisiz ham ishlaydi (`=IMPORTDATA`), lekin
        tushuntirish talab qiladi va havola qo'ldan-qo'lga o'tib
        ketishi mumkin. Shuning uchun u yopiq bo'limda turadi:
        kerak bo'lganlar ochadi, qolganlar ko'rmaydi ham.
      */}
      <details className="mt-5">
        <summary className="cursor-pointer text-footnote text-label-secondary">
          {t('exchange.sheets.advanced')}
        </summary>
        <div className="mt-3">
          <SheetsCard
            datasets={allowed.filter((d) => d.sheet)}
            links={links.data ?? []}
            onChanged={links.reload}
          />
        </div>
      </details>
    </>
  )
}

/* ------------------------------------------------------------------ */

function SheetsCard({
  datasets,
  links,
  onChanged,
}: {
  datasets: (typeof EXPORT_DATASETS)[number][]
  links: Awaited<ReturnType<typeof listExportLinks>>
  onChanged: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [dataset, setDataset] = useState('')
  /* Ro'yxat keyinroq keladi — tanlov shu sababli hisoblab olinadi */
  const selected = dataset || datasets[0]?.key || ''
  /* Yangi havola — FAQAT shu yerda ko'rinadi, keyin qayta ko'rsatilmaydi */
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useAction(async (key: string) => createExportLink({ dataset: key }))
  const revoke = useAction(async (id: string) => revokeExportLink(id))

  async function submit() {
    if (!selected) return
    const key = selected
    const created = await create.run(key)
    if (!created) {
      toast.error(create.lastError()?.message ?? t('toast.error'))
      return
    }
    setFresh(`${API_BASE}${created.path}`)
    setCopied(false)
    onChanged()
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t('exchange.sheets.copied'))
    } catch {
      toast.error(t('exchange.sheets.copyFailed'))
    }
  }

  async function drop(id: string) {
    await revoke.run(id)
    toast.success(t('exchange.sheets.revoked'))
    onChanged()
  }

  if (datasets.length === 0) return null

  return (
    <Card>
      <CardHeader title={t('exchange.sheets.title')} subtitle={t('exchange.sheets.hint')} />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Select
          label={t('exchange.sheets.dataset')}
          value={selected}
          onChange={(e) => setDataset(e.target.value)}
          options={datasets.map((d) => ({ value: d.key, label: t(`dataset.${d.key}`) }))}
          className="w-64"
        />
        <Button icon={<Link2 size={16} />} loading={create.pending} onClick={() => void submit()}>
          {t('exchange.sheets.create')}
        </Button>
      </div>

      {fresh ? (
        <div className="mt-4 rounded-[14px] bg-accent-soft p-4">
          <p className="text-footnote font-medium text-label">{t('exchange.sheets.oneTime')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[10px] bg-raised px-3 py-2 text-caption text-label">
              {fresh}
            </code>
            <IconButton label={t('action.copy')} onClick={() => void copy(fresh)}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </IconButton>
          </div>
          <p className="mt-3 text-caption text-label-secondary">{t('exchange.sheets.formula')}</p>
          <code className="mt-1 block truncate rounded-[10px] bg-raised px-3 py-2 text-caption text-label">
            =IMPORTDATA("{fresh}")
          </code>
        </div>
      ) : null}

      {links.length === 0 ? (
        <p className="mt-4 text-footnote text-label-tertiary">{t('exchange.sheets.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-3 rounded-[14px] bg-sunken px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-medium text-label">
                  {t(`dataset.${link.dataset}`)}
                </p>
                <p className="text-caption text-label-tertiary">
                  {link.createdByName} · {t('exchange.sheets.expires')} {dateShort(link.expiresAt)} ·{' '}
                  {t('exchange.sheets.used', { count: link.useCount })}
                </p>
              </div>
              {link.revoked ? (
                <Badge tone="neutral">{t('exchange.sheets.revokedBadge')}</Badge>
              ) : (
                <IconButton
                  label={t('exchange.sheets.revoke')}
                  onClick={() => void drop(link.id)}
                  disabled={revoke.pending}
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
