import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'

import { updateProfile } from '@/api/auth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { PhoneInput, TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { prepareAvatar } from '@/lib/image'
import type { ImageError } from '@/lib/image'
import { phoneToE164 } from '@/lib/format'
import { useAction } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

/**
 * Egasining o'z profili.
 *
 * Rasm brauzerda 256px gacha kichraytiriladi va JPEG'ga o'giriladi —
 * telefondan olingan 5 MB lik rasmni o'sha holicha saqlash noto'g'ri.
 */
export function ProfileTab() {
  const { t } = useI18n()
  const toast = useToast()
  const { session, refresh } = useAuth()

  const fileRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('+998 ')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<ImageError | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!session) return
    setFullName(session.user.fullName)
    setPhone(session.user.phone)
    setEmail(session.user.email)
    setAvatarUrl(session.user.avatarUrl)
  }, [session])

  const save = useAction(async () => {
    if (!session) return null
    return updateProfile(session.user.id, {
      fullName: fullName.trim(),
      phone: phoneToE164(phone),
      email: email.trim(),
      avatarUrl,
    })
  })

  async function pickFile(file: File | undefined) {
    if (!file) return
    setImageError(null)

    const result = await prepareAvatar(file)
    if (!result.ok) {
      setImageError(result.error ?? 'decode')
      return
    }
    setAvatarUrl(result.dataUrl)
  }

  const errors = {
    fullName: !fullName.trim() ? t('valid.required') : undefined,
    phone: phone.replace(/\D/g, '').length < 12 ? t('valid.phone') : undefined,
  }
  const valid = !errors.fullName && !errors.phone

  async function submit() {
    setTouched(true)
    if (!valid) return

    const result = await save.run()
    if (!result) {
      toast.error(t('toast.error'))
      return
    }
    await refresh()
    toast.success(t('profile.saved'))
  }

  if (!session) return null

  return (
    <div className="max-w-xl space-y-6">
      {/* ============ Rasm ============ */}
      <div>
        <p className="mb-3 text-footnote font-medium text-label-secondary">
          {t('profile.photo')}
        </p>

        <div className="flex items-center gap-5">
          {/* Rasm ustiga bosilsa ham tanlash oynasi ochiladi */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative shrink-0 rounded-full"
            aria-label={t('profile.upload')}
          >
            <Avatar name={fullName || session.user.fullName} src={avatarUrl} size="xl" />
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-full',
                'bg-black/45 text-white opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100',
              )}
            >
              <Camera size={22} />
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="tinted"
                size="sm"
                icon={<Upload size={14} />}
                onClick={() => fileRef.current?.click()}
              >
                {avatarUrl ? t('profile.change') : t('profile.upload')}
              </Button>

              {avatarUrl ? (
                <Button
                  variant="gray"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => setAvatarUrl(null)}
                >
                  {t('profile.remove')}
                </Button>
              ) : null}
            </div>

            <p className="mt-2 text-caption text-label-tertiary">{t('profile.photoHint')}</p>

            {imageError ? (
              <p className="mt-1.5 text-caption text-bad">
                {t(`profile.error.${imageError}`)}
              </p>
            ) : null}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            // Bir xil faylni qayta tanlash ham ishlashi uchun tozalaymiz
            e.target.value = ''
          }}
        />
      </div>

      {/* ============ Ma'lumotlar ============ */}
      <TextInput
        label={t('patientForm.fullName')}
        required
        value={fullName}
        error={touched ? errors.fullName : undefined}
        onChange={(e) => setFullName(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <PhoneInput
          label={t('common.phone')}
          required
          value={phone}
          error={touched ? errors.phone : undefined}
          onChange={setPhone}
        />

        <TextInput
          label={t('common.email')}
          type="email"
          value={email}
          hint={t('staff.loginHint')}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="rounded-[12px] bg-sunken px-4 py-3">
        <p className="text-caption text-label-tertiary">{t('staff.role')}</p>
        <p className="mt-0.5 text-subhead font-medium text-label">
          {t(`role.${session.user.role}`)}
        </p>
      </div>

      <Button onClick={submit} loading={save.pending}>
        {t('action.save')}
      </Button>
    </div>
  )
}
