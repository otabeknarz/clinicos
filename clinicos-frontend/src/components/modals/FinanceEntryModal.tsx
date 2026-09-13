import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, ImagePlus, Info, X } from 'lucide-react'

import { createFinanceEntry } from '@/api/finance'
import { uploadImage } from '@/api/uploads'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Tabs'
import { cn } from '@/lib/cn'
import { toISODate } from '@/lib/dates'
import { money } from '@/lib/format'
import { prepareMedicalImage } from '@/lib/image'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/types/models'
import type { FinanceEntryType, PaymentMethod } from '@/types/models'

/**
 * CHIQIM YOKI KIRIM YOZISH.
 *
 * Eng ko'p holat — registrator kassadan xaridga yoki taksiga pul beradi.
 * Shuning uchun standart qiymatlar shunga moslangan: chiqim, naqd, bugun.
 *
 * NAQD tanlansa ogohlantirish chiqadi: bu pul kassadan chiqadi va
 * yozgan odamning smena yopishdagi kutilgan summasi shuncha kamayadi.
 * Yozilmasa — kechqurun "kamomad" bo'lib chiqadi.
 *
 * Yozuv saqlangach TAHRIRLANMAYDI. Forma buni oldindan aytadi, aks holda
 * odam "keyin to'g'rilayman" deb shoshib saqlab yuborardi.
 */
/** Bitta yozuvga ko'pi bilan — serverdagi `ArrayMaxSize(10)` bilan bir xil */
const MAX_RECEIPTS = 10

export function FinanceEntryModal({
  open,
  onClose,
  onSaved,
  initialType = 'expense',
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  initialType?: FinanceEntryType
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [type, setType] = useState<FinanceEntryType>(initialType)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [counterparty, setCounterparty] = useState('')
  const [note, setNote] = useState('')
  /* Chek va hujjat suratlari — bir nechta: nakladnoy ko'pincha bir necha varaq */
  const [receipts, setReceipts] = useState<{ key: string; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setType(initialType)
    setCategory('')
    setAmount('')
    setMethod('cash')
    setDate(toISODate(new Date()))
    setCounterparty('')
    setNote('')
    setReceipts([])
    setTouched(false)
  }, [open, initialType])

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  const amountValue = Math.round(Number(amount) || 0)
  const today = toISODate(new Date())

  const errors = {
    category: category ? undefined : t('finance.error.category'),
    amount: amountValue > 0 ? undefined : t('finance.error.amount'),
    date: date && date <= today ? undefined : t('finance.error.date'),
  }
  const valid = !errors.category && !errors.amount && !errors.date

  const save = useAction(async () =>
    createFinanceEntry({
      type,
      category,
      amount: amountValue,
      method,
      /* Bugun bo'lsa — hozirgi vaqt: kassa hisobi kun ichidagi tartibga qaraydi */
      occurredAt: date === today ? undefined : `${date}T12:00:00`,
      counterparty,
      note,
      receipts: receipts.map((one) => one.key),
    }),
  )

  /**
   * Bir yo'la bir nechta rasm tanlanadi. Har biri alohida yuklanadi:
   * bittasi o'tmasa, qolganlari yo'qolmaydi.
   */
  async function pickReceipts(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = MAX_RECEIPTS - receipts.length
    const picked = Array.from(files).slice(0, room)
    if (files.length > room) toast.error(t('finance.receiptLimit', { count: MAX_RECEIPTS }))

    setUploading(true)
    let failed = 0
    for (const file of picked) {
      try {
        const image = await prepareMedicalImage(file)
        if (!image.blob) throw new Error(image.error ?? 'image')
        const uploaded = await uploadImage('finance', image.blob, image.dataUrl)
        setReceipts((current) => [...current, { key: uploaded.key, preview: image.dataUrl }])
      } catch {
        failed += 1
      }
    }
    setUploading(false)
    if (failed > 0) toast.error(t('finance.receiptFailed'))
  }

  async function submit() {
    setTouched(true)
    if (!valid) return
    const result = await save.run()
    if (!result) {
      toast.error(save.lastError()?.message || t('toast.error'))
      return
    }
    toast.success(type === 'expense' ? t('finance.savedExpense') : t('finance.savedIncome'))
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={type === 'expense' ? t('finance.newExpense') : t('finance.newIncome')}
      description={t('finance.immutableHint')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button icon={<Check size={16} />} loading={save.pending} disabled={uploading} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmented<FinanceEntryType>
          value={type}
          onChange={(next) => {
            setType(next)
            setCategory('')
          }}
          options={[
            { value: 'expense', label: t('finance.expense') },
            { value: 'income', label: t('finance.otherIncome') },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t('finance.category')}
            required
            value={category}
            error={touched ? errors.category : undefined}
            onChange={(e) => setCategory(e.target.value)}
            options={categories.map((key) => ({ value: key, label: t(`finance.category.${key}`) }))}
          />
          <TextInput
            label={t('finance.amount')}
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            suffix="so'm"
            value={amount}
            error={touched ? errors.amount : undefined}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <Field label={t('finance.method')}>
          <Segmented<PaymentMethod>
            value={method}
            onChange={setMethod}
            options={[
              { value: 'cash', label: t('payments.method.cash') },
              { value: 'card', label: t('payments.method.card') },
              { value: 'transfer', label: t('payments.method.transfer') },
            ]}
          />
        </Field>

        {/* Naqd — kassaga ta'sir qiladi, buni yozishdan OLDIN aytamiz */}
        {method === 'cash' ? (
          <div className="flex gap-2.5 rounded-[12px] bg-accent-soft px-3.5 py-3 text-footnote text-accent">
            <Info size={16} className="mt-px shrink-0" />
            <span>
              {type === 'expense' ? t('finance.cashOutHint') : t('finance.cashInHint')}
              {amountValue > 0 ? ` (${type === 'expense' ? '−' : '+'}${money(amountValue)})` : ''}
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('common.date')}
            type="date"
            max={today}
            value={date}
            error={touched ? errors.date : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
          <TextInput
            label={type === 'expense' ? t('finance.paidTo') : t('finance.receivedFrom')}
            placeholder={type === 'expense' ? t('finance.paidToPlaceholder') : t('finance.receivedFromPlaceholder')}
            maxLength={150}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>

        <TextArea
          label={t('finance.note')}
          placeholder={t('finance.notePlaceholder')}
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* --- Chek surati --- */}
        <Field label={t('finance.receipt')} hint={t('finance.receiptHint')}>
          <div className="flex flex-wrap gap-2.5">
            {receipts.map((one, index) => (
              <div key={one.key} className="relative">
                <img
                  src={one.preview}
                  alt={`${t('finance.receipt')} ${index + 1}`}
                  className="h-24 w-20 rounded-[12px] object-cover ring-1 ring-separator"
                />
                <button
                  type="button"
                  aria-label={t('action.delete')}
                  onClick={() => setReceipts((current) => current.filter((item) => item.key !== one.key))}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-label text-canvas"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {receipts.length < MAX_RECEIPTS ? (
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px]',
                  'border border-dashed border-separator text-caption text-label-secondary hover:bg-fill-4',
                  receipts.length === 0 ? 'h-24 w-full' : 'h-24 w-20',
                  uploading && 'pointer-events-none opacity-60',
                )}
              >
                <ImagePlus size={17} />
                <span className="px-1 text-center">
                  {uploading
                    ? t('common.loading')
                    : receipts.length === 0
                      ? t('finance.addReceipts')
                      : t('finance.addMore')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void pickReceipts(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

/** Yozuv turi belgisi — ro'yxatda ham ishlatiladi */
export function FinanceTypeIcon({ type, voided }: { type: FinanceEntryType; voided?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        voided ? 'bg-fill-3 text-label-tertiary' : type === 'expense' ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok',
      )}
    >
      {type === 'expense' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
    </span>
  )
}
