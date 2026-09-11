import { useState } from 'react'
import { Pause, Pill } from 'lucide-react'

import {
  createPharmacy,
  resetPharmacyOwnerPassword,
  suspendPharmacy,
  updatePharmacy,
} from '@/api/platformPharmacy'
import type { PharmacyCreated } from '@/api/platformPharmacy'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmailLocalInput, buildPlatformEmail } from '@/components/ui/EmailLocalInput'
import { PhoneInput, TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/States'
import { phoneToE164 } from '@/lib/format'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'
import type { OwnerPasswordReset } from '@/types/models'
import type { Pharmacy } from '@/types/pharmacy'

/**
 * Aptekalar bo'limining oynalari.
 *
 * Alohida faylda: ro'yxat ham, apteka kartasi ham ularni ochadi.
 * Shakli klinikalarnikiga ataylab o'xshash — platforma egasi bir
 * joyda o'rgangan narsani ikkinchi joyda qaytadan o'rganmasin.
 */

/* ------------------------------------------------------------------ */
/* Server ulanmagan                                                    */
/* ------------------------------------------------------------------ */

/**
 * SERVERDA DEMO MA'LUMOT KO'RSATILMAYDI.
 *
 * Aptekalar API si hozircha faqat demo qatlamida ishlaydi. Haqiqiy
 * serverda u o'sha demo bazadan "Sog'lom dorixonasi, 42 mln tushum"
 * kabi raqamlarni chiqarib, ularni haqiqiy mijozdek ko'rsatardi —
 * platforma egasi esa bunga ishonib qaror qabul qilardi. Server qismi
 * yozilguncha bo'lim ochiq aytadi: hali ulanmagan.
 */
export function PharmacyNotConnected() {
  const { t } = useI18n()
  return (
    <>
      <PageHeader title={t('pharmacies.title')} />
      <Card>
        <EmptyState
          icon={<Pill size={24} strokeWidth={1.75} />}
          title={t('pharmacies.notConnected')}
          description={t('pharmacies.notConnectedHint')}
        />
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Yangi apteka                                                        */
/* ------------------------------------------------------------------ */

export function NewPharmacyModal({
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

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [ownerName, setOwnerName] = useState('')
  const [ownerLogin, setOwnerLogin] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('+998 ')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<PharmacyCreated | null>(null)

  const valid =
    name.trim().length > 1 &&
    address.trim().length > 1 &&
    ownerName.trim().length > 1 &&
    ownerLogin.trim().length > 1

  function reset() {
    setName('')
    setCity('')
    setAddress('')
    setPhone('+998 ')
    setOwnerName('')
    setOwnerLogin('')
    setOwnerPhone('+998 ')
    setCreated(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function submit() {
    if (!valid) return
    setSaving(true)
    try {
      const result = await createPharmacy({
        name,
        city,
        address,
        phone: phoneToE164(phone),
        ownerName,
        ownerEmail: buildPlatformEmail(ownerLogin),
        ownerPhone: phoneToE164(ownerPhone),
      })
      setCreated(result)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  /*
    Yaratilgandan keyin — faqat login va parol.

    Parol shu oynada BIR MARTA ko'rinadi: bazada xeshi saqlanadi va
    keyin uni hech kim ko'ra olmaydi. Yopib qo'yilsa, "Rahbar parolini
    tiklash" bilan yangisi beriladi.
  */
  if (created) {
    return (
      <Modal
        open
        onClose={close}
        title={t('pharmacies.created')}
        footer={<Button onClick={close}>{t('action.close')}</Button>}
      >
        <div className="space-y-4">
          <p className="text-subhead text-label">{created.pharmacy.name}</p>

          <div className="rounded-[12px] bg-fill-4 p-4">
            <p className="text-caption text-label-tertiary">{t('pharmacies.ownerLogin')}</p>
            <p className="mt-0.5 text-callout font-medium text-label">{created.ownerEmail}</p>

            <p className="mt-3 text-caption text-label-tertiary">
              {t('platform.passwordOnce')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="text-callout font-semibold tnum text-label">
                {created.ownerPassword}
              </code>
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  void navigator.clipboard?.writeText(created.ownerPassword)
                  toast.success(t('platform.copied'))
                }}
              >
                {t('action.copy')}
              </Button>
            </div>
          </div>

          <p className="text-caption text-bad">{t('platform.passwordOnceHint')}</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('pharmacies.newTitle')}
      footer={
        <>
          <Button variant="gray" onClick={close}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {t('action.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-caption text-label-tertiary">{t('pharmacies.newHint')}</p>

        <p className="text-footnote font-medium text-label-secondary">
          {t('pharmacies.info')}
        </p>
        <TextInput
          label={t('pharmacies.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
          <TextInput
            label={t('pharmacies.city')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <TextInput
          label={t('pharmacies.address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <p className="pt-2 text-footnote font-medium text-label-secondary">
          {t('pharmacies.ownerInfo')}
        </p>
        <TextInput
          label={t('pharmacies.ownerName')}
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Domen qo'lda yozilmaydi — izohi `EmailLocalInput` da */}
          <EmailLocalInput
            label={t('pharmacies.ownerLogin')}
            value={ownerLogin}
            onChange={setOwnerLogin}
            required
          />
          <PhoneInput
            label={t('pharmacies.ownerPhone')}
            value={ownerPhone}
            onChange={setOwnerPhone}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Tahrirlash                                                          */
/* ------------------------------------------------------------------ */

/** Apteka ma'lumotlari. Rahbar va holat bu yerdan o'zgarmaydi. */
export function EditPharmacyModal({
  pharmacy,
  onClose,
  onDone,
}: {
  pharmacy: Pharmacy | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [saving, setSaving] = useState(false)

  /* Oyna ochilganda mavjud qiymatlar bilan to'ldiriladi */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (pharmacy && loadedFor !== pharmacy.id) {
    setLoadedFor(pharmacy.id)
    setName(pharmacy.name)
    setCity(pharmacy.city)
    setAddress(pharmacy.address)
    setPhone(pharmacy.phone || '+998 ')
  }
  if (!pharmacy && loadedFor !== null) setLoadedFor(null)

  const valid = name.trim().length > 1 && address.trim().length > 1

  async function submit() {
    if (!pharmacy || !valid) return
    setSaving(true)
    try {
      await updatePharmacy(pharmacy.id, {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        phone: phoneToE164(phone),
      })
      toast.success(t('toast.saved'))
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={pharmacy !== null}
      onClose={onClose}
      title={t('pharmacies.editTitle')}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={submit}>
            {t('action.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label={t('pharmacies.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneInput label={t('common.phone')} value={phone} onChange={setPhone} />
          <TextInput
            label={t('pharmacies.city')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <TextInput
          label={t('pharmacies.address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* To'xtatish                                                          */
/* ------------------------------------------------------------------ */

export function SuspendPharmacyModal({
  pharmacy,
  onClose,
  onDone,
}: {
  pharmacy: Pharmacy | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!pharmacy || !reason.trim()) return
    setSaving(true)
    try {
      await suspendPharmacy(pharmacy.id, reason)
      toast.success(t('toast.saved'))
      setReason('')
      onDone()
      onClose()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={pharmacy !== null}
      onClose={onClose}
      size="sm"
      title={t('pharmacies.suspendTitle')}
      description={pharmacy?.name}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button variant="danger" loading={saving} disabled={!reason.trim()} onClick={submit}>
            {t('pharmacies.suspend')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextArea
          label={t('platform.suspendReason')}
          hint={t('pharmacies.suspendHint')}
          placeholder={t('platform.suspendPlaceholder')}
          rows={3}
          required
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <p className="flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
          <Pause size={14} className="mt-0.5 shrink-0" />
          {t('pharmacies.suspendWarning')}
        </p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Rahbar parolini tiklash                                             */
/* ------------------------------------------------------------------ */

export function ResetPharmacyOwnerModal({
  pharmacy,
  onClose,
}: {
  pharmacy: (Pharmacy & { ownerEmail: string }) | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<OwnerPasswordReset | null>(null)

  async function submit() {
    if (!pharmacy) return
    setSaving(true)
    try {
      setResult(await resetPharmacyOwnerPassword(pharmacy.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  function close() {
    setResult(null)
    onClose()
  }

  return (
    <Modal
      open={pharmacy !== null}
      onClose={close}
      title={t('pharmacies.resetTitle')}
      footer={
        result ? (
          <Button onClick={close}>{t('action.close')}</Button>
        ) : (
          <>
            <Button variant="gray" onClick={close}>
              {t('action.cancel')}
            </Button>
            <Button variant="danger" loading={saving} onClick={submit}>
              {t('platform.resetOwnerConfirm')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-[12px] bg-fill-4 p-4">
            <p className="text-caption text-label-tertiary">{result.ownerName}</p>
            <p className="mt-0.5 text-callout font-medium text-label">{result.ownerEmail}</p>

            <p className="mt-3 text-caption text-label-tertiary">
              {t('platform.resetOwnerDone')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <code className="text-callout font-semibold tnum text-label">
                {result.password}
              </code>
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.password)
                  toast.success(t('platform.copied'))
                }}
              >
                {t('action.copy')}
              </Button>
            </div>
          </div>

          <p className="text-caption text-bad">{t('platform.passwordOnceHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-subhead text-label">{pharmacy?.name}</p>
          <p className="text-caption text-label-tertiary">{pharmacy?.ownerEmail}</p>
          <p className="rounded-[10px] bg-warn-soft px-3 py-2.5 text-caption text-warn">
            {t('pharmacies.resetWarning')}
          </p>
        </div>
      )}
    </Modal>
  )
}
