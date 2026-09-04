import { useState } from 'react'
import { AlertCircle, MessageSquare, MessageSquarePlus, Search, Send, Star } from 'lucide-react'

import { getFeedbackStats, listFeedback, replyToFeedback, setFeedbackStatus } from '@/api/feedback'
import { listDoctorsShort } from '@/api/doctors'
import { FeedbackFormModal } from '@/components/modals/FeedbackFormModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { SearchInput, Select } from '@/components/ui/Form'
import { StatCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/Progress'
import { Stars, StarValue } from '@/components/ui/Stars'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States'
import { Pagination } from '@/components/ui/Table'
import { FilterPills } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'
import type { Tone } from '@/lib/status'
import { useAction, useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { Feedback, FeedbackStatus } from '@/types/models'

const PAGE_SIZE = 12

export function FeedbackPage() {
  const { t } = useI18n()
  const { can, session } = useAuth()

  const [search, setSearch] = useState('')
  // FilterPills matnli qiymat bilan ishlaydi, shuning uchun baho ham matn
  const [rating, setRating] = useState<string>('all')
  const [doctorId, setDoctorId] = useState<string>('all')
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [version, setVersion] = useState(0)

  const debounced = useDebounced(search, 250)
  const isDoctor = session?.user.role === 'doctor'

  const stats = useAsync(() => getFeedbackStats(90), [version])
  const { data, loading, error, reload } = useAsync(
    () =>
      listFeedback({
        search: debounced,
        rating: rating === 'all' ? 'all' : Number(rating),
        doctorId,
        status,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debounced, rating, doctorId, status, page, version],
  )

  const { data: doctors } = useAsync(() => listDoctorsShort(), [], { skip: isDoctor })

  function refresh() {
    setVersion((v) => v + 1)
    reload()
  }

  return (
    <>
      <PageHeader
        title={t('feedback.title')}
        subtitle={t('feedback.subtitle')}
        actions={
          /*
            Izohni registratura kiritadi: bemor telefon qoldiradi,
            registrator yozadi. Shifokor O'ZI HAQIDA izoh qoldira
            olmasligi kerak — aks holda baholarning ma'nosi qolmaydi.
          */
          can('feedback.manage') ? (
            <Button icon={<MessageSquarePlus size={16} />} onClick={() => setFormOpen(true)}>
              <span className="hidden sm:inline">{t('feedback.add')}</span>
            </Button>
          ) : null
        }
      />

      {/* --- Yuqori ko'rsatkichlar --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={stats.loading}
          icon={<Star size={14} />}
          tone="warn"
          label={t('feedback.average')}
          value={stats.data ? stats.data.average.toFixed(2) : '—'}
        />
        <StatCard
          loading={stats.loading}
          icon={<MessageSquare size={14} />}
          tone="accent"
          label={t('feedback.total')}
          value={stats.data ? String(stats.data.total) : '—'}
        />
        <StatCard
          loading={stats.loading}
          icon={<AlertCircle size={14} />}
          tone={stats.data && stats.data.unanswered > 0 ? 'bad' : 'ok'}
          label={t('feedback.unanswered')}
          value={stats.data ? String(stats.data.unanswered) : '—'}
        />
        <StatCard
          loading={stats.loading}
          icon={<Star size={14} />}
          tone="neutral"
          label={t('feedback.score.waiting')}
          value={stats.data ? stats.data.byScore.waiting.toFixed(1) : '—'}
        />
      </div>

      {/* --- Taqsimot va yo'nalishlar --- */}
      {stats.data && stats.data.total > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('feedback.distribution')} />
            <ul className="mt-4 space-y-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.data!.distribution[star - 1]
                const pct = stats.data!.total ? (count / stats.data!.total) * 100 : 0
                return (
                  <li key={star} className="flex items-center gap-3">
                    <span className="flex w-8 shrink-0 items-center gap-1 text-footnote tnum text-label-secondary">
                      {star}
                      <Star size={11} className="fill-current text-[var(--ios-yellow)]" />
                    </span>
                    <ProgressBar
                      value={pct}
                      tone={star >= 4 ? 'ok' : star === 3 ? 'warn' : 'bad'}
                      className="flex-1"
                    />
                    <span className="w-12 shrink-0 text-right text-caption tnum text-label-tertiary">
                      {count}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t('feedbackForm.details')} />
            <ul className="mt-4 space-y-3.5">
              {(['doctor', 'service', 'cleanliness', 'waiting'] as const).map((key) => {
                const value = stats.data!.byScore[key]
                return (
                  <li key={key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-subhead text-label">
                        {t(`feedback.score.${key}`)}
                      </span>
                      <span className="text-footnote font-semibold tnum text-label">
                        {value.toFixed(1)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(value / 5) * 100}
                      tone={value >= 4.5 ? 'ok' : value >= 3.5 ? 'accent' : 'warn'}
                      className="mt-2"
                    />
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      {/* --- Shifokorlar reytingi --- */}
      {!isDoctor && stats.data && stats.data.byDoctor.length > 0 ? (
        <Card className="mt-5">
          <CardHeader title={t('feedback.byDoctor')} />
          <ul className="mt-4 space-y-3">
            {stats.data.byDoctor.map((row) => (
              <li key={row.doctorId} className="flex items-center gap-3">
                <Avatar name={row.doctorName} size="xs" />
                <span className="min-w-0 flex-1 truncate text-subhead text-label">
                  {row.doctorName}
                </span>
                <Stars value={row.average} size={13} />
                <StarValue value={row.average} count={row.count} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* --- Izohlar ro'yxati --- */}
      <Card padded={false} className="mt-5">
        <div className="hairline space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder={t('action.search')}
              icon={<Search size={16} />}
              className="sm:max-w-xs"
            />

            {!isDoctor ? (
              <Select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value)
                  setPage(1)
                }}
                placeholder={t('calendar.allDoctors')}
                options={[
                  { value: 'all', label: t('calendar.allDoctors') },
                  ...(doctors ?? []).map((d) => ({ value: d.id, label: d.fullName })),
                ]}
                className="sm:w-56"
              />
            ) : null}

            <FilterPills<FeedbackStatus | 'all'>
              value={status}
              onChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
              options={[
                { value: 'all', label: t('common.all') },
                { value: 'new', label: t('feedback.status.new') },
                { value: 'reviewed', label: t('feedback.status.reviewed') },
              ]}
              className="sm:ml-auto"
            />
          </div>

          <FilterPills
            value={rating}
            onChange={(v) => {
              setRating(v)
              setPage(1)
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: '5', label: '5 ★' },
              { value: '4', label: '4 ★' },
              { value: '3', label: '3 ★' },
              { value: '2', label: '2 ★' },
              { value: '1', label: '1 ★' },
            ]}
          />
        </div>

        {error ? (
          <ErrorState onRetry={reload} />
        ) : loading ? (
          <CardSkeleton className="m-5 border-0 shadow-none" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} strokeWidth={1.75} />}
            title={t('feedback.empty')}
            description=""
          />
        ) : (
          <>
            <ul>
              {data!.items.map((item) => (
                <FeedbackRow
                  key={item.id}
                  feedback={item}
                  canReply={can('feedback.manage')}
                  onChanged={refresh}
                />
              ))}
            </ul>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onChange={setPage}
              className="hairline-t"
            />
          </>
        )}
      </Card>

      <FeedbackFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bitta izoh                                                          */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<FeedbackStatus, Tone> = {
  new: 'accent',
  reviewed: 'ok',
  archived: 'neutral',
}

function FeedbackRow({
  feedback,
  canReply,
  onChanged,
}: {
  feedback: Feedback
  canReply: boolean
  onChanged: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')

  const reply = useAction(async () => replyToFeedback(feedback.id, replyText.trim()))
  const markReviewed = useAction(async () => setFeedbackStatus(feedback.id, 'reviewed'))

  const anonymous = feedback.isAnonymous || !feedback.patientName
  const displayName = anonymous ? t('feedback.anonymous') : feedback.patientName

  async function send() {
    if (!replyText.trim()) return
    await reply.run()
    toast.success(t('feedback.replied'))
    setReplying(false)
    setReplyText('')
    onChanged()
  }

  return (
    <li className="hairline px-5 py-4 last:border-b-0 sm:px-6">
      <div className="flex items-start gap-3">
        <Avatar name={anonymous ? '· ·' : feedback.patientName} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span
              className={cn(
                'text-subhead font-medium',
                anonymous ? 'text-label-tertiary' : 'text-label',
              )}
            >
              {displayName}
            </span>
            <Stars value={feedback.rating} size={13} />
            <span className="text-caption tnum text-label-tertiary">
              {dateTime(feedback.createdAt)}
            </span>
            <Badge tone={STATUS_TONE[feedback.status]}>
              {t(`feedback.status.${feedback.status}`)}
            </Badge>
          </div>

          {feedback.text ? (
            <p className="mt-2 text-subhead text-label">{feedback.text}</p>
          ) : null}

          {/* Alohida baholar */}
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {(['doctor', 'service', 'cleanliness', 'waiting'] as const).map((key) => (
              <li key={key} className="text-caption text-label-tertiary">
                {t(`feedback.score.${key}`)}:{' '}
                <span className="font-medium tnum text-label-secondary">
                  {feedback.scores[key]}
                </span>
              </li>
            ))}
          </ul>

          {/* Klinika javobi */}
          {feedback.reply ? (
            <div className="mt-3 rounded-[12px] bg-sunken px-3.5 py-2.5">
              <p className="text-caption font-medium text-label-tertiary">
                {t('feedback.clinicReply')}
              </p>
              <p className="mt-1 text-footnote text-label">{feedback.reply}</p>
            </div>
          ) : null}

          {/* Javob yozish */}
          {canReply && !feedback.reply ? (
            replying ? (
              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  autoFocus
                  value={replyText}
                  placeholder={t('feedback.replyPlaceholder')}
                  onChange={(e) => setReplyText(e.target.value)}
                  className={cn(
                    'w-full rounded-[10px] bg-sunken px-3.5 py-2.5 text-subhead text-label',
                    'border border-transparent outline-none resize-y',
                    'placeholder:text-label-tertiary focus:border-accent',
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    icon={<Send size={14} />}
                    loading={reply.pending}
                    onClick={send}
                  >
                    {t('feedback.reply')}
                  </Button>
                  <Button size="sm" variant="gray" onClick={() => setReplying(false)}>
                    {t('action.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="tinted" onClick={() => setReplying(true)}>
                  {t('feedback.reply')}
                </Button>
                {feedback.status === 'new' ? (
                  <Button
                    size="sm"
                    variant="plain"
                    loading={markReviewed.pending}
                    onClick={async () => {
                      await markReviewed.run()
                      onChanged()
                    }}
                  >
                    {t('feedback.markReviewed')}
                  </Button>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </div>
    </li>
  )
}
