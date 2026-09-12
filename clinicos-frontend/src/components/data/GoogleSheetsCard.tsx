import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Unlink } from 'lucide-react'

import {
  googleConnectUrl,
  googleDisconnect,
  googleStatus,
  listGoogleSheets,
  syncGoogleSheet,
} from '@/api/google'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { dateTime } from '@/lib/format'
import type { EXPORT_DATASETS } from '@/lib/exportDatasets'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * GOOGLE SHEETS.
 *
 * Bir marta ulanadi — keyin har bo'lim bitta bosishda jadvalga
 * ketadi. Jadval KLINIKANING Drive'ida yaratiladi: ma'lumot
 * ularniki bo'lib qoladi, bizda faqat manzili saqlanadi.
 *
 * Ulash oynada ochiladi va yopilgach holat qayta o'qiladi: Google
 * bizning sahifamizga qaytmaydi, shuning uchun "ulandingizmi" deb
 * so'rab turishdan boshqa yo'l yo'q.
 */
export function GoogleSheetsCard({
  datasets,
  range,
}: {
  datasets: (typeof EXPORT_DATASETS)[number][]
  range: { from?: string; to?: string }
}) {
  const { t } = useI18n()
  const toast = useToast()

  const status = useAsync(googleStatus, [])
  const sheets = useAsync(listGoogleSheets, [status.data?.connected])

  const [busy, setBusy] = useState<string | null>(null)
  const connect = useAction(googleConnectUrl)
  const disconnect = useAction(googleDisconnect)
  const sync = useAction(async (dataset: string) => syncGoogleSheet(dataset, range))

  /*
    Ulash oynasi yopilganda holatni qayta so'raymiz. Oyna boshqa
    domenda bo'lgani uchun uning ichidagi voqeani eshitib bo'lmaydi —
    faqat "yopildimi" degan savolga javob bor.
  */
  const [popup, setPopup] = useState<Window | null>(null)
  useEffect(() => {
    if (!popup) return
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        setPopup(null)
        status.reload()
      }
    }, 800)
    return () => clearInterval(timer)
  }, [popup, status])

  async function startConnect() {
    const result = await connect.run()
    if (!result) {
      toast.error(connect.lastError()?.message ?? t('toast.error'))
      return
    }
    setPopup(window.open(result.url, 'clinicos-google', 'width=520,height=680'))
  }

  async function runSync(dataset: string) {
    setBusy(dataset)
    const result = await sync.run(dataset)
    setBusy(null)
    if (!result) {
      toast.error(sync.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('google.synced', { count: result.rows }))
    sheets.reload()
  }

  async function drop() {
    await disconnect.run()
    toast.success(t('google.disconnected'))
    status.reload()
    sheets.reload()
  }

  const info = status.data

  return (
    <Card className="mt-5">
      <CardHeader
        title={t('google.title')}
        subtitle={t('google.hint')}
        action={
          info?.connected ? (
            <IconButton label={t('google.disconnect')} onClick={() => void drop()}>
              <Unlink size={16} />
            </IconButton>
          ) : null
        }
      />

      {/* --- Serverda sozlanmagan --- */}
      {info && !info.configured ? (
        <p className="mt-4 rounded-[14px] bg-sunken px-4 py-3 text-footnote text-label-secondary">
          {t('google.notConfigured')}
        </p>
      ) : null}

      {/* --- Ulanmagan --- */}
      {info?.configured && !info.connected ? (
        <div className="mt-4">
          <Button loading={connect.pending} onClick={() => void startConnect()}>
            {t('google.connect')}
          </Button>
          <p className="mt-2 text-caption text-label-tertiary">{t('google.connectHint')}</p>
        </div>
      ) : null}

      {/* --- Ulangan --- */}
      {info?.connected ? (
        <>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-subhead text-label">
            <span className="rounded-full bg-ok-soft px-2.5 py-1 text-caption font-medium text-ok">
              {t('google.connected')}
            </span>
            {info.email}
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {datasets.map((dataset) => {
              const sheet = (sheets.data ?? []).find((row) => row.dataset === dataset.key)
              return (
                <li
                  key={dataset.key}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-sunken px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-subhead font-medium text-label">
                      {t(`dataset.${dataset.key}`)}
                    </p>
                    {sheet ? (
                      <p className="truncate text-caption text-label-tertiary">
                        {t('google.lastSync', { count: sheet.rows })} · {dateTime(sheet.lastSyncAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {sheet ? (
                      <a
                        href={sheet.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-label-secondary transition-colors hover:bg-fill-4 hover:text-label"
                        aria-label={t('google.open')}
                      >
                        <ExternalLink size={16} />
                      </a>
                    ) : null}
                    <Button
                      size="sm"
                      variant="gray"
                      icon={<RefreshCw size={15} />}
                      loading={busy === dataset.key}
                      disabled={busy !== null && busy !== dataset.key}
                      onClick={() => void runSync(dataset.key)}
                    >
                      {sheet ? t('google.update') : t('google.send')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </Card>
  )
}
