import { useState } from 'react'
import { Gift, KeyRound, Pencil, Search, Trash2, Users } from 'lucide-react'

import { deleteStaff, listStaff, STAFF_POSITIONS } from '@/api/staff'
import { BonusModal } from '@/components/modals/BonusModal'
import { StaffFormModal } from '@/components/modals/StaffFormModal'
import { StaffScheduleModal } from '@/components/modals/StaffScheduleModal'
import { RatingBadge } from './RatingBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable } from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { money, percent, phone as formatPhone } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import { effectiveSalary } from '@/types/models'
import type { StaffPosition, StaffStatus, StaffWithPerformance } from '@/types/models'

export function StaffListTab({
  formOpen,
  onFormOpenChange,
  onDataChange,
}: {
  formOpen: boolean
  onFormOpenChange: (open: boolean) => void
  onDataChange: () => void
}) {
  const { t } = useI18n()
  const { can } = useAuth()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<StaffPosition | 'all'>('all')
  const [editing, setEditing] = useState<StaffWithPerformance | null>(null)
  const [deleting, setDeleting] = useState<StaffWithPerformance | null>(null)
  const [bonusFor, setBonusFor] = useState<StaffWithPerformance | null>(null)
  // Qator bosilganda xodimning ish jadvali ochiladi
  const [scheduleFor, setScheduleFor] = useState<StaffWithPerformance | null>(null)

  const debounced = useDebounced(search, 250)
  const { data, loading, error, reload } = useAsync(
    () => listStaff({ search: debounced, position }),
    [debounced, position],
  )

  const remove = useAction(async (id: string) => deleteStaff(id))
  const manage = can('staff.manage')
  const canBonus = can('bonus.manage')

  function refresh() {
    reload()
    onDataChange()
  }

  async function confirmDelete() {
    if (!deleting) return
    await remove.run(deleting.id)
    toast.success(t('toast.deleted'))
    setDeleting(null)
    refresh()
  }

  const columns: Column<StaffWithPerformance>[] = [
    {
      key: 'employee',
      header: t('staff.col.employee'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-label">{row.fullName}</p>
            <p className="truncate text-caption text-label-tertiary tnum">
              {formatPhone(row.phone)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'position',
      header: t('staff.col.position'),
      render: (row) => (
        <div>
          <p className="text-label">{row.positionTitle || t(`staff.position.${row.position}`)}</p>
          <p className="text-caption text-label-tertiary">
            {row.workRate !== 1 ? `${row.workRate} ${t('staff.rateUnit')} · ` : ''}
            {row.department}
          </p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: t('staff.schedule'),
      hideBelow: 'xl',
      render: (row) => (
        <span className="tnum text-label-secondary">
          {row.shiftStart}–{row.shiftEnd}
        </span>
      ),
    },
    {
      key: 'rating',
      header: t('staff.rating'),
      align: 'center',
      render: (row) => (
        <RatingBadge rating={row.performance.rating} factors={row.performance.factors} />
      ),
    },
    {
      key: 'performance',
      header: t('staff.performance'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) =>
        row.performance.performancePct === null ? (
          <span className="text-caption text-label-quaternary">—</span>
        ) : (
          <span
            className={cnPerformance(row.performance.performancePct)}
          >
            {percent(row.performance.performancePct)}
          </span>
        ),
    },
    {
      key: 'salary',
      header: t('staff.col.salary'),
      align: 'right',
      hideBelow: 'lg',
      render: (row) => {
        const base = effectiveSalary(row)
        const fromPercent = row.performance.percentEarnings
        const bonus = row.performance.bonusThisPeriod

        return (
          <div>
            {/* Asosiy qism: oylik yoki foiz */}
            <p className="tnum font-medium text-label">
              {row.payType === 'percent'
                ? fromPercent > 0
                  ? money(fromPercent)
                  : '—'
                : base > 0
                  ? money(base)
                  : '—'}
            </p>

            <p className="text-caption text-label-tertiary">
              {row.payType === 'salary'
                ? t('staff.payType.salary')
                : `${row.percentRate} / ${100 - row.percentRate}`}
              {row.payType === 'salary_percent' && fromPercent > 0
                ? ` · +${money(fromPercent)}`
                : ''}
            </p>

            {bonus > 0 ? (
              <p className="text-caption tnum text-ok">+{money(bonus)}</p>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'access',
      header: t('staff.col.access'),
      align: 'center',
      hideBelow: 'xl',
      render: (row) =>
        row.hasSystemAccess ? (
          <Badge tone="accent">
            <KeyRound size={11} />
            {row.role ? t(`role.${row.role}`) : t('staff.access.on')}
          </Badge>
        ) : (
          <span className="text-caption text-label-quaternary">—</span>
        ),
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status]} dot>
          {t(`staff.status.${row.status}`)}
        </Badge>
      ),
    },
    ...(manage || canBonus
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 'w-32',
            render: (row: StaffWithPerformance) => (
              <div className="flex justify-end gap-1">
                {canBonus && row.status !== 'fired' ? (
                  <IconButton
                    label={t('bonus.add')}
                    className="hover:text-ok"
                    onClick={(e) => {
                      e.stopPropagation()
                      setBonusFor(row)
                    }}
                  >
                    <Gift size={15} />
                  </IconButton>
                ) : null}
                {manage ? (
                  <>
                    <IconButton
                      label={t('action.edit')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(row)
                        onFormOpenChange(true)
                      }}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      label={t('action.delete')}
                      className="hover:text-bad"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(row)
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <div className="hairline flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('action.search')}
          icon={<Search size={16} />}
          className="sm:max-w-xs"
        />
        <FilterPills<StaffPosition | 'all'>
          value={position}
          onChange={setPosition}
          options={[
            { value: 'all', label: t('common.all') },
            ...STAFF_POSITIONS.map((key) => ({
              value: key,
              label: t(`staff.position.${key}`),
            })),
          ]}
          className="sm:ml-auto"
        />
      </div>

      {error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <DataTable
          rows={data ?? []}
          columns={columns}
          onRowClick={setScheduleFor}
          loading={loading}
          emptyState={<EmptyState icon={<Users size={24} strokeWidth={1.75} />} />}
          renderMobile={(row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-label">{row.fullName}</p>
                <p className="truncate text-caption text-label-tertiary">
                  {row.positionTitle || t(`staff.position.${row.position}`)}
                </p>
              </div>
              <RatingBadge
                rating={row.performance.rating}
                factors={row.performance.factors}
                size="sm"
              />
            </div>
          )}
        />
      )}

      <StaffScheduleModal
        open={scheduleFor !== null}
        staffId={scheduleFor?.id ?? null}
        staffName={scheduleFor?.fullName ?? ''}
        onClose={() => setScheduleFor(null)}
      />

      <StaffFormModal
        open={formOpen}
        staff={editing}
        onClose={() => {
          onFormOpenChange(false)
          setEditing(null)
        }}
        onSaved={refresh}
      />

      <BonusModal
        open={Boolean(bonusFor)}
        staff={bonusFor}
        onClose={() => setBonusFor(null)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        description={deleting?.fullName}
        pending={remove.pending}
      />
    </>
  )
}

const STATUS_TONE: Record<StaffStatus, Tone> = {
  active: 'ok',
  on_leave: 'warn',
  fired: 'neutral',
}

/** Samaradorlik rangini reja bajarilishiga qarab tanlaymiz */
function cnPerformance(value: number): string {
  const base = 'font-semibold tnum '
  if (value >= 100) return base + 'text-ok'
  if (value >= 80) return base + 'text-label'
  if (value >= 60) return base + 'text-warn'
  return base + 'text-bad'
}
