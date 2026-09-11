import { useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, MouseEvent, ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { NavBadge, NavDot } from './NavBadge'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'

/**
 * YON MENYU KO'RINISHI — klinika, platforma va apteka uchun BITTA.
 *
 * Ilgari har bir karkas o'z menyusini chizardi va ular asta-sekin
 * bir-biridan uzoqlashib borardi: apteka menyusida guruh sarlavhasi
 * ham, yangilik soni ham yo'q edi. Endi QAYSI bandlar chiqishini
 * karkas hal qiladi, QANDAY ko'rinishini — shu komponent.
 *
 * Ikki holat: to'liq (ikonka + nom) va yig'ilgan (faqat ikonka).
 * Yig'ilganda nom yo'qolmaydi — sichqoncha olib borilsa yonida
 * chiqadi, ekran o'quvchisi uchun esa `aria-label` bo'lib turadi.
 *
 * O'LCHAMLAR BIR-BIRIGA BOG'LIQ: yig'ilgan kenglik 76px, menyu
 * ichki chegarasi 12px, band ichki chegarasi 16px — shunda ikonka
 * ikkala holatda ham AYNAN bir joyda turadi va kenglik o'zgarayotganda
 * sakramaydi. Logotip ham shu hisobda (22px).
 */

export interface SideNavLink {
  to: string
  end?: boolean
  label: string
  icon: LucideIcon
  /** Yangilik soni — to'liq holatda son, yig'ilganda nuqta */
  badge?: number
}

export interface SideNavGroup {
  key: string
  label: string
  items: SideNavLink[]
}

export interface SideNavAction {
  label: string
  icon: LucideIcon
  onClick: () => void
}

interface Tip {
  label: string
  top: number
  left: number
}

/* Prujinali egri chiziq — tabletka joyiga biroz o'tib, qaytib o'tiradi */
const SPRING = 'ease-[cubic-bezier(0.34,1.25,0.64,1)]'

export function SideNav({
  brand,
  groups,
  user,
  actions,
  collapsed = false,
  motion = false,
  onToggle,
  onNavigate,
}: {
  /** Belgi (32×32) va yozuv — asl logotip `BrandLogo.tsx` da */
  brand: { mark: ReactNode; name: ReactNode }
  groups: SideNavGroup[]
  user: { name: string; role: string; avatarUrl?: string | null }
  /** Foydalanuvchi qatoridagi tugmalar (chiqish, parol) */
  actions: SideNavAction[]
  collapsed?: boolean
  /**
   * Harakatli rejim (hozircha faqat admin panel): faol band ostidagi
   * tabletka bir bo'limdan ikkinchisiga SIRPANIB o'tadi, ikonkalar
   * ustiga borilganda jonlanadi, yig'ish strelkasi aylanadi.
   */
  motion?: boolean
  /** Berilmasa, yig'ish tugmasi chiqmaydi (planshetdagi ochiladigan panel) */
  onToggle?: () => void
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const { pathname } = useLocation()

  /*
    NOM YORLIG'I `fixed` — `absolute` emas. Menyu ro'yxati o'z ichida
    skroll qiladi (`overflow-y-auto`) va undan tashqariga chiqqan
    har qanday narsani kesib tashlaydi.
  */
  const [tip, setTip] = useState<Tip | null>(null)

  function showTip(label: string) {
    return (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
      if (!collapsed) return
      const rect = e.currentTarget.getBoundingClientRect()
      /* Band menyu chetidan 12px ichkarida tugaydi — yorliq chetdan yana 10px narida */
      setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 22 })
    }
  }

  const hideTip = () => setTip(null)

  /*
    SIRPANADIGAN TABLETKA.

    Har bir band o'z fonini chizmaydi — bitta tabletka faol band
    ostiga ko'chadi. Joyi DOM dan o'lchanadi (holatda saqlanmaydi,
    ya'ni qayta chizish yo'q): yo'l o'zgarganda, menyu yig'ilganda
    va kenglik o'zgarayotgan paytda (ResizeObserver) — yig'ish
    animatsiyasi davomida tabletka band bilan birga torayadi.

    Birinchi joylashuv o'tishsiz: aks holda sahifa ochilganda
    tabletka burchakdan uchib kelardi.
  */
  const navRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const placedRef = useRef(false)
  const layoutKey = groups.map((group) => group.items.map((item) => item.to).join(',')).join('|')

  useLayoutEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!motion || !nav || !pill) return

    const place = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        pill.style.opacity = '0'
        return
      }

      const navRect = nav.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      const first = !placedRef.current
      if (first) pill.style.transition = 'none'

      pill.style.width = `${rect.width}px`
      pill.style.height = `${rect.height}px`
      pill.style.transform = `translate3d(${rect.left - navRect.left + nav.scrollLeft}px, ${
        rect.top - navRect.top + nav.scrollTop
      }px, 0)`
      pill.style.opacity = '1'

      if (first) {
        // Brauzer joyni qabul qilsin, keyin o'tish qaytariladi
        void pill.offsetWidth
        pill.style.transition = ''
        placedRef.current = true
      }
    }

    place()
    const observer = new ResizeObserver(place)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [motion, pathname, collapsed, layoutKey])

  return (
    <div className="relative h-full">
      <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(90deg,var(--sidenav-from)_40%,var(--sidenav-to))]">
        {/* --- Logotip --- */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-[22px]">
          {brand.mark}
          <span
            className={cn(
              'min-w-0 truncate whitespace-nowrap text-[19px] font-bold tracking-tight text-label',
              'transition-opacity duration-200',
              collapsed && 'opacity-0',
            )}
          >
            {brand.name}
          </span>
        </div>

        {/* --- Bo'limlar --- */}
        <nav
          ref={navRef}
          className="scroll-slim relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1"
          onScroll={hideTip}
        >
          {motion ? (
            <span
              ref={pillRef}
              aria-hidden
              className={cn(
                'pointer-events-none absolute left-0 top-0 rounded-[11px] opacity-0',
                'bg-[var(--sidenav-pill)] shadow-[var(--sidenav-pill-shadow)]',
                'transition-[transform,width,height,opacity] duration-500',
                SPRING,
              )}
            />
          ) : null}

          {groups.map((group) => (
            <div key={group.key} className="mb-4 last:mb-0">
              {/*
                Guruh sarlavhasi va yonida ingichka chiziq. Yig'ilganda
                so'z sig'maydi — faqat chiziq qoladi, guruhlar baribir
                bir-biridan ajralib turadi.
              */}
              <div className="flex h-7 items-center gap-2 px-4">
                {collapsed ? (
                  <span className="mx-auto h-px w-5 bg-separator" />
                ) : (
                  <>
                    <span className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.09em] text-label-tertiary">
                      {group.label}
                    </span>
                    <span className="h-px flex-1 bg-separator/50" />
                  </>
                )}
              </div>

              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      aria-label={collapsed ? item.label : undefined}
                      onMouseEnter={showTip(item.label)}
                      onMouseLeave={hideTip}
                      onFocus={showTip(item.label)}
                      onBlur={hideTip}
                      className={({ isActive }) =>
                        cn(
                          // `z-[1]` — sirpanadigan tabletka band matni OSTIDA qolsin
                          'group relative z-[1] flex h-10 items-center gap-3 rounded-[11px] px-4',
                          'text-subhead transition-[background-color,color,box-shadow] duration-200 ease-apple',
                          isActive
                            ? cn(
                                'font-semibold text-accent',
                                !motion &&
                                  'bg-[var(--sidenav-pill)] shadow-[var(--sidenav-pill-shadow)]',
                              )
                            : 'font-medium text-label/80 hover:bg-fill-4 hover:text-label',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative flex shrink-0">
                            <item.icon
                              size={19}
                              strokeWidth={isActive ? 2.1 : 1.6}
                              className={cn(
                                motion
                                  ? cn(
                                      'transition-[color,translate] duration-300 group-hover:translate-x-[2px]',
                                      SPRING,
                                    )
                                  : 'transition-colors duration-200',
                                isActive
                                  ? 'text-accent'
                                  : 'text-label-secondary group-hover:text-label',
                              )}
                            />
                            {collapsed ? <NavDot count={item.badge} /> : null}
                          </span>
                          <span
                            className={cn(
                              'min-w-0 truncate whitespace-nowrap transition-opacity duration-200',
                              collapsed && 'opacity-0',
                            )}
                          >
                            {item.label}
                          </span>
                          {collapsed ? null : <NavBadge count={item.badge} />}
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
        <div className="shrink-0 px-3 pb-3 pt-1">
          <div className="mx-1 mb-2 h-px bg-separator/50" />
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              {actions.map((action) => (
                <IconButton
                  key={action.label}
                  label={action.label}
                  onClick={action.onClick}
                  className="h-9 w-9"
                >
                  <action.icon size={17} />
                </IconButton>
              ))}
              <span
                className="mt-1 flex"
                onMouseEnter={showTip(`${user.name} · ${user.role}`)}
                onMouseLeave={hideTip}
              >
                <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-footnote font-semibold text-label">{user.name}</p>
                <p className="truncate text-caption text-label-tertiary">{user.role}</p>
              </div>
              {actions.map((action) => (
                <IconButton
                  key={action.label}
                  label={action.label}
                  onClick={action.onClick}
                  className="h-8 w-8"
                >
                  <action.icon size={16} />
                </IconButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {/*
        YIG'ISH TUGMASI — menyu chetida, logotip ro'parasida.
        Ikkala holatda ham bir joyda turadi: yig'ilgan menyuni
        qayta ochish uchun odam uni qidirib o'tirmaydi.
      */}
      {onToggle ? (
        <button
          type="button"
          onClick={() => {
            hideTip()
            onToggle()
          }}
          aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          aria-expanded={!collapsed}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          className={cn(
            'absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full',
            'bg-raised text-label-secondary shadow-[var(--elev-md)] ring-[0.5px] ring-separator',
            'transition-[color,transform] duration-200 ease-apple hover:scale-110 hover:text-accent',
          )}
        >
          {motion ? (
            <ChevronsLeft
              size={14}
              className={cn('transition-transform duration-500', SPRING, collapsed && 'rotate-180')}
            />
          ) : collapsed ? (
            <ChevronsRight size={14} />
          ) : (
            <ChevronsLeft size={14} />
          )}
        </button>
      ) : null}

      {collapsed && tip ? (
        <span
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className={cn(
            'pointer-events-none fixed z-50 -translate-y-1/2 animate-fade-in whitespace-nowrap',
            'rounded-[8px] bg-label px-2.5 py-1.5 text-footnote font-medium text-raised',
            'shadow-[var(--elev-popover)]',
          )}
        >
          {tip.label}
        </span>
      ) : null}
    </div>
  )
}
