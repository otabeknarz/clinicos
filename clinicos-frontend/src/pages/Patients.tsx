import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'

import { listPatients } from '@/api/patients'
import type { PatientFilter } from '@/api/patients'
import { PatientFormModal } from '@/components/modals/PatientFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { DataTable, Pagination } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { FilterPills } from '@/components/ui/Tabs'
import { dateShort, groupDigits, money, phone as formatPhone } from '@/lib/format'
import { PATIENT_LABEL, PATIENT_TONE } from '@/lib/status'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import type { PatientWithStats } from '@/types/models'

const PAGE_SIZE = 15

export function PatientsPage() {
  const { t } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PatientFilter>('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const debouncedSearch = useDebounced(search, 250)

  const { data, loading, error, reload } = useAsync(
    () => listPatients({ search: debouncedSearch, filter, page, pageSize: PAGE_SIZE }),
    [debouncedSearch, filter, page],
  )

  const rows = data?.items ?? []
  const total = data?.total ?? 0

  /** Filtr yoki qidiruv o'zgarsa birinchi sahifaga qaytamiz */
  function changeFilter(next: PatientFilter) {
    setFilter(next)
    setPage(1)
  }

  function changeSearch(next: string) {
    setSearch(next)
    setPage(1)
  }

  const columns: Column<PatientWithStats>[] = [
    {
      key: 'patient',
      header: t('patients.col.patient'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-label">{row.fullName}</p>
            <p className="truncate text-caption text-label-tertiary sm:hidden">
              {formatPhone(row.phone)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('patients.col.phone'),
      hideBelow: 'md',
      render: (row) => <span className="tnum text-label-secondary">{formatPhone(row.phone)}</span>,
    },
    {
      key: 'lastVisit',
      header: t('patients.col.lastVisit'),
      hideBelow: 'lg',
      render: (row) => (
        <span className="text-label-secondary">
          {row.stats.lastVisitAt ? dateShort(row.stats.lastVisitAt) : '—'}
        </span>
      ),
    },
    {
      key: 'visits',
      header: t('patients.col.visits'),
      align: 'right',
      hideBelow: 'sm',
      render: (row) => <span className="tnum text-label-secondary">{row.stats.visitCount}</span>,
    },
    {
      key: 'spent',
      header: t('patients.col.spent'),
      align: 'right',
      hideBelow: 'xl',
      render: (row) => (
        <span className="tnum font-medium text-label">{money(row.stats.totalSpent)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      render: (row) => (
        <Badge tone={PATIENT_TONE[row.status]} dot>
          {t(PATIENT_LABEL[row.status])}
        </Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('patients.title')}
        subtitle={loading ? undefined : t('patients.subtitle', { count: groupDigits(total) })}
        primaryAction={
          can('patients.create')
            ? {
                icon: <UserPlus size={16} />,
                label: t('patients.add'),
                shortLabel: t('action.add'),
                onClick: () => setFormOpen(true),
              }
            : undefined
        }
      />

      <Card padded={false}>
        {/* --- Qidiruv va filtrlar --- */}
        <div className="hairline flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <SearchInput
            value={search}
            onChange={changeSearch}
            placeholder={t('patients.search')}
            icon={<Search size={16} />}
            className="sm:max-w-xs"
          />
          <FilterPills<PatientFilter>
            value={filter}
            onChange={changeFilter}
            options={[
              { value: 'all', label: t('patients.filter.all') },
              { value: 'new', label: t('patients.filter.new') },
              { value: 'returning', label: t('patients.filter.returning') },
              { value: 'active', label: t('patients.filter.active') },
              { value: 'inactive', label: t('patients.filter.inactive') },
            ]}
            className="sm:ml-auto"
          />
        </div>

        {/* --- Jadval --- */}
        {error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <>
            <DataTable
              rows={rows}
              columns={columns}
              loading={loading}
              onRowClick={(row) => navigate(`/patients/${row.id}`)}
              emptyState={
                debouncedSearch || filter !== 'all' ? undefined : (
                  <EmptyState
                    icon={<Users size={24} strokeWidth={1.75} />}
                    title={t('patients.empty.title')}
                    description={t('patients.empty.desc')}
                    action={
                      can('patients.create') ? (
                        <Button variant="tinted" onClick={() => setFormOpen(true)}>
                          {t('patients.add')}
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
              renderMobile={(row) => (
                <div className="flex items-center gap-3">
                  <Avatar name={row.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-label">{row.fullName}</p>
                    <p className="truncate text-caption text-label-tertiary">
                      {formatPhone(row.phone)} · {row.stats.visitCount}
                    </p>
                  </div>
                  <Badge tone={PATIENT_TONE[row.status]}>{t(PATIENT_LABEL[row.status])}</Badge>
                </div>
              )}
            />

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              className="hairline-t"
            />
          </>
        )}
      </Card>

      <PatientFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(patient) => navigate(`/patients/${patient.id}`)}
      />
    </>
  )
}
