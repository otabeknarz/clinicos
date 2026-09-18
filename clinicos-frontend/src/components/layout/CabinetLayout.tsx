import { Outlet } from 'react-router-dom'
import { ClipboardList, House, LogOut, Star, Wallet } from 'lucide-react'

import { TabBar } from './TabBar'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { IconButton } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'

/**
 * BEMOR KABINETI KARKASI.
 *
 * Xodimlar karkasidan (`AppLayout`) alohida va ataylab soddaroq:
 * yon menyu yo'q, qidiruv yo'q, bildirishnoma yo'q. Bemorda to'rt
 * ekran bor, ya'ni yo'qolib qoladigan joyning o'zi yo'q.
 *
 * TELEFONGA MO'LJALLANGAN. Bu qism Telegram mini app ichida
 * ochiladi — u yerda ekran har doim tor va kompyuter ko'rinishi
 * degan narsa yo'q. Shuning uchun kenglik cheklanadi: planshetda
 * ham telefondagidek ko'rinadi, cho'zilib ketmaydi.
 */
export function CabinetLayout() {
  const { t } = useI18n()
  const { profile, leave } = usePatient()

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="material sticky top-0 z-30 shrink-0">
        <div className="hairline mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-subhead font-semibold text-label">
              {profile?.fullName ?? ''}
            </p>
            <p className="truncate text-caption text-label-tertiary">
              {profile?.clinicName ?? ''}
            </p>
          </div>

          <IconButton label={t('action.logout')} onClick={leave}>
            <LogOut size={18} />
          </IconButton>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-28">
        <ErrorBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <CabinetNav />
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Pastki panel — xodimlarnikining aynan o'zi ko'rinishida.
 *
 * Bir mahsulotning ikki qismi bir xil his qoldirishi kerak: bemor
 * keyin registratura ekranini ko'rsa (masalan, planshetda), u
 * o'zini boshqa ilovadek tutmasligi kerak.
 */
function CabinetNav() {
  const { t } = useI18n()

  return (
    <TabBar
      items={[
        { to: '/cabinet', end: true, icon: House, label: t('cabinet.home') },
        { to: '/cabinet/visits', icon: ClipboardList, label: t('cabinet.visits') },
        { to: '/cabinet/debt', icon: Wallet, label: t('cabinet.debt') },
        { to: '/cabinet/feedback', icon: Star, label: t('cabinet.feedbackTab') },
      ]}
    />
  )
}
