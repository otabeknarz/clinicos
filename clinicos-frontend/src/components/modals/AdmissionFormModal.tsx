import { useMemo, useState } from 'react'

import { listPatients } from '@/api/patients'
import { listDoctorsShort } from '@/api/doctors'
import { admitPatient, getBedBoard, inclusiveDays } from '@/api/ward'
import { Button } from '@/components/ui/Button'
import { Select, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { addDays, toISODate } from '@/lib/dates'
import { money } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'
import type { PaymentMethod, RoomCategory } from '@/types/models'

/**
 * BEMORNI STATSIONARGA YOTQIZISH.
 *
 * Ikki rejim:
 *
 *   Hozir yotqizish  — joy darhol band bo'ladi
 *   Rejalashtirish   — kelajakdagi kunga, joy o'sha kunlarga
 *                      band qilinadi, bugundan emas
 *
 * NARX BU YERDA FAQAT KO'RSATILADI. Haqiqiy summani server
 * hisoblaydi va u yotqizish paytida MUZLATILADI — palata narxi
 * keyin o'zgarsa, yotgan bemorning hisobi o'zgarmasligi kerak.
 *
 * OLDINDAN TO'LOV ixtiyoriy: zakalat ham, to'liq summa ham
 * bo'ladi. Maydon faqat pul yozish huquqi borlarga ko'rinadi —
 * egasida `payments.create` ATAYLAB yo'q.
 */
export function AdmissionFormModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { can } = useAuth()

  const [planned, setPlanned] = useState(false)
  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [category, setCategory] = useState<RoomCategory | 'all'>('all')
  const [bedId, setBedId] = useState('')
  const [from, setFrom] = useState(toISODate(new Date()))
  const [to, setTo] = useState(toISODate(addDays(new Date(), 2)))
  const [diagnosis, setDiagnosis] = useState('')
  const [prepay, setPrepay] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [saving, setSaving] = useState(false)

  const { data: patients } = useAsync(() => listPatients({ pageSize: 200 }), [])
  const { data: doctors } = useAsync(() => listDoctorsShort(), [])

  /*
    Joylar TANLANGAN KUNLAR uchun so'raladi. Bugungi bandlik
    yetarli emas: kelasi oyga rejalashtirilayotgan joy bugun
    bo'sh, lekin o'sha kunlarda band bo'lishi mumkin.
  */
  const { data: board } = useAsync(
    () => getBedBoard(new Date(from), new Date(to)),
    [from, to],
  )

  /** Tanlangan kunlarda hech kim yotmagan joylar */
  const freeBeds = useMemo(() => {
    const rows = board?.rows ?? []
    return rows
      .filter((row) => row.spans.length === 0 && row.bed.status !== 'maintenance')
      .filter((row) => category === 'all' || row.room.category === category)
  }, [board, category])

  const chosen = freeBeds.find((row) => row.bed.id === bedId) ?? null
  const days = inclusiveDays(new Date(from), new Date(to))
  const dailyRate = chosen?.room.dailyRate ?? 0
  const total = days * dailyRate

  const prepayAmount = Number(prepay.replace(/\D/g, '')) || 0
  const prepayTooMuch = prepayAmount > total

  const valid =
    patientId && doctorId && bedId && from && to && from <= to && !prepayTooMuch

  function reset() {
    setPlanned(false)
    setPatientId('')
    setDoctorId('')
    setCategory('all')
    setBedId('')
    setFrom(toISODate(new Date()))
    setTo(toISODate(addDays(new Date(), 2)))
    setDiagnosis('')
    setPrepay('')
  }

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      await admitPatient({
        patientId,
        doctorId,
        bedId,
        /*
          Rejalashtirilganda sanani o'zi yuboramiz — server
          kelajakdagi kunni ko'rib yozuvni `planned` qiladi.
          Hozir yotqizishda joriy vaqt ketadi.
        */
        admittedAt: planned ? new Date(`${from}T09:00:00`).toISOString() : new Date().toISOString(),
        expectedDischargeAt: to,
        diagnosis: diagnosis.trim(),
        notes: '',
        ...(prepayAmount > 0
          ? { prepayment: { amount: prepayAmount, method } }
          : {}),
      })
      toast.success(planned ? t('ward.plannedSaved') : t('ward.admitted'))
      onDone()
      reset()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('ward.admitTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {planned ? t('ward.modePlanned') : t('ward.checkIn')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs<'now' | 'planned'>
          value={planned ? 'planned' : 'now'}
          onChange={(v) => {
            const isPlanned = v === 'planned'
            setPlanned(isPlanned)
            /*
              Rejalashtirishga o'tganda kirish sanasini ERTAGA
              suramiz: bugungi kun bilan server yozuvni "hozir
              yotqizish" deb qabul qilardi.
            */
            setFrom(toISODate(addDays(new Date(), isPlanned ? 1 : 0)))
            setTo(toISODate(addDays(new Date(), isPlanned ? 3 : 2)))
          }}
          options={[
            { value: 'now', label: t('ward.modeNow') },
            { value: 'planned', label: t('ward.modePlanned') },
          ]}
        />

        <Select
          label={t('ward.selectPatient')}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          options={[
            { value: '', label: '—' },
            ...(patients?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.fullName} · ${p.phone}`,
            })),
          ]}
        />

        <Select
          label={t('ward.selectDoctor')}
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          options={[
            { value: '', label: '—' },
            ...(doctors ?? []).map((d) => ({ value: d.id, label: d.fullName })),
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('ward.from')}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextInput
            label={t('ward.to')}
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('ward.roomCategory')}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as RoomCategory | 'all')
              setBedId('')
            }}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'luxury', label: t('ward.category.luxury') },
              { value: 'standard', label: t('ward.category.standard') },
              { value: 'general', label: t('ward.category.general') },
            ]}
          />
          <Select
            label={t('ward.bed')}
            value={bedId}
            onChange={(e) => setBedId(e.target.value)}
            options={[
              { value: '', label: freeBeds.length ? '—' : t('ward.noFreeBeds') },
              ...freeBeds.map((row) => ({
                value: row.bed.id,
                label: `${row.bed.label} · ${t(`ward.category.${row.room.category}`)} · ${money(row.room.dailyRate)}`,
              })),
            ]}
          />
        </div>

        {/* ---- Narx ---- */}
        {chosen ? (
          <div className="rounded-[12px] bg-fill-4 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-caption text-label-tertiary">
                {t('ward.days', { count: days })} × {money(dailyRate)}
              </span>
              <span className="text-caption text-label-tertiary">{t('ward.perDay')}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-subhead font-medium text-label">{t('ward.total')}</span>
              <span className="text-title-3 font-semibold tnum text-label">
                {money(total)}
              </span>
            </div>
          </div>
        ) : null}

        <TextArea
          label={t('ward.diagnosis')}
          rows={2}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
        />

        {/*
          Oldindan to'lov faqat pul yozish huquqi borlarga.
          Egasida `payments.create` ataylab yo'q — pulni bir odam,
          tashrifni boshqasi yozadi. Server ham buni tekshiradi.
        */}
        {can('payments.create') ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t('ward.prepayment')}
              hint={t('ward.prepaymentHint')}
              inputMode="numeric"
              value={prepay}
              error={prepayTooMuch ? t('ward.prepaymentTooMuch') : undefined}
              onChange={(e) => setPrepay(e.target.value)}
            />
            <Select
              label={t('payments.method')}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              options={[
                { value: 'cash', label: t('payments.method.cash') },
                { value: 'card', label: t('payments.method.card') },
                { value: 'transfer', label: t('payments.method.transfer') },
              ]}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
