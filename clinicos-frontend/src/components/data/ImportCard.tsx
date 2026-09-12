import { useRef, useState } from 'react'
import { CheckCircle2, FileUp, Upload } from 'lucide-react'

import { applyImport, listImportDatasets, previewImport } from '@/api/imports'
import type { ImportPreview } from '@/api/imports'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { downloadCsv } from '@/lib/csv'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * EXCEL'DAN KO'CHIRISH.
 *
 * Ketma-ketlik ataylab uch qadam:
 *
 *   1. NAMUNA FAYL — odam bizning ustunlarimizni taxmin qilib
 *      o'tirmasin. Yuklab oladi, o'z ma'lumotini yozadi.
 *   2. TEKSHIRISH — nechta qator tayyor, qaysi qatorda nima xato.
 *      Bazaga hali hech narsa yozilmaydi.
 *   3. YUKLASH — faqat to'g'ri qatorlar yoziladi, takrorlar
 *      o'tkazib yuboriladi.
 */
export function ImportCard() {
  const { t } = useI18n()
  const toast = useToast()

  const datasets = useAsync(listImportDatasets, [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [dataset, setDataset] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const rows = datasets.data ?? []
  const selected = dataset || rows[0]?.key || ''
  const columns = rows.find((row) => row.key === selected)?.columns ?? []

  const check = useAction(async (key: string, source: File) => previewImport(key, source))
  const send = useAction(async (key: string, source: File) => applyImport(key, source))

  function pickFile(next: File | null) {
    setFile(next)
    setPreview(null)
  }

  async function runCheck() {
    if (!file || !selected) return
    const result = await check.run(selected, file)
    if (!result) {
      toast.error(check.lastError()?.message ?? t('toast.error'))
      return
    }
    setPreview(result)
  }

  async function runApply() {
    if (!file || !selected) return
    const result = await send.run(selected, file)
    if (!result) {
      toast.error(send.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('import.done', { count: result.created }))
    setPreview(null)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  /** Namuna fayl: sarlavhalar va bitta to'ldirilgan qator */
  function template() {
    if (columns.length === 0) return
    downloadCsv(`${selected}-namuna.csv`, [
      columns.map((column) => column.header),
      columns.map((column) => column.example),
    ])
  }

  if (rows.length === 0) return null

  return (
    <Card className="mt-5">
      <CardHeader title={t('import.title')} subtitle={t('import.hint')} />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Select
          label={t('import.dataset')}
          value={selected}
          onChange={(e) => {
            setDataset(e.target.value)
            pickFile(null)
          }}
          options={rows.map((row) => ({ value: row.key, label: t(`dataset.${row.key}`) }))}
          className="w-64"
        />
        <Button variant="gray" icon={<FileUp size={16} />} onClick={template}>
          {t('import.template')}
        </Button>
      </div>

      {/* --- Kutilayotgan ustunlar --- */}
      <ul className="mt-4 flex flex-wrap gap-2">
        {columns.map((column) => (
          <li key={column.field}>
            <Badge tone={column.required ? 'accent' : 'neutral'}>
              {column.header}
              {column.required ? ' *' : ''}
            </Badge>
          </li>
        ))}
      </ul>

      {/* --- Fayl --- */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="text-footnote text-label-secondary file:mr-3 file:rounded-[10px] file:border-0 file:bg-fill-4 file:px-3 file:py-2 file:text-footnote file:font-medium file:text-label"
        />
        <Button
          variant="gray"
          loading={check.pending}
          disabled={!file}
          onClick={() => void runCheck()}
        >
          {t('import.check')}
        </Button>
        <Button
          icon={<Upload size={16} />}
          loading={send.pending}
          disabled={!preview || preview.ready === 0}
          onClick={() => void runApply()}
        >
          {t('import.apply')}
        </Button>
      </div>

      <p className="mt-2 text-caption text-label-tertiary">{t('import.csvOnly')}</p>

      {/* --- Tekshiruv natijasi --- */}
      {preview ? (
        <div className="mt-4 rounded-[14px] bg-sunken p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-subhead text-label">
              <CheckCircle2 size={16} className="text-ok" />
              {t('import.ready', { count: preview.ready })}
            </span>
            <span className="text-subhead text-label-secondary">
              {t('import.total', { count: preview.total })}
            </span>
          </div>

          {preview.errors.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {preview.errors.slice(0, 10).map((error, index) => (
                <li key={`${error.row}-${index}`} className="text-caption text-bad">
                  {error.row > 0 ? `${error.row}-qator: ` : ''}
                  {error.message}
                </li>
              ))}
              {preview.errors.length > 10 ? (
                <li className="text-caption text-label-tertiary">
                  {t('import.moreErrors', { count: preview.errors.length - 10 })}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
