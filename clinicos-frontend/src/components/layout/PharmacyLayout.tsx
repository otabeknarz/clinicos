import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  FileText,
  Lock,
  LogOut,
  Pill,
  ShieldCheck,
  Store,
  TruckIcon,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import type { Permission } from '@/types/models'
import { useAuth } from '@/store/auth-context'

/**
 * APTEKA KARKASI.
 *
 * Klinika karkasidan (`AppLayout`) BUTUNLAY alohida va bu ataylab:
 * apteka boshqa biznes. Bemorlar, qabullar, tashxislar va klinika
 * moliyasi bu yerda umuman yo'q — na menyuda, na marshrutlarda.
 *
 * Chegara TUZILISHDA: farmatsevt kirganda klinika marshrutlari
 * ro'yxatga OLINMAYDI ham. Ruxsat qo'riqchisiga tayanilsa, bitta
 * unutilgan joy butun bemorlar bazasini ochib qo'yardi. Bemor
 * kabineti ham xuddi shu tarzda ajratilgan.
 */

/**
 * Menyu ROLGA qarab yig'iladi.
 *
 * Sotuvchida analitika va kassa nazorati BO'LMAYDI: ular uning
 * o'z ishining tekshiruvi. Rahbarda esa kassa yo'q — u sotmaydi.
 */
interface PharmacyNavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  permission: Permission
  end?: boolean
}

const NAV: PharmacyNavItem[] = [
  {
    to: '/pharmacy',
    labelKey: 'nav.pharmacy',
    icon: Store,
    permission: 'pharmacy.sell',
    end: true,
  },
  {
    to: '/pharmacy/medicines',
    labelKey: 'nav.pharmacyMedicines',
    icon: Pill,
    permission: 'pharmacy.view',
  },
  {
    to: '/pharmacy/stock',
    labelKey: 'nav.pharmacyStock',
    icon: Boxes,
    permission: 'pharmacy.view',
  },
  {
    to: '/pharmacy/prescriptions',
    labelKey: 'nav.pharmacyPrescriptions',
    icon: FileText,
    permission: 'pharmacy.view',
  },
  {
    to: '/pharmacy/shift',
    labelKey: 'nav.pharmacyShift',
    icon: Lock,
    permission: 'pharmacy.shift',
  },
  {
    to: '/pharmacy/purchases',
    labelKey: 'nav.pharmacyPurchases',
    icon: TruckIcon,
    /*
      `pharmacy.manage` EMAS: tovarni qabul qilish bilan narx
      belgilash bir xil ish emas. Rahbar buni sotuvchiga alohida
      biriktiradi.
    */
    permission: 'pharmacy.receive',
  },
  {
    to: '/pharmacy/staff',
    labelKey: 'nav.pharmacyStaff',
    icon: Users,
    permission: 'pharmacy.manage',
  },
  {
    to: '/pharmacy/analytics',
    labelKey: 'nav.pharmacyAnalytics',
    icon: BarChart3,
    permission: 'pharmacy.analytics',
  },
  {
    to: '/pharmacy/cash-control',
    labelKey: 'nav.pharmacyCashControl',
    icon: ShieldCheck,
    permission: 'pharmacy.cashcontrol',
  },
]

export function PharmacyLayout() {
  const { t } = useI18n()
  const { session, logout, can } = useAuth()

  const items = NAV.filter((item) => can(item.permission))

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* --- Yon menyu (kompyuter) --- */}
      <aside className="hidden w-60 shrink-0 flex-col bg-raised md:flex">
        <Brand />

        <nav className="min-h-0 flex-1 px-3">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[10px] px-3 py-2',
                      'text-subhead font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-label-secondary hover:bg-fill-4 hover:text-label',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={18}
                        strokeWidth={isActive ? 2.25 : 1.9}
                        className="shrink-0"
                      />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hairline-t shrink-0 p-3">
          <div className="flex items-center gap-2.5 rounded-[12px] px-2 py-2">
            <Avatar
              name={session?.user.fullName ?? ''}
              src={session?.user.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-footnote font-medium text-label">
                {session?.user.fullName}
              </p>
              <p className="truncate text-caption text-label-tertiary">
                {t(`role.${session?.user.role ?? 'pharmacist'}`)}
              </p>
            </div>
            <IconButton label={t('action.logout')} onClick={logout} className="h-8 w-8">
              <LogOut size={16} />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* --- Asosiy qism --- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Telefonda yuqori panel — yon menyu o'rniga */}
        <header className="material sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 md:hidden">
          <Brand compact />
          <IconButton
            label={t('action.logout')}
            onClick={logout}
            className="ml-auto h-9 w-9"
          >
            <LogOut size={17} />
          </IconButton>
        </header>

        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6">
          <ErrorBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* --- Pastki panel (telefon) --- */}
        <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
          <ul
            className={cn(
              'material-thick mx-auto flex max-w-md items-center justify-between gap-1',
              'rounded-full p-1.5',
              'shadow-[0_6px_24px_-6px_rgb(16_31_56_/_0.22)]',
              'ring-[0.5px] ring-separator',
            )}
          >
            {items.map((item) => (
              <li key={item.to} className="min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-label={t(item.labelKey)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center justify-center gap-1.5 rounded-full px-2',
                      'transition-colors duration-200 ease-apple',
                      isActive ? 'bg-navy text-white' : 'text-label-secondary',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                      {/*
                        Yozuv faqat faol bandda: to'rtta nom yonma-yon
                        turganda har biri o'qib bo'lmas darajada
                        kichrayib ketardi.
                      */}
                      {isActive ? (
                        <span className="truncate text-footnote font-semibold">
                          {t(item.labelKey)}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

function Brand({ compact }: { compact?: boolean }) {
  const { t } = useI18n()

  return (
    <div className={cn('flex shrink-0 items-center gap-2.5', !compact && 'h-16 px-5')}>
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-good text-white">
        <Store size={17} strokeWidth={2.4} />
      </span>
      <span className="text-headline font-semibold tracking-tight text-label">
        {t('pharmacy.title')}
      </span>
    </div>
  )
}
