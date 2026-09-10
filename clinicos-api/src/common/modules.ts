/**
 * KLINIKA MODULLARI.
 *
 * Har klinikaga hamma bo'lim ham kerak emas: stomatologiyada
 * statsionar yo'q, laboratoriyada shifokor qabuli yo'q. Platforma
 * egasi keraksizini o'chirib qo'yadi va u klinika uchun butunlay
 * ko'rinmaydi.
 *
 * O'CHIRILGAN MODUL — RUXSAT YO'QLIGI BILAN BIR XIL NARSA EMAS.
 * Ruxsat "bu ODAM qila oladimi" degan savolga javob beradi; modul
 * esa "bu KLINIKADA umuman bormi". Shuning uchun bu ikkinchi
 * darvoza, ruxsatlar ro'yxatiga aralashtirilmaydi.
 *
 * SAQLANISHI: `Clinic.disabledModules` da O'CHIRILGANLARI yotadi,
 * yoqilganlari emas. Nega: bo'sh ro'yxat "hammasi yoqilgan" degani,
 * ya'ni mavjud klinikalar va yangi qo'shilgan modullar o'z-o'zidan
 * ishlaydi. Yoqilganlar saqlansa, har yangi modul barcha klinikada
 * o'chiq bo'lib qolardi.
 */
export const CLINIC_MODULES = [
  'ward',
  'chat',
  'feedback',
  'analytics',
  'attendance',
  'cashcontrol',
  'calendar',
  'debts',
  'revenue',
] as const

/*
  NEGA HAMMA BO'LIM MODUL EMAS.

  Bemorlar, qabullar, tashriflar, to'lovlar, xizmatlar, shifokorlar va
  sozlamalar ro'yxatda YO'Q va bo'lmaydi ham: ularsiz klinika umuman
  ishlamaydi, ya'ni "o'chirilgan bemorlar" degan holat mahsulotni
  buzadi, sotilmaydi.

  XODIMLAR ham ataylab qoldirilmadi. Shifokor aynan Xodimlar orqali
  ishga olinadi (`StaffService.create` `Doctor` yozuvini ochadi) — bu
  bo'lim o'chirilsa, klinika shifokor qo'sholmay qoladi va butun
  mahsulot ishlamaydi. Davomat va rag'bat esa alohida modul
  (`attendance`), o'sha yerdan cheklanadi.
*/

export type ClinicModule = (typeof CLINIC_MODULES)[number]

/**
 * Ruxsat qaysi modulga tegishli.
 *
 * NEGA SHU SHAKLDA: har bir marshrutga alohida `@RequireModule`
 * yozish kerak bo'lardi va yangi marshrut qo'shilganda unutilardi.
 * Marshrutlarda ruxsat ALLAQACHON e'lon qilingan, shuning uchun
 * modul o'shandan chiqariladi — bitta jadval hammasini qamraydi.
 *
 * Ro'yxatda yo'q ruxsat hech qaysi modulga bog'lanmagan, ya'ni u
 * har doim ishlaydi (bemorlar, qabullar, to'lovlar — bularsiz
 * klinika umuman yo'q).
 */
const MODULE_BY_PERMISSION: Record<string, ClinicModule> = {
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

/** Shu ruxsatga tegishli modul o'chirilganmi */
export function isPermissionBlocked(
  permission: string,
  disabledModules: readonly string[],
): boolean {
  if (disabledModules.length === 0) return false
  const module = MODULE_BY_PERMISSION[permission]
  return module !== undefined && disabledModules.includes(module)
}

/**
 * Klinika turiga mos boshlang'ich to'plam.
 *
 * Bu FAQAT boshlang'ich qiymat: platforma egasi keyin har bir
 * modulni alohida yoqib-o'chira oladi. Tur yozuvda saqlanmaydi —
 * u shunchaki "hammasini qo'lda belgilab chiqmaslik" uchun.
 */
export const CLINIC_KINDS = ['general', 'dental', 'eye', 'lab'] as const
export type ClinicKind = (typeof CLINIC_KINDS)[number]

export const DISABLED_BY_KIND: Record<ClinicKind, ClinicModule[]> = {
  // To'liq davolash klinikasi — hammasi kerak
  general: [],
  // Stomatologiyada yotoq yo'q
  dental: ['ward'],
  // Ko'z klinikasi: operatsiya ambulator, yotqizish yo'q
  eye: ['ward'],
  /*
    Laboratoriyada shifokor qabuli ham, yotoq ham yo'q — u tahlil
    oladi va natija beradi. Davomat va rag'bat tizimi ham odatda
    ortiqcha.
  */
  lab: ['ward', 'attendance', 'analytics'],
}

/**
 * QO'LLAB-QUVVATLASH DARAJASI — tarifning bir qismi, lekin MODUL EMAS.
 *
 * Modul "mahsulotda bu bo'lim bormi" degan savolga javob beradi va uni
 * yoqib-o'chirish mumkin. Qo'llab-quvvatlash esa yoqiladigan narsa
 * emas: u xizmat majburiyati va uchta darajada bo'ladi. Shuning uchun
 * `features` ro'yxatiga qo'shilmaydi \u2014 aks holda "o'chirilgan
 * qo'llab-quvvatlash" degan ma'nosiz holat paydo bo'lardi.
 */
export const SUPPORT_LEVELS = ['queue', 'fast', 'manager'] as const
export type SupportLevel = (typeof SUPPORT_LEVELS)[number]
