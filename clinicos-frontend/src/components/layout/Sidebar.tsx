import { NavLink } from 'react-router-dom'
import { Activity, LogOut } from 'lucide-react'

import { NAVIGATION } from './navigation'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * Yon menyu.
 *
 * Desktopda doim ko'rinadi, planshetda ochiladi/yopiladi (`open` prop),
 * telefonda umuman ko'rinmaydi — u yerda pastki panel ishlaydi.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()
  const { session, can, logout, impersonating } = useAuth()

  if (!session) return null

  /*
    Klinika paneliga kirilganda menyu ALMASHADI: platforma bo'limlari
    o'rniga o'sha klinikaning bo'limlari chiqadi. Aks holda yordam
    berayotgan odam klinika ichida nima borligini ko'ra olmaydi.

    Ruxsat tekshiruvi platforma bo'limlarida saqlanadi — ular
    baribir `platform.*` talab qiladi va kirilgan holatda yashiriladi.
  */
  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const isPlatform = item.permission.startsWith('platform.')

      if (impersonating) {
        // Kirilgan holatda: platforma bandlari yopiladi,
        // klinika bandlari egasi darajasida ochiladi
        if (isPlatform) return false
        return !item.roles || item.roles.includes('owner')
      }

      if (isPlatform) return can(item.permission)

      return (
        can(item.permission) &&
        // Ba'zi bandlar faqat ma'lum rolda ma'noga ega
        (!item.roles || item.roles.includes(session.user.role))
      )
    }),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-raised">
      {/* --- Logotip --- */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand text-white">
          <Activity size={17} strokeWidth={2.5} />
        </span>
        <span className="text-headline font-semibold tracking-tight text-label">
          {t('app.name')}
        </span>
      </div>

      {/* --- Navigatsiya --- */}
      <nav className="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.labelKey} className="mb-5 last:mb-0">
            <p className="px-3 pb-1.5 text-caption-2 font-semibold tracking-wider text-label-tertiary">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
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
          </div>
        ))}
      </nav>

      {/* --- Foydalanuvchi --- */}
      <div className="hairline-t shrink-0 p-3">
        <div className="flex items-center gap-2.5 rounded-[12px] px-2 py-2">
          <Avatar name={session.user.fullName} src={session.user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-footnote font-medium text-label">
              {session.user.fullName}
            </p>
            <p className="truncate text-caption text-label-tertiary">
              {t(`role.${session.user.role}`)}
            </p>
          </div>
          <IconButton label={t('action.logout')} onClick={logout} className="h-8 w-8">
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
