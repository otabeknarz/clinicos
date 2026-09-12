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
import type { Clinic, ClinicModule, ID, Permission, Role, Session, User } from '@/types/models'

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
  { email: 'apteka@clinic-os.uz', role: 'pharmacist' },
  { email: 'apteka.rahbar@clinic-os.uz', role: 'pharmacy_owner' },
]

/** Demo rejimda har qanday parol qabul qilinadi, lekin bo'sh bo'lmasligi kerak */
export const DEMO_PASSWORD = 'demo1234'

// POST /auth/login  →  { user, clinic, permissions, token }
export async function login(input: LoginInput): Promise<Session> {
  if (!USE_MOCK) {
    return request<Session>('POST', '/auth/login', { body: input })
  }

  /*
    BARCHA bizneslardan qidiriladi — server ham shunday qiladi:
    kirishda kim qayerda ishlashi hali noma'lum. Faqat asosiy
    klinikadan qidirilganda alohida apteka xodimi umuman
    topilmasdi.
  */
  const user = getDb()
    .users.allAcrossTenants()
    .find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())

  if (!user || !input.password) {
    await delay(null, 400)
    throw Object.assign(new Error('auth.invalid'), { status: 401 })
  }

  const clinic = sessionTenant(user)

  const session: Session = {
    user,
    clinic,
    permissions: allowedPermissions(
      user.role,
      user.extraPermissions,
      user.clinicId,
      user.email,
    ),
    token: null,
  }

  return delay(session, 380)
}

/**
 * Sessiyadagi biznes — odam qayerda ishlaydi.
 *
 * Apteka klinika EMAS va klinikaga biriktirilmagan. Lekin sessiya
 * bitta shaklni kutadi (`Session.clinic`), shuning uchun apteka
 * xodimida uning o'rnida apteka turadi: `id` — ma'lumot kaliti,
 * nomi — aptekaning nomi.
 *
 * TO'XTATILGAN APTEKA xodimi kira olmaydi va sababini ko'radi —
 * klinika to'xtatilgandagi kabi. Serverda bu tekshiruv
 * `jwt.strategy.ts` da ham bo'lishi shart, aks holda allaqachon
 * berilgan token ishlayverardi.
 */
function sessionTenant(user: User): Clinic {
  const db = getDb()

  if (user.role === 'pharmacist' || user.role === 'pharmacy_owner') {
    const pharmacy = db.pharmacies.allAcrossTenants().find((p) => p.id === user.clinicId)
    if (!pharmacy) {
      throw Object.assign(new Error('Apteka topilmadi'), { status: 403 })
    }
    if (pharmacy.status === 'suspended') {
      throw Object.assign(
        new Error(`Apteka to‘xtatilgan: ${pharmacy.suspendReason}`),
        { status: 403 },
      )
    }
    return {
      id: pharmacy.id,
      name: pharmacy.name,
      logoUrl: null,
      phone: pharmacy.phone,
      address: pharmacy.address,
      workingHours: [],
      slotMinutes: 30,
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      createdAt: pharmacy.createdAt,
    }
  }

  const clinic = db.clinics.find(user.clinicId, user.clinicId)
  if (!clinic) throw new Error('Klinika topilmadi')
  return clinic
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

  const user = getDb()
    .users.allAcrossTenants()
    .find((u) => u.id === userId)
  if (!user) return null

  /* To'xtatilgan apteka — sessiya tiklanmaydi, odam kirish sahifasiga qaytadi */
  let clinic: Clinic
  try {
    clinic = sessionTenant(user)
  } catch {
    return null
  }

  return delay(
    {
      user,
      clinic,
      permissions: allowedPermissions(
      user.role,
      user.extraPermissions,
      user.clinicId,
      user.email,
    ),
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
  /** Apteka xodimining logini — kirim huquqi shunga bog'liq */
  login?: string,
): Permission[] {
  const disabled = getDb()
    .tenants.allAcrossTenants()
    .find((tenant) => tenant.id === clinicId)?.disabledModules

  /*
    KIRIM HUQUQI XODIM YOZUVIDAN KELADI.

    Rahbar uni "Xodimlar" bo'limida har bir sotuvchiga alohida
    yoqadi. Haqiqiy ishlashda bu `User.extraPermissions` ga
    yoziladi va server tokenda beradi; demoda esa apteka xodimi
    yozuvi bilan login bo'yicha bog'lanadi.
  */
  const fromStaff: Permission[] = login
    ? getDb()
        .pharmacyStaff.all(clinicId)
        .filter((one) => one.login === login && one.canReceive && one.status === 'active')
        .map(() => 'pharmacy.receive' as Permission)
    : []

  const base = resolvePermissions(role, [...(extra ?? []), ...fromStaff])
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

/** Telegram ulanishining holati */
export interface TelegramStatus {
  /** Hisob ulanganmi */
  linked: boolean
  /** Serverda bot tokeni bormi — yo'q bo'lsa bo'limni ko'rsatishning ma'nosi yo'q */
  available: boolean
}

/**
 * Telegram ulangan-ulanmaganini aytadi.
 *
 * Ilgari buni bilishning yo'li yo'q edi: ulanish ham, ulanmaganlik
 * ham jimgina edi va shifokor xabar kelmayotganining sababini
 * topa olmasdi.
 */
// GET /me/telegram
export async function telegramStatus(): Promise<TelegramStatus> {
  if (!USE_MOCK) {
    return request<TelegramStatus>('GET', '/me/telegram')
  }
  /* Demo rejimda bot yo'q */
  return delay({ linked: false, available: false }, 80)
}

/**
 * Botga olib boradigan bir martalik havola.
 *
 * Mini app ichidagi jimgina ulanish yetmaydi: ilovani brauzerdan
 * ochgan xodim hech qachon ulanmasdi. Bundan tashqari bot o'zi
 * birinchi bo'lib yoza olmaydi — odam suhbatni ochishi shart.
 * Havola ikkalasini bir yo'la bajaradi.
 */
// POST /me/telegram/link
export async function telegramLinkUrl(): Promise<{ url: string | null }> {
  if (!USE_MOCK) {
    return request<{ url: string | null }>('POST', '/me/telegram/link')
  }
  return delay({ url: null }, 80)
}

/** Ulanishni uzadi — telefon almashtirilganda kerak */
// DELETE /me/telegram
export async function unlinkTelegram(): Promise<{ linked: boolean }> {
  if (!USE_MOCK) {
    return request<{ linked: boolean }>('DELETE', '/me/telegram')
  }
  return delay({ linked: false }, 80)
}

/* ------------------------------------------------------------------ */
/* O'zi ro'yxatdan o'tish                                             */
/* ------------------------------------------------------------------ */

/** Klinikaning yo'nalishi — serverdagi ro'yxat bilan bir xil */
export const CLINIC_DIRECTIONS = ['general', 'dental', 'eye', 'lab'] as const
/** Ro'yxatdan o'tayotgan odam klinikada kim */
export const LEAD_POSITIONS = [
  'owner',
  'chief_doctor',
  'manager',
  'administrator',
  'doctor',
  'other',
] as const
/** Klinika hajmi */
export const STAFF_COUNTS = ['1-5', '6-15', '16-40', '40+'] as const

export interface RegisterInput {
  clinicName: string
  fullName: string
  phone: string
  position: (typeof LEAD_POSITIONS)[number]
  direction: (typeof CLINIC_DIRECTIONS)[number]
  city?: string
  staffCount?: (typeof STAFF_COUNTS)[number]
  password: string
}

/**
 * Ro'yxatdan o'tish BIRINCHI QADAMI.
 *
 * Bu chaqiruv hali hech narsa yaratmaydi: javobda Telegram
 * havolasi qaytadi va odam raqamini o'sha yerda tasdiqlaydi.
 * Sabab oddiy — birov boshqa odamning raqami bilan hisob ochib
 * ketmasligi kerak, bepul SMS xizmati esa yo'q.
 */
// POST /auth/register
export async function register(input: RegisterInput): Promise<{
  code: string
  url: string
  phone: string
  expiresInSec: number
}> {
  if (!USE_MOCK) {
    return request('POST', '/auth/register', { body: input })
  }

  /* Demo rejimda tasdiqlash yo'q: bot ham, server ham yo'q */
  return delay({
    code: 'demo',
    url: 'https://t.me/clinicos_bot',
    phone: input.phone,
    expiresInSec: 900,
  })
}

/**
 * Tasdiqlandimi.
 *
 * `waiting` — odam hali Telegramda raqamini ulashmagan;
 * `ready` — klinika ochildi va sessiya tayyor (BIR MARTA beriladi);
 * `expired` — 15 daqiqa o'tdi, formani qaytadan to'ldirish kerak.
 */
// GET /auth/register/status
export async function registerStatus(
  code: string,
): Promise<{ status: 'waiting' | 'ready' | 'expired'; session: Session | null }> {
  if (!USE_MOCK) {
    return request('GET', '/auth/register/status', { query: { code } })
  }
  return delay({ status: 'waiting' as const, session: null })
}
