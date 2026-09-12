/**
 * Bazadagi holat nomlarini o'zbekchaga o'giradi.
 *
 * Fayl buxgalter, direktor yoki soliqqa ketadi — u yerda
 * `CHECKED_IN` degan so'z hech narsa anglatmaydi. Ro'yxatda yo'q
 * qiymat bo'lsa, o'zi qanday bo'lsa shunday chiqadi: yangi holat
 * qo'shilganda fayl buzilmasin, shunchaki inglizcha ko'rinsin.
 */
const LABELS: Record<string, string> = {
  /* Bemor */
  MALE: 'Erkak',
  FEMALE: 'Ayol',
  ACTIVE: 'Faol',
  INACTIVE: 'Nofaol',
  ARCHIVED: 'Arxivda',
  /* Qabul */
  SCHEDULED: 'Rejalashtirilgan',
  CONFIRMED: 'Tasdiqlangan',
  CHECKED_IN: 'Navbatda',
  COMPLETED: 'Yakunlangan',
  CANCELLED: 'Bekor qilingan',
  NO_SHOW: 'Kelmadi',
  /* To'lov */
  UNPAID: 'To‘lanmagan',
  PAID: 'To‘langan',
  PARTIAL: 'Qisman',
  PENDING: 'Kutilmoqda',
  REFUNDED: 'Qaytarilgan',
  OVERDUE: 'Muddati o‘tgan',
  CREDIT: 'Qarzga',
  CASH: 'Naqd',
  CARD: 'Karta',
  TRANSFER: 'O‘tkazma',
  /* Xodim */
  ON_LEAVE: 'Ta’tilda',
  FIRED: 'Ishdan chiqqan',
  DOCTOR: 'Shifokor',
  NURSE: 'Hamshira',
  RECEPTIONIST: 'Registrator',
  MANAGER: 'Boshqaruvchi',
  ACCOUNTANT: 'Buxgalter',
  LAB_TECH: 'Laborant',
  PHARMACIST: 'Farmatsevt',
  CLEANER: 'Farrosh',
  SECURITY: 'Qorovul',
  DRIVER: 'Haydovchi',
  OTHER: 'Boshqa',
  /* Davomat */
  PRESENT: 'Keldi',
  LATE: 'Kechikdi',
  ABSENT: 'Kelmadi',
  EXCUSED: 'Sababli',
  DAY_OFF: 'Dam olish',
  /* Statsionar */
  PLANNED: 'Rejada',
  DISCHARGED: 'Chiqarilgan',
  /* Obuna */
  TRIAL: 'Sinov',
  PAST_DUE: 'Muddati o‘tgan',
  SUSPENDED: 'To‘xtatilgan',
  /* Dori shakli */
  TABLET: 'Tabletka',
  CAPSULE: 'Kapsula',
  SYRUP: 'Sirop',
  AMPOULE: 'Ampula',
  OINTMENT: 'Malham',
  DROPS: 'Tomchi',
  SPRAY: 'Sprey',
}

export function label(value: string | null | undefined): string {
  if (!value) return ''
  return LABELS[value] ?? value
}

/** Sana: 2026-09-12. Excel shu ko'rinishni sana deb taniydi. */
export function day(value: Date | null | undefined): string {
  if (!value) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

/** Soat: 14:30 */
export function clock(value: Date | null | undefined): string {
  if (!value) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`
}

/** Ha/yo'q — Excel'da o'qish uchun */
export function yesNo(value: boolean): string {
  return value ? 'ha' : 'yo‘q'
}
