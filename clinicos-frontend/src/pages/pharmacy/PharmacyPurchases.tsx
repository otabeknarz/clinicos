import { useState } from 'react'
import {
  Camera,
  FileImage,
  PackagePlus,
  Plus,
  Trash2,
  TruckIcon,
  UserPlus,
  X,
} from 'lucide-react'

import {
  createPurchase,
  createSupplier,
  listMedicines,
  listPurchases,
  listSuppliers,
} from '@/api/pharmacy'
import { uploadImage } from '@/api/uploads'
import type { PurchaseLineInput } from '@/api/pharmacy'
import type { MedicineForm, Purchase, PurchasePayment } from '@/types/pharmacy'
import { MEDICINE_FORMS } from '@/types/pharmacy'
import { ScanDialog } from '@/components/pharmacy/ScanDialog'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Field, SearchInput, Select, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Tabs'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { parseGs1, searchTermFrom } from '@/lib/barcode'
import { prepareMedicalImage } from '@/lib/image'
import { cn } from '@/lib/cn'
import { dateShort, money } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * KIRIM — DORI BAZAGA SHU YERDAN TUSHADI.
 *
 * Katalogga alohida "dori qo'shish" ekrani ATAYLAB asosiy yo'l
 * emas. Amalda farmatsevt qutini qo'lida ushlab turadi va unga
 * kerak bo'lgan narsa bitta: kelgan tovarni yozib qo'yish.
 * Uni "avval katalogga dori qo'sh, keyin partiya och, keyin
 * narx belgila" deb uchta ekranga yugurtirsak, u tizimni
 * chetlab o'tib daftarga yozishni afzal ko'radi.
 *
 * Shuning uchun katalogda yo'q dori SHU YERDA, qatorning
 * ichida ochiladi.
 */
export function PharmacyPurchasesPage() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const { data, loading, reload } = useAsync(() => listPurchases(90), [])
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t('nav.pharmacyPurchases')}
          subtitle={t('pharmacy.purchaseCount', { count: rows.length })}
          action={
            <Button onClick={() => setOpen(true)}>
              <PackagePlus size={16} />
              {t('pharmacy.newPurchase')}
            </Button>
          }
        />
      </Card>

      {loading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TruckIcon size={22} />}
            title={t('pharmacy.noPurchases')}
            description={t('pharmacy.noPurchasesHint')}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <PurchaseCard key={row.id} row={row} />
          ))}
        </div>
      )}

      <PurchaseModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          reload()
        }}
      />
    </div>
  )
}

function PurchaseCard({ row }: { row: Purchase }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="space-y-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="text-headline font-semibold text-label">
            {row.supplierName || t('pharmacy.noSupplier')}
          </p>
          <p className="mt-0.5 text-caption text-label-tertiary">
            {row.invoiceNumber} · {dateShort(row.receivedAt)} ·{' '}
            {t('pharmacy.lineCount', { count: row.items.length })}
            {row.receivedByName ? ` · ${row.receivedByName}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-headline font-bold tabular-nums text-label">
            {money(row.total)}
          </span>
          <PaymentBadge row={row} />
        </span>
      </button>

      {expanded && row.documents.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {row.documents.map((doc, index) => (
            <img
              key={index}
              src={doc}
              alt=""
              className="h-24 w-20 rounded-[10px] object-cover"
            />
          ))}
        </div>
      ) : null}

      {expanded ? (
        <ul className="hairline-t divide-y divide-separator">
          {row.items.map((item, index) => (
            <li key={index} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-subhead text-label">
                  {item.medicineName}
                </span>
                <span className="block text-caption text-label-tertiary">
                  {t('pharmacy.batch')} {item.batchCode} · {t('pharmacy.expires')}{' '}
                  {dateShort(item.expiresAt)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block tabular-nums text-subhead text-label">
                  {item.quantity} × {money(item.buyPrice)}
                </span>
                <span className="block text-caption text-label-tertiary">
                  {t('pharmacy.sellPrice')} {money(item.sellPrice)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

/**
 * To'lov holati — qarz QOLDIG'I bilan.
 *
 * Yolg'iz "nasiya" degan so'z yetarli emas: rahbar qancha qarz
 * qolganini shu yerdanoq ko'rishi kerak, aks holda har bir
 * hujjatni ochib chiqishga majbur bo'lardi.
 */
function PaymentBadge({ row }: { row: Purchase }) {
  const { t } = useI18n()
  const remaining = row.total - row.paidAmount

  if (remaining <= 0) {
    return (
      <span className="mt-1 inline-block text-caption text-good">
        {t('pharmacy.payPaid')}
      </span>
    )
  }

  const overdue = row.dueDate ? row.dueDate < new Date().toISOString().slice(0, 10) : false

  return (
    <span
      className={cn('mt-1 inline-block text-caption', overdue ? 'text-bad' : 'text-warn')}
    >
      {t('pharmacy.owed', { sum: money(remaining) })}
      {row.dueDate ? ` · ${dateShort(row.dueDate)}` : ''}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Yangi ta'minotchi                                                   */
/* ------------------------------------------------------------------ */

function SupplierModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [inn, setInn] = useState('')

  const save = useAction(async () => {
    return createSupplier({ name: name.trim(), phone, inn: inn.trim(), note: '' })
  })

  async function submit() {
    if (!name.trim()) return
    const created = await save.run()
    if (!created) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('pharmacy.supplierAdded'))
    setName('')
    setPhone('')
    setInn('')
    onSaved(created.id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pharmacy.newSupplier')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            disabled={!name.trim()}
            loading={save.pending}
            onClick={() => void submit()}
          >
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label={t('pharmacy.supplierName')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label={t('common.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {/* Soliq raqami — hisob-fakturada ko'rsatiladi */}
          <TextInput
            label={t('pharmacy.inn')}
            inputMode="numeric"
            value={inn}
            onChange={(e) => setInn(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Yangi kirim                                                         */
/* ------------------------------------------------------------------ */

interface Line extends PurchaseLineInput {
  /** Ro'yxatdagi kaliti — hali saqlanmagani uchun id yo'q */
  key: string
  name: string
  isNew: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function PurchaseModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const suppliers = useAsync(listSuppliers, [])

  const [supplierId, setSupplierId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayIso())
  const [lines, setLines] = useState<Line[]>([])
  const [picking, setPicking] = useState(false)
  const [addingSupplier, setAddingSupplier] = useState(false)

  const [payment, setPayment] = useState<PurchasePayment>('paid')
  const [paidAmount, setPaidAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  /** Hujjat rasmlari: ko'rsatish uchun `preview`, saqlash uchun `key` */
  const [documents, setDocuments] = useState<{ preview: string; key: string }[]>([])
  const [uploading, setUploading] = useState(false)

  const total = lines.reduce((sum, line) => sum + line.buyPrice * line.quantity, 0)

  const save = useAction(async () => {
    await createPurchase({
      supplierId: supplierId || null,
      invoiceNumber: invoice,
      receivedAt,
      payment,
      paidAmount: Number(paidAmount) || 0,
      dueDate: dueDate || null,
      documents: documents.map((one) => one.key),
      note: '',
      lines: lines.map(({ key, name, isNew, ...rest }) => {
        void key
        void name
        void isNew
        return rest
      }),
    })
  })

  async function submit() {
    if (lines.length === 0) return
    const done = await save.run()
    if (done === null) {
      toast.error(save.lastError()?.message ?? t('toast.error'))
      return
    }
    toast.success(t('pharmacy.purchaseSaved', { count: lines.length }))
    setLines([])
    setInvoice('')
    setDocuments([])
    setPaidAmount('')
    setDueDate('')
    onSaved()
  }

  /**
   * HUJJAT RASMI.
   *
   * Накладная yoki hisob-faktura surati. Tortishuvda yagona
   * dalil shu bo'ladi: ta'minotchi "men yubormadim" desa yoki
   * summa boshqacha chiqsa, qog'ozni qidirib yurish o'rniga shu
   * yerdan ochiladi. Nazoratchi ham partiya sertifikatini
   * so'raydi va u ham shu yerga tushadi.
   */
  async function addDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const prepared = await prepareMedicalImage(file)
      if (!prepared.ok || !prepared.blob) {
        toast.error(t('visit.imageBad'))
        return
      }
      const uploaded = await uploadImage('pharmacy', prepared.blob, prepared.dataUrl)
      setDocuments((current) => [
        ...current,
        { preview: prepared.dataUrl, key: uploaded.key },
      ])
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setUploading(false)
    }
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={t('pharmacy.newPurchase')}
        description={t('pharmacy.newPurchaseHint')}
        footer={
          <>
            <span className="mr-auto text-subhead text-label-secondary">
              {t('pharmacy.purchaseTotal')}:{' '}
              <span className="font-bold tabular-nums text-label">{money(total)}</span>
            </span>
            <Button variant="gray" onClick={onClose}>
              {t('action.cancel')}
            </Button>
            <Button
              disabled={lines.length === 0}
              loading={save.pending}
              onClick={() => void submit()}
            >
              {t('pharmacy.acceptPurchase')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* --- Hujjat --- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <Select
                label={t('pharmacy.supplier')}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={[
                  { value: '', label: t('pharmacy.noSupplier') },
                  ...(suppliers.data ?? []).map((one) => ({
                    value: one.id,
                    label: one.name,
                  })),
                ]}
              />
              {/*
                Yangi ta'minotchi SHU YERDA ochiladi: u bilan
                birinchi kirim bir vaqtda keladi va odamni alohida
                ekranga yuborish ishni to'xtatib qo'yardi.
              */}
              <button
                type="button"
                onClick={() => setAddingSupplier(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-caption font-medium text-accent hover:opacity-80"
              >
                <UserPlus size={13} />
                {t('pharmacy.newSupplier')}
              </button>
            </div>
            <TextInput
              label={t('pharmacy.invoice')}
              value={invoice}
              placeholder="H-12345"
              onChange={(e) => setInvoice(e.target.value)}
            />
            <TextInput
              label={t('pharmacy.receivedAt')}
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>

          {/* --- Qatorlar --- */}
          {lines.length === 0 ? (
            <p className="rounded-[12px] bg-raised px-4 py-6 text-center text-subhead text-label-tertiary">
              {t('pharmacy.noLines')}
            </p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="rounded-[12px] bg-raised p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-subhead font-medium text-label">
                        {line.name}
                      </p>
                      {line.isNew ? (
                        <Badge tone="accent" className="mt-1">
                          {t('pharmacy.newMedicine')}
                        </Badge>
                      ) : null}
                    </div>
                    <IconButton
                      label={t('action.delete')}
                      className="h-7 w-7"
                      onClick={() =>
                        setLines((current) => current.filter((l) => l.key !== line.key))
                      }
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Small
                      label={t('pharmacy.batch')}
                      value={line.batchCode}
                      onChange={(v) => update(line.key, { batchCode: v })}
                    />
                    <Small
                      label={t('pharmacy.expires')}
                      type="date"
                      value={line.expiresAt}
                      onChange={(v) => update(line.key, { expiresAt: v })}
                    />
                    <Small
                      label={t('pharmacy.quantity')}
                      numeric
                      value={String(line.quantity)}
                      onChange={(v) => update(line.key, { quantity: Number(v) || 0 })}
                    />
                    <Small
                      label={t('pharmacy.buyPrice')}
                      numeric
                      value={String(line.buyPrice)}
                      onChange={(v) => update(line.key, { buyPrice: Number(v) || 0 })}
                    />
                    <Small
                      label={t('pharmacy.sellPrice')}
                      numeric
                      value={String(line.sellPrice)}
                      onChange={(v) => update(line.key, { sellPrice: Number(v) || 0 })}
                    />
                  </div>

                  {/*
                    USTAMA DARHOL KO'RINADI. Uni keyin hisobotdan
                    bilib olish kech: tovar allaqachon narxlanib,
                    javonga chiqib bo'lgan bo'ladi.
                  */}
                  <p className="mt-2 text-caption text-label-tertiary">
                    {t('pharmacy.margin')}:{' '}
                    <span
                      className={cn(
                        'font-semibold',
                        line.sellPrice <= line.buyPrice ? 'text-bad' : 'text-good',
                      )}
                    >
                      {line.buyPrice
                        ? Math.round(
                            ((line.sellPrice - line.buyPrice) / line.buyPrice) * 100,
                          )
                        : 0}
                      %
                    </span>
                    {' · '}
                    {t('pharmacy.lineTotal')}: {money(line.buyPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <Button variant="gray" className="w-full" onClick={() => setPicking(true)}>
            <Plus size={16} />
            {t('pharmacy.addLine')}
          </Button>

          {/* --- To'lov sharti --- */}
          <div className="hairline-t space-y-3 pt-4">
            <p className="text-footnote font-medium text-label-secondary">
              {t('pharmacy.paymentTerms')}
            </p>

            <Segmented
              className="w-full"
              value={payment}
              onChange={setPayment}
              options={[
                { value: 'paid', label: t('pharmacy.payPaid') },
                { value: 'partial', label: t('pharmacy.payPartial') },
                { value: 'credit', label: t('pharmacy.payCredit') },
              ]}
            />

            {/*
              NASIYA ALOHIDA YOZILADI. Aptekaga tovar ko'pincha
              qarzga keladi va bu yozilmasa, apteka o'zining
              qancha qarzi borligini bilmaydi — javonda tovar
              turadi, muddat esa faqat ta'minotchining daftarida
              qoladi.
            */}
            {payment !== 'paid' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {payment === 'partial' ? (
                  <TextInput
                    label={t('pharmacy.paidAmount')}
                    inputMode="numeric"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value.replace(/\D/g, ''))}
                  />
                ) : null}
                <TextInput
                  label={t('pharmacy.dueDate')}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {/* --- Hujjatlar --- */}
          <div className="hairline-t space-y-3 pt-4">
            <p className="text-footnote font-medium text-label-secondary">
              {t('pharmacy.documents')}
            </p>
            <p className="text-caption text-label-tertiary">
              {t('pharmacy.documentsHint')}
            </p>

            {documents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <span key={doc.key} className="relative">
                    <img
                      src={doc.preview}
                      alt=""
                      className="h-24 w-20 rounded-[10px] object-cover"
                    />
                    <IconButton
                      label={t('action.delete')}
                      className="absolute -right-2 -top-2 h-6 w-6 bg-fill-2"
                      onClick={() =>
                        setDocuments((current) =>
                          current.filter((one) => one.key !== doc.key),
                        )
                      }
                    >
                      <X size={12} />
                    </IconButton>
                  </span>
                ))}
              </div>
            ) : null}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-fill-4 px-3 py-2 text-subhead font-medium text-label transition-colors duration-150 hover:bg-fill-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void addDocument(e)}
              />
              <FileImage size={16} />
              {uploading ? t('common.loading') : t('pharmacy.addDocument')}
            </label>
          </div>
        </div>
      </Modal>

      <SupplierModal
        open={addingSupplier}
        onClose={() => setAddingSupplier(false)}
        onSaved={(id) => {
          setAddingSupplier(false)
          setSupplierId(id)
          void suppliers.reload()
        }}
      />

      <LinePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(line) => {
          setLines((current) => [...current, line])
          setPicking(false)
        }}
      />
    </>
  )
}

function Small({
  label,
  value,
  onChange,
  numeric,
  type,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
  type?: string
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block truncate text-caption-2 text-label-tertiary">
        {label}
      </span>
      <input
        type={type ?? 'text'}
        inputMode={numeric ? 'numeric' : undefined}
        value={value}
        onChange={(e) =>
          onChange(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)
        }
        className="h-9 w-full rounded-[8px] border border-transparent bg-canvas px-2.5 text-footnote tabular-nums text-label outline-none transition-colors duration-150 focus:border-accent"
      />
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Qator qo'shish: mavjud dori yoki yangisi                            */
/* ------------------------------------------------------------------ */

function LinePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (line: Line) => void
}) {
  const { t } = useI18n()

  const [term, setTerm] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  /** Skanerdan kelgan partiya va muddat — yangi qatorga o'tadi */
  const [scanned, setScanned] = useState<{ batch: string; expiry: string } | null>(null)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState('')
  const [form, setForm] = useState<MedicineForm>('tablet')
  const [manufacturer, setManufacturer] = useState('')
  const [unit, setUnit] = useState('quti')
  const [rx, setRx] = useState(false)
  const [barcode, setBarcode] = useState('')

  const found = useAsync(() => listMedicines({ search: term }), [term])

  function reset() {
    setTerm('')
    setScanned(null)
    setCreating(false)
    setName('')
    setManufacturer('')
    setBarcode('')
  }

  function pickExisting(id: string, medicineName: string, sellPrice: number) {
    onPick({
      key: `${id}-${Date.now()}`,
      medicineId: id,
      medicine: null,
      name: medicineName,
      isNew: false,
      batchCode: scanned?.batch ?? '',
      expiresAt: scanned?.expiry ?? '',
      quantity: 1,
      buyPrice: Math.round(sellPrice / 1.3),
      sellPrice,
    })
    reset()
  }

  function createNew() {
    if (!name.trim()) return
    onPick({
      key: `new-${Date.now()}`,
      medicineId: null,
      medicine: {
        name: name.trim(),
        form,
        manufacturer: manufacturer.trim(),
        country: '',
        barcode: barcode.trim(),
        unit,
        prescriptionOnly: rx,
        sellPrice: 0,
      },
      name: name.trim(),
      isNew: true,
      batchCode: scanned?.batch ?? '',
      expiresAt: scanned?.expiry ?? '',
      quantity: 1,
      buyPrice: 0,
      sellPrice: 0,
    })
    reset()
  }

  /**
   * Skanerdan kelgan kod.
   *
   * GS1 DataMatrix bo'lsa, PARTIYA va MUDDAT ham ichida keladi —
   * ularni qo'lda terishning hojati qolmaydi. Aynan shu joyda
   * skanerning foydasi eng katta: kirimda har bir qutining
   * muddatini qo'lda kiritish — xatoning eng ko'p uchraydigan
   * manbai.
   */
  function handleScan(raw: string) {
    setScanOpen(false)
    const gs1 = parseGs1(raw)
    if (gs1) {
      setScanned({ batch: gs1.batch ?? '', expiry: gs1.expiresAt ?? '' })
      setBarcode(gs1.gtin.replace(/^0+/, ''))
    }
    setTerm(searchTermFrom(raw))
  }

  return (
    <>
      <ScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetect={handleScan}
      />

      <Modal
        open={open}
        onClose={() => {
          reset()
          onClose()
        }}
        title={t('pharmacy.addLine')}
        description={t('pharmacy.addLineHint')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SearchInput
              className="min-w-0 flex-1"
              value={term}
              onChange={setTerm}
              placeholder={t('pharmacy.searchCatalog')}
            />
            <IconButton
              label={t('scan.title')}
              className="h-10 w-10 shrink-0 bg-raised"
              onClick={() => setScanOpen(true)}
            >
              <Camera size={18} />
            </IconButton>
          </div>

          {scanned ? (
            <p className="rounded-[10px] bg-ok-soft px-3 py-2 text-caption text-ok">
              {t('pharmacy.scannedInfo', {
                batch: scanned.batch || '—',
                expiry: scanned.expiry ? dateShort(scanned.expiry) : '—',
              })}
            </p>
          ) : null}

          {creating ? (
            <div className="space-y-3">
              <TextInput
                label={t('pharmacy.medicineName')}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={t('pharmacy.form')}
                  value={form}
                  onChange={(e) => setForm(e.target.value as MedicineForm)}
                  options={MEDICINE_FORMS.map((one) => ({
                    value: one,
                    label: t(`pharmacy.form.${one}`),
                  }))}
                />
                <TextInput
                  label={t('pharmacy.unit')}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label={t('pharmacy.manufacturer')}
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
                <TextInput
                  label={t('pharmacy.barcode')}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <Field label="">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={rx}
                    onChange={(e) => setRx(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-subhead text-label">
                    {t('pharmacy.rxOnly')}
                  </span>
                </label>
              </Field>

              <div className="flex gap-2">
                <Button variant="gray" onClick={() => setCreating(false)}>
                  {t('action.back')}
                </Button>
                <Button className="flex-1" disabled={!name.trim()} onClick={createNew}>
                  {t('pharmacy.addToPurchase')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ul className="max-h-72 divide-y divide-separator overflow-y-auto">
                {(found.data ?? []).slice(0, 20).map((medicine) => (
                  <li key={medicine.id}>
                    <button
                      type="button"
                      onClick={() =>
                        pickExisting(medicine.id, medicine.name, medicine.sellPrice)
                      }
                      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-fill-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-subhead text-label">
                          {medicine.name}
                        </span>
                        <span className="block text-caption text-label-tertiary">
                          {medicine.manufacturer} · {t('pharmacy.left')}{' '}
                          {medicine.inStock}
                        </span>
                      </span>
                      <Plus size={16} className="shrink-0 text-accent" />
                    </button>
                  </li>
                ))}
              </ul>

              {/*
                "Yangi dori" TUGMASI DOIM KO'RINADI, qidiruv bo'sh
                chiqqanda emas. Farmatsevt ko'pincha katalogda
                yo'qligini oldindan biladi va qidirib o'tirishni
                istamaydi.
              */}
              <Button
                variant="tinted"
                className="w-full"
                onClick={() => {
                  setCreating(true)
                  if (!name) setName(term)
                }}
              >
                <Plus size={16} />
                {t('pharmacy.newMedicine')}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
