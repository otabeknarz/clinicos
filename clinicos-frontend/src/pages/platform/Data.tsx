import { Building2, Database, MapPin, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'

import { getPlatformData } from '@/api/platform'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { compactNumber, dateLong, groupDigits, money, monthsShort, percent } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import type { PlatformDataStats } from '@/types/models'

/**
 * MA'LUMOT BAZASI — platformaning uzoq muddatli aktivi.
 *
 * Klinikalar ClinicOS da ishlagani sari bu yerda butun mamlakat
 * bo'ylab tibbiy bozor manzarasi to'planadi: qayerda qanday xizmat
 * talab qilinadi, narxlar qanday tarqalgan, qaysi oyda murojaat
 * ko'payadi. Bunday ma'lumot bozorda yo'q.
 *
 * SHAXSIY MA'LUMOT YO'Q. Bu sahifadagi har bir raqam — yig'indi
 * yoki ulush. Bemor ismi, telefoni, tashxisi bu yerga hech qachon
 * chiqmaydi; ular klinikaning o'zida qoladi. Shu chegara buzilsa,
 * klinikalarning ishonchi ham, aktivning o'zi ham yo'qoladi.
 */
export function PlatformDataPage() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => getPlatformData(), [])

  return (
    <>
      <PageHeader title={t('data.title')} subtitle={t('data.subtitle')} />

      {error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              loading={loading}
              icon={<UserRound size={17} />}
              tone="accent"
              to="/platform/registry?view=patients"
              label={t('data.patients')}
              value={data ? compactNumber(data.totals.patients) : '—'}
              countTo={data?.totals.patients}
              format={compactNumber}
              caption={
                data ? t('data.since', { date: dateLong(data.totals.since) }) : undefined
              }
            />
            <KpiCard
              loading={loading}
              icon={<Database size={17} />}
              tone="brand"
              label={t('data.appointments')}
              value={data ? compactNumber(data.totals.appointments) : '—'}
              countTo={data?.totals.appointments}
              format={compactNumber}
              caption={t('data.allTime')}
            />
            <KpiCard
              loading={loading}
              icon={<Stethoscope size={17} />}
              tone="ok"
              to="/platform/registry?view=doctors"
              label={t('data.doctors')}
              value={data ? groupDigits(data.totals.doctors) : '—'}
              countTo={data?.totals.doctors}
              format={(v) => groupDigits(Math.round(v))}
            />
            <KpiCard
              loading={loading}
              icon={<Building2 size={17} />}
              tone="accent"
              to="/platform/clinics"
              label={t('data.clinics')}
              value={data ? groupDigits(data.totals.clinics) : '—'}
              countTo={data?.totals.clinics}
              format={(v) => groupDigits(Math.round(v))}
            />
          </div>

          {/* Chegara sahifaning eng ko'zga tashlanadigan joyida turadi */}
          <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-ok-soft px-5 py-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ok" />
            <div>
              <p className="text-subhead font-semibold text-ok">{t('data.privacy')}</p>
              <p className="mt-0.5 text-footnote text-label-secondary">
                {t('data.privacyHint')}
              </p>
            </div>
          </div>

          {loading || !data ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <CardSkeleton className="min-h-72" />
              <CardSkeleton className="min-h-72" />
            </div>
          ) : (
            <>
              <div className="mt-5">
                <GrowthCard data={data} />
              </div>

              <div className="mt-5">
                <ConditionsCard data={data} />
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <ServicesCard data={data} />

                <div className="grid content-start gap-5">
                  <SpecialtyCard data={data} />
                  <SeasonalityCard data={data} />
                </div>
              </div>

              <div className="mt-5">
                <CityCard data={data} />
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Baza o'sishi                                                        */
/* ------------------------------------------------------------------ */

/**
 * Baza qanday to'lib borayotgani.
 *
 * Aktivning qiymati hajmda emas, O'SISH TEZLIGIDA: bugungi 40 ming
 * yozuv o'z-o'zidan qimmat emas, lekin har oy 15% o'sayotgan baza
 * bir yildan keyin butunlay boshqa narsaga aylanadi.
 */
function GrowthCard({ data }: { data: PlatformDataStats }) {
  const { t } = useI18n()

  const max = Math.max(...data.growth.map((g) => g.patients), 1)
  const labels = monthsShort()

  const first = data.growth[0]?.patients ?? 0
  const last = data.growth[data.growth.length - 1]?.patients ?? 0
  const growthPct = first > 0 ? ((last - first) / first) * 100 : 0

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('data.growth')}
        subtitle={t('platform.growthHint')}
        action={
          <Badge tone={growthPct >= 0 ? 'ok' : 'bad'}>
            {percent(growthPct, 0)} {t('data.perYear')}
          </Badge>
        }
      />

      <div className="mt-6 flex h-44 items-end gap-1.5">
        {data.growth.map((row, index) => {
          const monthIndex = Number(row.period.slice(5, 7)) - 1
          const isLast = index === data.growth.length - 1

          return (
            <div
              key={row.period}
              className="flex h-full min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  data-motion="bar"
                  className={cn(
                    'w-full rounded-t-[4px] transition-all',
                    isLast ? 'bg-brand' : 'bg-brand/35',
                  )}
                  style={{
                    height: `${Math.max(2, (row.patients / max) * 100)}%`,
                    animationDelay: `${180 + index * 55}ms`,
                  }}
                  title={`${row.period} · ${groupDigits(row.patients)}`}
                />
              </div>
              <span className="text-caption-2 text-label-tertiary">
                {labels[monthIndex]}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Bemorlar qanday muammo bilan keladi                                 */
/* ------------------------------------------------------------------ */

/**
 * Murojaat sabablari — jamlangan holda.
 *
 * Bu TASHXIS EMAS: kimning nima bilan kasallangani bu yerda yo'q.
 * Butun bozor bo'yicha ulush ko'rsatiladi.
 *
 * O'sish foizi eng muhim ustun: qaysi muammo ko'payib borayotgani
 * — klinika qaysi yo'nalishga shifokor olishi kerakligini,
 * farmatsevtikaga esa nimaga talab ortayotganini aytadi.
 */
function ConditionsCard({ data }: { data: PlatformDataStats }) {
  const { t, tComplaint } = useI18n()
  const max = Math.max(...data.byCondition.map((c) => c.share), 1)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader title={t('data.conditions')} subtitle={t('data.conditionsHint')} />
      </div>

      <ul>
        {data.byCondition.map((row) => (
          <li key={row.key} className="hairline last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="w-44 shrink-0 truncate text-subhead font-medium text-label">
                {tComplaint(row.key)}
              </span>

              <span className="min-w-32 flex-1">
                <ProgressBar value={(row.share / max) * 100} tone="accent" />
              </span>

              <span className="w-14 shrink-0 text-right text-footnote font-semibold tnum text-label">
                {percent(row.share, 1)}
              </span>

              <span
                className={cn(
                  'w-16 shrink-0 text-right text-caption font-medium tnum',
                  row.changePct >= 0 ? 'text-ok' : 'text-bad',
                )}
              >
                {row.changePct >= 0 ? '+' : ''}
                {percent(row.changePct, 0)}
              </span>

              <span className="hidden w-28 shrink-0 text-right text-caption tnum text-label-tertiary sm:block">
                {t('data.avgVisits', { count: row.avgVisits })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Xizmatlar bozori                                                    */
/* ------------------------------------------------------------------ */

/**
 * Xizmatlar bo'yicha talab va narx tarqoqligi.
 *
 * `min–max` oralig'i — bu sahifadagi eng qimmatli raqam. Yangi
 * klinika ochayotgan odam ham, narxini ko'tarmoqchi bo'lgan mavjud
 * klinika ham aynan shu oraliqni bilishni xohlaydi.
 */
function ServicesCard({ data }: { data: PlatformDataStats }) {
  const { t, tService } = useI18n()

  return (
    <Card className="min-w-0">
      <CardHeader title={t('data.services')} subtitle={t('data.servicesHint')} />

      <ul className="mt-5 space-y-4">
        {data.topServices.map((row) => (
          <li key={row.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-footnote font-medium text-label">
                {tService(row.key)}
              </span>
              <span className="shrink-0 text-footnote font-semibold tnum text-label">
                {percent(row.share, 1)}
              </span>
            </div>

            <ProgressBar value={row.share * 6} tone="accent" className="mt-2" />

            <p className="mt-1.5 text-caption tnum text-label-tertiary">
              {money(row.avgPrice)}
              <span className="text-label-quaternary">
                {' '}
                ({money(row.priceMin)} — {money(row.priceMax)})
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Mutaxassisliklar                                                    */
/* ------------------------------------------------------------------ */

function SpecialtyCard({ data }: { data: PlatformDataStats }) {
  const { t, tSpecialty } = useI18n()

  return (
    <Card className="min-w-0">
      <CardHeader title={t('data.specialties')} subtitle={t('data.specialtiesHint')} />

      <ul className="mt-4 space-y-2.5">
        {data.bySpecialty.slice(0, 7).map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-footnote text-label-secondary">
              {tSpecialty(row.key)}
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="text-footnote font-semibold tnum text-label">
                {percent(row.share, 1)}
              </span>
              <span
                className={cn(
                  'w-14 text-right text-caption font-medium tnum',
                  row.changePct >= 0 ? 'text-ok' : 'text-bad',
                )}
              >
                {row.changePct >= 0 ? '+' : ''}
                {percent(row.changePct, 0)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Mavsumiylik                                                         */
/* ------------------------------------------------------------------ */

/**
 * Qaysi oyda murojaat ko'payadi.
 *
 * 100 = yillik o'rtacha. Klinika uchun bu xodim rejalashtirish
 * uchun kerak, bozor uchun esa reklama byudjetini qachon ko'tarish
 * kerakligini ko'rsatadi.
 */
function SeasonalityCard({ data }: { data: PlatformDataStats }) {
  const { t } = useI18n()
  const labels = monthsShort()

  return (
    <Card className="min-w-0">
      <CardHeader title={t('data.seasonality')} subtitle={t('data.seasonalityHint')} />

      <div className="mt-5 flex h-28 items-end gap-1">
        {data.seasonality.map((row, index) => {
          const high = row.index >= 110
          const low = row.index <= 90

          return (
            <div key={row.month} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  data-motion="bar"
                  className={cn(
                    'w-full rounded-t-[3px]',
                    high ? 'bg-warn' : low ? 'bg-accent/30' : 'bg-accent/60',
                  )}
                  style={{
                    height: `${(row.index / 140) * 100}%`,
                    animationDelay: `${200 + index * 45}ms`,
                  }}
                  title={`${labels[row.month]} · ${row.index}`}
                />
              </div>
              <span className="text-caption-2 text-label-tertiary">
                {labels[row.month].slice(0, 1)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Hududlar                                                            */
/* ------------------------------------------------------------------ */

function CityCard({ data }: { data: PlatformDataStats }) {
  const { t } = useI18n()
  const max = Math.max(...data.byCity.map((c) => c.patients), 1)

  return (
    <Card padded={false} className="min-w-0">
      <div className="p-5 sm:p-6 sm:pb-3">
        <CardHeader title={t('data.regions')} subtitle={t('data.regionsHint')} />
      </div>

      <ul>
        {data.byCity.map((row) => (
          <li key={row.city} className="hairline last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <MapPin size={15} className="shrink-0 text-label-tertiary" />

              <span className="w-28 shrink-0 truncate text-subhead font-medium text-label">
                {row.city}
              </span>

              <span className="min-w-32 flex-1">
                <ProgressBar value={(row.patients / max) * 100} tone="brand" />
              </span>

              <span className="w-20 shrink-0 text-right text-footnote tnum text-label">
                {groupDigits(row.patients)}
              </span>

              <span className="w-24 shrink-0 text-right text-caption tnum text-label-tertiary">
                {t('platform.clinicCount', { count: row.clinics })}
              </span>

              <span className="w-28 shrink-0 text-right text-footnote font-medium tnum text-label">
                {money(row.avgCheck)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
