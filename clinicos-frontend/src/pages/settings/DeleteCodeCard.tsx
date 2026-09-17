import { useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'

import { getDeleteCodeStatus, setDeleteCode } from '@/api/deleteCode'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Form'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * O'CHIRISH KODI — klinika egasi o'rnatadi.
 *
 * Bemor, xizmat yoki to'lovni o'chirish shu kod bilan tasdiqlanadi.
 * Registratorda o'chirish tugmasi bor, lekin kodni egasi aytmaguncha u
 * hech narsani o'chira olmaydi. Kodni almashtirish egasining paroli bilan —
 * ochiq qolgan kompyuterdan uni o'zgartirib bo'lmasin.
 */
export function DeleteCodeCard() {
  const { t } = useI18n()
  const toast = useToast()
  const status = useAsync(() => getDeleteCodeStatus(), [])

  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [repeat, setRepeat] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const isSet = status.data?.isSet ?? false
  const codeValid = /^\d{4,8}$/.test(code)
  const mismatch = repeat.length > 0 && repeat !== code

  async function submit() {
    if (!codeValid || repeat !== code || !password || pending) return
    setPending(true)
    setError('')
    try {
      await setDeleteCode({ code, password })
      toast.success(t('deleteCode.saved'))
      setEditing(false)
      setCode('')
      setRepeat('')
      setPassword('')
      status.reload()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('toast.error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="max-w-xl rounded-[14px] bg-sunken p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-accent">
          <KeyRound size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-subhead font-semibold text-label">{t('deleteCode.cardTitle')}</p>
            {status.data ? (
              isSet ? (
                <Badge tone="ok">
                  <ShieldCheck size={12} className="mr-1" />
                  {t('deleteCode.isSet')}
                </Badge>
              ) : (
                <Badge tone="warn">{t('deleteCode.notSetBadge')}</Badge>
              )
            ) : null}
          </div>
          <p className="mt-1 text-footnote text-label-secondary">{t('deleteCode.cardHint')}</p>

          {editing ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label={t('deleteCode.new')}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={code}
                  hint={t('deleteCode.format')}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <TextInput
                  label={t('deleteCode.repeat')}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={repeat}
                  error={mismatch ? t('deleteCode.mismatch') : undefined}
                  onChange={(e) => setRepeat(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <TextInput
                label={t('deleteCode.password')}
                type="password"
                autoComplete="current-password"
                value={password}
                error={error || undefined}
                hint={t('deleteCode.passwordHint')}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
              />
              <div className="flex gap-2">
                <Button
                  onClick={submit}
                  loading={pending}
                  disabled={!codeValid || repeat !== code || !password}
                >
                  {t('action.save')}
                </Button>
                <Button variant="gray" onClick={() => setEditing(false)}>
                  {t('action.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-3" size="sm" variant="tinted" onClick={() => setEditing(true)}>
              {isSet ? t('deleteCode.change') : t('deleteCode.setup')}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
