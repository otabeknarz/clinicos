import { LogOut } from 'lucide-react'

import { BrandMark, BrandWordmark } from './BrandLogo'
import { NAVIGATION } from './navigation'
import { SideNav } from './SideNav'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * Yon menyu — klinika va platforma bo'limlari.
 *
 * Desktopda doim ko'rinadi (to'liq yoki ikonkagacha yig'ilgan),
 * planshetda ochiladi/yopiladi, telefonda umuman ko'rinmaydi — u
 * yerda pastki panel ishlaydi. Ko'rinishi `SideNav` da, bu yerda
 * faqat QAYSI bandlar chiqishi hal qilinadi.
 */
export function Sidebar({
  onNavigate,
  badges,
  collapsed,
  onToggleCollapsed,
}: {
  onNavigate?: () => void
  /** Bo'lim yonida ko'rinadigan yangilik sonlari */
  badges?: Record<string, number>
  collapsed?: boolean
  /** Berilmasa, yig'ish tugmasi chiqmaydi */
  onToggleCollapsed?: () => void
}) {
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
    key: group.labelKey,
    label: t(group.labelKey),
    items: group.items
      .filter((item) => {
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
      })
      .map((item) => ({
        to: item.to,
        end: item.end,
        label: t(item.labelKey),
        icon: item.icon,
        badge: item.badge ? badges?.[item.badge] : undefined,
      })),
  })).filter((group) => group.items.length > 0)

  return (
    <SideNav
      brand={{ mark: <BrandMark />, name: <BrandWordmark /> }}
      groups={groups}
      user={{
        name: session.user.fullName,
        role: t(`role.${session.user.role}`),
        avatarUrl: session.user.avatarUrl,
      }}
      actions={[{ label: t('action.logout'), icon: LogOut, onClick: logout }]}
      collapsed={collapsed}
      motion
      onToggle={onToggleCollapsed}
      onNavigate={onNavigate}
    />
  )
}
