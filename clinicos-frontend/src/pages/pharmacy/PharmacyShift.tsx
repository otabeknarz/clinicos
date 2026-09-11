import { useState } from 'react'
import { CheckCircle2, Lock, TriangleAlert } from 'lucide-react'

import { closePharmacyShift, handoverCandidates, todayShift } from '@/api/pharmacy'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, Select, TextArea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { money } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * SMENANI YOPISH — sotuvchining kun oxiridagi ishi.
 *
 * TIZIM SUMMASI KO'RINIB TURADI va bu ataylab. Avval u
 * yashirilgan edi — "sanash ko'chirishga aylanmasin" degan
 * fikrda. Amalda teskarisi muhimroq: raqamni ko'rib turgan odam
 * undan KAM yozishga qo'rqadi, chunki farq darhol ko'rinadi.
 *
 * Kam yozsa — ogohlantirish chiqadi. Baribir davom etsa, yozuv
 * RAHBARGA ketadi va unga shunday deb aytiladi. Yashirin
 * belgilanmaydi: odam nima bo'layotganini bilib turishi kerak,
 * aks holda bu tuzoqqa aylanardi.
 */
export function PharmacyShiftPage() {
  const { t } = useI18n()
  const toast = useToast()

  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [handedTo, setHandedTo] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ diff: number; flagged: boolean } | null>(null)

  const { data, loading, reload } = useAsync(todayShift, [])
  const candidates = useAsync(handoverCandidates, [])

  const close = useAction(async (flagged: boolean) => {
    await closePharmacyShift(Number(counted) || 0, note, flagged, handedTo || null)
  })

  const expected = data?.expectedCash ?? 0
  const value = Number(counted) || 0
  const diff = value - expected

  /*
    5 000 so'mgacha farqda ogohlantirish chiqmaydi: qaytim
    xatosi shuncha bo'lishi mumkin va har safar rahbarni
    chaqirsak, belgining o'zi ma'nosini yo'qotardi.
  */
  const TOLERANCE = 5000
  const needsWarning = counted !== '' && diff < -TOLERANCE

  async function finish(flagged: boolean) {
    const done = await close.run(flagged)
    if (done === null) {
      toast.error(t('toast.error'))
      return
    }
    setConfirming(false)
    setResult({ diff, flagged })
    toast.success(flagged ? t('pharmacy.sentToOwner') : t('pharmacy.shiftClosed'))
    void reload()
  }

  function submit() {
    if (counted === '') return
    if (needsWarning) {
      setConfirming(true)
      return
    }
    void finish(false)
  }

  if (loading || !data) return <CardSkeleton />

  /* --- Yopilgandan keyin --- */
  if (result || data.closed) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title={t('pharmacy.shiftDone')}
          description={
            result
              ? result.flagged
                ? t('pharmacy.shiftSentToOwner', { sum: money(Math.abs(result.diff)) })
                : result.diff === 0
                  ? t('pharmacy.shiftExact')
                  : result.diff < 0
                    ? t('pharmacy.shiftShort', { sum: money(Math.abs(result.diff)) })
                    : t('pharmacy.shiftOver', { sum: money(result.diff) })
              : t('pharmacy.shiftAlready')
          }
        />
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader title={t('nav.pharmacyShift')} subtitle={t('pharmacy.shiftHint')} />

        <div className="mt-4 space-y-3">
          <Row label={t('pharmacy.receipts')} value={String(data.receipts)} />
          <Row label={t('payments.method.card')} value={money(data.cardTotal)} />
          {/*
            NAQD SAVDO KO'RINIB TURADI — bu ekrandagi eng muhim
            raqam. Odam undan kam yozsa, farqni o'zi ham ko'radi.
          */}
          <div className="hairline-t flex items-center justify-between pt-3">
            <span className="text-headline font-semibold text-label">
              {t('pharmacy.cashSales')}
            </span>
            <span className="text-title-3 font-bold tabular-nums text-label">
              {money(expected)}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <Field label={t('pharmacy.countedCash')} required hint={t('pharmacy.countHint')}>
          <input
            inputMode="numeric"
            autoFocus
            value={counted}
            placeholder="0"
            onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))}
            className="h-12 w-full rounded-[10px] border border-transparent bg-raised px-4 text-title-3 font-bold tabular-nums text-label outline-none transition-colors duration-150 focus:border-accent"
          />
        </Field>

        {/* Farq YOZAYOTGANDA ko'rinadi — saqlagandan keyin emas */}
        {counted !== '' && diff !== 0 ? (
          <p
            className={
              diff < -TOLERANCE
                ? 'mt-2 flex items-start gap-1.5 text-footnote text-bad'
                : 'mt-2 text-footnote text-label-secondary'
            }
          >
            {diff < -TOLERANCE ? (
              <TriangleAlert size={14} className="mt-px shrink-0" />
            ) : null}
            {diff < 0
              ? t('pharmacy.liveShort', { sum: money(Math.abs(diff)) })
              : t('pharmacy.liveOver', { sum: money(diff) })}
          </p>
        ) : null}

        {/*
          KASSA KIMGA TOPSHIRILADI.

          Aptekada kassa odamdan odamga o'tadi va aynan shu payt
          javobgarlik ham o'tadi. Yozilmasa, ertasi kuni kamomad
          chiqqanda "men olganimda shunday edi" degan gap
          boshlanadi va uni tekshirib bo'lmaydi.

          Bo'sh qoldirish mumkin: kun oxirida keyingi smena
          bo'lmasligi ham mumkin.
        */}
        <div className="mt-4">
          <Select
            label={t('pharmacy.handTo')}
            hint={t('pharmacy.handToHint')}
            value={handedTo}
            onChange={(e) => setHandedTo(e.target.value)}
            /* Bo'sh qiymat Select'ning o'zida bor — nomini aniqroq qilamiz */
            placeholder={t('pharmacy.handToNobody')}
            options={(candidates.data ?? []).map((one) => ({
              value: one.id,
              label: one.fullName,
            }))}
          />
        </div>

        <div className="mt-4">
          <TextArea
            label={t('pharmacy.shiftNote')}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={counted === ''}
          loading={close.pending}
          onClick={submit}
        >
          <Lock size={16} />
          {t('pharmacy.closeShift')}
        </Button>
      </Card>

      {/* --- Kam summa kiritilganda --- */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('pharmacy.warnTitle')}
        description={t('pharmacy.warnBody', { sum: money(Math.abs(diff)) })}
        footer={
          <>
            <Button variant="gray" onClick={() => setConfirming(false)}>
              {t('pharmacy.warnRecount')}
            </Button>
            <Button
              variant="danger"
              loading={close.pending}
              onClick={() => void finish(true)}
            >
              {t('pharmacy.warnProceed')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-[12px] bg-raised p-4">
            <Row label={t('pharmacy.cashSales')} value={money(expected)} />
            <div className="mt-2">
              <Row label={t('pharmacy.countedCash')} value={money(value)} />
            </div>
            <div className="hairline-t mt-3 flex items-center justify-between pt-3">
              <span className="text-subhead font-semibold text-label">
                {t('pharmacy.difference')}
              </span>
              <span className="text-headline font-bold tabular-nums text-bad">
                {money(Math.abs(diff))}
              </span>
            </div>
          </div>

          {/*
            Nima bo'lishi OLDINDAN aytiladi. Yashirin belgilash
            tuzoq bo'lardi: odam bilmasdan belgilanib, keyin
            "nega meni ayblashyapti" deb o'ylardi.
          */}
          <p className="flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            {t('pharmacy.warnNotice')}
          </p>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-subhead text-label-secondary">{label}</span>
      <span className="tabular-nums font-medium text-label">{value}</span>
    </div>
  )
}
