import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, House, LogOut, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { IconButton } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { usePatient } from '@/store/patient-context'

/**
 * BEMOR KABINETI KARKASI.
 *
 * Xodimlar karkasidan (`AppLayout`) alohida va ataylab soddaroq:
 * yon menyu yo'q, qidiruv yo'q, bildirishnoma yo'q. Bemorda uch
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
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30',
        'px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2',
        'bg-gradient-to-t from-canvas via-canvas/90 to-transparent',
      )}
    >
      <ul
        className={cn(
          'material-thick mx-auto flex max-w-xs items-center justify-between gap-1',
          'rounded-full p-1.5',
          'shadow-[0_6px_24px_-6px_rgb(16_31_56_/_0.22)]',
          'ring-[0.5px] ring-separator',
        )}
      >
        <Item to="/cabinet" end icon={House} label={t('cabinet.home')} />
        <Item to="/cabinet/visits" icon={ClipboardList} label={t('cabinet.visits')} />
        <Item to="/cabinet/debt" icon={Wallet} label={t('cabinet.debt')} />
      </ul>
    </nav>
  )
}

function Item({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
}) {
  return (
    <li className="min-w-0">
      <NavLink
        to={to}
        end={end}
        aria-label={label}
        className={({ isActive }) =>
          cn(
            'flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3',
            'transition-[background-color,color,padding] duration-200 ease-apple',
            isActive
              ? 'bg-navy px-4 text-white'
              : 'text-label-tertiary hover:text-label-secondary',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.9} className="shrink-0" />
            {isActive ? (
              <span className="truncate text-footnote font-semibold">{label}</span>
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  )
}
