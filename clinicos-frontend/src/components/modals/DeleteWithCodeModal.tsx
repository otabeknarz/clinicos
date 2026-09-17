import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'

import { getDeleteCodeStatus, setDeleteCode } from '@/api/deleteCode'
import { Button } from '@/components/ui/Button'
import { TextArea, TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

export interface DeleteOption<T extends string> {
  value: T
  label: string
  hint: string
  /** Qaytarib bo'lmaydigan variant — qizil ko'rinadi */
  danger?: boolean
}

/**
 * KOD BILAN O'CHIRISH OYNASI — bemor, xizmat va to'lov uchun bitta.
 *
 * Kodni klinika egasi Sozlamalar → Klinika bo'limida o'rnatadi. Kod
 * o'rnatilmagan bo'lsa oyna buni darhol aytadi — odam kodni terib,
 * keyin "o'rnatilmagan" degan xatoni ko'rmasin.
 *
 * Xato (noto'g'ri kod, qulf) oyna ichida, maydon ostida ko'rinadi:
 * bildirishnoma bir zumda yo'qoladi, kodni qayta terayotgan odam esa
 * nima noto'g'ri bo'lganini ko'rib turishi kerak.
 */
export function DeleteWithCodeModal<T extends string = string>({
  open,
  onClose,
  title,
  description,
  options,
  withReason = false,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  options?: DeleteOption<T>[]
  withReason?: boolean
  confirmLabel?: string
  /** Xato tashlasa — oyna ochiq qoladi va xabar ko'rinadi */
  onConfirm: (input: { code: string; option: T | null; reason: string }) => Promise<void>
}) {
  const { t } = useI18n()
  const { can } = useAuth()
  const [code, setCode] = useState('')
  const [repeat, setRepeat] = useState('')
  const [reason, setReason] = useState('')
  const [option, setOption] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const status = useAsync(() => getDeleteCodeStatus(), [open], { skip: !open })

  useEffect(() => {
    if (!open) return
    setCode('')
    setRepeat('')
    setReason('')
    setError('')
    setOption(options?.[0]?.value ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const notSet = status.data ? !status.data.isSet : false
  /*
    KOD HALI YO'Q VA OYNANI EGASI OCHDI — kod shu yerda yaratiladi va darhol
    ishlatiladi. Keyingi o'chirishlarda o'sha kod so'raladi. Kodni boshqa
    xodim yarata olmaydi: u egasidan so'raydi.
  */
  const creating = notSet && can('settings.manage')
  const blocked = notSet && !creating
  const selected = options?.find((o) => o.value === option)
  const danger = options ? Boolean(selected?.danger) : true
  const codeOk = creating ? /^\d{4,8}$/.test(code) && repeat === code : code.trim().length >= 4

  async function submit() {
    if (!codeOk || blocked || pending) return
    setPending(true)
    setError('')
    try {
      if (creating) await setDeleteCode({ code })
      await onConfirm({ code: code.trim(), option, reason: reason.trim() })
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('toast.error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={typeof description === 'string' ? description : undefined}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'filled'}
            loading={pending}
            disabled={blocked || !codeOk}
            onClick={submit}
          >
            {creating ? t('deleteCode.createAndDelete') : (confirmLabel ?? t('action.delete'))}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {typeof description === 'string' ? null : description}

        {options ? (
          <div className="grid gap-2">
            {options.map((o) => {
              const active = o.value === option
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOption(o.value)}
                  className={cn(
                    'rounded-[12px] px-4 py-3 text-left ring-1 transition-colors',
                    active
                      ? o.danger
                        ? 'bg-bad-soft ring-bad/50'
                        : 'bg-accent-soft ring-accent/40'
                      : 'bg-sunken ring-transparent hover:ring-separator',
                  )}
                >
                  <p
                    className={cn(
                      'text-subhead font-medium',
                      active ? (o.danger ? 'text-bad' : 'text-accent') : 'text-label',
                    )}
                  >
                    {o.label}
                  </p>
                  <p className="mt-0.5 text-caption text-label-secondary">{o.hint}</p>
                </button>
              )
            })}
          </div>
        ) : null}

        {withReason ? (
          <TextArea
            label={t('deleteCode.reason')}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : null}

        {blocked ? (
          <div className="flex gap-3 rounded-[12px] bg-warn-soft px-4 py-3 text-warn">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <p className="text-footnote">{t('deleteCode.notSetStaff')}</p>
          </div>
        ) : creating ? (
          <div className="space-y-3 rounded-[12px] bg-accent-soft p-3.5">
            <p className="text-footnote text-label">{t('deleteCode.createHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label={t('deleteCode.new')}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                name="new-delete-code"
                data-1p-ignore
                maxLength={8}
                value={code}
                hint={t('deleteCode.format')}
                error={error || undefined}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''))
                  setError('')
                }}
              />
              <TextInput
                label={t('deleteCode.repeat')}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                name="repeat-delete-code"
                data-1p-ignore
                maxLength={8}
                value={repeat}
                error={repeat && repeat !== code ? t('deleteCode.mismatch') : undefined}
                onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
        ) : (
          <TextInput
            label={t('deleteCode.label')}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            name="delete-code"
            data-1p-ignore
            maxLength={8}
            icon={<KeyRound size={16} />}
            value={code}
            error={error || undefined}
            hint={t('deleteCode.hint')}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
        )}
      </div>
    </Modal>
  )
}
