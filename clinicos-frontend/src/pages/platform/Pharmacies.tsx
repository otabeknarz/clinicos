import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Pause, Pencil, Pill, Play, Plus, TriangleAlert } from 'lucide-react'

import { USE_MOCK } from '@/api/client'
import { activatePharmacy, listPharmacies } from '@/api/platformPharmacy'
import type { PharmacyOverview } from '@/api/platformPharmacy'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { dateRelative, money, moneyShort } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import {
  EditPharmacyModal,
  NewPharmacyModal,
  PharmacyNotConnected,
  ResetPharmacyOwnerModal,
  SuspendPharmacyModal,
} from './PharmacyModals'

type StatusFilter = 'all' | 'active' | 'suspended'

/** Shuncha kun savdo bo'lmasa — apteka "jim" hisoblanadi */
const IDLE_DAYS = 3

/**
 * APTEKALAR — platformaning alohida bo'limi.
 *
 * Klinikalar ro'yxatiga QO'SHILMAGAN va ataylab: apteka boshqa
 * biznes, uni boshqa ko'rsatkichlar bilan kuzatish kerak. Klinikada
 * "nechta shifokor, nechta bemor" muhim, aptekada esa "kassa to'g'ri
 * topshirilyaptimi, javonda muddati o'tgan dori yo'qmi".
 *
 * TEPADA — "E'TIBOR KERAK". Platforma egasi har kuni yuzta qatorni
 * ko'zdan kechirmaydi. Unga kerakli savol: "qaysi aptekada nimadir
 * noto'g'ri?" — javob ro'yxatdan oldin, o'z so'zlari bilan turadi.
 */
export function PlatformPharmaciesPage() {
  /* Server qismi yozilguncha — demo raqamlar haqiqiydek ko'rinmasin */
  if (!USE_MOCK) return <PharmacyNotConnected />
  return <PharmaciesScreen />
}

function PharmaciesScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('platform.manage')

  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const { data, loading, error, reload } = useAsync(() => listPharmacies(), [version])
  const all = useMemo(() => data ?? [], [data])

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PharmacyOverview | null>(null)
  const [suspending, setSuspending] = useState<PharmacyOverview | null>(null)
  const [resetting, setResetting] = useState<PharmacyOverview | null>(null)

  const refresh = () => setVersion((v) => v + 1)

  const rows = all.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      row.name.toLowerCase().includes(q) ||
      row.city.toLowerCase().includes(q) ||
      row.ownerName.toLowerCase().includes(q)
    )
  })

  const attention = useMemo(() => attentionOf(all, t), [all, t])
  const active = all.filter((row) => row.status === 'active').length

  const columns = [
    {
      key: 'pharmacy',
      header: t('pharmacies.col.pharmacy'),
      render: (row: PharmacyOverview) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-subhead font-medium text-label">{row.name}</p>
            <p className="truncate text-caption text-label-tertiary">
              {[row.city, row.ownerName].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: t('pharmacies.col.revenue'),
      align: 'right' as const,
      render: (row: PharmacyOverview) => (
        <div>
          <p className="text-footnote font-medium tnum text-label">{money(row.revenue)}</p>
          <p className="text-caption tnum text-label-tertiary">
            {t('pharmacies.receipts', { count: row.receipts })}
          </p>
        </div>
      ),
    },
    {
      key: 'today',
      header: t('pharmacies.col.today'),
      align: 'right' as const,
      hideBelow: 'lg' as const,
      render: (row: PharmacyOverview) => (
        <span className="text-footnote tnum text-label-secondary">
          {moneyShort(row.todayRevenue)}
        </span>
      ),
    },
    {
      key: 'cash',
      header: t('pharmacies.col.cash'),
      hideBelow: 'md' as const,
      render: (row: PharmacyOverview) => <CashCell row={row} />,
    },
    {
      key: 'stock',
      header: t('pharmacies.col.stock'),
      hideBelow: 'lg' as const,
      render: (row: PharmacyOverview) => <StockCell row={row} />,
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'center' as const,
      render: (row: PharmacyOverview) => (
        <Badge tone={row.status === 'active' ? 'ok' : 'bad'} dot>
          {t(`pharmacies.status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'lastSale',
      header: t('pharmacies.col.lastSale'),
      align: 'right' as const,
      hideBelow: 'xl' as const,
      render: (row: PharmacyOverview) => (
        <span className="text-caption text-label-tertiary">
          {row.lastSaleAt ? dateRelative(row.lastSaleAt) : t('pharmacies.never')}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 'w-24',
            render: (row: PharmacyOverview) => (
              <div className="flex justify-end gap-1">
                <IconButton
                  label={t('pharmacies.edit')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(row)
                  }}
                >
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  label={t('pharmacies.resetOwner')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setResetting(row)
                  }}
                >
                  <KeyRound size={15} />
                </IconButton>
                {row.status === 'suspended' ? (
                  <IconButton
                    label={t('pharmacies.activate')}
                    className="hover:text-ok"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await activatePharmacy(row.id)
                      refresh()
                    }}
                  >
                    <Play size={15} />
                  </IconButton>
                ) : (
                  <IconButton
                    label={t('pharmacies.suspend')}
                    className="hover:text-bad"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSuspending(row)
                    }}
                  >
                    <Pause size={15} />
                  </IconButton>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={t('pharmacies.title')}
        subtitle={data ? t('pharmacies.count', { count: all.length }) : t('common.loading')}
        actions={
          canManage ? (
            <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              {t('pharmacies.new')}
            </Button>
          ) : null
        }
      />

      {/* --- Umumiy son --- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={t('pharmacies.tile.total')}
          value={String(all.length)}
          hint={t('pharmacies.tile.totalHint', {
            active,
            suspended: all.length - active,
          })}
        />
        <Tile
          label={t('pharmacies.tile.revenue')}
          value={moneyShort(all.reduce((sum, row) => sum + row.revenue, 0))}
          hint={t('pharmacies.receipts', {
            count: all.reduce((sum, row) => sum + row.receipts, 0),
          })}
        />
        <Tile
          label={t('pharmacies.tile.today')}
          value={moneyShort(all.reduce((sum, row) => sum + row.todayRevenue, 0))}
        />
        <Tile
          label={t('pharmacies.tile.attention')}
          value={String(new Set(attention.map((a) => a.id)).size)}
          hint={t('pharmacies.tile.attentionHint')}
          tone={attention.length ? 'warn' : undefined}
        />
      </div>

      {/* --- E'tibor kerak --- */}
      {attention.length > 0 ? (
        <Card className="mb-5">
          <p className="flex items-center gap-2 text-subhead font-semibold text-label">
            <TriangleAlert size={16} className="text-warn" />
            {t('pharmacies.attentionTitle')}
          </p>
          <ul className="mt-3 space-y-1">
            {attention.map((item) => (
              <li key={`${item.id}-${item.kind}`}>
                <button
                  type="button"
                  onClick={() => navigate(`/platform/pharmacies/${item.id}`)}
                  className="flex w-full items-start gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-fill-4"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.tone === 'bad' ? 'bg-bad' : 'bg-warn',
                    )}
                  />
                  <span className="text-footnote text-label-secondary">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card padded={false}>
        <div className="hairline flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('pharmacies.search')}
            className="sm:max-w-xs"
          />
          <FilterPills<StatusFilter>
            value={status}
            onChange={setStatus}
            options={(['all', 'active', 'suspended'] as const).map((value) => ({
              value,
              label: value === 'all' ? t('common.all') : t(`pharmacies.status.${value}`),
            }))}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <DataTable<PharmacyOverview>
            rows={rows}
            columns={columns}
            loading={loading}
            onRowClick={(row) => navigate(`/platform/pharmacies/${row.id}`)}
            renderMobile={(row) => (
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-subhead font-medium text-label">{row.name}</p>
                    <p className="truncate text-caption text-label-tertiary">
                      {[row.city, row.ownerName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge tone={row.status === 'active' ? 'ok' : 'bad'} dot>
                    {t(`pharmacies.status.${row.status}`)}
                  </Badge>
                </div>
                <p className="text-caption tnum text-label-secondary">
                  {money(row.revenue)} · {t('pharmacies.receipts', { count: row.receipts })}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <CashCell row={row} />
                  <StockCell row={row} />
                </div>
              </div>
            )}
            emptyState={
              <EmptyState
                icon={<Pill size={24} strokeWidth={1.75} />}
                title={all.length ? t('pharmacies.noMatch') : t('pharmacies.empty')}
                description={all.length ? '' : t('pharmacies.emptyHint')}
              />
            }
          />
        )}
      </Card>

      <NewPharmacyModal
        open={creating}
        onClose={() => setCreating(false)}
        onDone={refresh}
      />
      <EditPharmacyModal
        pharmacy={editing}
        onClose={() => setEditing(null)}
        onDone={refresh}
      />
      <SuspendPharmacyModal
        pharmacy={suspending}
        onClose={() => setSuspending(null)}
        onDone={refresh}
      />
      <ResetPharmacyOwnerModal pharmacy={resetting} onClose={() => setResetting(null)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* E'tibor kerak                                                       */
/* ------------------------------------------------------------------ */

interface Attention {
  id: string
  kind: 'flagged' | 'expired' | 'idle'
  tone: 'bad' | 'warn'
  text: string
}

/**
 * Nima e'tibor talab qiladi — uch narsa, shu tartibda.
 *
 * 1. KAM TOPSHIRILGAN SMENA. Sotuvchi ogohlantirishni ko'rib turib
 *    kam summa kiritgan — bu tasodif emas, suhbat talab qiladi.
 * 2. MUDDATI O'TGAN DORI JAVONDA. Bu jarima va litsenziya masalasi,
 *    bemor uchun esa xavf.
 * 3. SAVDO TO'XTAGAN. Faol apteka bir necha kun sotmasa — yo tizimdan
 *    foydalanmay qo'ygan (ketishga yaqin mijoz), yo muammo bor.
 *
 * Tugab qolgan dori bu yerga KIRMAYDI: u har aptekada har kuni
 * bo'ladi va ro'yxatni doimiy shovqinga aylantirardi.
 */
function attentionOf(
  rows: PharmacyOverview[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): Attention[] {
  const out: Attention[] = []
  const now = Date.now()

  for (const row of rows) {
    if (row.status !== 'active') continue

    if (row.flaggedShifts > 0) {
      out.push({
        id: row.id,
        kind: 'flagged',
        tone: 'bad',
        text: t('pharmacies.attn.flagged', { name: row.name, count: row.flaggedShifts }),
      })
    }
    if (row.expiredBatches > 0) {
      out.push({
        id: row.id,
        kind: 'expired',
        tone: 'bad',
        text: t('pharmacies.attn.expired', { name: row.name, count: row.expiredBatches }),
      })
    }

    /* Yangi ochilgan aptekaga birinchi kunlari tegmaymiz */
    const age = (now - new Date(row.createdAt).getTime()) / 86_400_000
    if (age < IDLE_DAYS) continue

    if (!row.lastSaleAt) {
      out.push({
        id: row.id,
        kind: 'idle',
        tone: 'warn',
        text: t('pharmacies.attn.idleNever', { name: row.name }),
      })
    } else {
      const days = Math.floor((now - new Date(row.lastSaleAt).getTime()) / 86_400_000)
      if (days >= IDLE_DAYS) {
        out.push({
          id: row.id,
          kind: 'idle',
          tone: 'warn',
          text: t('pharmacies.attn.idle', { name: row.name, days }),
        })
      }
    }
  }

  return out.sort((a, b) => Number(a.tone === 'warn') - Number(b.tone === 'warn'))
}

/* ------------------------------------------------------------------ */
/* Katakchalar                                                         */
/* ------------------------------------------------------------------ */

function CashCell({ row }: { row: PharmacyOverview }) {
  const { t } = useI18n()
  if (row.flaggedShifts > 0) {
    return (
      <span className="text-caption font-medium text-bad">
        {t('pharmacies.flagged', { count: row.flaggedShifts })}
      </span>
    )
  }
  if (row.cashShort > 0) {
    return (
      <span className="text-caption text-warn">
        {t('pharmacies.short', { sum: moneyShort(row.cashShort) })}
      </span>
    )
  }
  return <span className="text-caption text-label-tertiary">{t('pharmacies.cashClean')}</span>
}

function StockCell({ row }: { row: PharmacyOverview }) {
  const { t } = useI18n()
  const parts: { text: string; tone: string }[] = []
  if (row.expiredBatches > 0) {
    parts.push({ text: t('pharmacies.expired', { count: row.expiredBatches }), tone: 'text-bad' })
  }
  if (row.expiringBatches > 0) {
    parts.push({
      text: t('pharmacies.expiring', { count: row.expiringBatches }),
      tone: 'text-warn',
    })
  }
  if (row.lowStock > 0) {
    parts.push({
      text: t('pharmacies.low', { count: row.lowStock }),
      tone: 'text-label-secondary',
    })
  }
  if (parts.length === 0) {
    return <span className="text-caption text-label-tertiary">{t('pharmacies.stockOk')}</span>
  }
  return (
    <span className="flex flex-col">
      {parts.map((part) => (
        <span key={part.text} className={cn('text-caption', part.tone)}>
          {part.text}
        </span>
      ))}
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
  tone?: 'warn'
}) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-callout font-bold tnum sm:text-title-3',
          tone === 'warn' ? 'text-warn' : 'text-label',
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
