import { Role } from '@prisma/client'

/**
 * ROLLAR VA RUXSATLAR — SERVER TOMONI.
 *
 * Frontendda ham xuddi shunday ro'yxat bor (`src/lib/permissions.ts`),
 * lekin u FAQAT interfeys uchun: tugmani ko'rsatadi yoki yashiradi.
 *
 * Haqiqiy cheklov shu yerda. Foydalanuvchi brauzer konsolidan ham
 * so'rov yubora oladi, ya'ni frontenddagi tekshiruv himoya emas.
 *
 * IKKALASI MOS TURISHI KERAK. Frontendda ruxsat qo'shsangiz, shu
 * yerga ham qo'shing — aks holda tugma ko'rinadi, lekin bosilganda
 * 403 chiqadi.
 */

/**
 * Barcha ruxsatlar.
 *
 * Ro'yxat frontenddagi `Permission` turi bilan AYNAN bir xil
 * (`clinicos/src/types/models.ts`). Ular ajralib ketmasligi uchun
 * `npm run check:permissions` tekshiradi.
 *
 * Tur bo'lgani uchun noto'g'ri yozilgan nom kompilyatsiya xatosiga
 * aylanadi. Ilgari u jimgina o'tib ketardi va endpoint hech kimga
 * ochilmay qolardi — bunday xatoni sinovsiz sezib bo'lmaydi.
 */
export type Permission =
  | 'dashboard.view'
  | 'patients.view'
  | 'patients.create'
  | 'patients.edit'
  | 'patients.delete'
  | 'patients.viewMedical'
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.cancel'
  | 'calendar.view'
  | 'doctors.view'
  | 'doctors.manage'
  | 'services.view'
  | 'services.manage'
  | 'payments.view'
  | 'payments.create'
  | 'payments.refund'
  | 'revenue.view'
  | 'analytics.view'
  | 'visits.view'
  | 'visits.create'
  | 'settings.view'
  | 'settings.manage'
  | 'users.manage'
  | 'ward.view'
  | 'ward.manage'
  | 'staff.view'
  | 'staff.manage'
  | 'attendance.view'
  | 'attendance.manage'
  | 'bonus.manage'
  | 'feedback.view'
  | 'feedback.manage'
  | 'chat.use'
  | 'cashcontrol.view'
  | 'shift.close'
  | 'platform.view'
  | 'platform.manage'
  | 'platform.impersonate'

/**
 * KLINIKA EGASI.
 *
 * Ro'yxatda `create` ruxsatlari ATAYLAB yo'q: egasi bemor
 * qo'shmaydi, pul kiritmaydi, tashrif yozmaydi.
 *
 * NEGA: tizimning firibgarlikka qarshi mantiqi vazifalar
 * bo'linishiga tayanadi — shifokor tashrifni yozadi, registrator
 * pulni yozadi, egasi ikkalasini solishtiradi. Egasi ikkala
 * tomonni ham yoza oladigan bo'lsa, u o'zini o'zi tekshirgan
 * bo'lardi va solishtiruvning ma'nosi qolmasdi.
 */
export const OWNER_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.viewMedical',
  'appointments.view',
  'calendar.view',
  'doctors.view',
  'doctors.manage',
  'services.view',
  'services.manage',
  'payments.view',
  'visits.view',
  'ward.view',
  'ward.manage',
  'staff.view',
  'staff.manage',
  'bonus.manage',
  'attendance.view',
  'attendance.manage',
  'feedback.view',
  'feedback.manage',
  'chat.use',
  'cashcontrol.view',
  'revenue.view',
  'analytics.view',
  'settings.view',
  'settings.manage',
  'users.manage',
] as const

export const RECEPTIONIST_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.create',
  'patients.edit',
  'appointments.view',
  'appointments.create',
  'appointments.edit',
  'appointments.cancel',
  'calendar.view',
  'doctors.view',
  'services.view',
  'payments.view',
  'payments.create',
  'ward.view',
  'ward.manage',
  'attendance.view',
  'attendance.manage',
  'feedback.view',
  'chat.use',
  /*
    Registratorda `cashcontrol.view` ATAYLAB YO'Q.

    Solishtiruv hisoboti — bu uning o'z ishining tekshiruvi.
    Pul yig'uvchi odam tekshiruv qanday chiqayotganini ko'rib
    tursa, farqni yopish yo'lini topib oladi.
  */
  'shift.close',
  'settings.view',
] as const

export const DOCTOR_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.viewMedical',
  'appointments.view',
  'calendar.view',
  'visits.view',
  'visits.create',
  'ward.view',
  'services.view',
  'feedback.view',
  'chat.use',
  'settings.view',
] as const

export const SUPERADMIN_PERMISSIONS: readonly Permission[] = [
  'platform.view',
  'platform.manage',
  'platform.impersonate',
  'settings.view',
] as const

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  SUPERADMIN: SUPERADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
  RECEPTIONIST: RECEPTIONIST_PERMISSIONS,
  DOCTOR: DOCTOR_PERMISSIONS,
}

/**
 * Rol standarti + shaxsan berilgan qo'shimchalar.
 *
 * Qo'shimcha ruxsat egasi tomonidan beriladi. Masalan ishonchli
 * registratorga `revenue.view` berib, klinikaning umumiy
 * aylanmasini ochib qo'yish mumkin.
 */
export function resolvePermissions(role: Role, extra: string[] = []): string[] {
  return [...new Set([...ROLE_PERMISSIONS[role], ...extra])]
}
