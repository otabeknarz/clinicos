import { useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  Pill,
  ShieldCheck,
  Store,
  TruckIcon,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { BrandMark, BrandWordmark } from './BrandLogo'
import { SideNav } from './SideNav'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { changePassword } from '@/api/auth'
import { Button, IconButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useSidebarCollapsed } from '@/lib/useSidebarCollapsed'
import { useCardSpotlight } from '@/lib/useCardSpotlight'
import { useEntranceMotion } from '@/lib/useEntranceMotion'
import { useSoftUi } from '@/lib/useSoftUi'
import { useI18n } from '@/i18n'
import type { Permission } from '@/types/models'
import { useAuth } from '@/store/auth-context'
import { useToast } from '@/store/toast-context'

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
    to: '/pharmacy/data-exchange',
    labelKey: 'exchange.title',
    icon: FileSpreadsheet,
    permission: 'data.export',
  },
  {
    to: '/pharmacy/cash-control',
    labelKey: 'nav.pharmacyCashControl',
    icon: ShieldCheck,
    permission: 'pharmacy.cashcontrol',
  },
]

/*
  Menyu ikki guruhda: kundalik savdo va boshqaruv. Rahbarda to'qqizta
  band bor — guruhsiz ular bitta ustunda qorishib ketardi. Sotuvchida
  boshqaruv guruhi odatda bo'sh bo'ladi va sarlavhasi ham chiqmaydi.
*/
const MANAGE_PATHS = new Set([
  '/pharmacy/purchases',
  '/pharmacy/staff',
  '/pharmacy/analytics',
  '/pharmacy/cash-control',
  '/pharmacy/data-exchange',
])

export function PharmacyLayout() {
  const { t } = useI18n()
  const { session, logout, can } = useAuth()
  const [changingPassword, setChangingPassword] = useState(false)
  const { collapsed, toggle } = useSidebarCollapsed()

  // Klinika karkasi bilan bir xil ko'rinish va harakat (`AppLayout`)
  const location = useLocation()
  const entering = useEntranceMotion(location.pathname, 1900)
  useSoftUi()
  const rootRef = useRef<HTMLDivElement>(null)
  useCardSpotlight(rootRef, true)

  const items = NAV.filter((item) => can(item.permission))

  const groups = [
    { key: 'sales', label: t('pharmacy.navGroup.sales'), manage: false },
    { key: 'manage', label: t('pharmacy.navGroup.manage'), manage: true },
  ]
    .map((group) => ({
      key: group.key,
      label: group.label,
      items: items
        .filter((item) => MANAGE_PATHS.has(item.to) === group.manage)
        .map((item) => ({
          to: item.to,
          end: item.end,
          label: t(item.labelKey),
          icon: item.icon,
        })),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div ref={rootRef} className="flex min-h-dvh">
      {/* --- Yon menyu (kompyuter) --- */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-separator/40 md:block',
          'transition-[width] duration-300 ease-apple motion-reduce:transition-none',
          collapsed ? 'w-[76px]' : 'w-60',
        )}
      >
        <div className="sticky top-0 z-40 h-dvh">
          <SideNav
            brand={{ mark: <BrandMark />, name: <BrandWordmark /> }}
            groups={groups}
            user={{
              name: session?.user.fullName ?? '',
              role: t(`role.${session?.user.role ?? 'pharmacist'}`),
              avatarUrl: session?.user.avatarUrl,
            }}
            actions={[
              {
                label: t('password.change'),
                icon: KeyRound,
                onClick: () => setChangingPassword(true),
              },
              { label: t('action.logout'), icon: LogOut, onClick: logout },
            ]}
            collapsed={collapsed}
            motion
            onToggle={toggle}
          />
        </div>
      </aside>

      {/* --- Asosiy qism --- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Telefonda yuqori panel — yon menyu o'rniga */}
        <header className="material sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 md:hidden">
          <Brand />
          <IconButton
            label={t('password.change')}
            onClick={() => setChangingPassword(true)}
            className="ml-auto h-9 w-9"
          >
            <KeyRound size={17} />
          </IconButton>
          <IconButton label={t('action.logout')} onClick={logout} className="h-9 w-9">
            <LogOut size={17} />
          </IconButton>
        </header>

        {/* Yuqori panel yo'q — katta panel tepadan ham chekinadi (`admin-panel--top`) */}
        <main
          className={cn(
            'min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6',
            'platform-surface admin-panel admin-panel--top',
            entering && 'platform-motion',
          )}
        >
          {/*
            VAQTINCHALIK PAROL. Rahbar yoki platforma bergan parol bilan
            kirilgan — u boshqa odamga ma'lum. Almashtirilmasa, o'sha odam
            sotuvchi nomidan sota olardi va kassa farqi unga yozilardi.
          */}
          {session?.user.mustChangePassword ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-warn-soft px-4 py-3">
              <p className="text-footnote text-warn">{t('pharmacy.tempPassword')}</p>
              <Button size="sm" onClick={() => setChangingPassword(true)}>
                {t('password.change')}
              </Button>
            </div>
          ) : null}
          <ErrorBoundary fallback={(retry) => <ErrorState onRetry={retry} />}>
            <Outlet />
          </ErrorBoundary>
        </main>

        <ChangePasswordModal
          open={changingPassword}
          onClose={() => setChangingPassword(false)}
        />

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

/** Telefondagi yuqori panel logotipi — asl ClinicOS belgisi */
function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <BrandMark />
      <span className="text-headline font-bold text-label">
        <BrandWordmark />
      </span>
    </div>
  )
}

/**
 * Parolni almashtirish — apteka xodimida "Sozlamalar" sahifasi yo'q,
 * shuning uchun shu yerda. Joriy parol so'raladi: ochiq qolgan sessiya
 * yonidan o'tgan odam parolni almashtirib hisobni egallab ololmasin.
 */
function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const { applySession } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = current.length > 0 && next.length >= 8 && repeat === next && next !== current

  function close() {
    setCurrent('')
    setNext('')
    setRepeat('')
    onClose()
  }

  async function submit() {
    if (!valid) {
      if (next === current && next.length >= 8) toast.error(t('password.same'))
      return
    }
    setSaving(true)
    try {
      /* Server yangi sessiya qaytaradi — eski token endi yaroqsiz */
      applySession(await changePassword(current, next))
      toast.success(t('password.changed'))
      close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={t('password.change')}
      footer={
        <>
          <Button variant="gray" onClick={close}>
            {t('action.cancel')}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={() => void submit()}>
            {t('password.change')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <TextInput
          label={t('password.current')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextInput
          label={t('password.new')}
          hint={t('password.hint')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <TextInput
          label={t('password.repeat')}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
    </Modal>
  )
}
