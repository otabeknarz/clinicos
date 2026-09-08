import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { createService, updateService } from '@/api/services'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Select, TextInput } from '@/components/ui/Form'
import { SERVICE_CATEGORIES } from '@/i18n/data'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import { resolveServicePrice } from '@/types/models'
import type {
  LoyaltyTier,
  PaymentTiming,
  Service,
  ServicePriceMode,
} from '@/types/models'

export function ServiceFormModal({
  open,
  onClose,
  onSaved,
  service,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  service?: Service | null
}) {
  const { t, tCategory, tService } = useI18n()
  const toast = useToast()
  const editing = Boolean(service)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')
  const [timing, setTiming] = useState<PaymentTiming>('postpaid')
  const [tiers, setTiers] = useState<LoyaltyTier[]>([])
  const [touched, setTouched] = useState(false)

  /*
    NARXNI SHIFOKOR BELGILAYDIMI.

    Egasi buni FAQAT shu yerda belgilaydi — undan keyingi hamma ish
    shifokor va registrator panelida bo'ladi.
  */
  const [doctorSet, setDoctorSet] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    if (!open) return
    setTouched(false)
    // Demo xizmatlar nomi tarjima kaliti sifatida saqlanadi — tahrirlashda
    // foydalanuvchiga o'qilishi mumkin bo'lgan nomni ko'rsatamiz.
    setName(service ? tService(service.name) : '')
    setCategory(service?.category ?? '')
    setPrice(service ? String(service.price) : '')
    setDuration(service ? String(service.durationMinutes) : '30')
    setTiming(service?.paymentTiming ?? 'postpaid')
    setTiers(service?.loyaltyTiers ? [...service.loyaltyTiers] : [])
    setDoctorSet(service?.priceMode === 'doctor_set')
    setMinPrice(service?.minPrice ? String(service.minPrice) : '')
    setMaxPrice(service?.maxPrice ? String(service.maxPrice) : '')
  }, [open, service, tService])

  const errors = {
    name: !name.trim() ? t('valid.required') : undefined,
    category: !category ? t('valid.required') : undefined,
    price: doctorSet || (price && Number(price) > 0) ? undefined : t('valid.positive'),
    duration: !duration || Number(duration) <= 0 ? t('valid.positive') : undefined,
    minPrice:
      doctorSet && (!minPrice || Number(minPrice) <= 0) ? t('valid.positive') : undefined,
    maxPrice: doctorSet
      ? !maxPrice || Number(maxPrice) <= 0
        ? t('valid.positive')
        : Number(minPrice) > Number(maxPrice)
          ? t('serviceForm.rangeInvalid')
          : undefined
      : undefined,
  }
  const valid = Object.values(errors).every((error) => error === undefined)

  const save = useAction(async () => {
    const payload = {
      name: name.trim(),
      category,
      /*
        Narxni shifokor belgilasa, katalog narxi sifatida eng kami
        yoziladi — server ham xuddi shunday qiladi. Narxni o'qiydigan
        eski joylar bo'sh qiymat ko'rmasin.
      */
      price: doctorSet ? Number(minPrice) : Number(price),
      priceMode: (doctorSet ? 'doctor_set' : 'fixed') as ServicePriceMode,
      minPrice: doctorSet ? Number(minPrice) : undefined,
      maxPrice: doctorSet ? Number(maxPrice) : undefined,
      durationMinutes: Number(duration),
      // Summasi noma'lum xizmatni oldindan to'lab bo'lmaydi
      paymentTiming: doctorSet ? ('postpaid' as PaymentTiming) : timing,
      // Bo'sh yoki noto'g'ri pog'onalarni saqlamaymiz
      loyaltyTiers: tiers
        .filter((tier) => tier.afterVisits > 0 && tier.discountPct > 0)
        .sort((a, b) => a.afterVisits - b.afterVisits),
      status: (service?.status ?? 'active') as Service['status'],
    }
    return service ? updateService(service.id, payload) : createService(payload)
  })

  async function submit() {
    setTouched(true)
    if (!valid) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    toast.success(editing ? t('toast.updated') : t('toast.created'))
    onSaved()
    onClose()
  }

  function updateTier(index: number, patch: Partial<LoyaltyTier>) {
    setTiers((current) =>
      current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    )
  }

  const basePrice = Number(price) || 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('action.edit') : t('services.add')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button onClick={submit} loading={save.pending}>
            {editing ? t('action.save') : t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <TextInput
          label={t('serviceForm.name')}
          required
          value={name}
          error={touched ? errors.name : undefined}
          onChange={(e) => setName(e.target.value)}
        />

        <Select
          label={t('serviceForm.category')}
          required
          value={category}
          error={touched ? errors.category : undefined}
          onChange={(e) => setCategory(e.target.value)}
          options={SERVICE_CATEGORIES.map((key) => ({ value: key, label: tCategory(key) }))}
        />

        {/* ============ Narxni kim belgilaydi ============ */}
        <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-sunken p-3.5">
          <input
            type="checkbox"
            checked={doctorSet}
            onChange={(e) => setDoctorSet(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="min-w-0">
            <span className="block text-subhead font-medium text-label">
              {t('serviceForm.doctorSet')}
            </span>
            <span className="mt-0.5 block text-caption text-label-tertiary">
              {t('serviceForm.doctorSetHint')}
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          {doctorSet ? (
            <>
              <TextInput
                label={t('serviceForm.minPrice')}
                type="number"
                inputMode="numeric"
                min={0}
                step={10000}
                required
                suffix="so'm"
                value={minPrice}
                error={touched ? errors.minPrice : undefined}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <TextInput
                label={t('serviceForm.maxPrice')}
                type="number"
                inputMode="numeric"
                min={0}
                step={10000}
                required
                suffix="so'm"
                value={maxPrice}
                error={touched ? errors.maxPrice : undefined}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </>
          ) : (
            <TextInput
              label={t('serviceForm.price')}
              type="number"
              inputMode="numeric"
              min={0}
              step={10000}
              required
              suffix="so'm"
              value={price}
              error={touched ? errors.price : undefined}
              onChange={(e) => setPrice(e.target.value)}
            />
          )}

          <TextInput
            label={t('serviceForm.duration')}
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            required
            suffix={t('common.min')}
            value={duration}
            error={touched ? errors.duration : undefined}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* ============ To'lov qachon olinadi ============ */}
        <Field
          label={t('serviceForm.paymentTiming')}
          hint={
            /*
              Narxni shifokor belgilasa tanlov yo'q: summasi ko'rikdan
              oldin noma'lum xizmatni oldindan to'lab bo'lmaydi. Server
              ham buni majburan `postpaid` qiladi.
            */
            doctorSet
              ? t('serviceForm.doctorSetPostpaid')
              : timing === 'prepaid'
                ? t('serviceForm.prepaidHint')
                : t('serviceForm.postpaidHint')
          }
        >
          <div className="flex gap-2">
            {(['prepaid', 'postpaid'] as PaymentTiming[]).map((option) => {
              const active = doctorSet ? option === 'postpaid' : timing === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={doctorSet}
                  onClick={() => setTiming(option)}
                  className={cn(
                    'h-10 flex-1 rounded-[10px] text-subhead font-medium',
                    'transition-colors duration-150',
                    active
                      ? 'bg-accent text-white'
                      : 'bg-sunken text-label-secondary hover:text-label',
                    doctorSet && 'cursor-not-allowed opacity-50 hover:text-label-secondary',
                  )}
                >
                  {t(`serviceForm.${option}`)}
                </button>
              )
            })}
          </div>
        </Field>

        {/*
          ============ Sodiqlik chegirmasi ============

          Narxni shifokor belgilaydigan xizmatda CHEGIRMA YO'Q: shifokor
          summani belgilaganda bemorning holatini allaqachon hisobga
          oladi, ustiga chegirma qo'yilsa ikki marta hisoblangan bo'lardi.
          Server ham bu xizmatlarga chegirma qo'llamaydi.
        */}
        <section className={cn('rounded-[14px] bg-sunken p-4', doctorSet && 'hidden')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-subhead font-medium text-label">
                {t('serviceForm.loyalty')}
              </p>
              <p className="mt-0.5 text-caption text-label-secondary">
                {t('serviceForm.loyaltyHint')}
              </p>
            </div>
            <Button
              size="sm"
              variant="tinted"
              icon={<Plus size={14} />}
              onClick={() =>
                setTiers((current) => [
                  ...current,
                  { afterVisits: current.length ? 0 : 3, discountPct: 10 },
                ])
              }
            >
              <span className="hidden sm:inline">{t('serviceForm.addTier')}</span>
            </Button>
          </div>

          {tiers.length === 0 ? (
            <p className="mt-3 text-footnote text-label-tertiary">
              {t('serviceForm.noLoyalty')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tiers.map((tier, index) => {
                const preview = resolveServicePrice(
                  { price: basePrice, loyaltyTiers: [tier] },
                  tier.afterVisits,
                )

                return (
                  <li key={index} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="mb-1 block text-caption text-label-tertiary">
                        {t('serviceForm.afterVisits')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={tier.afterVisits || ''}
                        onChange={(e) =>
                          updateTier(index, { afterVisits: Number(e.target.value) })
                        }
                        className={cn(
                          'h-10 w-full rounded-[10px] bg-raised px-3 text-subhead tnum text-label',
                          'border border-transparent outline-none',
                          'transition-colors duration-150 focus:border-accent',
                        )}
                      />
                    </div>

                    <div className="w-24">
                      <label className="mb-1 block text-caption text-label-tertiary">
                        {t('serviceForm.discount')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={5}
                          value={tier.discountPct || ''}
                          onChange={(e) =>
                            updateTier(index, { discountPct: Number(e.target.value) })
                          }
                          className={cn(
                            'h-10 w-full rounded-[10px] bg-raised px-3 pr-7 text-subhead tnum text-label',
                            'border border-transparent outline-none',
                            'transition-colors duration-150 focus:border-accent',
                          )}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-caption text-label-tertiary">
                          %
                        </span>
                      </div>
                    </div>

                    {/* Natijaviy narx */}
                    <div className="hidden min-w-0 flex-1 pb-2.5 sm:block">
                      <p className="truncate text-caption text-label-tertiary">
                        {basePrice > 0 && tier.afterVisits > 0
                          ? t('serviceForm.tierPreview', {
                              count: tier.afterVisits,
                              price: money(preview.price),
                            })
                          : ''}
                      </p>
                    </div>

                    <IconButton
                      label={t('action.delete')}
                      className="mb-0.5 hover:text-bad"
                      onClick={() =>
                        setTiers((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <X size={16} />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
