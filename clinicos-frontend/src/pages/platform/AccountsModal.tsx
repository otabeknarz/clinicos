import { useState } from 'react'

import {
  listTenantAccounts,
  resetDeleteCode,
  setTenantAccountPassword,
  setTenantDeleteCode,
} from '@/api/platform'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * LOGINLAR VA O'CHIRISH KODI — klinikalar va aptekalar uchun bitta oyna.
 *
 * Parollar ko'rsatilmaydi (bazada xesh): unutilgan parol o'rniga admin
 * yangisini qo'yadi. O'chirish kodi faqat klinikada bor.
 */
export function AccountsModal({
  tenant,
  onClose,
  withDeleteCode = true,
}: {
  /** Klinika yoki apteka: `id` — klinika id'si */
  tenant: { id: string; name: string } | null
  onClose: () => void
  /** Aptekada o'chirish kodi yo'q — faqat loginlar */
  withDeleteCode?: boolean
}) {
  const { t } = useI18n()
  const toast = useToast()
  /*
    LOGINLAR VA O'CHIRISH KODI.

    Parollar KO'RSATILMAYDI — ular bazada xesh. Odam unutsa, admin shu yerda
    yangisini qo'yib, unga aytadi. O'chirish kodi ham xuddi shunday: bekor
    qilinadi yoki yangisi qo'yiladi.
  */
  const accounts = useAsync(
    () => (tenant ? listTenantAccounts(tenant.id) : Promise.resolve(null)),
    [tenant?.id],
    { skip: !tenant },
  )
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    setEditingUser(null)
    setNewPassword('')
    setNewCode('')
    onClose()
  }

  async function savePassword(userId: string) {
    if (!tenant || newPassword.length < 8) return
    setSaving(true)
    try {
      await setTenantAccountPassword(tenant.id, userId, newPassword)
      void navigator.clipboard?.writeText(newPassword)
      toast.success(t('platform.passwordChanged'))
      setEditingUser(null)
      setNewPassword('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  async function saveCode() {
    if (!tenant || !/^\d{4,8}$/.test(newCode)) return
    setSaving(true)
    try {
      await setTenantDeleteCode(tenant.id, newCode)
      toast.success(t('platform.deleteCodeSaved'))
      setNewCode('')
      accounts.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  async function cancelCode() {
    if (!tenant) return
    setSaving(true)
    try {
      await resetDeleteCode(tenant.id)
      toast.success(t('platform.deleteCodeResetDone'))
      accounts.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={tenant !== null}
      onClose={close}
      size="lg"
      title={t('platform.accountsTitle')}
      description={tenant?.name}
      footer={<Button onClick={close}>{t('action.close')}</Button>}
    >
      <div className="space-y-5 pb-2">
        <section>
          <p className="mb-2 text-footnote font-semibold text-label">{t('platform.accountsLogins')}</p>
          <p className="mb-3 text-caption text-label-tertiary">{t('platform.accountsHint')}</p>
          {accounts.loading ? (
            <p className="text-caption text-label-tertiary">…</p>
          ) : (
            <ul className="divide-y divide-separator rounded-[12px] ring-1 ring-separator">
              {(accounts.data?.users ?? []).map((user) => (
                <li key={user.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-subhead font-medium text-label">
                        {user.fullName}
                        {!user.isActive ? (
                          <span className="ml-2 text-caption text-label-tertiary">
                            {t('platform.accountInactive')}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-caption text-label-secondary">
                        {user.login} · {t(`role.${user.role}`)}
                      </p>
                    </div>
                    {editingUser === user.id ? null : (
                      <Button
                        size="sm"
                        variant="gray"
                        onClick={() => {
                          setEditingUser(user.id)
                          setNewPassword('')
                        }}
                      >
                        {t('platform.setPassword')}
                      </Button>
                    )}
                  </div>
                  {editingUser === user.id ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <TextInput
                          label={t('platform.newPassword')}
                          name="admin-set-new-password"
                          autoComplete="off"
                          data-1p-ignore
                          value={newPassword}
                          hint={t('platform.newPasswordHint')}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="gray"
                        onClick={() => setNewPassword(generateAdminPassword())}
                      >
                        {t('platform.generate')}
                      </Button>
                      <Button
                        size="sm"
                        loading={saving}
                        disabled={newPassword.length < 8}
                        onClick={() => savePassword(user.id)}
                      >
                        {t('action.save')}
                      </Button>
                      <Button size="sm" variant="plain" onClick={() => setEditingUser(null)}>
                        {t('action.cancel')}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {withDeleteCode ? (
        <section className="rounded-[12px] bg-sunken p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-footnote font-semibold text-label">{t('deleteCode.cardTitle')}</p>
            {accounts.data ? (
              <Badge tone={accounts.data.deleteCodeSet ? 'ok' : 'warn'}>
                {accounts.data.deleteCodeSet ? t('deleteCode.isSet') : t('deleteCode.notSetBadge')}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-40">
              <TextInput
                label={t('platform.newDeleteCode')}
                name="admin-new-delete-code"
                inputMode="numeric"
                autoComplete="off"
                data-1p-ignore
                maxLength={8}
                value={newCode}
                hint={t('deleteCode.format')}
                onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button
              size="sm"
              loading={saving}
              disabled={!/^\d{4,8}$/.test(newCode)}
              onClick={saveCode}
            >
              {t('action.save')}
            </Button>
            {accounts.data?.deleteCodeSet ? (
              <Button size="sm" variant="gray" loading={saving} onClick={cancelCode}>
                {t('platform.deleteCodeReset')}
              </Button>
            ) : null}
          </div>
        </section>
        ) : null}
      </div>
    </Modal>
  )
}

/** O'qilishi oson parol: chalkash belgilarsiz (0/O, 1/l) */
function generateAdminPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return [...bytes].map((n) => chars[n % chars.length]).join('')
}
