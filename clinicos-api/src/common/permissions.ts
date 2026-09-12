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
  /* Qarzdorlik — to'lovlardan ALOHIDA ruxsat: ilgari ikkalasi
     `payments.view` da edi va qarzdorlikni tarifdan chiqarib
     bo'lmasdi — uni o'chirsak to'lovlar ham yopilardi.
     IZOHDA BO'SH QATOR BO'LMASIN: `check:permissions` ro'yxatni
     birinchi bo'sh qatorgacha o'qiydi. */
  | 'debts.view'
  | 'debts.waive'
  | 'revenue.view'
  | 'analytics.view'
  /* Ma'lumot almashish — Excel va Google Sheets. Bo'limni KO'RISH
     huquqi uni faylga aylantirish huquqini bermaydi: eksport butun
     bazani bir bosishda tashqariga chiqaradi, import esa bazaga
     yozadi. Shuning uchun ikkalasi alohida va egasi ularni xodimga
     birma-bir beradi. `patients.message` — bemorlarga umumiy xabar.
     IZOHDA BO'SH QATOR BO'LMASIN: `check:permissions` ro'yxatni
     birinchi bo'sh qatorgacha o'qiydi. */
  | 'data.export'
  | 'data.import'
  | 'patients.message'
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
  /* Apteka — klinika ichidagi alohida biznes: o'z tovari, o'z
     kassasi, o'z hisoboti. `sell` kassada ishlash uchun, `manage`
     esa katalog, kirim va narxlar uchun.
     IZOHDA BO'SH QATOR BO'LMASIN: `check:permissions` ro'yxatni
     birinchi bo'sh qatorgacha o'qiydi. */
  | 'pharmacy.view'
  | 'pharmacy.sell'
  | 'pharmacy.manage'
  | 'pharmacy.shift'
  | 'pharmacy.receive'
  | 'pharmacy.analytics'
  | 'pharmacy.cashcontrol'
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
  'data.export',
  'data.import',
  'patients.message',
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
  'debts.view',
  /*
    Qaytarish FAQAT egasida.

    Registratorda ATAYLAB yo'q: pulni olgan odam uni o'zi
    "qaytardim" deb yozib, naqd kamomadni yopib qo'yishi mumkin
    bo'lardi. Xato bo'lsa registrator egasiga aytadi.

    Pul yozuvi baribir o'zgarmaydi — qaytarish YANGI yozuv
    bo'lib qo'shiladi, eskisi joyida qoladi.
  */
  'payments.refund',
  /*
    Qarzni kechirish ham FAQAT egasida.

    Registratorda ATAYLAB yo'q: pulni oladigan odam qarzni ham yopa
    olsa, bemordan pulni olib, tizimda "kechirdim" deb yozib qo'yishi
    mumkin bo'lardi — qarz ham yo'q, pul ham yo'q.

    Qarzning o'zi o'chmaydi: kechirish alohida yozuv bo'lib qo'shiladi,
    kim va qachon qilgani ko'rinadi.
  */
  'debts.waive',
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
  /*
    APTEKA RUXSATLARI BU YERDA YO'Q va bu ataylab.

    Apteka alohida tizim, unga alohida hisob bilan kiriladi
    (`PHARMACIST_PERMISSIONS`). Klinika egasi aptekani ham
    yuritsa, unga farmatsevt hisobi ochiladi.
  */
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
  'debts.view',
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

/**
 * FARMATSEVT — faqat apteka.
 *
 * Bemorlar, qabullar, tashxislar va klinika moliyasi UMUMAN yo'q:
 * u boshqa biznesda ishlaydi. `settings.view` — o'z profili uchun.
 */
export const PHARMACIST_PERMISSIONS: readonly Permission[] = [
  'pharmacy.view',
  'pharmacy.sell',
  /* Kun oxirida kassani sanab topshiradi */
  'pharmacy.shift',
  /*
    `pharmacy.manage`, `pharmacy.analytics` va
    `pharmacy.cashcontrol` ATAYLAB YO'Q. Narxni qo'yadigan odam
    pulni ham yig'adigan bo'lsa, farqni o'ziga yozib olish yo'li
    ochilardi; solishtiruv hisoboti esa uning O'Z ishining
    tekshiruvi — uni ko'rib turgan odam farqni yopishni o'rganib
    oladi. Klinikada registrator ham xuddi shu sababdan
    `cashcontrol.view` ni ko'rmaydi.
  */
  'settings.view',
] as const

/**
 * APTEKA RAHBARI — sotmaydi, solishtiradi.
 *
 * `pharmacy.sell` unda yo'q, xuddi klinika egasida
 * `payments.create` yo'qligi kabi.
 */
export const PHARMACY_OWNER_PERMISSIONS: readonly Permission[] = [
  'data.export',
  'pharmacy.view',
  'pharmacy.manage',
  'pharmacy.receive',
  'pharmacy.analytics',
  'pharmacy.cashcontrol',
  'settings.view',
] as const

export const DOCTOR_PERMISSIONS: readonly Permission[] = [
  'patients.message',
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
  'data.export',
  'platform.view',
  'platform.manage',
  'platform.impersonate',
  'settings.view',
] as const

/**
 * PLATFORMA EGASI KLINIKA PANELIGA KIRGANDA.
 *
 * Faqat KO'RISH. Bu ro'yxatda birorta ham `create`, `edit`,
 * `manage` yoki `delete` yo'q — va qo'shilmasligi kerak.
 *
 * NEGA: platforma xodimi mijoz klinikasining ishchisi emas.
 * U yordam berish yoki muammoni tekshirish uchun kiradi, ish
 * qilish uchun emas. Yozish imkoni bo'lsa, klinikadagi har bir
 * yozuvning "kim qilgani" savoli chalkashadi — egasi o'z
 * xodimini ayblab, aslida platforma xodimi tegan bo'lib chiqadi.
 *
 * `chat.use` ham YO'Q: u xabar yozish demak, ya'ni platforma
 * xodimi klinika xodimi nomidan gapirgan bo'lardi.
 *
 * Platforma ruxsatlari (`platform.*`) ham berilmaydi — kirgan
 * odam o'sha payt klinika ichida, platforma panelida emas.
 *
 * Har bir ochilgan tibbiy yozuv audit jurnalida qoladi
 * (`audit.service.ts`), va `meta` da kirish yozuvining id'si
 * bo'ladi — ya'ni bu klinika xodimi emasligi ko'rinib turadi.
 */
export const IMPERSONATION_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.viewMedical',
  'appointments.view',
  'calendar.view',
  'doctors.view',
  'services.view',
  'payments.view',
  'debts.view',
  'visits.view',
  'ward.view',
  'staff.view',
  'attendance.view',
  'feedback.view',
  'cashcontrol.view',
  'revenue.view',
  'analytics.view',
  'settings.view',
] as const

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  SUPERADMIN: SUPERADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
  RECEPTIONIST: RECEPTIONIST_PERMISSIONS,
  DOCTOR: DOCTOR_PERMISSIONS,
  PHARMACIST: PHARMACIST_PERMISSIONS,
  PHARMACY_OWNER: PHARMACY_OWNER_PERMISSIONS,
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

/**
 * EGASI XODIMGA BERA OLADIGAN RUXSATLAR.
 *
 * Ro'yxat QISQA va ataylab shunday: bu yerga `payments.refund` yoki
 * `debts.waive` qo'shilsa, egasi bilmasdan pulga tegadigan huquqni
 * berib yuborishi mumkin bo'lardi — ular rol bilan keladi va rol
 * o'zgartirish alohida qaror.
 *
 * Bular esa ish qurollari: hisobotni Excel'ga chiqarish, bazani
 * ko'chirish va bemorlarga xabar yuborish. Ularning har biri
 * xavfli bo'lgani uchun rolga qo'shilmagan, lekin kerak bo'lganda
 * bitta xodimga berilishi mumkin.
 */
export const GRANTABLE_PERMISSIONS = [
  'data.export',
  'data.import',
  'patients.message',
] as const satisfies readonly Permission[]
