import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldAlert, Stethoscope, UserRound, X } from 'lucide-react'

import {
  AGE_GROUPS,
  listTenantDoctors,
  listTenantPatients,
  listTenants,
} from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FilterBar } from '@/components/layout/FilterBar'
import { Card } from '@/components/ui/Card'
import { SearchInput, Select } from '@/components/ui/Form'
import { Stars } from '@/components/ui/Stars'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DataTable, Pagination } from '@/components/ui/Table'
import { Tabs } from '@/components/ui/Tabs'
import { COMPLAINT_KEYS, SPECIALTIES } from '@/i18n/data'
import { cn } from '@/lib/cn'
import { dateCompact, groupDigits, money, moneyShort, phone as fmtPhone } from '@/lib/format'
import { DOCTOR_LABEL, DOCTOR_TONE } from '@/lib/status'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { TenantDoctor, TenantPatient } from '@/types/models'

type View = 'doctors' | 'patients'

/** Reyting filtri chegaralari */
const RATING_STEPS = [4.5, 4, 3.5, 3]
/** Ish hajmi chegaralari — 30 kundagi qabullar */
const LOAD_STEPS = [150, 100, 50, 20]
/** Tashriflar soni chegaralari */
const VISIT_STEPS = [10, 5, 3, 2]
/** To'lagan summa chegaralari */
const SPENT_STEPS = [5_000_000, 2_000_000, 1_000_000, 500_000]
/** Oylik chegaralari */
const PAY_STEPS = [15_000_000, 10_000_000, 6_000_000, 3_000_000]

/**
 * KLINIKALAR KESIMIDAGI RO'YXATLAR.
 *
 * Ikki ro'yxat: shifokorlar (kontaktlari bilan) va bemorlar.
 *
 * NEGA FILTRLAR KO'P: ro'yxatning qiymati uzunligida emas, kerakli
 * qatorni tez topishda. "Samarqandda qon bosimi bilan kelgan, 5
 * martadan ko'p tashrif qilgan bemorlar" — shunday savolga javob
 * bera olmasa, ro'yxat shunchaki ma'lumot uyumi bo'lib qoladi.
 *
 * Barcha filtr URL da saqlanadi: topilgan natijani havola qilib
 * boshqa xodimga yuborish mumkin.
 *
 * TIBBIY MA'LUMOT YO'Q. Tashxis, davolash, tashrif yozuvi bu yerga
 * chiqmaydi — faqat murojaat sababi turkumi.
 */
export function PlatformRegistryPage() {
  const { t, tSpecialty, tComplaint } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [page, setPage] = useState(1)

  const view = (searchParams.get('view') as View) ?? 'doctors'
  const tenantId = searchParams.get('tenant') ?? 'all'

  const { data: tenants } = useAsync(() => listTenants({ pageSize: 200 }), [])

  /** Bitta filtrni o'zgartirish — qolganlari saqlanadi */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  /*
    Ko'rinish almashganda filtrlar tozalanadi — shifokor filtri
    bemorlar ro'yxatida ma'nosiz. Klinika tanlovi saqlanadi: odam
    odatda bitta klinika ustida ishlaydi.
  */
  function setView(next: View) {
    const params = new URLSearchParams()
    params.set('view', next)
    if (tenantId !== 'all') params.set('tenant', tenantId)
    setSearchParams(params, { replace: true })
    setSearch('')
    setPage(1)
  }

  function clearFilters() {
    const params = new URLSearchParams()
    params.set('view', view)
    setSearchParams(params, { replace: true })
    setSearch('')
    setPage(1)
  }

  // Faol filtrlar soni — tozalash tugmasi shunga qarab chiqadi
  const activeFilters = [...searchParams.keys()].filter((key) => key !== 'view').length

  const tenantOptions = [
    { value: 'all', label: t('registry.allClinics') },
    ...(tenants?.items ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })),
  ]

  const cities = [...new Set((tenants?.items ?? []).map((tenant) => tenant.city))].sort()

  return (
    <>
      <PageHeader title={t('registry.title')} subtitle={t('registry.subtitle')} />

      {/* Chegara ro'yxatdan oldin turadi — keyin emas */}
      <div className="mb-5 flex items-start gap-3 rounded-[14px] bg-warn-soft px-5 py-4">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <p className="text-subhead font-semibold text-warn">{t('registry.notice')}</p>
          <p className="mt-0.5 text-footnote text-label-secondary">
            {t('registry.noticeHint')}
          </p>
        </div>
      </div>

      <Card padded={false}>
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'doctors', label: t('registry.doctors') },
              { value: 'patients', label: t('registry.patients') },
            ]}
          />
        </div>

        {/* --- Filtrlar --- */}
        <div className="hairline space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next)
                setPage(1)
              }}
              placeholder={t('registry.searchPlaceholder')}
              className="sm:max-w-xs"
            />

            {activeFilters > 0 ? (
              <Button
                variant="plain"
                size="sm"
                icon={<X size={14} />}
                className="sm:ml-auto"
                onClick={clearFilters}
              >
                {t('registry.clearFilters', { count: activeFilters })}
              </Button>
            ) : null}
          </div>

          {/*
            Telefonda bu filtrlar bitta "Filtr" tugmasiga yig'iladi.

            Ustma-ust turganda ular butun ekranni egallab, birorta
            natija ko'rinmasdi — holbuki ko'p hollarda filtr emas,
            ro'yxatning o'zi kerak.
          */}
          <FilterBar activeCount={activeFilters} onReset={clearFilters}>
            <Select
              value={tenantId}
              onChange={(e) => setParam('tenant', e.target.value)}
              className="sm:max-w-56"
              options={tenantOptions}
            />

            {view === 'doctors' ? (
              <>
                <Select
                  value={searchParams.get('specialty') ?? 'all'}
                  onChange={(e) => setParam('specialty', e.target.value)}
                  className="max-w-52"
                  options={[
                    { value: 'all', label: t('registry.allSpecialties') },
                    ...SPECIALTIES.map((key) => ({
                      value: key,
                      label: tSpecialty(key),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('minRating') ?? 'all'}
                  onChange={(e) => setParam('minRating', e.target.value)}
                  className="max-w-44"
                  options={[
                    { value: 'all', label: t('registry.anyRating') },
                    ...RATING_STEPS.map((step) => ({
                      value: String(step),
                      label: t('registry.ratingFrom', { value: step }),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('minLoad') ?? 'all'}
                  onChange={(e) => setParam('minLoad', e.target.value)}
                  className="max-w-52"
                  options={[
                    { value: 'all', label: t('registry.anyLoad') },
                    ...LOAD_STEPS.map((step) => ({
                      value: String(step),
                      label: t('registry.loadFrom', { count: step }),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('minPay') ?? 'all'}
                  onChange={(e) => setParam('minPay', e.target.value)}
                  className="max-w-48"
                  options={[
                    { value: 'all', label: t('registry.anyPay') },
                    ...PAY_STEPS.map((step) => ({
                      value: String(step),
                      label: t('registry.payFrom', { value: moneyShort(step) }),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('sort') ?? 'load'}
                  onChange={(e) => setParam('sort', e.target.value)}
                  className="max-w-44"
                  options={[
                    { value: 'load', label: t('registry.sortLoad') },
                    { value: 'pay', label: t('registry.sortPay') },
                    { value: 'rating', label: t('registry.sortRating') },
                    { value: 'name', label: t('registry.sortName') },
                  ]}
                />
              </>
            ) : (
              <>
                <Select
                  value={searchParams.get('city') ?? 'all'}
                  onChange={(e) => setParam('city', e.target.value)}
                  className="max-w-44"
                  options={[
                    { value: 'all', label: t('registry.allCities') },
                    ...cities.map((city) => ({ value: city, label: city })),
                  ]}
                />

                <Select
                  value={searchParams.get('condition') ?? 'all'}
                  onChange={(e) => setParam('condition', e.target.value)}
                  className="max-w-56"
                  options={[
                    { value: 'all', label: t('registry.allConditions') },
                    ...COMPLAINT_KEYS.map((key) => ({
                      value: key,
                      label: tComplaint(key),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('ageGroup') ?? 'all'}
                  onChange={(e) => setParam('ageGroup', e.target.value)}
                  className="max-w-44"
                  options={[
                    { value: 'all', label: t('registry.allAges') },
                    ...AGE_GROUPS.map((group) => ({
                      value: group.key,
                      label: t(`registry.age.${group.key}`),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('minVisits') ?? 'all'}
                  onChange={(e) => setParam('minVisits', e.target.value)}
                  className="max-w-48"
                  options={[
                    { value: 'all', label: t('registry.anyVisits') },
                    ...VISIT_STEPS.map((step) => ({
                      value: String(step),
                      label: t('registry.visitsFrom', { count: step }),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('minSpent') ?? 'all'}
                  onChange={(e) => setParam('minSpent', e.target.value)}
                  className="max-w-48"
                  options={[
                    { value: 'all', label: t('registry.anySpent') },
                    ...SPENT_STEPS.map((step) => ({
                      value: String(step),
                      label: t('registry.spentFrom', { value: moneyShort(step) }),
                    })),
                  ]}
                />

                <Select
                  value={searchParams.get('sort') ?? 'recent'}
                  onChange={(e) => setParam('sort', e.target.value)}
                  className="max-w-48"
                  options={[
                    { value: 'recent', label: t('registry.sortRecent') },
                    { value: 'visits', label: t('registry.sortVisits') },
                    { value: 'spent', label: t('registry.sortSpent') },
                  ]}
                />
              </>
            )}
          </FilterBar>
        </div>

        {view === 'doctors' ? (
          <DoctorsTable
            params={searchParams}
            search={debounced}
            page={page}
            onPage={setPage}
          />
        ) : (
          <PatientsTable
            params={searchParams}
            search={debounced}
            page={page}
            onPage={setPage}
          />
        )}
      </Card>
    </>
  )
}

/** URL parametrini songa aylantirish */
function num(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  return raw ? Number(raw) : undefined
}

/** URL parametrini matn sifatida olish; "all" bo'lsa — filtr yo'q */
function str(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key)
  return raw && raw !== 'all' ? raw : undefined
}

/* ------------------------------------------------------------------ */
/* Shifokorlar                                                         */
/* ------------------------------------------------------------------ */

function DoctorsTable({
  params,
  search,
  page,
  onPage,
}: {
  params: URLSearchParams
  search: string
  page: number
  onPage: (page: number) => void
}) {
  const { t, tSpecialty } = useI18n()

  const tenantId = str(params, 'tenant')
  const specialty = str(params, 'specialty')
  const minRating = num(params, 'minRating')
  const minLoad = num(params, 'minLoad')
  const minPay = num(params, 'minPay')
  const sort = (params.get('sort') as 'load' | 'rating' | 'name' | 'pay') ?? 'load'

  const { data, loading, error, reload } = useAsync(
    () =>
      listTenantDoctors({
        tenantId,
        specialty,
        minRating,
        minLoad,
        minPay,
        sort,
        search,
        page,
      }),
    [tenantId, specialty, minRating, minLoad, minPay, sort, search, page],
  )

  const columns = [
    {
      key: 'doctor',
      header: t('registry.doctor'),
      render: (row: TenantDoctor) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-subhead font-medium text-label">{row.fullName}</p>
            <p className="truncate text-caption text-label-tertiary">
              {tSpecialty(row.specialty)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: t('platform.clinic'),
      hideBelow: 'md' as const,
      render: (row: TenantDoctor) => (
        <span className="text-footnote text-label-secondary">{row.tenantName}</span>
      ),
    },
    {
      key: 'contact',
      header: t('registry.contact'),
      hideBelow: 'lg' as const,
      render: (row: TenantDoctor) => (
        <div>
          <p className="text-footnote tnum text-label">{fmtPhone(row.phone)}</p>
          <p className="truncate text-caption text-label-tertiary">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'load',
      header: t('registry.load'),
      align: 'right' as const,
      hideBelow: 'lg' as const,
      render: (row: TenantDoctor) => (
        <span className="text-footnote tnum text-label">
          {groupDigits(row.completedLast30d)}
        </span>
      ),
    },
    {
      key: 'pay',
      header: t('registry.pay'),
      align: 'right' as const,
      render: (row: TenantDoctor) => (
        <div>
          <p className="text-footnote font-semibold tnum text-label">
            {money(row.monthlyPay)}
          </p>
          <p className="text-caption text-label-tertiary">
            {row.payType === 'salary'
              ? t('staff.payType.salary')
              : `${row.percentRate}%`}
          </p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: t('staff.rating'),
      align: 'center' as const,
      render: (row: TenantDoctor) =>
        row.rating === null ? (
          <span className="text-caption text-label-quaternary">—</span>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <Stars value={row.rating} size={13} />
            <span className="text-caption-2 tnum text-label-tertiary">
              {row.rating.toFixed(1)}
            </span>
          </div>
        ),
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right' as const,
      render: (row: TenantDoctor) => (
        <Badge tone={DOCTOR_TONE[row.status]} dot>
          {t(DOCTOR_LABEL[row.status])}
        </Badge>
      ),
    },
  ]

  if (error) return <ErrorState onRetry={reload} />

  return (
    <>
      <ResultCount total={data?.total} loading={loading} />

      <DataTable<TenantDoctor>
        rows={data?.items ?? []}
        columns={columns}
        loading={loading}
        emptyState={
          <EmptyState
            icon={<Stethoscope size={24} strokeWidth={1.75} />}
            title={t('registry.noDoctors')}
            description={t('registry.tryClearing')}
          />
        }
        /*
          Telefonda jadval kartochkaga aylanadi.

          Yon tomonga suriladigan jadvalda odam ustunni yo'qotib
          qo'yadi: ism chapda qolib, raqam o'ngda ko'rinmay turadi.
          Kartochkada har bir shifokor bir joyda — ismi, klinikasi,
          telefoni va eng kerakli uchta raqami.
        */
        renderMobile={(row) => (
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <Avatar name={row.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-medium text-label">
                  {row.fullName}
                </p>
                <p className="truncate text-caption text-label-tertiary">
                  {tSpecialty(row.specialty)} · {row.tenantName}
                </p>
              </div>
              <Badge tone={DOCTOR_TONE[row.status]} dot>
                {t(DOCTOR_LABEL[row.status])}
              </Badge>
            </div>

            <a
              href={`tel:${row.phone}`}
              className="block text-footnote tnum text-accent"
              onClick={(e) => e.stopPropagation()}
            >
              {fmtPhone(row.phone)}
            </a>

            <div className="flex items-center gap-4 text-caption text-label-tertiary">
              <span>
                {t('registry.load')}:{' '}
                <span className="font-medium tnum text-label-secondary">
                  {groupDigits(row.completedLast30d)}
                </span>
              </span>
              <span>
                {t('registry.pay')}:{' '}
                <span className="font-medium tnum text-label-secondary">
                  {money(row.monthlyPay)}
                </span>
              </span>
              {row.rating === null ? null : (
                <span className="ml-auto flex items-center gap-1">
                  <Stars value={row.rating} size={12} />
                  <span className="tnum">{row.rating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={onPage} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bemorlar                                                            */
/* ------------------------------------------------------------------ */

function PatientsTable({
  params,
  search,
  page,
  onPage,
}: {
  params: URLSearchParams
  search: string
  page: number
  onPage: (page: number) => void
}) {
  const { t, tComplaint } = useI18n()

  const tenantId = str(params, 'tenant')
  const city = str(params, 'city')
  const condition = str(params, 'condition')
  const ageGroup = str(params, 'ageGroup')
  const minVisits = num(params, 'minVisits')
  const minSpent = num(params, 'minSpent')
  const sort = (params.get('sort') as 'recent' | 'visits' | 'spent') ?? 'recent'

  const { data, loading, error, reload } = useAsync(
    () =>
      listTenantPatients({
        tenantId,
        city,
        condition,
        ageGroup,
        minVisits,
        minSpent,
        sort,
        search,
        page,
      }),
    [tenantId, city, condition, ageGroup, minVisits, minSpent, sort, search, page],
  )

  const columns = [
    {
      key: 'patient',
      header: t('common.patient'),
      render: (row: TenantPatient) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-subhead font-medium text-label">{row.fullName}</p>
            <p className="truncate text-caption tnum text-label-tertiary">
              {fmtPhone(row.phone)} · {t('registry.years', { count: row.age })}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: t('platform.clinic'),
      hideBelow: 'md' as const,
      render: (row: TenantPatient) => (
        <div>
          <p className="truncate text-footnote text-label-secondary">{row.tenantName}</p>
          <p className="truncate text-caption text-label-tertiary">{row.city}</p>
        </div>
      ),
    },
    {
      key: 'condition',
      header: t('registry.condition'),
      hideBelow: 'lg' as const,
      render: (row: TenantPatient) => (
        <span className="text-footnote text-label-secondary">
          {tComplaint(row.condition)}
        </span>
      ),
    },
    {
      key: 'last',
      header: t('registry.lastVisit'),
      hideBelow: 'xl' as const,
      render: (row: TenantPatient) => (
        <span className="text-footnote tnum text-label-secondary">
          {row.lastVisitAt ? dateCompact(row.lastVisitAt) : '—'}
        </span>
      ),
    },
    {
      key: 'visits',
      header: t('registry.visits'),
      align: 'center' as const,
      render: (row: TenantPatient) => (
        <span
          className={cn(
            'text-footnote font-medium tnum',
            row.isReturning ? 'text-ok' : 'text-label-tertiary',
          )}
        >
          {row.visitCount}
        </span>
      ),
    },
    {
      key: 'spent',
      header: t('patient.stat.totalSpent'),
      align: 'right' as const,
      render: (row: TenantPatient) => (
        <span className="text-footnote font-semibold tnum text-label">
          {money(row.totalSpent)}
        </span>
      ),
    },
  ]

  if (error) return <ErrorState onRetry={reload} />

  return (
    <>
      <ResultCount total={data?.total} loading={loading} />

      <DataTable<TenantPatient>
        rows={data?.items ?? []}
        columns={columns}
        loading={loading}
        emptyState={
          <EmptyState
            icon={<UserRound size={24} strokeWidth={1.75} />}
            title={t('registry.noPatients')}
            description={t('registry.tryClearing')}
          />
        }
        /* Telefonda jadval o'rniga kartochka — yuqoridagi izohga qarang */
        renderMobile={(row) => (
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <Avatar name={row.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-medium text-label">
                  {row.fullName}
                </p>
                <p className="truncate text-caption tnum text-label-tertiary">
                  {fmtPhone(row.phone)} · {t('registry.years', { count: row.age })}
                </p>
              </div>
              <span className="shrink-0 text-footnote font-semibold tnum text-label">
                {money(row.totalSpent)}
              </span>
            </div>

            <p className="truncate text-caption text-label-secondary">
              {row.tenantName} · {row.city}
            </p>

            <div className="flex items-center gap-4 text-caption text-label-tertiary">
              <span>
                {t('registry.condition')}:{' '}
                <span className="text-label-secondary">{tComplaint(row.condition)}</span>
              </span>
              <span className="ml-auto">
                {t('registry.visits')}:{' '}
                <span
                  className={cn(
                    'font-medium tnum',
                    row.isReturning ? 'text-ok' : 'text-label-secondary',
                  )}
                >
                  {row.visitCount}
                </span>
              </span>
            </div>
          </div>
        )}
      />
      <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={onPage} />
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Nechta natija topilgani.
 *
 * Filtr qo'ygan odam birinchi navbatda shu raqamni qidiradi:
 * "12 ta" bilan "1 240 ta" butunlay boshqa xulosa beradi.
 */
function ResultCount({ total, loading }: { total?: number; loading: boolean }) {
  const { t } = useI18n()

  if (loading || total === undefined) return null

  return (
    <p className="hairline px-5 py-2.5 text-caption text-label-tertiary sm:px-6">
      {t('registry.found', { count: total })}
    </p>
  )
}
