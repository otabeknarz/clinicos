import { ShieldCheck, TriangleAlert } from 'lucide-react'

import { listPharmacyShifts } from '@/api/pharmacy'
import type { PharmacyShift } from '@/types/pharmacy'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateShort, money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * APTEKA KASSA NAZORATI — FAQAT RAHBAR.
 *
 * Mag'zi klinikadagi bilan bir xil: SOTUVNI tizim yozadi, NAQD
 * PULNI sotuvchi sanaydi. Ikki raqamni turli manba bergani uchun
 * ularning farqi haqiqiy signal beradi.
 *
 * Sotuvchi bu sahifani ko'rmaydi. Ko'rsa, farq qanday hisoblanishini
 * o'rganib, uni yopish yo'lini topib olardi.
 */
export function PharmacyCashControlPage() {
  const { t } = useI18n()
  const { data, loading } = useAsync(() => listPharmacyShifts(30), [])
  const rows = data ?? []

  const totalGap = rows.reduce((sum, row) => sum + row.difference, 0)
  const problem = rows.filter((row) => row.difference !== 0).length
  /*
    Sotuvchi ogohlantirishni ko'rib turib kam summa kiritgan
    kunlar. Tasodifiy kamomaddan ALOHIDA sanaladi: birinchisi
    har aptekada bo'ladi, ikkinchisi suhbat talab qiladi.
  */
  const flagged = rows.filter((row) => row.flagged)

  return (
    <div className="space-y-4">
      {flagged.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[12px] bg-bad-soft px-4 py-3">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-bad" />
          <div className="min-w-0">
            <p className="text-subhead font-semibold text-bad">
              {t('pharmacy.flaggedTitle', { count: flagged.length })}
            </p>
            <p className="mt-0.5 text-caption text-label-secondary">
              {t('pharmacy.flaggedHint')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label={t('pharmacy.shiftsClosed')} value={String(rows.length)} />
        <Tile
          label={t('pharmacy.shiftsWithGap')}
          value={String(problem)}
          tone={problem ? 'warn' : undefined}
        />
        <Tile
          label={t('pharmacy.totalGap')}
          value={money(Math.abs(totalGap))}
          hint={
            totalGap === 0
              ? t('pharmacy.gapNone')
              : totalGap < 0
                ? t('pharmacy.gapShort')
                : t('pharmacy.gapOver')
          }
          tone={totalGap === 0 ? undefined : totalGap < 0 ? 'bad' : 'warn'}
        />
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6 sm:pb-4">
          <CardHeader
            title={t('nav.pharmacyCashControl')}
            subtitle={t('pharmacy.cashControlHint')}
            /*
              Farq NIMADAN hisoblanishi sarlavhaning ostida
              yozib qo'yiladi: ustun nomlari qancha aniq
              bo'lmasin, birinchi marta ko'rgan odam baribir
              savol beradi.
            */
          />
        </div>

        <DataTable<PharmacyShift>
          rows={rows}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title={t('pharmacy.noShifts')}
              description={t('pharmacy.noShiftsHint')}
            />
          }
          columns={[
            {
              key: 'date',
              header: t('common.date'),
              render: (row) => (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-label">{dateShort(row.date)}</p>
                    {row.flagged ? (
                      <Badge tone="bad">{t('pharmacy.flaggedBadge')}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-caption text-label-tertiary">
                    {row.sellerName || t('role.pharmacist')} · {row.receipts}{' '}
                    {t('pharmacy.receipts').toLowerCase()}
                    {/* Kassa kimga o'tgani — javobgarlik shu payt ko'chadi */}
                    {row.handedToName
                      ? ` · ${t('pharmacy.handedTo', { name: row.handedToName })}`
                      : ''}
                  </p>
                </div>
              ),
            },
            /*
              USTUNLAR SHUNDAY TARTIBDA VA SHUNDAY NOMLANGAN.

              Ilgari "Tizim bo'yicha" degan ustun turardi va uning
              yonida karta summasi ko'rinardi — odam ikkalasini
              qo'shib, farq noto'g'ri hisoblangan deb o'ylardi.
              Aslida farq FAQAT NAQD pulga tegishli: kartadagi pul
              kassada sanalmaydi, u to'g'ridan-to'g'ri hisobga
              tushadi.

              Endi jami savdo alohida ko'rsatiladi va uning ostida
              "shundan karta" yozuvi turadi — shunda naqd qayerdan
              chiqqani o'z-o'zidan ko'rinadi.
            */
            {
              key: 'total',
              header: t('pharmacy.daySales'),
              align: 'right',
              hideBelow: 'lg',
              render: (row) => (
                <span className="inline-flex flex-col items-end">
                  <span className="tabular-nums text-label-secondary">
                    {money(row.expectedCash + row.cardTotal)}
                  </span>
                  <span className="text-caption text-label-quaternary">
                    {t('pharmacy.ofWhichCard', { sum: money(row.cardTotal) })}
                  </span>
                </span>
              ),
            },
            {
              key: 'expected',
              header: t('pharmacy.expectedCash'),
              align: 'right',
              render: (row) => (
                <span className="tabular-nums text-label-secondary">
                  {money(row.expectedCash)}
                </span>
              ),
            },
            {
              key: 'counted',
              header: t('pharmacy.countedCash'),
              align: 'right',
              render: (row) => (
                <span className="tabular-nums font-medium text-label">
                  {money(row.countedCash)}
                </span>
              ),
            },
            {
              key: 'diff',
              header: t('pharmacy.difference'),
              align: 'right',
              render: (row) => <GapCell row={row} />,
            },
          ]}
          renderMobile={(row) => (
            <div className="min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-label">{dateShort(row.date)}</span>
                  {row.flagged ? (
                    <Badge tone="bad">{t('pharmacy.flaggedBadge')}</Badge>
                  ) : null}
                </span>
                <GapCell row={row} />
              </div>
              <p className="text-caption text-label-tertiary">
                {t('pharmacy.expectedCash')} {money(row.expectedCash)} ·{' '}
                {t('pharmacy.countedCash')} {money(row.countedCash)}
              </p>
              <p className="text-caption text-label-quaternary">
                {t('pharmacy.daySales')} {money(row.expectedCash + row.cardTotal)} ·{' '}
                {t('pharmacy.ofWhichCard', { sum: money(row.cardTotal) })}
              </p>
            </div>
          )}
        />
      </Card>
    </div>
  )
}

/**
 * Farq — MINUS BELGISIZ, yo'nalishi so'z bilan.
 *
 * "−4 000" ni ko'rgan odam bu kamomadmi yoki ortiqchami deb
 * o'ylab qoladi. "4 000 kam" esa o'sha zahoti tushunarli.
 */
function GapCell({ row }: { row: PharmacyShift }) {
  const { t } = useI18n()

  if (row.difference === 0) {
    return <Badge tone="ok">{t('pharmacy.gapNone')}</Badge>
  }

  return (
    <span className="inline-flex flex-col items-end">
      <span
        className={cn(
          'tabular-nums font-semibold',
          row.difference < 0 ? 'text-bad' : 'text-warn',
        )}
      >
        {money(Math.abs(row.difference))}
      </span>
      <span className="text-caption text-label-tertiary">
        {row.difference < 0 ? t('pharmacy.gapShort') : t('pharmacy.gapOver')}
      </span>
    </span>
  )
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'warn' | 'bad'
}) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-callout font-bold tabular-nums sm:text-title-3',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
          !tone && 'text-label',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-caption text-label-quaternary">{hint}</p>
      ) : null}
    </Card>
  )
}
