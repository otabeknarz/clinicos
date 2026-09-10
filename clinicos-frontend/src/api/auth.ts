/**
 * Autentifikatsiya.
 *
 * XAVFSIZLIK ESLATMASI (dasturchiga):
 *  - Parol serverda `bcrypt`/`argon2` bilan xeshlanadi. Frontend parolni
 *    faqat HTTPS orqali yuboradi va hech qaerda saqlamaydi.
 *  - Eng yaxshi variant — sessiyani HttpOnly + Secure + SameSite cookie'da
 *    saqlash. Bu holda token JS uchun ko'rinmaydi (XSS o'g'irlay olmaydi).
 *  - Token localStorage'da saqlanmasin. Hozir mock rejimda faqat
 *    foydalanuvchi id'si saqlanadi, token yo'q.
 */

import { ApiError, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { MAIN_CLINIC_ID } from '@/mock/seed'
import { resolvePermissions } from '@/lib/permissions'
import type { ClinicModule, ID, Permission, Role, Session, User } from '@/types/models'

export interface LoginInput {
  email: string
  password: string
}

/** Demo hisoblar — kirish sahifasida ko'rsatiladi */
export const DEMO_ACCOUNTS: { email: string; role: Role }[] = [
  { email: 'admin@clinicos.uz', role: 'superadmin' },
  { email: 'owner@shifomed.uz', role: 'owner' },
  { email: 'reception@shifomed.uz', role: 'receptionist' },
  { email: 'aziz.karimov@shifomed.uz', role: 'doctor' },
]

/** Demo rejimda har qanday parol qabul qilinadi, lekin bo'sh bo'lmasligi kerak */
export const DEMO_PASSWORD = 'demo1234'

// POST /auth/login  →  { user, clinic, permissions, token }
export async function login(input: LoginInput): Promise<Session> {
  if (!USE_MOCK) {
    return request<Session>('POST', '/auth/login', { body: input })
  }

  const db = getDb()
  const user = db.users
    .all(MAIN_CLINIC_ID)
    .find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())

  if (!user || !input.password) {
    await delay(null, 400)
    throw Object.assign(new Error('auth.invalid'), { status: 401 })
  }

  const clinic = db.clinics.find(user.clinicId, user.clinicId)
  if (!clinic) throw new Error('Klinika topilmadi')

  const session: Session = {
    user,
    clinic,
    permissions: allowedPermissions(user.role, user.extraPermissions, user.clinicId),
    token: null,
  }

  return delay(session, 380)
}

// POST /auth/logout
export async function logout(): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('POST', '/auth/logout')
    return
  }
  await delay(null, 120)
}

// GET /auth/me  →  sahifa yangilanganda sessiyani tiklash
export async function me(userId?: string): Promise<Session | null> {
  if (!USE_MOCK) {
    try {
      return await request<Session>('GET', '/auth/me')
    } catch {
      return null
    }
  }

  if (!userId) return null

  const db = getDb()
  const user = db.users.all(MAIN_CLINIC_ID).find((u) => u.id === userId)
  if (!user) return null

  const clinic = db.clinics.find(user.clinicId, user.clinicId)
  if (!clinic) return null

  return delay(
    {
      user,
      clinic,
      permissions: allowedPermissions(user.role, user.extraPermissions, user.clinicId),
      token: null,
    },
    60,
  )
}

export interface ProfileInput {
  fullName: string
  phone: string
  email: string
  /**
   * Avatar.
   *
   * Demo rejimda — data URL (rasm brauzerda kichraytirilgan).
   * Haqiqiy backendda bu alohida endpoint bo'ladi:
   *   POST /profile/avatar  (multipart/form-data)
   * va javobda saqlangan faylning havolasi qaytadi.
   */
  avatarUrl: string | null
}

// PATCH /profile
export async function updateProfile(userId: ID, input: ProfileInput): Promise<User> {
  if (!USE_MOCK) return request<User>('PATCH', '/profile', { body: input })

  const db = getDb()
  const updated = db.users.update(userId, input, MAIN_CLINIC_ID)
  if (!updated) throw new Error('Foydalanuvchi topilmadi')

  // Xodimlar ro'yxatidagi yozuv ham yangilanadi
  const staff = db.staff.all(MAIN_CLINIC_ID).find((row) => row.login === updated.email)
  if (staff) {
    db.staff.update(
      staff.id,
      { fullName: input.fullName, phone: input.phone, avatarUrl: input.avatarUrl },
      MAIN_CLINIC_ID,
    )
  }

  return delay(updated, 320)
}

/**
 * PAROLNI ALMASHTIRISH.
 *
 * Joriy parol majburiy: token borligi "bu o'sha odam" degani emas.
 * Qarovsiz qolgan ochiq sessiya yonidan o'tgan odam hisobni
 * o'zlashtirib ololmasin.
 *
 * Javobda YANGI sessiya qaytadi. Serverda almashtirilgach eski
 * tokenlar yaroqsiz bo'ladi — shu jumladan chaqiruvchining o'zi
 * ishlatayotgani ham. Shuning uchun `AuthContext` yangi tokenni
 * darhol o'rniga qo'yishi kerak, aks holda foydalanuvchi o'z
 * parolini almashtirib, o'zi chiqib qolardi.
 */
// POST /auth/password
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Session> {
  if (!USE_MOCK) {
    return request<Session>('POST', '/auth/password', {
      body: { currentPassword, newPassword },
    })
  }

  /*
    Demo rejimda parol umuman tekshirilmaydi — mock qatlamida
    parol saqlanmaydi. Faqat shakl to'g'riligi ko'riladi.
  */
  if (currentPassword !== DEMO_PASSWORD) {
    throw new ApiError('Joriy parol noto‘g‘ri', 400)
  }
  const session = await me(getDb().users.all(MAIN_CLINIC_ID)[0]?.id)
  if (!session) throw new ApiError('Sessiya topilmadi', 400)
  return delay(session, 320)
}

// GET /users  →  sozlamalardagi foydalanuvchilar ro'yxati
export async function listUsers(): Promise<User[]> {
  if (!USE_MOCK) return request<User[]>('GET', '/users')
  return delay(getDb().users.all(MAIN_CLINIC_ID))
}

/**
 * Rolning ruxsatlaridan o'chirilgan bo'limlarnikini olib tashlaydi.
 *
 * Serverda `buildSession` xuddi shu ishni qiladi: o'chirilgan
 * bo'limning ruxsatlari sessiyaga umuman tushmaydi va menyu ham,
 * tugmalar ham o'z-o'zidan bo'ysunadi. Demo rejimda takrorlanmasa,
 * bo'lim o'chirilgani faqat haqiqiy backendda ko'rinardi.
 */
function allowedPermissions(
  role: Role,
  extra: Permission[] | undefined,
  clinicId: ID,
): Permission[] {
  const disabled = getDb()
    .tenants.allAcrossTenants()
    .find((tenant) => tenant.id === clinicId)?.disabledModules

  const base = resolvePermissions(role, extra)
  if (!disabled || disabled.length === 0) return base

  return base.filter((permission) => {
    const module = MODULE_BY_PERMISSION[permission]
    return module === undefined || !disabled.includes(module)
  })
}

/**
 * Ruxsat qaysi bo'limga tegishli.
 * Serverdagi `src/common/modules.ts` bilan bir xil bo'lishi shart.
 */
const MODULE_BY_PERMISSION: Partial<Record<Permission, ClinicModule>> = {
  'ward.view': 'ward',
  'ward.manage': 'ward',
  'chat.use': 'chat',
  'feedback.view': 'feedback',
  'feedback.manage': 'feedback',
  'analytics.view': 'analytics',
  'attendance.view': 'attendance',
  'attendance.manage': 'attendance',
  'bonus.manage': 'attendance',
  'cashcontrol.view': 'cashcontrol',
  'shift.close': 'cashcontrol',
  'calendar.view': 'calendar',
  'debts.view': 'debts',
  'debts.waive': 'debts',
  'revenue.view': 'revenue',
}

/**
 * Telegram hisobini joriy foydalanuvchiga bog'laydi.
 *
 * Xodim ilovani mini app ichida ochganda BIR MARTA chaqiriladi.
 * Alohida "bog'lash" tugmasi yo'q: u baribir bosilmasdi va xodim
 * xabar kelmayotganini bilmay yurardi.
 *
 * XATO QAYTARMAYDI. Imzo yaroqsiz bo'lishining odatiy sababi —
 * ilova oddiy brauzerda ochilgan. Bu nosozlik emas.
 */
// POST /me/telegram
export async function linkTelegram(initData: string): Promise<{ linked: boolean }> {
  if (!USE_MOCK) {
    return request<{ linked: boolean }>('POST', '/me/telegram', { body: { initData } })
  }
  /* Demo rejimda bog'lanadigan bot yo'q */
  return delay({ linked: false }, 80)
}
