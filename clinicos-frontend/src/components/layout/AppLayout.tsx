import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { MoreHorizontal, X } from 'lucide-react'

import { MOBILE_NAV, NAVIGATION, PLATFORM_MOBILE_NAV } from './navigation'
import { Sidebar } from './Sidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ImpersonationBar } from './ImpersonationBar'
import { Topbar } from './Topbar'
import { IconButton } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useEntranceMotion } from '@/lib/useEntranceMotion'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * Ilova karkasi.
 *
 *  Desktop (≥1024px)  — chapda doimiy yon menyu + kontent
 *  Planshet (768–1023) — yon menyu ochiladigan panel sifatida
 *  Telefon  (<768px)   — yon menyu yopiq, pastda 4 bandli panel
 */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  /*
    Kirish animatsiyasi faqat sahifa ochilganda ishlaydi. Yo'l
    o'zgarsa — qaytadan, filtr o'zgarsa — yo'q.
  */
  const isPlatform = location.pathname.startsWith('/platform')
  const entering = useEntranceMotion(location.pathname)

  // Sahifa almashganda ochiq panelni yopamiz
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Panel ochiq bo'lganda fon skroll qilmasin
  useEffect(() => {
    if (!sidebarOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* --- Doimiy yon menyu (desktop) --- */}
      <aside className="hairline hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar />
        </div>
      </aside>

      {/* --- Ochiladigan yon menyu (planshet/telefon) --- */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="animate-scale-in absolute inset-y-0 left-0 w-72 origin-left shadow-lg">
            <IconButton
              label="close"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-2 top-3.5 z-10"
            >
              <X size={18} />
            </IconButton>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* --- Asosiy qism --- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />

        <ImpersonationBar />

        {/*
          Harakat faqat platforma bo'limlarida.

          Ikki sinf ajratilgan:
            `platform-surface` — doimiy: hover, o'tishlar
            `platform-motion`  — vaqtinchalik: sahifa ochilgandagi
                                  kirish animatsiyasi

          Ikkinchisi bir necha soniyadan keyin o'chadi, aks holda
          qidiruv va filtrda jadval har safar qaytadan chiziladi.
        */}
        <main
          className={cn(
            'wrap min-w-0 flex-1 py-6 pb-24 md:pb-10',
            isPlatform && 'platform-surface',
            isPlatform && entering && 'platform-motion',
          )}
        >
          {/*
            Sahifa qulasa — yon menyu va yuqori panel joyida qoladi,
            odam boshqa bo'limga o'tib ketaveradi.

            `key` ga marshrut berilgan: yo'l o'zgarsa React qatlamni
            qaytadan yaratadi, ya'ni xato o'z-o'zidan tozalanadi.
          */}
          <ErrorBoundary
            key={location.pathname}
            fallback={(retry) => <ErrorState onRetry={retry} />}
          >
            <Outlet />
          </ErrorBoundary>
        </main>

        <MobileNav />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Telefondagi pastki panel                                            */
/* ------------------------------------------------------------------ */

/**
 * Pastki panel — telefonda asosiy navigatsiya.
 *
 * Ekranga 4 ta band sig'adi, qolganlari "Yana" varag'ida. Shifokor yoki
 * klinika egasi telefondan HAR BIR bo'limga yeta olishi kerak — kompyuter
 * oldida o'tirmasdan ishlashi mumkin bo'lsin.
 */
function MobileNav() {
  const { t } = useI18n()
  const { can } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  /*
    Varaq ochiq bo'lganda: Escape yopadi va orqadagi sahifa skroll
    qilmaydi. Ikkinchisi telefonda ayniqsa muhim — varaq ustida
    barmoq surilganda ostidagi uzun ro'yxat siljib ketmasin.
  */
  useEffect(() => {
    if (!moreOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [moreOpen])

  /*
    Platforma egasida klinika bo'limlari ochilmaydi — unga o'z ro'yxati
    beriladi, aks holda pastki panelda bitta band qolar edi.
  */
  const source = can('platform.view') ? PLATFORM_MOBILE_NAV : MOBILE_NAV
  const primary = source.filter((item) => can(item.permission))

  // "Yana" varag'iga tushadigan bandlar — pastki panelda yo'qlari
  const primaryPaths = new Set(primary.map((item) => item.to))
  const overflow = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission) && !primaryPaths.has(item.to)),
  })).filter((group) => group.items.length > 0)

  if (primary.length === 0) return null

  const hasOverflow = overflow.length > 0
  const overflowActive = overflow.some((group) =>
    group.items.some((item) => location.pathname.startsWith(item.to)),
  )

  return (
    <>
      <nav className="material-thick hairline-t fixed inset-x-0 bottom-0 z-30 md:hidden">
        <ul className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {primary.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                    'transition-colors duration-150',
                    isActive ? 'text-accent' : 'text-label-tertiary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/*
                      Faol band ikonka ortidagi yumshoq "tabletka" bilan
                      belgilanadi. Faqat rang bilan belgilash yorug'da
                      va rangni ajratolmaydigan odamda bilinmaydi.
                    */}
                    <span
                      className={cn(
                        'flex h-7 w-12 items-center justify-center rounded-full',
                        'transition-colors duration-200',
                        isActive && 'bg-accent-soft',
                      )}
                    >
                      <item.icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                    </span>
                    <span className="max-w-full truncate text-caption-2 font-medium">
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          {hasOverflow ? (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cn(
                  'flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                  'transition-colors duration-150',
                  overflowActive ? 'text-accent' : 'text-label-tertiary',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full',
                    'transition-colors duration-200',
                    overflowActive && 'bg-accent-soft',
                  )}
                >
                  <MoreHorizontal size={21} strokeWidth={overflowActive ? 2.3 : 1.9} />
                </span>
                <span className="max-w-full truncate text-caption-2 font-medium">
                  {t('action.more')}
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* --- "Yana" varag'i --- */}
      {moreOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('action.more')}
          className="fixed inset-0 z-50 flex items-end md:hidden"
        >
          <div
            className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />

          <div className="animate-rise relative w-full rounded-t-[22px] bg-overlay pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
            {/* Tortish chizig'i — iOS varaqlaridagi kabi */}
            <div className="flex justify-center pb-1 pt-2.5">
              <span className="h-1 w-9 rounded-full bg-fill-2" />
            </div>

            <div className="max-h-[70dvh] overflow-y-auto scroll-slim px-3 pb-3">
              {overflow.map((group) => (
                <div key={group.labelKey} className="mb-3 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-caption-2 font-semibold tracking-wider text-label-tertiary">
                    {t(group.labelKey)}
                  </p>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          onClick={() => setMoreOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex min-h-[48px] items-center gap-3 rounded-[12px] px-3',
                              'text-body font-medium transition-colors duration-150',
                              isActive ? 'bg-accent-soft text-accent' : 'text-label',
                            )
                          }
                        >
                          <item.icon size={20} strokeWidth={1.9} className="shrink-0" />
                          <span className="truncate">{t(item.labelKey)}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
