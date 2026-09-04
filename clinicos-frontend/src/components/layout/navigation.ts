import {
  BarChart3,
  Building2,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Database,
  LayoutDashboard,
  Layers,
  Settings,
  MessageCircle,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { Permission, Role } from '@/types/models'

/**
 * Yon menyu tuzilishi.
 *
 * Har bir band ruxsat talab qiladi — foydalanuvchida u bo'lmasa, band
 * umuman ko'rsatilmaydi. Guruh butunlay bo'sh qolsa, guruh sarlavhasi
 * ham chiqmaydi.
 */

export interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  permission: Permission
  /**
   * Band faqat shu rollarda ko'rinadi.
   *
   * Ruxsat tizimi "nima qila oladi" degan savolga javob beradi, bu esa
   * "kimga kerak" degan savolga. Masalan o'z shifokor profili barcha
   * rollarda ochiladigan ruxsatga bog'langan, lekin u faqat
   * shifokorda ma'noga ega.
   */
  roles?: Role[]
  /** Aniq moslik talab qilinadimi (bosh sahifa uchun) */
  end?: boolean
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const NAVIGATION: NavGroup[] = [
  /*
    PLATFORMA — faqat super adminda.

    Bu guruh klinika bo'limlaridan butunlay ajratilgan: super admin
    klinika ichidagi hech narsani ko'rmaydi, klinika xodimi esa
    platforma bo'limlarini ko'rmaydi. Ruxsatlar ham alohida.
  */
  {
    labelKey: 'platform.group',
    items: [
      {
        to: '/platform',
        labelKey: 'platform.overview',
        icon: LayoutDashboard,
        permission: 'platform.view',
        end: true,
      },
      {
        to: '/platform/clinics',
        labelKey: 'platform.clinics',
        icon: Building2,
        permission: 'platform.view',
      },
      {
        to: '/platform/analytics',
        labelKey: 'analytics.platformTitle',
        icon: BarChart3,
        permission: 'platform.view',
      },
      {
        to: '/platform/registry',
        labelKey: 'registry.title',
        icon: Users,
        permission: 'platform.view',
      },
      {
        to: '/platform/data',
        labelKey: 'data.title',
        icon: Database,
        permission: 'platform.view',
      },
      {
        to: '/platform/team',
        labelKey: 'team.title',
        icon: UserCog,
        permission: 'platform.manage',
      },
      {
        to: '/platform/plans',
        labelKey: 'platform.plans',
        icon: Layers,
        permission: 'platform.view',
      },
      {
        to: '/platform/invoices',
        labelKey: 'platform.invoices',
        icon: Receipt,
        permission: 'platform.view',
      },
    ],
  },
  {
    labelKey: 'nav.group.main',
    items: [
      {
        to: '/',
        labelKey: 'nav.dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
        end: true,
      },
    ],
  },
  {
    labelKey: 'nav.group.patients',
    items: [
      { to: '/patients', labelKey: 'nav.patients', icon: Users, permission: 'patients.view' },
      {
        to: '/appointments',
        labelKey: 'nav.appointments',
        icon: ClipboardList,
        permission: 'appointments.view',
      },
      {
        to: '/calendar',
        labelKey: 'nav.calendar',
        icon: CalendarDays,
        permission: 'calendar.view',
      },
      { to: '/ward', labelKey: 'nav.ward', icon: BedDouble, permission: 'ward.view' },
    ],
  },
  {
    labelKey: 'nav.group.team',
    items: [
      {
        to: '/me',
        labelKey: 'nav.myProfile',
        icon: UserRound,
        // Har bir xodimga kerak: o'z natijasi, oyligi va jadvali
        permission: 'dashboard.view',
      },
      {
        to: '/schedule',
        labelKey: 'schedule.mine',
        icon: CalendarClock,
        // Har bir xodim o'z ish jadvalini ko'rishi kerak —
        // shuning uchun eng keng tarqalgan ruxsatga bog'landi
        permission: 'dashboard.view',
      },
      { to: '/chat', labelKey: 'nav.chat', icon: MessageCircle, permission: 'chat.use' },
    ],
  },
  {
    labelKey: 'nav.group.clinic',
    items: [
      {
        to: '/doctors',
        labelKey: 'nav.doctors',
        icon: Stethoscope,
        permission: 'doctors.view',
      },
      { to: '/staff', labelKey: 'nav.staff', icon: UserCog, permission: 'staff.view' },
      {
        to: '/attendance',
        labelKey: 'nav.attendance',
        icon: CalendarCheck,
        permission: 'attendance.view',
      },
      {
        to: '/feedback',
        labelKey: 'nav.feedback',
        icon: MessageSquare,
        permission: 'feedback.view',
      },
      {
        to: '/services',
        labelKey: 'nav.services',
        icon: ClipboardList,
        permission: 'services.view',
      },
    ],
  },
  {
    labelKey: 'nav.group.finance',
    items: [
      {
        to: '/payments',
        labelKey: 'nav.payments',
        icon: CreditCard,
        permission: 'payments.view',
      },
      { to: '/revenue', labelKey: 'nav.revenue', icon: TrendingUp, permission: 'revenue.view' },
      {
        to: '/cash-control',
        labelKey: 'nav.cashControl',
        icon: ShieldCheck,
        permission: 'cashcontrol.view',
      },
    ],
  },
  {
    labelKey: 'nav.group.analytics',
    items: [
      {
        to: '/analytics',
        labelKey: 'nav.analytics',
        icon: BarChart3,
        permission: 'analytics.view',
      },
    ],
  },
  {
    labelKey: 'nav.group.system',
    items: [
      { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.view' },
    ],
  },
]

/**
 * Telefondagi pastki panel — PLATFORMA egasi uchun.
 *
 * NEGA ALOHIDA RO'YXAT: umumiy ro'yxat klinika bo'limlaridan iborat,
 * platforma egasida esa ularning birortasi ham ochilmaydi. Ruxsat
 * filtridan keyin pastki panelda bitta band qolib, u buzilgandek
 * ko'rinadi.
 */
export const PLATFORM_MOBILE_NAV: NavItem[] = [
  {
    to: '/platform',
    labelKey: 'platform.overview',
    icon: LayoutDashboard,
    permission: 'platform.view',
    end: true,
  },
  {
    to: '/platform/clinics',
    labelKey: 'platform.clinics',
    icon: Building2,
    permission: 'platform.view',
  },
  {
    to: '/platform/analytics',
    labelKey: 'analytics.platformTitle',
    icon: BarChart3,
    permission: 'platform.view',
  },
  {
    to: '/platform/registry',
    labelKey: 'registry.title',
    icon: Users,
    permission: 'platform.view',
  },
]

/** Telefondagi pastki panel — klinika xodimlari uchun */
export const MOBILE_NAV: NavItem[] = [
  {
    to: '/',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.view',
    end: true,
  },
  { to: '/patients', labelKey: 'nav.patients', icon: Users, permission: 'patients.view' },
  {
    to: '/appointments',
    labelKey: 'nav.appointments',
    icon: ClipboardList,
    permission: 'appointments.view',
  },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarDays, permission: 'calendar.view' },
]
