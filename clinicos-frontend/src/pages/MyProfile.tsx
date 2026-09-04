import { useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Gift,
  Gavel,
  Percent,
  ThumbsUp,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { listBonuses } from '@/api/bonuses'
import { currentPeriod, getMyPenalties } from '@/api/penalties'
import { getMyStaffProfile } from '@/api/staff'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Progress'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { RatingBadge } from '@/pages/staff/RatingBadge'
import { cn } from '@/lib/cn'
import { dateCompact, money, percent } from '@/lib/format'
import { effectiveSalary } from '@/types/models'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import type { RatingFactor, StaffWithPerformance } from '@/types/models'

type Tab = 'result' | 'earnings' | 'schedule'

/**
 * "MENING PROFILIM" — shifokordan boshqa xodimlar uchun.
 *
 * Uchta savolga javob beradi:
 *   1. Men qanday ishlayapman?  (tizimning avtomatik bahosi)
 *   2. Bu oyda qancha olaman?   (maosh, foiz, bonus)
 *   3. Qaysi kunlari ishlayman? (jadval)
 *
 * NEGA BAHONI OCHIQ KO'RSATAMIZ: reyting baribir hisoblanadi va
 * bonusga ta'sir qiladi. Yopiq bo'lsa, xodim uchun bu "boshliqning
 * fikri" bo'lib qoladi va bahsga sabab bo'ladi. Ochiq bo'lsa —
 * tuzatish mumkin bo'lgan aniq ko'rsatkich: "kassa aniqligi 78%"
 * degan raqamni ko'targan odam nimani tuzatishini biladi.
 *
 * BU YERDA YO'Q: klinikaning daromadi, boshqa xodimlarning maoshi
 * yoki reytingi. Faqat o'zi haqida.
 */
export function MyProfilePage() {
  const { t } = useI18n()
  const { session } = useAuth()
  const [tab, setTab] = useState<Tab>('result')

  const { data, loading, error, reload } = useAsync(
    () => getMyStaffProfile(session?.user.email ?? ''),
    [session?.user.email],
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading && !data) return <CardSkeleton className="min-h-64" />

  // Klinika egasi shtatda bo'lmasligi mumkin — u holda karta ham yo'q
  if (!data) {
    return (
      <>
        <PageHeader title={t('nav.myProfile')} />
        <Card>
          <EmptyState title={t('schedule.noStaffRecord')} description="" className="py-10" />
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={data.fullName} size="lg" />
            <span>{data.fullName}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{data.positionTitle}</span>
            <span>{data.department}</span>
            <RatingBadge rating={data.performance.rating} />
          </span>
        }
      />

      <Card padded={false}>
        <div className="hairline px-5 pt-4 sm:px-6">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'result', label: t('myProfile.tab.result') },
              { value: 'earnings', label: t('earnings.tab') },
              { value: 'schedule', label: t('schedule.title') },
            ]}
          />
        </div>

        <div className="p-5 sm:p-6">
          {tab === 'result' ? <ResultTab staff={data} /> : null}
          {tab === 'earnings' ? <EarningsSection staff={data} /> : null}
          {tab === 'schedule' ? (
            <>
              <CardHeader title={t('schedule.title')} subtitle={t('schedule.pageSubtitle')} />
              <WorkScheduleCalendar staffId={data.id} className="mt-5" />
            </>
          ) : null}
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tizimning avtomatik bahosi                                          */
/* ------------------------------------------------------------------ */

/** Yaxshi ishlayotgan ko'rsatkich chegarasi */
const STRONG = 85
/** E'tibor talab qiladigan ko'rsatkich chegarasi */
const WEAK = 65

/**
 * Har bir omil uchun "nima qilish kerak" maslahati.
 *
 * Raqamning o'zi kam: "kassa aniqligi 62%" degan xodim nimani
 * tuzatishini bilmasligi mumkin. Maslahat aynan shuni aytadi.
 */
const ADVICE: Record<string, string> = {
  'staff.factor.discipline': 'advice.discipline',
  'staff.factor.cashAccuracy': 'advice.cashAccuracy',
  'staff.factor.volume': 'advice.volume',
  'staff.factor.completion': 'advice.completion',
  'staff.factor.noShow': 'advice.noShow',
}

function ResultTab({ staff }: { staff: StaffWithPerformance }) {
  const { t } = useI18n()
  const { performance } = staff

  if (performance.factors.length === 0) {
    return (
      <EmptyState
        title={t('staff.ratingNone')}
        description={t('myProfile.noDataHint')}
        className="py-10"
      />
    )
  }

  const strong = performance.factors.filter((f) => f.score >= STRONG)
  const weak = performance.factors.filter((f) => f.score < WEAK)

  return (
    <>
      <CardHeader title={t('myProfile.tab.result')} subtitle={t('common.last30d')} />

      {/* --- Xulosa --- */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Verdict
          tone="ok"
          icon={<ThumbsUp size={16} />}
          title={t('myProfile.strong')}
          factors={strong}
          empty={t('myProfile.strongEmpty')}
        />
        <Verdict
          tone="warn"
          icon={<AlertTriangle size={16} />}
          title={t('myProfile.weak')}
          factors={weak}
          empty={t('myProfile.weakEmpty')}
        />
      </div>

      {/* --- Ko'rsatkichlar --- */}
      <h3 className="mt-6 text-subhead font-semibold text-label">
        {t('staff.ratingAuto')}
      </h3>

      <ul className="mt-3 space-y-4">
        {performance.factors.map((factor) => (
          <li key={factor.labelKey}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-footnote text-label-secondary">{t(factor.labelKey)}</span>
              <span className="flex items-baseline gap-2">
                {/*
                  Xom qiymat faqat balldan farq qilsa ko'rsatiladi.
                  "84% 84%" degan takror xatoga o'xshab ko'rinadi.
                */}
                {factor.display !== percent(factor.score) ? (
                  <span className="text-caption tnum text-label-tertiary">
                    {factor.display}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'text-footnote font-semibold tnum',
                    factor.score >= STRONG
                      ? 'text-ok'
                      : factor.score < WEAK
                        ? 'text-bad'
                        : 'text-label',
                  )}
                >
                  {percent(factor.score)}
                </span>
              </span>
            </div>

            <ProgressBar
              value={factor.score}
              tone={factor.score >= STRONG ? 'ok' : factor.score < WEAK ? 'bad' : 'accent'}
              className="mt-2"
            />

            {/* Maslahat faqat past ko'rsatkichda — yaxshi natijaga o'git keraksiz */}
            {factor.score < WEAK && ADVICE[factor.labelKey] ? (
              <p className="mt-2 text-caption text-label-tertiary">
                {t(ADVICE[factor.labelKey])}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* --- Reja bajarilishi --- */}
      {performance.performancePct !== null ? (
        <div className="mt-6 rounded-[12px] bg-sunken px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-footnote text-label-secondary">{t('staff.metric.plan')}</span>
            <span className="text-subhead font-semibold tnum text-label">
              {percent(performance.performancePct)}
            </span>
          </div>
          <ProgressBar
            value={Math.min(100, performance.performancePct)}
            tone={performance.performancePct >= 100 ? 'ok' : 'accent'}
            className="mt-2"
          />
        </div>
      ) : null}

      <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
        <TrendingUp size={14} className="mt-0.5 shrink-0" />
        {t('myProfile.autoHint')}
      </p>
    </>
  )
}

/** Kuchli / zaif tomonlar ro'yxati */
function Verdict({
  tone,
  icon,
  title,
  factors,
  empty,
}: {
  tone: 'ok' | 'warn'
  icon: React.ReactNode
  title: string
  factors: RatingFactor[]
  empty: string
}) {
  const { t } = useI18n()

  return (
    <div className={cn('rounded-[12px] p-4', tone === 'ok' ? 'bg-ok-soft' : 'bg-warn-soft')}>
      <p
        className={cn(
          'flex items-center gap-2 text-footnote font-semibold',
          tone === 'ok' ? 'text-ok' : 'text-warn',
        )}
      >
        {icon}
        {title}
      </p>

      {factors.length === 0 ? (
        <p className="mt-2 text-caption text-label-secondary">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {factors.map((factor) => (
            <li
              key={factor.labelKey}
              className="flex items-baseline justify-between gap-3 text-caption text-label"
            >
              <span className="min-w-0 truncate">{t(factor.labelKey)}</span>
              <span className="shrink-0 font-semibold tnum">{percent(factor.score)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Moliya                                                              */
/* ------------------------------------------------------------------ */

/**
 * Xodimning shu oydagi puli.
 *
 * Faqat o'ziniki: klinikaning daromadi ham, boshqalarning maoshi ham
 * bu yerda yo'q.
 */
function EarningsSection({ staff }: { staff: StaffWithPerformance }) {
  const { t } = useI18n()
  const { performance } = staff

  const period = currentPeriod()

  const { data: bonuses } = useAsync(() => listBonuses(period, staff.id), [period, staff.id])

  /*
    Jarimalar shu yerda ko'rinishi SHART: xodim oylikni ko'rayotganda
    undan nima ushlanishini ham bir joyda ko'rishi kerak. Alohida
    bo'limga yashirilsa, oy oxirida "nega kam?" degan savol chiqadi.
  */
  const { data: penalties } = useAsync(
    () => getMyPenalties(staff.id, period),
    [period, staff.id],
  )

  const base = effectiveSalary(staff)
  const bonusTotal = (bonuses ?? []).reduce((sum, b) => sum + b.amount, 0)
  const penaltyTotal = penalties?.total ?? 0

  const rows = [
    staff.payType !== 'percent' && {
      key: 'salary',
      icon: <Wallet size={15} />,
      label: t('staff.payType.salary'),
      hint: staff.workRate !== 1 ? t('earnings.rateHint', { rate: staff.workRate }) : '',
      value: base,
      tone: 'text-label',
    },
    staff.payType !== 'salary' && {
      key: 'percent',
      icon: <Percent size={15} />,
      label: t('earnings.percentShare'),
      hint:
        performance.generatedRevenue !== null
          ? t('earnings.percentHint', {
              rate: staff.percentRate,
              revenue: money(performance.generatedRevenue),
            })
          : t('earnings.notAttributable'),
      value: performance.percentEarnings,
      tone: 'text-label',
    },
    bonusTotal > 0 && {
      key: 'bonus',
      icon: <Gift size={15} />,
      label: t('bonus.title'),
      hint: '',
      value: bonusTotal,
      tone: 'text-ok',
      negative: false,
    },
    penaltyTotal > 0 && {
      key: 'penalty',
      icon: <Gavel size={15} />,
      label: t('penalty.title'),
      hint: t('penalty.deducted'),
      value: penaltyTotal,
      tone: 'text-bad',
      negative: true,
    },
  ].filter((row): row is Exclude<typeof row, false> => Boolean(row))

  return (
    <>
      <CardHeader
        title={t('earnings.title')}
        subtitle={t(`staff.payType.${staff.payType}`)}
      />

      <div className="mt-5 rounded-[14px] bg-ok-soft px-5 py-4">
        <p className="text-footnote text-label-secondary">{t('earnings.total')}</p>
        <p className="mt-1 text-title-1 font-bold tnum text-ok">
          {money(base + performance.percentEarnings + bonusTotal - penaltyTotal)}
        </p>

        {/* Jarima bo'lsa, ungacha bo'lgan summa ham ko'rsatiladi */}
        {penaltyTotal > 0 ? (
          <p className="mt-1 text-caption text-label-secondary">
            {t('penalty.beforePenalty')}:{' '}
            <span className="tnum">
              {money(base + performance.percentEarnings + bonusTotal)}
            </span>
          </p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-3 rounded-[10px] bg-sunken px-4 py-3"
          >
            <span className="shrink-0 text-label-tertiary">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-footnote font-medium text-label">{row.label}</span>
              {row.hint ? (
                <span className="block text-caption text-label-tertiary">{row.hint}</span>
              ) : null}
            </span>
            <span className={cn('shrink-0 text-subhead font-semibold tnum', row.tone)}>
              {'negative' in row && row.negative ? '−' : ''}
              {money(row.value)}
            </span>
          </li>
        ))}
      </ul>

      {/* --- Bonuslar --- */}
      {(bonuses ?? []).length > 0 ? (
        <div className="mt-6">
          <h3 className="text-subhead font-semibold text-label">{t('bonus.title')}</h3>
          <ul className="mt-3 space-y-2">
            {(bonuses ?? []).map((bonus) => (
              <li
                key={bonus.id}
                className="flex flex-wrap items-center gap-3 rounded-[10px] bg-sunken px-4 py-3"
              >
                <Gift size={15} className="shrink-0 text-ok" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote text-label">
                    {bonus.reason || t('bonus.title')}
                  </span>
                  <span className="block text-caption text-label-tertiary">
                    {dateCompact(bonus.createdAt)}
                  </span>
                </span>
                <Badge tone={bonus.status === 'paid' ? 'ok' : 'neutral'} dot>
                  {t(`bonus.status.${bonus.status}`)}
                </Badge>
                <span className="shrink-0 text-footnote font-semibold tnum text-ok">
                  +{money(bonus.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* --- Jarimalar --- */}
      {(penalties?.items ?? []).length > 0 ? (
        <div className="mt-6">
          <h3 className="text-subhead font-semibold text-label">{t('penalty.myTitle')}</h3>

          <ul className="mt-3 space-y-2">
            {(penalties?.items ?? []).map((penalty) => (
              <li
                key={penalty.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3',
                  penalty.status === 'waived' ? 'bg-fill-4' : 'bg-bad-soft',
                )}
              >
                <Gavel
                  size={15}
                  className={cn(
                    'shrink-0',
                    penalty.status === 'waived' ? 'text-label-tertiary' : 'text-bad',
                  )}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-footnote font-medium text-label">
                    {penalty.ruleName}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {t(`penalty.trigger.${penalty.trigger}`)} · {penalty.reason}
                  </span>
                </span>

                {penalty.status === 'waived' ? (
                  <Badge tone="ok">{t('penalty.waived')}</Badge>
                ) : null}

                <span
                  className={cn(
                    'shrink-0 text-footnote font-semibold tnum',
                    penalty.status === 'waived'
                      ? 'text-label-quaternary line-through'
                      : 'text-bad',
                  )}
                >
                  −{money(penalty.amount)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-caption text-label-tertiary">{t('penalty.myHint')}</p>
        </div>
      ) : null}

      <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-fill-4 px-3 py-2.5 text-caption text-label-secondary">
        <CalendarDays size={14} className="mt-0.5 shrink-0" />
        {t('earnings.periodHint')}
      </p>
    </>
  )
}
