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
  'prescriptions',
  /* Bemorlarga umumiy xabar — kundalik ishga majburiy emas */
  'messages',
  /* Excel'ga chiqarish va ko'chirish */
  'dataexchange',
  'chat',
  'feedback',
  'analytics',
  'attendance',
  'cashcontrol',
  'calendar',
  'debts',
  'revenue',
  /* Kirim-chiqim: xarajatlar va bemor to'lovidan tashqari kirim */
  'finance',
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
const MODULE_BY_PERMISSION: Record<string, string> = {
  /* --- Asosiy bo'limlar --- */
  'dashboard.view': 'dashboard',
  'patients.view': 'patients',
  'patients.create': 'patients',
  'patients.edit': 'patients',
  'patients.delete': 'patients',
  'patients.viewMedical': 'patients',
  'appointments.view': 'appointments',
  'appointments.create': 'appointments',
  'appointments.edit': 'appointments',
  'appointments.cancel': 'appointments',
  'visits.view': 'visits',
  'visits.create': 'visits',
  'doctors.view': 'doctors',
  'doctors.manage': 'doctors',
  'services.view': 'services',
  'services.manage': 'services',
  'payments.view': 'payments',
  'payments.create': 'payments',
  'payments.refund': 'payments',
  'staff.view': 'staff',
  'staff.manage': 'staff',
  'settings.view': 'settings',
  'settings.manage': 'settings',
  'users.manage': 'settings',
  /* --- Apteka bo'limlari --- */
  'pharmacy.view': 'pharmacy',
  'pharmacy.sell': 'pharmacypos',
  'pharmacy.manage': 'pharmacycatalog',
  'pharmacy.receive': 'pharmacypurchases',
  'pharmacy.shift': 'pharmacyshift',
  'pharmacy.analytics': 'pharmacyanalytics',
  'pharmacy.cashcontrol': 'pharmacycash',
  'prescriptions.manage': 'prescriptions',
  'patients.message': 'messages',
  'data.export': 'dataexchange',
  'data.import': 'dataexchange',
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
  'finance.view': 'finance',
  'finance.create': 'finance',
  'finance.void': 'finance',
}

/**
 * ASOSIY BO'LIMLAR — sotiladigan "imkoniyat" emas, klinikaning o'zi.
 *
 * Tarifda ham, klinika sozlamasida (`disabledModules`) ham ular
 * YO'Q: tarif "bemorlar bo'limi bor" deb sotmaydi. Lekin platforma
 * admini ularni ham CHEKLOV bilan yopa oladi ("texnik ishlar",
 * "to'lov kechikdi") — admin paneli tizimdagi HAR BIR funksiyani
 * boshqarishi kerak, bittasi ham chetda qolmasligi kerak.
 */
export const CORE_MODULES = [
  'dashboard',
  'patients',
  'appointments',
  'visits',
  'doctors',
  'services',
  'payments',
  'staff',
  'settings',
] as const

/** Apteka bo'limlari — apteka hisobidagi har bir ish joyi */
export const PHARMACY_MODULES = [
  'pharmacy',
  'pharmacypos',
  'pharmacycatalog',
  'pharmacypurchases',
  'pharmacyshift',
  'pharmacyanalytics',
  'pharmacycash',
] as const

/**
 * CHEKLOV QO'YISH MUMKIN BO'LGAN HAMMA BO'LIM.
 *
 * Har bir ruxsat shu ro'yxatdagi biror bo'limga tegishli
 * (`MODULE_BY_PERMISSION`) — ya'ni tizimda cheklab bo'lmaydigan
 * funksiya qolmaydi. Platformaning o'z ruxsatlari (`platform.*`)
 * bundan tashqarida: admin o'z panelini yopib qo'ya olmasligi kerak.
 */
export const RESTRICTABLE_MODULES = [
  ...CORE_MODULES,
  ...CLINIC_MODULES,
  ...PHARMACY_MODULES,
] as const

export type RestrictableModule = (typeof RESTRICTABLE_MODULES)[number]

/** Ruxsat qaysi bo'limga tegishli — `undefined` faqat platforma ruxsatlarida */
export function moduleOf(permission: string): string | undefined {
  return MODULE_BY_PERMISSION[permission]
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
 * SINOV MUDDATIDA YOPIQ TURADIGAN BO'LIMLAR.
 *
 * 14 kunlik bepul versiya KUNDALIK ISHNI to'liq ko'rsatadi:
 * bemorlar, qabullar, tashriflar, to'lovlar, xizmatlar,
 * shifokorlar, xodimlar, davomat, izohlar, chat va qarzlar —
 * ya'ni klinika ertaga ishlashni boshlay oladi.
 *
 * YOPIQ QOLADIGANI — RAHBAR QATLAMI: tushum, tahlil va kassa
 * solishtiruvi, shuningdek statsionar. Bular "o'lchash va
 * nazorat" qismi, ya'ni mahsulot nima uchun pul olishi.
 * Sinovda hamma narsa ochiq bo'lsa, to'lash uchun sabab
 * qolmaydi; kundalik ish yopiq bo'lsa esa sinovdan umuman
 * ma'no chiqmaydi.
 *
 * Platforma admini har bir klinikada buni qo'lda o'zgartira
 * oladi — bu boshlang'ich to'plam, qat'iy qoida emas.
 */
export const TRIAL_DISABLED_MODULES: ClinicModule[] = [
  'revenue',
  'analytics',
  'cashcontrol',
  'ward',
]

/**
 * APTEKA SINOVIDA YOPIQLAR — rahbar qatlami: tahlil va kassa
 * solishtiruvi. Kassa, katalog va tovar qabul qilish ochiq —
 * apteka ertasiga savdoni boshlay olishi kerak.
 */
export const PHARMACY_TRIAL_DISABLED_MODULES: string[] = ['pharmacyanalytics', 'pharmacycash']

/** Yo'nalish uchun sinovda yopiqlarning SUKUT to'plami (bazada shart bo'lmasa) */
export function defaultTrialClosed(direction: string): string[] {
  return direction === 'pharmacy'
    ? [...PHARMACY_TRIAL_DISABLED_MODULES]
    : [...TRIAL_DISABLED_MODULES]
}

/** Sinov necha kun davom etadi */
export const TRIAL_DAYS = 14

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
