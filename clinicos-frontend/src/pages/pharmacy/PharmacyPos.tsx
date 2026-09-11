import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  Camera,
  CreditCard,
  Minus,
  Plus,
  Scan,
  ShoppingCart,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import { createSale, pharmacySummary, searchForSale } from '@/api/pharmacy'
import type { CartLine } from '@/types/pharmacy'
import { OnDutyGate } from '@/components/pharmacy/OnDutyGate'
import { ScanDialog } from '@/components/pharmacy/ScanDialog'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/Form'
import { Segmented } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/States'
import { searchTermFrom } from '@/lib/barcode'
import { cn } from '@/lib/cn'
import { dateShort, money } from '@/lib/format'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * APTEKA KASSASI.
 *
 * Farmatsevtning ish quroli — kun bo'yi shu ekranda turadi.
 * Shuning uchun u boshqa sahifalarga o'xshamaydi: qidiruv maydoni
 * doim fokusda, natijalar bir bosishda savatga tushadi va savat
 * yonida turadi.
 *
 * QIDIRUV NATIJASI DORI EMAS, PARTIYA. Bitta dorining ikki
 * partiyasi ikki xil muddatga ega va farmatsevt qutini qo'lida
 * ushlab turibdi — qaysi biri ekanini TIZIM emas, U biladi.
 * Avtomatik tanlansa, kassadagi yozuv javondagi haqiqatdan
 * uzilib qolardi.
 */
/**
 * Kassa — FAQAT SMENADAGI ODAMGA.
 *
 * O'rab olish komponent darajasida: sahifaning o'zi o'zgarmadi,
 * lekin smenada bo'lmagan odam uning ichiga umuman kirmaydi.
 */
export function PharmacyPosPage() {
  return (
    <OnDutyGate>
      <PosScreen />
    </OnDutyGate>
  )
}

function PosScreen() {
  const { t } = useI18n()
  const toast = useToast()
  const searchRef = useRef<HTMLInputElement>(null)

  const [term, setTerm] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [scanOpen, setScanOpen] = useState(false)

  const summary = useAsync(pharmacySummary, [])
  const results = useAsync(() => searchForSale(term), [term])

  /* Kassada qo'l klaviaturada — sahifa ochilishi bilan yozishga tayyor */
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  )
  const discountValue = Math.min(Number(discount) || 0, total)
  const toPay = Math.max(0, total - discountValue)

  function addLine(line: CartLine) {
    setCart((current) => {
      const existing = current.find((l) => l.batchId === line.batchId)
      if (existing) {
        /* Zaxiradan ortiq sotib bo'lmaydi — bu yerda to'xtatiladi */
        if (existing.quantity >= existing.available) {
          toast.error(t('pharmacy.notEnough'))
          return current
        }
        return current.map((l) =>
          l.batchId === line.batchId ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...current, { ...line, quantity: 1 }]
    })
    setTerm('')
    searchRef.current?.focus()
  }

  function setQuantity(batchId: string, next: number) {
    setCart((current) =>
      current
        .map((l) =>
          l.batchId === batchId
            ? { ...l, quantity: Math.max(0, Math.min(next, l.available)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  const sell = useAction(async () => {
    await createSale({ lines: cart, discount: discountValue, method, patientId: null })
  })

  async function submit() {
    if (cart.length === 0) return
    const done = await sell.run()
    if (done === null) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(t('pharmacy.sold', { sum: money(toPay) }))
    setCart([])
    setDiscount('')
    void summary.reload()
    searchRef.current?.focus()
  }

  /**
   * Skanerdan kelgan kod.
   *
   * GS1 DataMatrix bo'lsa — ichidan GTIN olinadi, aks holda
   * kodning o'zi ishlatiladi. Ikkalasi ham qidiruv maydoniga
   * tushadi: farmatsevt nima o'qilganini KO'RIB tursin, aks
   * holda noto'g'ri dori savatga jimgina tushib qolardi.
   */
  function handleScan(raw: string) {
    setScanOpen(false)
    setTerm(searchTermFrom(raw))
    searchRef.current?.focus()
  }

  return (
    <div className="space-y-4">
      <ScanDialog open={scanOpen} onClose={() => setScanOpen(false)} onDetect={handleScan} />

      {/* --- Bugungi holat --- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('pharmacy.todayRevenue')} value={money(summary.data?.todayRevenue ?? 0)} />
        <Stat label={t('pharmacy.todaySales')} value={String(summary.data?.todaySales ?? 0)} />
        <Stat label={t('pharmacy.todayProfit')} value={money(summary.data?.todayProfit ?? 0)} tone="good" />
        <Stat
          label={t('pharmacy.expiringShort')}
          value={String(summary.data?.expiringBatches ?? 0)}
          tone={summary.data?.expiringBatches ? 'warn' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* --- Qidiruv --- */}
        <Card padded={false} className="min-w-0">
          <div className="flex items-center gap-2 p-4 sm:p-5">
            <SearchInput
              className="min-w-0 flex-1"
              inputRef={searchRef}
              value={term}
              onChange={setTerm}
              icon={<Scan size={16} />}
              placeholder={t('pharmacy.searchHint')}
            />
            {/*
              KAMERA — QO'SHIMCHA YO'L. Aptekada odatda USB skaner
              turadi va u klaviatura kabi ishlaydi: kodni to'g'ridan
              to'g'ri yuqoridagi maydonga yozib beradi. Kamera esa
              skaner buzilganda yoki telefonda ishlaganda asqotadi.
            */}
            <IconButton
              label={t('scan.title')}
              className="h-10 w-10 shrink-0 bg-raised"
              onClick={() => setScanOpen(true)}
            >
              <Camera size={18} />
            </IconButton>
          </div>

          {term.trim() === '' ? (
            <EmptyState
              icon={<Scan size={22} />}
              title={t('pharmacy.startTyping')}
              description={t('pharmacy.startTypingHint')}
            />
          ) : (results.data ?? []).length === 0 ? (
            <EmptyState title={t('pharmacy.nothingFound')} />
          ) : (
            <ul className="hairline-t divide-y divide-separator">
              {(results.data ?? []).map((line) => (
                <li key={line.batchId}>
                  <button
                    type="button"
                    onClick={() => addLine(line)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-fill-4 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-subhead font-medium text-label">
                          {line.name}
                        </span>
                        {line.prescriptionOnly ? (
                          <Badge tone="warn">{t('pharmacy.rx')}</Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-caption text-label-tertiary">
                        {t('pharmacy.expires')}: {dateShort(line.expiresAt)} ·{' '}
                        {t('pharmacy.left')}: {line.available}
                      </span>
                    </span>
                    <span className="shrink-0 text-subhead font-semibold tabular-nums text-label">
                      {money(line.price)}
                    </span>
                    <Plus size={16} className="shrink-0 text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- Savat --- */}
        <Card padded={false} className="flex min-w-0 flex-col self-start">
          <div className="flex items-center gap-2 p-4 sm:p-5">
            <ShoppingCart size={17} className="text-label-secondary" />
            <p className="text-headline font-semibold text-label">{t('pharmacy.cart')}</p>
            {cart.length > 0 ? (
              <Badge tone="accent" className="ml-auto">
                {cart.length}
              </Badge>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <p className="hairline-t px-4 py-8 text-center text-subhead text-label-tertiary sm:px-5">
              {t('pharmacy.cartEmpty')}
            </p>
          ) : (
            <ul className="hairline-t divide-y divide-separator">
              {cart.map((line) => (
                <li key={line.batchId} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-subhead font-medium text-label">
                      {line.name}
                    </p>
                    <IconButton
                      label={t('action.delete')}
                      className="h-7 w-7"
                      onClick={() => setQuantity(line.batchId, 0)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-[9px] bg-fill-4">
                      <IconButton
                        label="-"
                        className="h-7 w-7"
                        onClick={() => setQuantity(line.batchId, line.quantity - 1)}
                      >
                        <Minus size={13} />
                      </IconButton>
                      <span className="w-7 text-center text-subhead font-semibold tabular-nums text-label">
                        {line.quantity}
                      </span>
                      <IconButton
                        label="+"
                        className="h-7 w-7"
                        onClick={() => setQuantity(line.batchId, line.quantity + 1)}
                      >
                        <Plus size={13} />
                      </IconButton>
                    </span>

                    <span className="ml-auto text-subhead font-semibold tabular-nums text-label">
                      {money(line.price * line.quantity)}
                    </span>
                  </div>

                  {line.quantity >= line.available ? (
                    <p className="mt-1.5 flex items-center gap-1 text-caption text-warn">
                      <TriangleAlert size={12} />
                      {t('pharmacy.allTaken')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* --- Yakun --- */}
          <div className="hairline-t space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between text-subhead text-label-secondary">
              <span>{t('pharmacy.subtotal')}</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-subhead text-label-secondary">
                {t('pharmacy.discount')}
              </span>
              <input
                inputMode="numeric"
                value={discount}
                placeholder="0"
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                className="h-9 w-28 rounded-[9px] border border-transparent bg-raised px-3 text-right text-subhead tabular-nums text-label outline-none transition-colors duration-150 focus:border-accent"
              />
            </div>

            <div className="hairline-t flex items-center justify-between pt-3">
              <span className="text-headline font-semibold text-label">
                {t('pharmacy.toPay')}
              </span>
              <span className="text-title-3 font-bold tabular-nums text-label">
                {money(toPay)}
              </span>
            </div>

            <Segmented
              className="w-full"
              value={method}
              onChange={setMethod}
              options={[
                {
                  value: 'cash',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Banknote size={14} />
                      {t('payments.method.cash')}
                    </span>
                  ),
                },
                {
                  value: 'card',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={14} />
                      {t('payments.method.card')}
                    </span>
                  ),
                },
                { value: 'transfer', label: t('payments.method.transfer') },
              ]}
            />

            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0}
              loading={sell.pending}
              onClick={() => void submit()}
            >
              {t('pharmacy.sell')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn'
}) {
  return (
    <Card className="min-w-0">
      <p className="truncate text-caption text-label-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-callout font-bold tabular-nums sm:text-title-3',
          tone === 'good' && 'text-good',
          tone === 'warn' && 'text-warn',
          !tone && 'text-label',
        )}
      >
        {value}
      </p>
    </Card>
  )
}
