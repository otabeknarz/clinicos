import { useState } from 'react'
import { Check, Gift, Lightbulb, Plus, Settings2, Trash2 } from 'lucide-react'

import {
  acceptSuggestion,
  currentPeriod,
  deleteBonus,
  getBonusSuggestions,
  listBonuses,
  listBonusRules,
  payBonus,
  updateBonusRule,
} from '@/api/bonuses'
import { RatingBadge } from './RatingBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { CardHeader } from '@/components/ui/Card'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { money, percent } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { BonusStatus, BonusSuggestion } from '@/types/models'

type SubTab = 'list' | 'suggestions' | 'rules'

export function BonusesTab({ onDataChange }: { onDataChange: () => void }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<SubTab>('list')

  return (
    <>
      <div className="hairline px-5 pt-4 sm:px-6">
        <Tabs<SubTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'list', label: t('bonus.tab.list') },
            { value: 'suggestions', label: t('bonus.tab.suggestions') },
            { value: 'rules', label: t('bonus.tab.rules') },
          ]}
        />
      </div>

      {tab === 'list' ? <BonusList onDataChange={onDataChange} /> : null}
      {tab === 'suggestions' ? <SuggestionList onDataChange={onDataChange} /> : null}
      {tab === 'rules' ? <RuleList /> : null}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Berilgan bonuslar                                                   */
/* ------------------------------------------------------------------ */

const BONUS_TONE: Record<BonusStatus, Tone> = {
  planned: 'warn',
  approved: 'accent',
  paid: 'ok',
}

function BonusList({ onDataChange }: { onDataChange: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const { can } = useAuth()

  const [version, setVersion] = useState(0)
  const { data, loading, error, reload } = useAsync(() => listBonuses(), [version])

  const pay = useAction(async (id: string) => payBonus(id))
  const remove = useAction(async (id: string) => deleteBonus(id))

  function refresh() {
    setVersion((v) => v + 1)
    onDataChange()
  }

  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data) return <CardSkeleton className="m-5 border-0 shadow-none" />
  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Gift size={24} strokeWidth={1.75} />}
        title={t('bonus.empty')}
        description=""
      />
    )
  }

  const period = currentPeriod()
  const thisPeriodTotal = data
    .filter((b) => b.period === period)
    .reduce((sum, b) => sum + b.amount, 0)

  return (
    <>
      <div className="hairline flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 sm:px-6">
        <span className="text-footnote text-label-secondary">{t('bonus.thisMonth')}</span>
        <span className="text-title-3 font-semibold tnum text-label">
          {money(thisPeriodTotal)}
        </span>
      </div>

      <ul>
        {data.map((bonus) => (
          <li
            key={bonus.id}
            className="hairline flex flex-wrap items-center gap-3 px-5 py-3 last:border-b-0 sm:px-6"
          >
            <Avatar name={bonus.staffName} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-subhead font-medium text-label">{bonus.staffName}</p>
              <p className="truncate text-caption text-label-tertiary">
                {bonus.reason || t(`bonus.source.${bonus.source}`)}
              </p>
            </div>

            <span className="shrink-0 text-caption tnum text-label-tertiary">
              {bonus.period}
            </span>

            <span className="shrink-0 text-subhead font-semibold tnum text-label">
              {money(bonus.amount)}
            </span>

            <Badge tone={BONUS_TONE[bonus.status]} dot>
              {t(`bonus.status.${bonus.status}`)}
            </Badge>

            {can('bonus.manage') ? (
              <div className="flex shrink-0 gap-1">
                {bonus.status !== 'paid' ? (
                  <IconButton
                    label={t('bonus.pay')}
                    className="hover:text-ok"
                    onClick={async () => {
                      await pay.run(bonus.id)
                      toast.success(t('toast.updated'))
                      refresh()
                    }}
                  >
                    <Check size={15} />
                  </IconButton>
                ) : null}
                <IconButton
                  label={t('action.delete')}
                  className="hover:text-bad"
                  onClick={async () => {
                    await remove.run(bonus.id)
                    toast.success(t('toast.deleted'))
                    refresh()
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Tizim takliflari                                                    */
/* ------------------------------------------------------------------ */

function SuggestionList({ onDataChange }: { onDataChange: () => void }) {
  const { t } = useI18n()
  const toast = useToast()

  const [version, setVersion] = useState(0)
  const period = currentPeriod()
  const { data, loading, error, reload } = useAsync(
    () => getBonusSuggestions(period),
    [version],
  )

  const accept = useAction(async (suggestion: BonusSuggestion) =>
    acceptSuggestion(suggestion, period),
  )

  async function acceptOne(suggestion: BonusSuggestion) {
    await accept.run(suggestion)
    toast.success(t('bonus.given'))
    setVersion((v) => v + 1)
    onDataChange()
  }

  async function acceptAll() {
    for (const suggestion of data ?? []) {
      await accept.run(suggestion)
    }
    toast.success(t('bonus.given'))
    setVersion((v) => v + 1)
    onDataChange()
  }

  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data) return <CardSkeleton className="m-5 border-0 shadow-none" />

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb size={24} strokeWidth={1.75} />}
        title={t('bonus.noSuggestions')}
        description={t('bonus.suggestionsHint')}
      />
    )
  }

  const total = data.reduce((sum, s) => sum + s.amount, 0)

  return (
    <>
      <div className="hairline px-5 py-4 sm:px-6">
        <CardHeader
          title={t('bonus.suggestions')}
          subtitle={t('bonus.suggestionsHint')}
          action={
            <Button size="sm" variant="tinted" loading={accept.pending} onClick={acceptAll}>
              {t('bonus.acceptAll')} · {money(total)}
            </Button>
          }
        />
      </div>

      <ul>
        {data.map((suggestion) => (
          <li
            key={suggestion.staffId}
            className="hairline flex flex-wrap items-center gap-3 px-5 py-3 last:border-b-0 sm:px-6"
          >
            <Avatar name={suggestion.staffName} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-subhead font-medium text-label">
                {suggestion.staffName}
              </p>
              <p className="truncate text-caption text-label-tertiary">{suggestion.ruleName}</p>
            </div>

            {suggestion.performancePct !== null ? (
              <span className="shrink-0 text-caption tnum text-label-secondary">
                {percent(suggestion.performancePct)}
              </span>
            ) : null}

            <RatingBadge rating={suggestion.rating} size="sm" />

            <span className="shrink-0 text-subhead font-semibold tnum text-label">
              {money(suggestion.amount)}
            </span>

            <Button
              size="sm"
              variant="tinted"
              icon={<Check size={14} />}
              onClick={() => acceptOne(suggestion)}
            >
              {t('bonus.accept')}
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Qoidalar                                                            */
/* ------------------------------------------------------------------ */

function RuleList() {
  const { t } = useI18n()
  const toast = useToast()

  const [version, setVersion] = useState(0)
  const { data, loading, error, reload } = useAsync(() => listBonusRules(), [version])
  const toggle = useAction(async (id: string, isActive: boolean) =>
    updateBonusRule(id, { isActive }),
  )

  if (error) return <ErrorState onRetry={reload} />
  if (loading || !data) return <CardSkeleton className="m-5 border-0 shadow-none" />

  return (
    <>
      <div className="hairline px-5 py-4 sm:px-6">
        <CardHeader
          title={t('bonus.rules')}
          subtitle={t('bonus.suggestionsHint')}
          action={
            <Button size="sm" variant="tinted" icon={<Plus size={14} />} disabled>
              {t('bonus.rule.add')}
            </Button>
          }
        />
      </div>

      {data.length === 0 ? (
        <EmptyState icon={<Settings2 size={24} strokeWidth={1.75} />} />
      ) : (
        <ul>
          {data.map((rule) => (
            <li
              key={rule.id}
              className="hairline flex flex-wrap items-center gap-3 px-5 py-4 last:border-b-0 sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-medium text-label">{rule.name}</p>
                <p className="mt-0.5 text-caption text-label-tertiary">
                  {rule.positions.length === 0
                    ? t('bonus.rule.allPositions')
                    : rule.positions.map((p) => t(`staff.position.${p}`)).join(', ')}
                  {rule.minPerformance > 0
                    ? ` · ${t('bonus.rule.minPerformance')} ${percent(rule.minPerformance)}`
                    : ''}
                  {rule.minRating > 0
                    ? ` · ${t('bonus.rule.minRating')} ${rule.minRating}`
                    : ''}
                </p>
              </div>

              <span className="shrink-0 text-subhead font-semibold tnum text-label">
                {rule.rewardType === 'fixed'
                  ? money(rule.rewardValue)
                  : `${rule.rewardValue}%`}
              </span>

              <button
                type="button"
                onClick={async () => {
                  await toggle.run(rule.id, !rule.isActive)
                  toast.success(t('toast.updated'))
                  setVersion((v) => v + 1)
                }}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-caption font-medium transition-colors duration-150',
                  rule.isActive
                    ? 'bg-ok-soft text-ok'
                    : 'bg-fill-4 text-label-tertiary',
                )}
              >
                {rule.isActive ? t('bonus.rule.active') : t('bonus.rule.inactive')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="px-5 py-3 text-caption text-label-tertiary sm:px-6">
        {t('bonus.suggestionsHint')}
      </p>
    </>
  )
}
