import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Activity, Lock, Mail } from 'lucide-react'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/api/auth'
import { USE_MOCK } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * Kirish sahifasi.
 *
 * Demo hisoblari ro'yxati ko'rsatiladi — bir bosishda rolni almashtirib,
 * har bir rol qanday interfeys ko'rishini tekshirish mumkin.
 *
 * DASTURCHIGA: haqiqiy backendda bu ro'yxat OLIB TASHLANADI.
 */
export function LoginPage() {
  const { t } = useI18n()
  const { session, login, loading, error } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  if (session) return <Navigate to="/" replace />

  const emailError = touched && !email.trim() ? t('valid.required') : undefined
  const passwordError = touched && !password ? t('valid.required') : undefined

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!email.trim() || !password) return
    try {
      await login(email, password)
    } catch {
      /* xato AuthContext'da saqlanadi va pastda ko'rsatiladi */
    }
  }

  function signInAsDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    setTouched(false)
    void login(demoEmail, DEMO_PASSWORD).catch(() => {})
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm">
        {/* --- Logotip --- */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand text-white shadow-md">
            <Activity size={26} strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-title-1 text-label">{t('app.name')}</h1>
          <p className="mt-1 text-subhead text-label-secondary">{t('auth.subtitle')}</p>
        </div>

        {/* --- Forma --- */}
        <form onSubmit={submit} className="card squircle space-y-4 p-6">
          <TextInput
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            placeholder="owner@shifomed.uz"
            icon={<Mail size={16} />}
            value={email}
            error={emailError}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextInput
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock size={16} />}
            value={password}
            error={passwordError}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? (
            <p className="rounded-[10px] bg-bad-soft px-3 py-2 text-footnote text-bad">
              {t('auth.invalid')}
            </p>
          ) : null}

          <Button type="submit" block size="lg" loading={loading}>
            {t('auth.submit')}
          </Button>
        </form>

        {/*
          --- Demo hisoblar ---

          FAQAT demo rejimda. Haqiqiy backend ulanganda bu hisoblar
          mavjud emas: tugma bosilsa kirish rad etiladi, va sahifa
          o'z-o'zidan hammaga ko'rinadigan parolni yozib turadi.
        */}
        {USE_MOCK && (
        <div className="mt-6">
          <p className="text-center text-caption font-medium text-label-tertiary">
            {t('auth.demoTitle')}
          </p>
          <p className="mt-0.5 text-center text-caption-2 text-label-tertiary">
            {t('auth.demoHint')}
          </p>

          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={loading}
                onClick={() => signInAsDemo(account.email)}
                className={cn(
                  'card squircle card-interactive flex items-center justify-between gap-3 px-4 py-3 text-left',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-subhead font-medium text-label">
                    {t(`role.${account.role}`)}
                  </span>
                  <span className="block truncate text-caption text-label-tertiary">
                    {account.email}
                  </span>
                </span>
                <span className="shrink-0 text-caption font-medium text-accent">
                  {t('auth.submit')}
                </span>
              </button>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
