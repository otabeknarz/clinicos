import { useEffect, useState } from 'react'
import { Check, Phone, Search, UserX } from 'lucide-react'

import { createFeedback, lookupByPhone } from '@/api/feedback'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PhoneInput, TextArea } from '@/components/ui/Form'
import { Stars } from '@/components/ui/Stars'
import { cn } from '@/lib/cn'
import { dateShort, phoneToE164 } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { FeedbackLookup } from '@/types/models'

/**
 * Izoh qoldirish.
 *
 * Ikki qadam:
 *   1. Bemor telefon raqamini kiritadi -> tizim uni topadi
 *   2. Tashrifni tanlab, baho va izoh qoldiradi
 *
 * Ro'yxatdan o'tish, parol yoki ilova kerak emas — eng past to'siq.
 * Real hayotda bu forma klinikadagi planshetda yoki QR orqali
 * bemorning telefonida ochiladi.
 */
export function FeedbackFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t, tService } = useI18n()
  const toast = useToast()

  const [phone, setPhone] = useState('+998 ')
  const [lookup, setLookup] = useState<FeedbackLookup | null>(null)
  const [visitId, setVisitId] = useState<string | null>(null)

  const [rating, setRating] = useState(0)
  const [scores, setScores] = useState({
    doctor: 0,
    service: 0,
    cleanliness: 0,
    waiting: 0,
  })
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(true)

  useEffect(() => {
    if (!open) return
    setPhone('+998 ')
    setLookup(null)
    setVisitId(null)
    setRating(0)
    setScores({ doctor: 0, service: 0, cleanliness: 0, waiting: 0 })
    setText('')
    setAnonymous(true)
  }, [open])

  const find = useAction(async () => lookupByPhone(phoneToE164(phone)))
  const save = useAction(async () => {
    const visit = lookup?.recentVisits.find((v) => v.appointmentId === visitId)
    return createFeedback({
      phone: phoneToE164(phone),
      patientId: lookup?.patientId ?? null,
      patientName: lookup?.patientName ?? '',
      doctorId: visit?.doctorId ?? null,
      appointmentId: visitId,
      rating,
      // Alohida baho qo'yilmagan bo'lsa — umumiy bahoni olamiz
      scores: {
        doctor: scores.doctor || rating,
        service: scores.service || rating,
        cleanliness: scores.cleanliness || rating,
        waiting: scores.waiting || rating,
      },
      text: text.trim(),
      isAnonymous: anonymous,
    })
  })

  async function handleFind() {
    const result = await find.run()
    if (result) {
      setLookup(result)
      // Baholanmagan birinchi tashrifni oldindan tanlaymiz
      const first = result.recentVisits.find((v) => !v.hasFeedback)
      setVisitId(first?.appointmentId ?? null)
    }
  }

  async function submit() {
    if (rating === 0) return
    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('feedbackForm.thanks'))
    onSaved()
    onClose()
  }

  const digits = phone.replace(/\D/g, '')
  const canFind = digits.length >= 12

  const SCORE_KEYS = ['doctor', 'service', 'cleanliness', 'waiting'] as const

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('feedbackForm.title')}
      footer={
        lookup?.found ? (
          <>
            <Button variant="gray" onClick={onClose}>
              {t('action.cancel')}
            </Button>
            <Button onClick={submit} loading={save.pending} disabled={rating === 0}>
              {t('feedbackForm.submit')}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5 pb-2">
        {/* ============ 1-qadam: telefon ============ */}
        <div>
          <div className="flex items-end gap-2">
            <PhoneInput
              label={t('feedbackForm.phoneStep')}
              value={phone}
              hint={t('feedbackForm.phoneHint')}
              fieldClassName="flex-1"
              icon={<Phone size={16} />}
              onChange={(next) => {
                setPhone(next)
                setLookup(null)
              }}
            />
            <Button
              className="mb-6"
              icon={<Search size={16} />}
              disabled={!canFind}
              loading={find.pending}
              onClick={handleFind}
            >
              {t('feedbackForm.find')}
            </Button>
          </div>

          {lookup && !lookup.found ? (
            <div className="flex items-center gap-3 rounded-[12px] bg-warn-soft px-4 py-3">
              <UserX size={18} className="shrink-0 text-warn" />
              <div className="min-w-0">
                <p className="text-subhead font-medium text-warn">
                  {t('feedbackForm.notFound')}
                </p>
                <p className="text-caption text-label-secondary">
                  {t('feedbackForm.notFoundHint')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ============ 2-qadam: baho ============ */}
        {lookup?.found ? (
          <>
            <div className="rounded-[14px] bg-accent-soft px-4 py-3">
              <p className="text-subhead font-medium text-accent">
                {t('feedbackForm.hello', { name: lookup.patientName.split(' ')[0] })}
              </p>
            </div>

            {/* Tashrifni tanlash */}
            {lookup.recentVisits.length === 0 ? (
              <p className="text-footnote text-label-tertiary">
                {t('feedbackForm.noVisits')}
              </p>
            ) : (
              <div>
                <p className="mb-2 text-footnote font-medium text-label-secondary">
                  {t('feedbackForm.selectVisit')}
                </p>
                <ul className="space-y-2">
                  {lookup.recentVisits.map((visit) => {
                    const active = visitId === visit.appointmentId
                    return (
                      <li key={visit.appointmentId}>
                        <button
                          type="button"
                          disabled={visit.hasFeedback}
                          onClick={() => setVisitId(visit.appointmentId)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left',
                            'transition-colors duration-150',
                            visit.hasFeedback
                              ? 'cursor-not-allowed bg-sunken opacity-50'
                              : active
                                ? 'bg-accent-soft ring-1 ring-inset ring-accent/40'
                                : 'bg-sunken hover:bg-fill-4',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-subhead text-label">
                              {tService(visit.serviceName)}
                            </span>
                            <span className="block truncate text-caption text-label-tertiary">
                              {visit.doctorName} · {dateShort(visit.date)}
                            </span>
                          </span>

                          {visit.hasFeedback ? (
                            <span className="shrink-0 text-caption text-label-tertiary">
                              {t('feedbackForm.alreadyRated')}
                            </span>
                          ) : active ? (
                            <Check size={16} className="shrink-0 text-accent" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Umumiy baho */}
            <div className="rounded-[14px] bg-sunken p-4 text-center">
              <p className="text-footnote text-label-secondary">{t('feedbackForm.rate')}</p>
              <Stars value={rating} onChange={setRating} size={32} className="mt-2.5" />
            </div>

            {/* Alohida baholar */}
            <div>
              <p className="mb-2.5 text-footnote font-medium text-label-secondary">
                {t('feedbackForm.details')}
              </p>
              <ul className="space-y-2.5">
                {SCORE_KEYS.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="text-subhead text-label">
                      {t(`feedback.score.${key}`)}
                    </span>
                    <Stars
                      value={scores[key]}
                      size={20}
                      onChange={(value) => setScores((s) => ({ ...s, [key]: value }))}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <TextArea
              label={t('feedbackForm.comment')}
              placeholder={t('feedbackForm.commentPlaceholder')}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-sunken p-3.5">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ios-blue)]"
              />
              <span className="min-w-0">
                <span className="block text-subhead font-medium text-label">
                  {t('feedbackForm.anonymous')}
                </span>
                <span className="block text-caption text-label-secondary">
                  {t('feedbackForm.anonymousHint')}
                </span>
              </span>
            </label>
          </>
        ) : null}
      </div>
    </Modal>
  )
}
