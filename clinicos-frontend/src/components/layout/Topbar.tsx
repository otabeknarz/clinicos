import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  Check,
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  SunMoon,
} from 'lucide-react'

import { GlobalSearch } from './GlobalSearch'
import { PlatformSearch } from './PlatformSearch'
import { listNotifications } from '@/api/notifications'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { MenuDivider, MenuItem, MenuLabel, Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { LANGS, useI18n } from '@/i18n'
import type { Lang } from '@/i18n'
import { useAuth } from '@/store/auth-context'
import { useTheme } from '@/store/theme-context'
import type { ThemeMode } from '@/store/theme-context'

/**
 * Yuqori panel.
 *
 * Apple uslubi: shaffof material fon — sahifa skroll qilinganda kontent
 * ostidan xira ko'rinib turadi.
 */
export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { t } = useI18n()

  // Platforma bo'limlarida boshqa qidiruv ishlaydi
  const isPlatform = useLocation().pathname.startsWith('/platform')

  return (
    <header className="material sticky top-0 z-30 h-16 shrink-0">
      <div className="hairline flex h-full items-center gap-3 px-4 sm:px-6">
        {/*
          Menyu tugmasi — faqat PLANSHETDA.

          Telefonda pastki menyu va uning "Yana" varag'i bor, sidebar
          ortiqcha. Kompyuterda yon menyu doim ochiq turadi. Oraliq
          kenglik (768–1023px) esa ikkalasidan ham mahrum — shu yerda
          kerak.
        */}
        <span className="hidden md:inline-flex lg:hidden">
          <IconButton label="menu" onClick={onOpenSidebar}>
            <Menu size={20} />
          </IconButton>
        </span>

        {/*
          Qidiruv — desktopda kengroq.

          Platforma panelida boshqa qidiruv ishlaydi: u klinikalar,
          shifokorlar va bemorlar bo'yicha turkumlab qidiradi.
        */}
        {isPlatform ? (
          <PlatformSearch className="hidden max-w-md flex-1 sm:block" />
        ) : (
          <GlobalSearch className="hidden max-w-md flex-1 sm:block" />
        )}

        {/* Telefonda faqat ikonka */}
        <div className="flex-1 sm:hidden" />

        <div className="flex shrink-0 items-center gap-1">
          <MobileSearchButton />
          <NotificationsMenu />
          {/*
            Mavzu va til telefonda yuqoridan olib tashlandi.

            Bular kunda bir marta ham bosilmaydigan sozlamalar, lekin
            tor ekranda joyni egallab, kerakli tugmalarni siqib
            qo'yardi. Ikkalasi ham Sozlamalar > Ko'rinish bo'limida.
          */}
          <span className="hidden items-center gap-1 sm:flex">
            <ThemeMenu />
            <LanguageMenu />
          </span>
          <UserMenu />
        </div>
      </div>
      <span className="sr-only">{t('app.name')}</span>
    </header>
  )
}

/* ------------------------------------------------------------------ */

function MobileSearchButton() {
  const isPlatform = useLocation().pathname.startsWith('/platform')

  return (
    <Popover
      width="w-[min(92vw,26rem)]"
      trigger={({ toggle }) => (
        <IconButton label="search" onClick={toggle} className="sm:hidden">
          <Search size={18} />
        </IconButton>
      )}
    >
      {() => (
        <div className="p-1">
          {isPlatform ? <PlatformSearch /> : <GlobalSearch />}
        </div>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */

function NotificationsMenu() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data } = useAsync(() => listNotifications(), [])

  const items = data ?? []
  const total = items.reduce((sum, item) => sum + item.count, 0)

  const DOT: Record<string, string> = {
    info: 'bg-accent',
    warn: 'bg-warn',
    bad: 'bg-bad',
  }

  return (
    <Popover
      width="w-80"
      trigger={({ toggle, open }) => (
        <IconButton label={t('notif.title')} onClick={toggle} active={open} className="relative">
          <Bell size={18} />
          {total > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-bad ring-2 ring-[var(--surface-raised)]" />
          ) : null}
        </IconButton>
      )}
    >
      {({ close }) => (
        <>
          <MenuLabel>{t('notif.title')}</MenuLabel>
          {items.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-footnote text-label-tertiary">
              {t('notif.empty')}
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(item.href)
                      close()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-fill-4"
                  >
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', DOT[item.severity])}
                    />
                    <span className="text-subhead text-label">
                      {t(`notif.${item.kind}`, { count: item.count })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */

function ThemeMenu() {
  const { t } = useI18n()
  const { mode, setMode } = useTheme()

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('settings.theme.light'), icon: Sun },
    { value: 'dark', label: t('settings.theme.dark'), icon: Moon },
    { value: 'system', label: t('settings.theme.system'), icon: SunMoon },
  ]

  const Current = options.find((o) => o.value === mode)?.icon ?? Sun

  return (
    <Popover
      width="w-44"
      trigger={({ toggle, open }) => (
        <IconButton label={t('settings.appearance')} onClick={toggle} active={open}>
          <Current size={18} />
        </IconButton>
      )}
    >
      {({ close }) => (
        <>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              icon={<option.icon size={16} />}
              active={mode === option.value}
              onClick={() => {
                setMode(option.value)
                close()
              }}
              meta={mode === option.value ? <Check size={14} /> : undefined}
            >
              {option.label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */

function LanguageMenu() {
  const { t, lang, setLang } = useI18n()

  return (
    <Popover
      width="w-44"
      trigger={({ toggle, open }) => (
        <IconButton label={t('settings.language')} onClick={toggle} active={open}>
          <Globe size={18} />
        </IconButton>
      )}
    >
      {({ close }) => (
        <>
          {LANGS.map((option) => (
            <MenuItem
              key={option.code}
              active={lang === option.code}
              onClick={() => {
                setLang(option.code as Lang)
                close()
              }}
              meta={lang === option.code ? <Check size={14} /> : option.short}
            >
              {option.label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  )
}

/* ------------------------------------------------------------------ */

function UserMenu() {
  const { t } = useI18n()
  const { session, logout, can } = useAuth()
  const navigate = useNavigate()

  if (!session) return null

  return (
    <Popover
      width="w-60"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="ml-1 rounded-full transition-opacity hover:opacity-80"
          aria-label={session.user.fullName}
        >
          <Avatar name={session.user.fullName} src={session.user.avatarUrl} size="sm" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar name={session.user.fullName} src={session.user.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-footnote font-medium text-label">
                {session.user.fullName}
              </p>
              <p className="truncate text-caption text-label-tertiary">
                {t(`role.${session.user.role}`)}
              </p>
            </div>
          </div>

          <MenuDivider />

          {can('settings.view') ? (
            <MenuItem
              icon={<Settings size={16} />}
              onClick={() => {
                navigate('/settings')
                close()
              }}
            >
              {t('nav.settings')}
            </MenuItem>
          ) : null}

          <MenuItem icon={<LogOut size={16} />} danger onClick={logout}>
            {t('action.logout')}
          </MenuItem>
        </>
      )}
    </Popover>
  )
}
