/**
 * Rollarga asoslangan ruxsatlar (RBAC).
 *
 * !!! DIQQAT — DASTURCHIGA MUHIM XABAR !!!
 *
 * Bu fayl FAQAT interfeys darajasida ishlaydi: menyu bandini yashirish,
 * tugmani o'chirish, marshrutga kiritmaslik. Bu XAVFSIZLIK EMAS.
 *
 * Brauzerdagi har qanday tekshiruvni foydalanuvchi chetlab o'tishi mumkin.
 * Haqiqiy ruxsat tekshiruvi HAR BIR endpoint'da server tomonda takrorlanishi
 * SHART. Qaysi endpoint qaysi ruxsatni talab qilishi — `docs/API.md`da.
 */

import type { Permission, Role, Session } from '@/types/models'

/* ------------------------------------------------------------------ */
/* Rol → standart ruxsatlar                                            */
/* ------------------------------------------------------------------ */

/**
 * EGASI (CEO).
 *
 * Muhim qaror: egasi bemor QO'SHMAYDI va qabul YOZMAYDI — bu
 * administratsiyaning ishi. Shuning uchun `patients.create`,
 * `appointments.create` va `payments.create` ro'yxatda YO'Q.
 *
 * Sabab faqat qulaylik emas, nazorat ham: pulni kim kiritganini aniq
 * bilish uchun kassaga faqat administratsiya tegadi. Egasi kiritgan
 * to'lov nazorat hisobotini buzadi.
 *
 * Egasiga kerak bo'lgani — ko'rish, tahlil qilish va xodimlarni
 * boshqarish.
 */
/**
 * PLATFORMA EGASI (ClinicOS ning o'zi).
 *
 * Ro'yxat ataylab qisqa: super admin klinikalar bilan ishlaydi,
 * ularning ichidagi ish bilan emas. Bemor, tashrif, to'lov —
 * bularning birortasi ham bu yerda yo'q.
 *
 * Klinika paneliga kirish kerak bo'lsa, u `platform.impersonate`
 * orqali va SABAB bilan kiradi — har bir kirish qayd etiladi.
 */
const SUPERADMIN_PERMISSIONS: Permission[] = [
  'platform.view',
  'platform.manage',
  'platform.impersonate',
  // O'z profili: ism, rasm, til, ko'rinish
  'settings.view',
]

const OWNER_PERMISSIONS: Permission[] = [
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
  'revenue.view',
  'analytics.view',
  'visits.view',
  'ward.view',
  'ward.manage',
  'staff.view',
  'staff.manage',
  'attendance.view',
  'attendance.manage',
  'bonus.manage',
  'feedback.view',
  'feedback.manage',
  'chat.use',
  'cashcontrol.view',
  'settings.view',
  'settings.manage',
  'users.manage',
]

/**
 * Registratura: kundalik ish oqimi to'liq ochiq, moliyaviy hisobotlar yopiq.
 * Egasi kerak bo'lsa `extraPermissions` orqali `revenue.view` qo'sha oladi.
 */
const RECEPTIONIST_PERMISSIONS: Permission[] = [
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
  // Davomatni administratsiya belgilaydi — kim keldi, kim kelmadi
  'attendance.view',
  'attendance.manage',
  // Bemor fikrlarini ko'radi, lekin javob bera olmaydi (feedback.manage yo'q)
  'feedback.view',
  'chat.use',
  // Smenani yopish — kun oxirida kassani sanab topshirish
  'shift.close',
  // O'z profili: ism, telefon, rasm, til, ko'rinish.
  // `settings.manage` YO'Q — klinika sozlamalariga tegmaydi.
  'settings.view',
]

/**
 * Shifokor: faqat o'z ishi. Bemorlar ro'yxati ham cheklangan —
 * `visibleDoctorId` orqali server faqat unga tegishli bemorlarni qaytaradi.
 */
const DOCTOR_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.viewMedical',
  'appointments.view',
  'calendar.view',
  'services.view',
  'visits.view',
  'visits.create',
  'ward.view',
  // Shifokor o'zi haqidagi fikrlarni ANONIM ko'radi
  'feedback.view',
  'chat.use',
  // O'z profili: ism, telefon, rasm, til, ko'rinish
  'settings.view',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: SUPERADMIN_PERMISSIONS,
  owner: OWNER_PERMISSIONS,
  receptionist: RECEPTIONIST_PERMISSIONS,
  doctor: DOCTOR_PERMISSIONS,
}

/** Rol standarti + qo'shimcha berilgan ruxsatlar */
export function resolvePermissions(role: Role, extra: Permission[] = []): Permission[] {
  return Array.from(new Set([...ROLE_PERMISSIONS[role], ...extra]))
}

/* ------------------------------------------------------------------ */
/* Tekshiruvlar                                                        */
/* ------------------------------------------------------------------ */

export function can(session: Session | null, permission: Permission): boolean {
  if (!session) return false
  return session.permissions.includes(permission)
}

/* ------------------------------------------------------------------ */
/* Ma'lumot ko'lami (data scope)                                       */
/* ------------------------------------------------------------------ */

/**
 * Shifokor faqat o'ziga tegishli yozuvlarni ko'radi.
 * Bu ID api qatlamiga uzatiladi va so'rovga filtr sifatida qo'shiladi.
 *
 * Serverda ham AYNAN shu cheklov qo'llanishi shart — mijoz bu filtrni
 * olib tashlashi mumkin.
 */
export function scopedDoctorId(session: Session | null): string | null {
  if (!session) return null
  if (session.user.role === 'doctor') return session.user.doctorId
  return null
}
