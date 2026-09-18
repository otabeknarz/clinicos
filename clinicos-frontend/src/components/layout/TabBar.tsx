import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

import { NavDot } from './NavBadge'
import { cn } from '@/lib/cn'

export interface TabBarItem {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
  /** Yangilik soni — ikonka ustida nuqta bo'lib ko'rinadi */
  badge?: number
}

/**
 * TELEFONDAGI PASTKI MENYU — klinika, apteka va bemor kabineti uchun bitta.
 *
 * Suzuvchi shisha panel: chetlardan uzilgan, orqasidagi sahifa xira
 * ko'rinib turadi. Har bir bandda ikonka va OSTIDA nom — hamma bandning
 * nomi doim ko'rinadi, odam qaysi tugma nima ekanini taxmin qilmaydi.
 * Faol band yorqinroq va ostida kichik nuqta turadi (iOS'dagi kabi).
 *
 * Uchala joyda bitta komponent: bir mahsulotning qismlari bir xil his
 * qoldirishi kerak, uch nusxa esa vaqt o'tib bir-biridan uzoqlashardi.
 */
export function TabBar({ items, className }: { items: TabBarItem[]; className?: string }) {
  if (items.length === 0) return null

  return (
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30',
        'px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2',
        className,
      )}
    >
      <ul
        className={cn(
          'tab-bar pointer-events-auto mx-auto flex max-w-lg items-stretch justify-between',
          'rounded-[26px] px-1.5 py-1.5',
        )}
      >
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-[3px] rounded-[20px] px-1 pb-2 pt-2',
                  'transition-colors duration-200 ease-apple',
                  isActive ? 'tab-bar-active' : 'tab-bar-idle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <item.icon size={21} strokeWidth={isActive ? 2.1 : 1.8} />
                    <NavDot count={item.badge} />
                  </span>
                  {/*
                    Nom BIR QATORDA va kesiladi: besh band yonma-yon — uzun
                    nom ikki qatorga tushsa panel balandligi sakrab turardi.
                  */}
                  <span className="max-w-full truncate text-[10.5px] font-medium leading-none">
                    {item.label}
                  </span>
                  {/* Faol band belgisi */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-current',
                      'transition-opacity duration-200',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
