import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Phone, Search, Sparkles } from 'lucide-react'

import { listLeads, updateLead } from '@/api/leads'
import type { Lead, LeadStatus } from '@/api/leads'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput, TextArea } from '@/components/ui/Form'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Pagination } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import type { Tone } from '@/lib/status'
import { dateTime } from '@/lib/format'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * SOTUV SO'ROVLARI.
 *
 * O'zi ro'yxatdan o'tgan odam shu yerga tushadi va sotuv ishi
 * shundan boshlanadi: qo'ng'iroq qilinadi, izoh yoziladi, holat
 * belgilanadi.
 *
 * NEGA KLINIKALAR RO'YXATIDAN ALOHIDA: u yerda ISHLAYOTGAN
 * mijozlar turadi, bu yerda esa hali mijoz bo'lmaganlar. Ikkalasi
 * bir ro'yxatda bo'lsa, sotuvchi har kuni ularni ajratib
 * o'tirardi.
 *
 * HAR BIR QATORDA "QANCHALIK JONLI" ko'rsatkichi bor: bemor
 * kiritgan va xodim qo'shgan klinika mahsulotni rostdan sinab
 * ko'ryapti — qo'ng'iroq ham boshqacha bo'ladi.
 */
const STATUSES: (LeadStatus | 'all')[] = ['all', 'new', 'contacted', 'converted', 'lost']

const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: 'accent',
  contacted: 'warn',
  converted: 'ok',
  lost: 'neutral',
}

export function PlatformLeadsPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LeadStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [version, setVersion] = useState(0)

  const debounced = useDebounced(search, 250)
  const { data, loading, error, reload } = useAsync(
    () => listLeads({ search: debounced, status, page }),
    [debounced, status, page, version],
  )

  async function save(lead: Lead, patch: { status?: LeadStatus; note?: string }) {
    try {
      await updateLead(lead.id, patch)
      toast.success(t('toast.saved'))
      setVersion((v) => v + 1)
    } catch {
      toast.error(t('toast.error'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('leads.title')}
        subtitle={t('leads.subtitle')}
        actions={
          data && data.fresh > 0 ? (
            <Badge tone="accent">
              <Sparkles size={12} />
              {t('leads.freshCount', { count: data.fresh })}
            </Badge>
          ) : null
        }
      />

      <Card padded={false}>
        <div className="hairline flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder={t('action.search')}
            icon={<Search size={16} />}
            className="sm:max-w-xs"
          />
          <FilterPills<LeadStatus | 'all'>
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={STATUSES.map((key) => ({
              value: key,
              label: key === 'all' ? t('common.all') : t(`leads.status.${key}`),
            }))}
            className="sm:ml-auto"
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading && !data ? (
          <CardSkeleton className="m-5 border-0 shadow-none" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={t('leads.empty')} className="py-12" />
        ) : (
          <>
            <ul>
              {data.items.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onSave={save} />
              ))}
            </ul>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  )
}

function LeadRow({
  lead,
  onSave,
}: {
  lead: Lead
  onSave: (lead: Lead, patch: { status?: LeadStatus; note?: string }) => Promise<void>
}) {
  const { t } = useI18n()
  const [note, setNote] = useState(lead.note)
  const [open, setOpen] = useState(false)

  const days = trialDaysLeft(lead.trialEndsAt)

  return (
    <li className="hairline px-5 py-4 last:border-b-0 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={lead.clinicName} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-subhead font-medium text-label">{lead.clinicName}</span>
            <Badge tone={STATUS_TONE[lead.status]} dot>
              {t(`leads.status.${lead.status}`)}
            </Badge>
            <span className="text-caption text-label-tertiary">
              {t(`direction.${lead.direction}`)}
            </span>
            <span className="text-caption tnum text-label-tertiary">
              {dateTime(lead.createdAt)}
            </span>
          </div>

          <p className="mt-1 text-footnote text-label-secondary">
            {lead.fullName} · {t(`leadPosition.${lead.position}`)}
            {lead.city ? ` · ${lead.city}` : ''}
            {lead.staffCount ? ` · ${lead.staffCount}` : ''}
          </p>

          {/*
            KLINIKA JONLIMI. Sotuvchiga qo'ng'iroqdan OLDIN kerak:
            bo'sh turgan klinika bilan ishlayotgani boshqa-boshqa
            suhbat.
          */}
          <p className="mt-1 text-caption text-label-tertiary">
            {t('leads.usage', { patients: lead.patients, users: lead.users })}
            {days !== null ? ` · ${days > 0 ? t('leads.trialLeft', { days }) : t('leads.trialOver')}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Raqam — eng muhim maydon, bir bosishda qo'ng'iroq */}
          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-footnote font-medium text-accent transition-transform duration-200 hover:scale-105"
            href={`tel:${lead.phone.replace(/\s/g, '')}`}
          >
            <Phone size={14} />
            <span className="tnum">{lead.phone}</span>
          </a>

          {lead.clinicId && !lead.clinicDeleted ? (
            <Link
              to={`/platform/clinics/${lead.clinicId}`}
              className="text-footnote font-medium text-accent hover:underline"
            >
              <Building2 size={14} className="mr-1 inline" />
              {t('leads.openClinic')}
            </Link>
          ) : null}

          <Button variant="gray" size="sm" onClick={() => setOpen((v) => !v)}>
            {t('leads.note')}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 rounded-[14px] bg-sunken p-3">
          <TextArea
            label={t('leads.note')}
            rows={2}
            placeholder={t('leads.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {STATUSES.filter((key): key is LeadStatus => key !== 'all').map((key) => (
              <Button
                key={key}
                size="sm"
                variant={lead.status === key ? 'filled' : 'gray'}
                onClick={() => void onSave(lead, { status: key, note })}
              >
                {t(`leads.status.${key}`)}
              </Button>
            ))}
            <Button
              size="sm"
              variant="tinted"
              className="ml-auto"
              onClick={() => void onSave(lead, { note })}
            >
              {t('action.save')}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/** Sinovga necha kun qolgani. `null` — sinov emas. */
function trialDaysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  const end = new Date(`${endsAt}T23:59:59`)
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000)
}
