/**
 * ClinicOS — ma'lumot modellari.
 *
 * Bu fayl frontend va backend o'rtasidagi shartnoma. Backend JSON'i shu
 * tiplarga mos kelishi kerak — to'liq tavsif `docs/API.md` va `docs/DATABASE.md`da.
 *
 * MULTI-TENANCY: har bir yozuvda `clinicId` bor. Server HAR BIR so'rovda
 * sessiyadagi klinika bo'yicha filtrlashi shart — mijoz tomonidan kelgan
 * `clinicId`ga hech qachon ishonmang.
 */

/* ------------------------------------------------------------------ */
/* Asosiy tiplar                                                       */
/* ------------------------------------------------------------------ */

/** ISO 8601 sana-vaqt, masalan "2026-09-01T09:30:00.000Z" */
export type ISODateTime = string
/** ISO sana, masalan "2026-09-01" */
export type ISODate = string
/** "HH:mm", masalan "09:30" */
export type TimeString = string
/** Pul — so'mda, butun son. Frontend hech qachon float ishlatmaydi. */
export type UZS = number

export type ID = string

/* ------------------------------------------------------------------ */
/* Rollar va ruxsatlar                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rollar.
 *
 * `superadmin` — platforma egasi (ClinicOS ning o'zi). U klinika
 * ICHIDAGI rol EMAS: alohida panelda ishlaydi va bemor ma'lumotlarini
 * ko'rmaydi. Shuning uchun uning ruxsatlari ham alohida ro'yxatda.
 */
export type Role = 'superadmin' | 'owner' | 'receptionist' | 'doctor'

/**
 * Alohida ruxsatlar. Rol → ruxsatlar xaritasi `src/lib/permissions.ts`da.
 * Egasi ayrim ruxsatlarni qo'lda berishi mumkin (masalan, registraturaga
 * moliyaviy hisobotlarni ochish).
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
  /* --- Statsionar --- */
  | 'ward.view'
  | 'ward.manage'
  /* --- Xodimlar --- */
  | 'staff.view'
  | 'staff.manage'
  /* --- Davomat va bonus --- */
  | 'attendance.view'
  | 'attendance.manage'
  | 'bonus.manage'
  /* --- Izohlar --- */
  | 'feedback.view'
  | 'feedback.manage'
  /* --- Chat --- */
  | 'chat.use'
  /* --- Kassa nazorati (faqat egasi) --- */
  | 'cashcontrol.view'
  /* --- Smena yopish (administratsiya) --- */
  | 'shift.close'
  /* --- Platforma (super admin) --- */
  /**
   * Bu ruxsatlar KLINIKA ichidagi rollarga hech qachon berilmaydi.
   * Ular boshqa ma'lumot ustida ishlaydi: klinikalar, tariflar,
   * obunalar. Bemor ma'lumotiga umuman tegmaydi.
   */
  | 'platform.view'
  | 'platform.manage'
  /** Klinika paneliga yordam uchun kirish — alohida ruxsat */
  | 'platform.impersonate'

/* ------------------------------------------------------------------ */
/* Platforma (super admin paneli)                                      */
/* ------------------------------------------------------------------ */

/**
 * Tarifda ochiladigan imkoniyatlar.
 *
 * Bular klinika panelidagi butun bo'limlarga mos keladi: tarif
 * pasaytirilsa, o'sha bo'lim yopiladi. Shuning uchun ro'yxat qisqa
 * va aniq — har biri sotilishi mumkin bo'lgan qiymat.
 */
export type PlanFeature =
  /** Statsionar: xonalar, koykalar, yotqizish */
  | 'ward'
  /** Tahlil va prognoz */
  | 'analytics'
  /** Kassa nazorati — kutilgan va olingan pulni solishtirish */
  | 'cashControl'
  /** Xodimlar: davomat, reyting, bonus, jarima */
  | 'staff'
  /** Ichki chat */
  | 'chat'
  /** Tashqi tizimlar uchun API */
  | 'api'

export type PlanTier = 'starter' | 'standard' | 'premium'

/** Cheksiz chegara — sonli maydonlarda shu qiymat ishlatiladi */
export const UNLIMITED = -1

export interface Plan {
  id: ID
  tier: PlanTier
  name: string
  /** Oylik narx */
  pricePerMonth: UZS
  /**
   * Chegaralar. `UNLIMITED` (-1) — cheklanmagan.
   *
   * Chegaradan oshgan klinika ishlashda davom etadi, lekin panelda
   * ogohlantirish chiqadi. Ishni to'xtatib qo'yish — klinikaning
   * bemorlariga zarar, biznesga esa foyda emas.
   */
  limits: {
    doctors: number
    staff: number
  }
  features: PlanFeature[]
  isActive: boolean
  createdAt: ISODateTime
}

/**
 * Klinikaning platformadagi holati.
 *
 *   'trial'     — sinov muddati, hali to'lamagan
 *   'active'    — to'lovda, hammasi ochiq
 *   'past_due'  — to'lov muddati o'tgan, lekin hali ishlayapti
 *   'suspended' — kirish yopilgan (ma'lumot saqlanadi)
 *   'cancelled' — mijoz ketgan
 */
export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'

/** Klinikaning haqiqiy foydalanishi — tarif chegarasi bilan solishtiriladi */
export interface TenantUsage {
  doctors: number
  staff: number
  patients: number
  users: number
  appointmentsThisMonth: number
}

/**
 * KLINIKA — platforma nuqtai nazaridan.
 *
 * MUHIM: bu yerda BEMOR ma'lumoti yo'q va bo'lmasligi ham kerak.
 * Platforma egasi klinikalar bilan ishlaydi, ularning bemorlari
 * bilan emas. Sonlar (nechta bemor) — ha; ismlar — yo'q.
 */
export interface Tenant {
  /** Klinika id'si — `Clinic.id` bilan bir xil */
  id: ID
  name: string
  logoUrl: string | null
  city: string
  phone: string
  /* --- Kim ro'yxatdan o'tgan --- */
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  /* --- Obuna --- */
  status: TenantStatus
  planId: ID
  planName: string
  pricePerMonth: UZS
  /** Sinov muddati tugash sanasi. `null` — sinovda emas. */
  trialEndsAt: ISODate | null
  /** Birinchi to'lov sanasi. `null` — hali to'lamagan. */
  subscribedAt: ISODate | null
  /** Keyingi hisob sanasi */
  nextInvoiceAt: ISODate | null
  /** To'xtatilgan bo'lsa — sababi */
  suspendReason: string
  usage: TenantUsage
  /** Oxirgi marta tizimga kirilgan payt */
  lastActiveAt: ISODateTime | null
  createdAt: ISODateTime
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue'

export interface TenantInvoice {
  id: ID
  tenantId: ID
  tenantName: string
  /** Qaysi oy uchun: "2026-09" */
  period: string
  planName: string
  amount: UZS
  status: InvoiceStatus
  issuedAt: ISODate
  dueAt: ISODate
  paidAt: ISODateTime | null
}

/**
 * Klinika paneliga kirish yozuvi.
 *
 * NEGA QAYD ETILADI: platforma egasi yordam berish uchun klinika
 * paneliga kira oladi — bu kuchli imkoniyat. Har bir kirish sabab
 * bilan yozib qo'yiladi va klinika egasi uni ko'ra oladi.
 * Yozuvsiz bunday imkoniyat ishonchni buzadi.
 */
export interface ImpersonationLog {
  id: ID
  tenantId: ID
  tenantName: string
  adminName: string
  reason: string
  startedAt: ISODateTime
  endedAt: ISODateTime | null
  /**
   * Kirish uchun QISQA MUDDATLI token (30 daqiqa).
   *
   * Faqat kirish so'rovining javobida keladi; jurnal ro'yxatida
   * bu maydon bo'lmaydi. Shu token bilan yuborilgan so'rovlar
   * o'sha klinikaga qaraydi va faqat ko'rish ruxsatiga ega.
   */
  token?: string
}

/**
 * Klinikadagi shifokor — platforma ro'yxati uchun.
 *
 * NEGA KONTAKT BOR: klinikalar tarmog'ini qurishda shifokorlar
 * bilan bevosita ishlash kerak bo'ladi. Bu ish kontakti —
 * klinikaning xodimi haqidagi ma'lumot, bemor ma'lumoti emas.
 */
export interface TenantDoctor {
  id: ID
  tenantId: ID
  tenantName: string
  fullName: string
  specialty: string
  phone: string
  email: string
  status: DoctorStatus
  /** Oxirgi 30 kunda yakunlangan qabullar */
  completedLast30d: number

  /* --- Maosh --- */
  /**
   * Shifokor shu oyda qancha olgani: maosh + foiz.
   *
   * NEGA PLATFORMAGA KERAK: klinikalar tarmog'ini qurishda bozordagi
   * maosh darajasini bilish shart — shifokorni taklif qilayotganda
   * qancha taklif qilish kerakligi shu raqamdan chiqadi.
   */
  monthlyPay: UZS
  payType: PayType
  /** Foizli modelda shifokorga tegadigan ulush, % */
  percentRate: number
  /** Bemorlar bahosi, 0-5. Ma'lumot yetarli bo'lmasa null. */
  rating: number | null
  hiredAt: ISODate
}

/**
 * Klinikaning bemori — platforma ro'yxati uchun.
 *
 * DIQQAT: bu yerda TIBBIY ma'lumot yo'q. Tashxis, davolash, tashrif
 * yozuvi — hech biri chiqmaydi va chiqmasligi kerak. Ko'rinadigan
 * narsa: kim, qachon kelgan, necha marta, qancha to'lagan.
 *
 * NEGA SHUNDAY: bu ro'yxatning maqsadi — klinika halol
 * ishlayotganini tekshirish (tashrif bor, puli yo'q kabi holatlar) va
 * xizmat sifatini baholash. Buning uchun tashxis kerak emas.
 */
export interface TenantPatient {
  id: ID
  tenantId: ID
  tenantName: string
  fullName: string
  phone: string
  gender: Gender
  /** Yosh — guruhlab filtrlash uchun */
  age: number
  /** Klinika joylashgan shahar */
  city: string
  /**
   * Asosiy murojaat sababi.
   *
   * Bu TASHXIS EMAS — shikoyat turkumi ("bosh og'rig'i", "profilaktik
   * ko'rik"). Tashxisni shifokor qo'yadi va u klinikada qoladi.
   */
  condition: string
  /** Ro'yxatga olingan sana */
  registeredAt: ISODate
  lastVisitAt: ISODate | null
  visitCount: number
  totalSpent: UZS
  /** Qaytib kelganmi — xizmat sifatining bilvosita o'lchovi */
  isReturning: boolean
}

/**
 * PLATFORMA XODIMI — ClinicOS jamoasidagi odam.
 *
 * Bu klinika xodimi EMAS. Bu sizning jamoangiz: sotuv menejeri,
 * yordam xizmati, buxgalter.
 *
 * NEGA ALOHIDA RUXSATLAR: platformadagi ma'lumotlarning og'irligi
 * bir xil emas. Sotuv menejeriga klinikalar ro'yxati kerak, lekin
 * bemorlar ro'yxati kerak emas. Hammaga hamma narsani berish —
 * eng oson va eng xavfli yo'l.
 */
export interface PlatformMember {
  id: ID
  fullName: string
  email: string
  phone: string
  /** Lavozim — erkin matn, tashkilotga qarab */
  position: string
  /** Berilgan ruxsatlar */
  permissions: PlatformPermission[]
  isActive: boolean
  lastActiveAt: ISODateTime | null
  createdAt: ISODateTime
}

/**
 * Platforma ichidagi ruxsatlar.
 *
 * Ataylab mayda bo'laklarga bo'lingan — ayniqsa `registry.patients`:
 * u eng nozik ma'lumot va uni faqat kerak bo'lgan odamga berish
 * kerak.
 */
export type PlatformPermission =
  /** Klinikalar ro'yxati va kartasi */
  | 'clinics.view'
  /** Tarif o'zgartirish, to'xtatish/yoqish */
  | 'clinics.manage'
  /** Hisoblar va to'lovlar */
  | 'billing.view'
  /** Hisobni to'langan deb belgilash */
  | 'billing.manage'
  /** Jamlangan bozor ma'lumoti */
  | 'data.view'
  /** Shifokorlar ro'yxati (kontaktlari bilan) */
  | 'registry.doctors'
  /** Bemorlar ro'yxati — eng nozik ruxsat */
  | 'registry.patients'
  /** Klinika paneliga yordam uchun kirish */
  | 'clinics.impersonate'
  /** Jamoani boshqarish — xodim qo'shish va ruxsat berish */
  | 'team.manage'

/**
 * PLATFORMA MA'LUMOT BAZASI — jamlangan bozor ko'rsatkichlari.
 *
 * NEGA BU MUHIM: klinikalar ClinicOS da ishlagani sari platformada
 * butun mamlakat bo'ylab tibbiy bozor manzarasi to'planadi — qaysi
 * hududda qanday xizmat talab qilinadi, narxlar qanday, mavsumiylik
 * qanday. Bunday ma'lumot bozorda yo'q va u vaqt o'tishi bilan
 * qimmatlashib boradi.
 *
 * SHAXSIY MA'LUMOT YO'Q VA BO'LMAYDI. Bu yerdagi har bir raqam —
 * yig'indi yoki ulush. Bemor ismi, telefoni, tashxisi platformadan
 * chiqmaydi; ular klinikaning o'zida qoladi.
 *
 * DASTURCHIGA: server bu ma'lumotni HISOBLANGAN holda qaytarishi
 * kerak. Xom yozuvlarni platformaga uzatish — na texnik, na
 * huquqiy jihatdan to'g'ri.
 */
export interface PlatformDataStats {
  /** Bazadagi umumiy hajm */
  totals: {
    clinics: number
    patients: number
    doctors: number
    /** Butun tarix bo'yicha qabullar */
    appointments: number
    /** Ma'lumot yig'ila boshlagan sana */
    since: ISODate
  }

  /** Baza oylar bo'yicha qanday o'sgani */
  growth: { period: string; patients: number; appointments: number }[]

  /** Hududlar kesimi */
  byCity: {
    city: string
    clinics: number
    patients: number
    /** Shu hududdagi o'rtacha chek */
    avgCheck: UZS
  }[]

  /**
   * Eng ko'p talab qilinadigan xizmatlar.
   *
   * `priceMin`/`priceMax` — klinikalar orasidagi narx tarqoqligi.
   * Aynan shu raqam bozor uchun qimmatli: yangi klinika narxni
   * qayerga qo'yishini shu bilan biladi.
   */
  topServices: {
    key: string
    /** Barcha qabullardagi ulushi, % */
    share: number
    avgPrice: UZS
    priceMin: UZS
    priceMax: UZS
  }[]

  /** Mutaxassisliklar bo'yicha talab */
  bySpecialty: { key: string; share: number; changePct: number }[]

  /**
   * Bemorlar QANDAY MUAMMO bilan kelgani — jamlangan holda.
   *
   * Bu tashxis EMAS: bu yerda kimning nima bilan kasallangani yo'q.
   * Faqat butun bozor bo'yicha ulush: "murojaatlarning 14 foizi
   * qon bosimi bilan bog'liq".
   *
   * NEGA QIMMATLI: farmatsevtika, sug'urta va yangi klinika
   * ochmoqchi bo'lganlar uchun eng kerakli raqam shu — qayerda
   * qanday talab bor.
   */
  byCondition: {
    key: string
    /** Murojaatlardagi ulushi, % */
    share: number
    /** O'tgan yilga nisbatan o'zgarish */
    changePct: number
    /** Shu muammo bo'yicha o'rtacha necha marta kelinadi */
    avgVisits: number
  }[]

  /**
   * Mavsumiylik: oyning murojaat indeksi.
   * 100 = yillik o'rtacha. 130 = o'rtachadan 30% ko'p.
   */
  seasonality: { month: number; index: number }[]
}

/**
 * PLATFORMA ANALITIKASI — butun tarmoq bo'yicha.
 *
 * Bosh sahifa "bizning biznesimiz qanday" degan savolga javob beradi.
 * Bu esa boshqasiga: "klinikalarimiz qanday ishlayapti" — ular
 * qancha pul aylantirmoqda, qancha foyda qilmoqda, qaysi shifokorlar
 * ko'proq daromad keltirmoqda, odamlar nima bilan kelmoqda.
 *
 * NEGA MUHIM: bu bizning mijozlarimizning biznesi. U o'sib borsa,
 * bizning obunamiz ham o'sadi. Tushib ketsa — ular ketishidan
 * oldin bilishimiz kerak.
 */
export interface PlatformAnalytics {
  /** Klinikalar oyiga qancha pul aylantirmoqda */
  turnover: Metric

  /**
   * Taxminiy foyda: aylanma − oylik maosh fondi.
   *
   * TAXMINIY, chunki ijara, dori, kommunal xarajatlar tizimda
   * yo'q. Bu raqamni aniq foyda deb ko'rsatish — aldash bo'lardi,
   * shuning uchun nomida ham "taxminiy" so'zi turadi.
   */
  estimatedProfit: Metric

  /** Xarajatning aylanmadagi ulushi, % */
  payrollShare: number

  /** Platformaning o'z daromadi — obunalardan */
  ourRevenue: Metric

  /**
   * Bizning ulushimiz: obuna / klinikalar aylanmasi.
   *
   * Eng muhim strategik raqam: mijoz bizga o'z aylanmasining necha
   * foizini beradi. Past bo'lsa — narxni ko'tarish mumkin.
   */
  takeRate: number

  /** Oylar bo'yicha — grafik uchun */
  history: { period: string; turnover: UZS; profit: UZS; ourRevenue: UZS }[]

  /** Eng ko'p aylanma qiladigan klinikalar */
  topClinics: {
    tenantId: ID
    name: string
    city: string
    planName: string
    turnover: UZS
    profit: UZS
    patients: number
    /** Bir bemordan o'rtacha tushum */
    perPatient: UZS
  }[]

  /** Eng ko'p daromad keltiradigan shifokorlar */
  topDoctors: {
    id: ID
    fullName: string
    tenantName: string
    specialty: string
    revenue: UZS
    appointments: number
    rating: number | null
    /** Shu shifokor shu oyda qancha olgani */
    monthlyPay: UZS
  }[]

  /**
   * Eng yuqori maosh oladigan shifokorlar.
   *
   * Daromad reytingidan alohida: foizli shifokor ko'p daromad
   * keltirib, o'zi kam olishi mumkin. Tarmoq qurishda taklif
   * tayyorlash uchun aynan shu raqam kerak.
   */
  topPaid: {
    id: ID
    fullName: string
    tenantName: string
    specialty: string
    monthlyPay: UZS
    payType: PayType
    percentRate: number
    revenue: UZS
  }[]

  /** Bozordagi o'rtacha oylik */
  avgPay: UZS

  /** Eng ko'p uchraydigan murojaat sabablari */
  topConditions: { key: string; share: number; changePct: number }[]

  /** Mutaxassisliklar bo'yicha daromad */
  revenueBySpecialty: { key: string; revenue: UZS; share: number }[]
}

/** Platforma ko'rsatkichlari — super admin bosh sahifasi uchun */
export interface PlatformStats {
  tenants: {
    total: number
    trial: number
    active: number
    pastDue: number
    suspended: number
    cancelled: number
  }
  /** Oylik takrorlanuvchi daromad */
  mrr: Metric
  newThisMonth: Metric
  churnedThisMonth: Metric
  /** Ketganlar ulushi, % */
  churnRate: number
  /** Sinovdan to'lovga o'tganlar ulushi, % */
  trialConversionRate: number
  /** Tarif kesimida */
  byPlan: { planId: ID; planName: string; count: number; mrr: UZS }[]
  /** Oylar bo'yicha tarix — grafik uchun */
  history: { period: string; mrr: UZS; tenants: number }[]
  /** To'lanmagan hisoblar */
  overdue: { count: number; amount: UZS }
}

/* ------------------------------------------------------------------ */
/* Klinika (tenant)                                                    */
/* ------------------------------------------------------------------ */

export interface WorkingHours {
  /** 0 = yakshanba … 6 = shanba */
  weekday: number
  open: TimeString
  close: TimeString
  isClosed: boolean
}

export interface Clinic {
  id: ID
  name: string
  logoUrl: string | null
  phone: string
  address: string
  workingHours: WorkingHours[]
  /** Qabul uchun standart oraliq, daqiqada */
  slotMinutes: number
  currency: 'UZS'
  timezone: string
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Foydalanuvchi                                                       */
/* ------------------------------------------------------------------ */

export interface User {
  id: ID
  clinicId: ID
  fullName: string
  email: string
  phone: string
  role: Role
  avatarUrl: string | null
  /** Rol bo'yicha standartga QO'SHIMCHA berilgan ruxsatlar */
  extraPermissions: Permission[]
  isActive: boolean
  lastLoginAt: ISODateTime | null
  createdAt: ISODateTime
  /** Agar rol = doctor bo'lsa, shifokor profiliga bog'lanish */
  doctorId: ID | null
}

/** Kirgan foydalanuvchi sessiyasi. Parol yoki hash HECH QACHON bu yerda bo'lmaydi. */
export interface Session {
  user: User
  clinic: Clinic
  permissions: Permission[]
  /** Backend qo'shilganda — access token. Mock rejimda null. */
  token: string | null
}

/* ------------------------------------------------------------------ */
/* Shifokor                                                            */
/* ------------------------------------------------------------------ */

export type DoctorStatus = 'active' | 'on_leave' | 'inactive'

export interface Doctor {
  id: ID
  clinicId: ID
  fullName: string
  specialty: string
  phone: string
  email: string
  avatarUrl: string | null
  /** Qabul narxi — xizmatdan mustaqil bazaviy narx */
  consultationFee: UZS
  status: DoctorStatus
  /** Ish kunlari: 0 = yakshanba … 6 = shanba */
  workdays: number[]
  shiftStart: TimeString
  shiftEnd: TimeString
  hiredAt: ISODate
  createdAt: ISODateTime
}

/** Ro'yxat sahifasi uchun hisoblangan ko'rsatkichlar (backend qaytaradi) */
export interface DoctorStats {
  appointmentsToday: number
  patientsThisMonth: number
  revenueThisMonth: UZS
  completedThisMonth: number
  noShowRate: number
  averageCheck: UZS
}

export interface DoctorWithStats extends Doctor {
  stats: DoctorStats
}

/* ------------------------------------------------------------------ */
/* Bemor                                                               */
/* ------------------------------------------------------------------ */

export type Gender = 'male' | 'female'
export type PatientStatus = 'active' | 'inactive'

export interface Patient {
  id: ID
  clinicId: ID
  fullName: string
  phone: string
  birthDate: ISODate
  gender: Gender
  address: string
  /** Registratura izohi. Tibbiy ma'lumot EMAS. */
  notes: string
  status: PatientStatus
  /** Doimiy biriktirilgan shifokor (bo'lishi shart emas) */
  primaryDoctorId: ID | null
  createdAt: ISODateTime
}

/** Ro'yxat va profil uchun hisoblangan ko'rsatkichlar */
export interface PatientStats {
  visitCount: number
  lastVisitAt: ISODate | null
  totalSpent: UZS
  /** Birinchi tashrifidan keyin qaytganmi */
  isReturning: boolean
  nextFollowUpAt: ISODate | null
}

export interface PatientWithStats extends Patient {
  stats: PatientStats
}

/* ------------------------------------------------------------------ */
/* Xizmat                                                              */
/* ------------------------------------------------------------------ */

export type ServiceStatus = 'active' | 'archived'

/**
 * To'lov qachon olinadi.
 *
 *   'prepaid'  - xizmatdan OLDIN (UZI, tahlil, jarrohlik kabi)
 *   'postpaid' - ko'rikdan KEYIN (konsultatsiya, muolaja)
 *
 * Registratura shu belgiga qarab pulni qachon so'rashni biladi.
 */
export type PaymentTiming = 'prepaid' | 'postpaid'

/**
 * Sodiqlik chegirmasi.
 *
 * "5 tashrifdan keyin 10% chegirma" degani: bemor shu xizmatdan
 * 5 marta foydalangach, 6-martadan boshlab narx 10% arzon bo'ladi.
 */
export interface LoyaltyTier {
  /** Necha marta olgandan keyin */
  afterVisits: number
  /** Chegirma foizi, 1-100 */
  discountPct: number
}

export interface Service {
  id: ID
  clinicId: ID
  name: string
  category: string
  price: UZS
  /** Davomiyligi — daqiqada */
  durationMinutes: number
  /** To'lov xizmatdan oldin olinadimi yoki keyin */
  paymentTiming: PaymentTiming
  /**
   * Sodiqlik chegirmalari, tashriflar soni bo'yicha o'sib boradi.
   * Bo'sh massiv - chegirma yo'q.
   */
  loyaltyTiers: LoyaltyTier[]
  status: ServiceStatus
  createdAt: ISODateTime
}

/**
 * Bemor uchun amaldagi narx.
 *
 * Sodiqlik pog'onalari orasidan bemorning tashriflar soniga mos
 * keladigan ENG YUQORI chegirma tanlanadi.
 */
export function resolveServicePrice(
  service: Pick<Service, 'price' | 'loyaltyTiers'>,
  visitCount: number,
): { price: UZS; discountPct: number; basePrice: UZS } {
  const tier = [...service.loyaltyTiers]
    .filter((t) => visitCount >= t.afterVisits)
    .sort((a, b) => b.discountPct - a.discountPct)[0]

  const discountPct = tier?.discountPct ?? 0
  return {
    basePrice: service.price,
    discountPct,
    price: Math.round((service.price * (100 - discountPct)) / 100),
  }
}

/* ------------------------------------------------------------------ */
/* Qabul                                                               */
/* ------------------------------------------------------------------ */

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type AppointmentPaymentStatus = 'unpaid' | 'paid' | 'partial'

export interface Appointment {
  id: ID
  clinicId: ID
  patientId: ID
  doctorId: ID
  serviceId: ID
  /** Boshlanish vaqti (to'liq sana-vaqt) */
  startsAt: ISODateTime
  durationMinutes: number
  status: AppointmentStatus
  paymentStatus: AppointmentPaymentStatus
  notes: string
  /** Bemor kelgan vaqt — "checked_in"ga o'tganda yoziladi */
  checkedInAt: ISODateTime | null
  completedAt: ISODateTime | null
  cancelledAt: ISODateTime | null
  cancelReason: string | null
  createdBy: ID
  createdAt: ISODateTime
}

/** Ro'yxat/kalendar uchun bog'liq nomlar bilan (backend join qilib beradi) */
export interface AppointmentExpanded extends Appointment {
  patient: Pick<Patient, 'id' | 'fullName' | 'phone'>
  doctor: Pick<Doctor, 'id' | 'fullName' | 'specialty'>
  service: Pick<Service, 'id' | 'name' | 'price' | 'durationMinutes'>
}

/* ------------------------------------------------------------------ */
/* Tashrif (shifokor yozuvi) — MAXFIY TIBBIY MA'LUMOT                  */
/* ------------------------------------------------------------------ */

/**
 * MUHIM: bu maxfiy tibbiy ma'lumot.
 * Serverda `visits.view` ruxsati VA shifokorning shu bemorga aloqasi
 * tekshirilishi shart. Har bir o'qish AuditLog'ga yozilishi kerak.
 */
export interface Visit {
  id: ID
  clinicId: ID
  appointmentId: ID
  patientId: ID
  doctorId: ID
  visitedAt: ISODateTime
  /** Shikoyat / murojaat sababi */
  complaint: string
  diagnosis: string
  /** Davolash va tavsiyalar */
  treatment: string
  notes: string
  createdAt: ISODateTime
}

export interface VisitExpanded extends Visit {
  doctor: Pick<Doctor, 'id' | 'fullName' | 'specialty'>
  service: Pick<Service, 'id' | 'name'> | null
}

/* ------------------------------------------------------------------ */
/* Takroriy tashrif                                                    */
/* ------------------------------------------------------------------ */

export type FollowUpStatus = 'pending' | 'scheduled' | 'done' | 'missed'

export interface FollowUp {
  id: ID
  clinicId: ID
  patientId: ID
  doctorId: ID
  /** Qaysi tashrifdan keyin tavsiya qilingan */
  visitId: ID | null
  recommendedDate: ISODate
  reason: string
  status: FollowUpStatus
  /** Rejalashtirilgan bo'lsa — yangi qabul id'si */
  appointmentId: ID | null
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* To'lov                                                              */
/* ------------------------------------------------------------------ */

export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type PaymentStatus = 'paid' | 'pending' | 'refunded'

export interface Payment {
  id: ID
  clinicId: ID
  patientId: ID
  doctorId: ID
  serviceId: ID
  appointmentId: ID | null
  amount: UZS
  method: PaymentMethod
  status: PaymentStatus
  paidAt: ISODateTime
  notes: string
  createdBy: ID
  createdAt: ISODateTime
}

export interface PaymentExpanded extends Payment {
  patient: Pick<Patient, 'id' | 'fullName'>
  doctor: Pick<Doctor, 'id' | 'fullName'>
  service: Pick<Service, 'id' | 'name'>
}

/* ------------------------------------------------------------------ */
/* Bildirishnoma                                                       */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | 'appointments_today'
  | 'unconfirmed'
  | 'pending_payments'
  | 'follow_ups_due'
  | 'no_shows'

export interface AppNotification {
  id: ID
  clinicId: ID
  kind: NotificationKind
  /** i18n kaliti uchun son — matn frontendda tarjima qilinadi */
  count: number
  /** Bosilganda ochiladigan sahifa */
  href: string
  severity: 'info' | 'warn' | 'bad'
  createdAt: ISODateTime
  readAt: ISODateTime | null
}

/* ------------------------------------------------------------------ */
/* Audit jurnali                                                       */
/* ------------------------------------------------------------------ */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'view_medical'
  | 'export'

/**
 * Audit yozuvini FAQAT server yaratadi. Frontend uni ko'rsatishi mumkin,
 * lekin hech qachon yozmaydi.
 */
export interface AuditLog {
  id: ID
  clinicId: ID
  userId: ID
  action: AuditAction
  entityType: string
  entityId: ID | null
  meta: Record<string, unknown>
  ipAddress: string | null
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Analitika / hisobotlar                                              */
/* ------------------------------------------------------------------ */

/** Bir ko'rsatkich + o'tgan davrga nisbatan o'zgarish */
export interface Metric {
  value: number
  /** Foizda, masalan 12.4 yoki -2.1. Solishtirish imkoni bo'lmasa null. */
  changePct: number | null
}

export interface DashboardSummary {
  patientsToday: Metric
  revenueToday: Metric
  appointmentsToday: Metric
  /** Bugungi qabullardan hali bo'lmaganlari */
  appointmentsRemaining: number
  newPatients: Metric
  returningPatients: Metric
  noShows: Metric
}

export interface SeriesPoint {
  /** X o'qi belgisi: sana yoki soat */
  label: string
  value: number
}

export interface ClinicPerformance {
  patients: number
  revenue: UZS
  appointments: number
  averageCheck: UZS
  returningRate: number
  noShowRate: number
  /** Progress indikatorlari uchun maqsad qiymatlar */
  targets: {
    patients: number
    revenue: UZS
    appointments: number
    averageCheck: UZS
    returningRate: number
    noShowRate: number
  }
}

export interface RevenueBreakdownItem {
  id: ID
  label: string
  value: UZS
  /** Umumiy summadagi ulushi, 0–100 */
  sharePct: number
}

export interface RevenueReport {
  totalRevenue: UZS
  netRevenue: UZS
  transactions: number
  averageCheck: UZS
  overTime: SeriesPoint[]
  byDoctor: RevenueBreakdownItem[]
  byService: RevenueBreakdownItem[]
  byMethod: RevenueBreakdownItem[]
}

export interface AnalyticsReport {
  patientGrowth: SeriesPoint[]
  revenueGrowth: SeriesPoint[]
  appointmentsSeries: SeriesPoint[]
  retentionSeries: SeriesPoint[]
  newPatients: Metric
  returningPatients: Metric
  /** Rejalashtirilgan qabullardan nechtasi yakunlangani, % */
  conversionRate: Metric
  noShowRate: Metric
  averageCheck: Metric
  revenue: Metric
  revenuePerDoctor: RevenueBreakdownItem[]
  revenuePerService: RevenueBreakdownItem[]
}

/* ------------------------------------------------------------------ */
/* Ro'yxat so'rovlari                                                  */
/* ------------------------------------------------------------------ */

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type DateRangePreset = 'today' | '7d' | '30d' | 'year' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  from: ISODate
  to: ISODate
}

/* ------------------------------------------------------------------ */
/* Global qidiruv                                                      */
/* ------------------------------------------------------------------ */

export type SearchEntity = 'patient' | 'doctor' | 'service' | 'appointment'

export interface SearchHit {
  id: ID
  entity: SearchEntity
  title: string
  subtitle: string
  href: string
}

/**
 * Platforma qidiruvining turkumlari.
 *
 * Klinika paneli qidiruvidan ALOHIDA: u yerda bemor, shifokor,
 * xizmat va qabul qidiriladi; bu yerda esa klinikalar, ularning
 * shifokorlari va bemorlari.
 */
export type PlatformSearchScope = 'all' | 'clinic' | 'doctor' | 'patient'

export interface PlatformSearchHit {
  id: ID
  scope: Exclude<PlatformSearchScope, 'all'>
  title: string
  subtitle: string
  /** O'ng tomonda ko'rsatiladigan qo'shimcha ma'lumot */
  meta: string
  href: string
}

/* ================================================================== */
/* STATSIONAR (yotoq xona)                                            */
/* ================================================================== */

/** Xona toifasi. Har toifaning kunlik narxi boshqacha. */
export type RoomCategory = 'luxury' | 'standard' | 'general'

export type RoomStatus = 'active' | 'maintenance'

export interface Room {
  id: ID
  clinicId: ID
  /** Xona raqami: "204" */
  number: string
  floor: number
  category: RoomCategory
  /** Bir koyka uchun kunlik narx */
  dailyRate: UZS
  status: RoomStatus
  notes: string
  createdAt: ISODateTime
}

export type BedStatus = 'free' | 'occupied' | 'maintenance'

export interface Bed {
  id: ID
  clinicId: ID
  roomId: ID
  /** Koyka belgisi: "204-1" */
  label: string
  status: BedStatus
  createdAt: ISODateTime
}

export type AdmissionStatus = 'planned' | 'active' | 'discharged'

/**
 * Yotqizish — bemorning statsionarda yotgan davri.
 *
 * `dailyRate` ataylab NUSXA sifatida saqlanadi: xona narxi ertaga
 * o'zgarsa, o'tgan oyning hisoboti o'zgarib ketmasligi kerak.
 */
export interface Admission {
  id: ID
  clinicId: ID
  patientId: ID
  doctorId: ID
  roomId: ID
  bedId: ID
  admittedAt: ISODateTime
  /** Rejalashtirilgan chiqish sanasi */
  expectedDischargeAt: ISODate | null
  dischargedAt: ISODateTime | null
  status: AdmissionStatus
  diagnosis: string
  dailyRate: UZS
  notes: string
  createdBy: ID
  createdAt: ISODateTime
}

export interface AdmissionExpanded extends Admission {
  patient: Pick<Patient, 'id' | 'fullName' | 'phone'>
  doctor: Pick<Doctor, 'id' | 'fullName' | 'specialty'>
  room: Pick<Room, 'id' | 'number' | 'category' | 'dailyRate'>
  bed: Pick<Bed, 'id' | 'label'>
  /** Bugungi kunga qadar necha kun yotgani */
  daysStayed: number
  /** Yotgan kunlar uchun hisoblangan summa */
  accrued: UZS
}

/** Statsionar ko'rsatkichlari */
export interface WardStats {
  totalBeds: number
  occupiedBeds: number
  /** 0–100 */
  occupancyPct: Metric
  admittedToday: number
  dischargedToday: number
  /** O'rtacha yotish davomiyligi, kunda */
  averageStayDays: number
  revenue: Metric
  byCategory: {
    category: RoomCategory
    totalBeds: number
    occupiedBeds: number
    revenue: UZS
  }[]
  occupancySeries: SeriesPoint[]
}

/**
 * Shaxmatka qatori — bitta koyka va uning band davrlari.
 *
 * `fromIndex`/`toIndex` — so'ralgan sana oralig'idagi kun indekslari,
 * shuning uchun interfeys ularni to'g'ridan-to'g'ri katakcha kengligiga
 * aylantira oladi.
 */
export interface BedBoardSpan {
  admissionId: ID
  patientId: ID
  patientName: string
  doctorName: string
  status: AdmissionStatus
  fromIndex: number
  toIndex: number
  /** Oraliqdan oldin boshlangan / keyin tugaydigan davr */
  continuesBefore: boolean
  continuesAfter: boolean
}

export interface BedBoardRow {
  bed: Pick<Bed, 'id' | 'label' | 'status'>
  room: Pick<Room, 'id' | 'number' | 'category'>
  spans: BedBoardSpan[]
}

export interface BedBoard {
  /** Ustunlar — sanalar */
  days: ISODate[]
  rows: BedBoardRow[]
}

/* ================================================================== */
/* XODIMLAR                                                           */
/* ================================================================== */

/**
 * Lavozim. Shifokordan farrosh va qorovulgacha — klinikaning butun
 * shtatı shu yerda turadi.
 */
export type StaffPosition =
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'manager'
  | 'accountant'
  | 'lab_tech'
  | 'pharmacist'
  | 'cleaner'
  | 'security'
  | 'driver'
  | 'other'

export type StaffStatus = 'active' | 'on_leave' | 'fired'

/** To'lov modeli: oylik, foiz yoki ikkalasi */
export type PayType = 'salary' | 'percent' | 'salary_percent'

export interface Staff {
  id: ID
  clinicId: ID
  fullName: string
  phone: string
  email: string
  position: StaffPosition
  /** Lavozimning aniq nomi, masalan "Bosh hamshira" */
  positionTitle: string
  department: string

  /* --- Ish vaqti --- */
  /** Ish kunlari: 0 = yakshanba ... 6 = shanba */
  workdays: number[]
  shiftStart: TimeString
  shiftEnd: TimeString

  /**
   * Stavka - shartnoma bo'yicha ish hajmi.
   * 1 = to'liq stavka, 0.5 = yarim, 1.5 = bir yarim.
   * Maosh shunga ko'paytiriladi.
   */
  workRate: number

  /* --- To'lov modeli --- */
  /**
   * Xodim qanday to'lov oladi:
   *   'salary'         - faqat oylik maosh
   *   'percent'        - faqat foiz (o'zi keltirgan tushumdan)
   *   'salary_percent' - oylik + foiz (aralash)
   *
   * Foizli model O'zbekistonda keng tarqalgan: shifokor o'zi qabul
   * qilgan bemorlardan tushgan pulning ma'lum ulushini oladi.
   */
  payType: PayType
  /**
   * Xodimning tushumdagi ulushi, foizda.
   * 30 degani "30 / 70" - xodimga 30%, klinikaga 70%.
   */
  percentRate: number

  /** To'liq stavkadagi oylik maosh. Foizli modelda 0 bo'lishi mumkin. */
  salary: UZS

  hiredAt: ISODate
  status: StaffStatus
  /**
   * Tizimga kira oladimi.
   *
   * Buni FAQAT egasi sozlaydi. Farrosh yoki qorovulga login kerak emas —
   * ular shunchaki shtatda turadi. Kirish huquqi berilsa, `role` ham
   * belgilanishi shart.
   */
  hasSystemAccess: boolean
  role: Role | null
  /**
   * Login - tizimga kirish uchun. Odatda email.
   * Kirish huquqi berilganda majburiy.
   */
  login: string
  /**
   * Parol oxirgi marta qachon belgilangani.
   *
   * PAROLNING O'ZI HECH QAYERDA SAQLANMAYDI - na bu yerda, na frontendda.
   * Server uni bcrypt/argon2 bilan xeshlaydi. Egasi mavjud parolni
   * KO'RA OLMAYDI, faqat yangisini belgilay oladi.
   */
  credentialsSetAt: ISODateTime | null
  /** Birinchi kirishda parolni almashtirish talab qilinadimi */
  mustChangePassword: boolean

  /** position = 'doctor' bo'lsa, shifokor yozuviga bog'lanish */
  doctorId: ID | null
  avatarUrl: string | null
  notes: string
  createdAt: ISODateTime
}

/**
 * Oylik maosh - stavka hisobga olingan holda.
 * Faqat foizli modelda ishlaydiganlarda bu 0 bo'ladi.
 */
export function effectiveSalary(
  staff: Pick<Staff, 'salary' | 'workRate' | 'payType'>,
): UZS {
  if (staff.payType === 'percent') return 0
  return Math.round(staff.salary * staff.workRate)
}

/** Keltirilgan tushumdan xodimga tegadigan ulush */
export function percentEarnings(
  staff: Pick<Staff, 'payType' | 'percentRate'>,
  generatedRevenue: UZS,
): UZS {
  if (staff.payType === 'salary') return 0
  return Math.round((generatedRevenue * staff.percentRate) / 100)
}

/* ------------------------------------------------------------------ */
/* Davomat                                                             */
/* ------------------------------------------------------------------ */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'day_off'

/**
 * Kunlik davomat yozuvi.
 *
 * Bu farrosh, qorovul kabi xodimlar uchun YAGONA o'lchanadigan
 * ko'rsatkich - ularning reytingi shundan hisoblanadi.
 */
export interface Attendance {
  id: ID
  clinicId: ID
  staffId: ID
  date: ISODate
  status: AttendanceStatus
  checkInAt: ISODateTime | null
  checkOutAt: ISODateTime | null
  /**
   * Qo'lda kiritilgan kelish vaqti, masalan "09:20".
   * Kechikish shu vaqt va smena boshlanishi farqidan hisoblanadi.
   */
  arrivedAt: TimeString | null
  /** Kechikish, daqiqada */
  lateMinutes: number
  /** Haqiqatda ishlagan vaqt, daqiqada */
  workedMinutes: number
  note: string

  /* --- Kim, qachon belgiladi --- */
  /**
   * Davomatni belgilagan xodim. Yozuv egasiz qolmasligi kerak:
   * kelish vaqtini kim yozgani keyinchalik tekshirish uchun zarur.
   */
  markedBy: ID
  markedByName: string
  /** Yozuv tizimga qachon kiritilgani — kelish vaqtidan farqli */
  markedAt: ISODateTime

  /* --- Shubhali yozuv belgisi --- */
  /**
   * Kiritilgan kelish vaqti tizimga yozilgan paytdan sezilarli
   * darajada oldin bo'lsa, yozuv shubhali deb belgilanadi.
   *
   * NEGA: kelish vaqtini keyinchalik "orqaga surib" yozish —
   * kechikishni yashirishning eng oddiy yo'li. Tizim buni to'sib
   * qo'ymaydi (haqiqiy sabablar ham bo'ladi), lekin yashirmaydi ham:
   * yozuv klinika egasiga ogohlantirish bo'lib boradi.
   */
  flagged: boolean
  flagReason: string

  createdAt: ISODateTime
}

/** Egasiga ko'rsatiladigan shubhali davomat yozuvi */
export interface AttendanceFlag {
  id: ID
  staffId: ID
  staffName: string
  positionTitle: string
  date: ISODate
  arrivedAt: TimeString | null
  lateMinutes: number
  markedByName: string
  markedAt: ISODateTime
  reason: string
  /** Kelish vaqti bilan yozuv kiritilgan payt orasidagi farq, daqiqada */
  gapMinutes: number
}

/**
 * Kunlik davomat qatori — registratura har kuni shu ro'yxatni to'ldiradi.
 *
 * Har bir xodim uchun bitta qator: kim, qaysi lavozimda, ish kunimi va
 * bugungi holati. `status` null bo'lsa — hali belgilanmagan.
 */
export interface DailyAttendanceRow {
  staffId: ID
  fullName: string
  positionTitle: string
  department: string
  shiftStart: TimeString
  shiftEnd: TimeString
  /** Bugun bu xodimning ish kunimi */
  isWorkday: boolean
  status: AttendanceStatus | null
  /** Qo'lda kiritilgan kelish vaqti */
  arrivedAt: TimeString | null
  lateMinutes: number
  note: string
  /** Kelish vaqti shubhali yozilgan */
  flagged: boolean
}

export interface DailyAttendance {
  date: ISODate
  rows: DailyAttendanceRow[]
  counts: {
    /** Bugun ishlashi kerak bo'lganlar */
    expected: number
    present: number
    late: number
    absent: number
    excused: number
    /** Hali belgilanmaganlar — registratura shularni to'ldirishi kerak */
    unmarked: number
  }
}

/**
 * Bir kunning ish jadvalidagi holati.
 *
 * `planned` — CEO belgilagan ish kunimi (Staff.workdays).
 * `status`  — davomat belgilangan bo'lsa, uning natijasi.
 */
export interface WorkScheduleDay {
  date: ISODate
  planned: boolean
  status: AttendanceStatus | null
  lateMinutes: number
}

/**
 * Xodimning bir oylik ish jadvali.
 *
 * Xodim o'z profilida shuni ochib, qaysi kunlar ishlashini oldindan
 * ko'radi. Jadvalni faqat klinika egasi o'zgartiradi — xodim
 * tomonda bu faqat ko'rish uchun.
 */
export interface WorkSchedule {
  staffId: ID
  fullName: string
  positionTitle: string
  /** "2026-09" */
  month: string
  workdays: number[]
  shiftStart: TimeString
  shiftEnd: TimeString
  workRate: number
  days: WorkScheduleDay[]
  /** Shu oyda rejalashtirilgan ish kunlari soni */
  plannedDays: number
  /** Shu oyda haqiqatda ishlangan kunlar (kelgan yoki kechikkan) */
  workedDays: number
}

export interface AttendanceSummary {
  staffId: ID
  /** Qaysi oy: "2026-09" */
  period: string
  /** Ish kunlari soni */
  workdays: number
  present: number
  late: number
  absent: number
  excused: number
  totalLateMinutes: number
  /** Kelgan kunlar ulushi, 0-100 */
  attendancePct: number
  /** Intizom balli, 0-100. Kechikish va qatnashmaslik pasaytiradi. */
  disciplineScore: number
}

export interface AttendanceDay {
  date: ISODate
  status: AttendanceStatus
  lateMinutes: number
}

/* ------------------------------------------------------------------ */
/* Xodim ko'rsatkichlari va reytingi                                   */
/* ------------------------------------------------------------------ */

/** Reyting tarkibiy qismi - nimadan hisoblangani ko'rinib tursin */
export interface RatingFactor {
  /** i18n kaliti */
  labelKey: string
  /** 0-100 */
  score: number
  /** Umumiy balldagi ulushi, 0-1 */
  weight: number
  /** Ko'rsatiladigan xom qiymat, masalan "4.2%" */
  display: string
}

export interface StaffPerformance {
  staffId: ID
  /**
   * Reyting 0-5, ko'rsatkichlardan avtomatik hisoblanadi.
   * `null` - hech qanday ma'lumot yo'q (masalan yangi kelgan xodim).
   */
  rating: number | null
  factors: RatingFactor[]
  /**
   * Reja bajarilishi, %. Bonus qoidalari shunga qaraydi.
   * `null` - reja o'lchanmaydi.
   */
  performancePct: number | null
  /** Ko'rsatkichlar ro'yxati - profil kartasida ko'rsatiladi */
  metrics: { labelKey: string; value: string }[]
  /** Shu davrdagi bonuslar yig'indisi */
  bonusThisPeriod: UZS
  attendance: AttendanceSummary | null

  /* --- Daromad --- */
  /**
   * Xodim shu davrda klinikaga keltirgan tushum.
   * `null` - bu lavozimda tushumni xodimga bog'lab bo'lmaydi
   * (farrosh, qorovul va h.k.).
   */
  generatedRevenue: UZS | null
  /** Foizli modeldan tushgan daromad */
  percentEarnings: UZS
  /** Jami: maosh + foiz + bonus */
  totalEarnings: UZS
}

export interface StaffWithPerformance extends Staff {
  performance: StaffPerformance
}

/* ------------------------------------------------------------------ */
/* Bonus                                                               */
/* ------------------------------------------------------------------ */

export type BonusSource = 'manual' | 'suggested' | 'rule'
export type BonusStatus = 'planned' | 'approved' | 'paid'

/**
 * Shifokorning shaxsiy moliyasi — bir oy uchun.
 *
 * BU KLINIKA DAROMADI EMAS. Bu aynan shu shifokor qo'liga tegadigan
 * pul: maosh, foiz va bonuslar. Shifokor "men bu oyda qancha
 * ishladim" degan savolga o'zi javob olishi kerak — buxgalteriyaga
 * borib so'rash shart emas.
 *
 * KIM KO'RADI: shifokorning o'zi va klinika egasi. Registratura
 * ko'rmaydi.
 */
export interface DoctorEarnings {
  doctorId: ID
  /** "2026-09" */
  period: string

  /* --- Shartnoma --- */
  payType: PayType
  /** To'liq stavkadagi maosh */
  salary: UZS
  /** Stavka: 1 = to'liq, 0.5 = yarim */
  workRate: number
  /** Foizli modelda shifokorga tegadigan ulush, % */
  percentRate: number

  /* --- Shu oydagi hisob --- */
  /** Maosh × stavka */
  baseSalary: UZS
  /** Shifokor shu oyda klinikaga keltirgan tushum */
  generatedRevenue: UZS
  /** Tushumdan foiz bo'yicha tegadigan qism */
  percentEarnings: UZS
  bonuses: Bonus[]
  bonusTotal: UZS
  /** Jami: maosh + foiz + bonus */
  total: UZS

  /* --- Ish hajmi --- */
  completedAppointments: number
  averageCheck: UZS
}

export interface Bonus {
  id: ID
  clinicId: ID
  staffId: ID
  staffName: string
  /** Qaysi oy uchun: "2026-09" */
  period: string
  amount: UZS
  reason: string
  source: BonusSource
  /** Qoidadan kelib chiqqan bo'lsa - qoida id'si */
  ruleId: ID | null
  status: BonusStatus
  createdBy: ID
  createdAt: ISODateTime
  paidAt: ISODateTime | null
}

export type BonusRewardType = 'percent_of_salary' | 'fixed'

/**
 * Bonus qoidasi - egasi bir marta yozadi, tizim har oy qo'llaydi.
 *
 * Masalan: "Shifokorlar, samaradorlik 100% dan oshsa - maoshning 10%i".
 */
export interface BonusRule {
  id: ID
  clinicId: ID
  name: string
  /** Qaysi lavozimlarga tegishli. Bo'sh bo'lsa - hammaga. */
  positions: StaffPosition[]
  /** Samaradorlik shu foizdan oshsa qo'llanadi */
  minPerformance: number
  /** Reyting shu balldan yuqori bo'lsa qo'llanadi (0 = shart yo'q) */
  minRating: number
  rewardType: BonusRewardType
  /** Foiz yoki qat'iy summa */
  rewardValue: number
  isActive: boolean
  createdAt: ISODateTime
}

/* ------------------------------------------------------------------ */
/* Jarimalar                                                           */
/* ------------------------------------------------------------------ */

/**
 * Jarima sababi — tizim TEKSHIRA OLADIGAN holatlar.
 *
 * Ataylab qisqa ro'yxat: jarima avtomatik qo'llanadigan bo'lsa, uning
 * asosi ham avtomatik tekshiriladigan bo'lishi shart. "Yomon ishladi"
 * kabi sub'ektiv sabab bu yerda bo'lmaydi — aks holda tizim
 * odamning kayfiyatini rasmiylashtirgan bo'ladi.
 *
 *   'late'                 — har bir kechikkan kun
 *   'late_minutes'         — har 10 daqiqa kechikish
 *   'absent'               — sababsiz kelmagan kun
 *   'cash_shortfall'       — smena yopilganda kassada kamomad
 *   'backdated_attendance' — davomat vaqti orqaga surib yozilgan
 *   'discipline_below'     — intizom balli chegaradan past
 */
export type PenaltyTrigger =
  | 'late'
  | 'late_minutes'
  | 'absent'
  | 'cash_shortfall'
  | 'backdated_attendance'
  | 'discipline_below'

/** Jarima qanday hisoblanadi */
export type PenaltyAmountType =
  /** Qat'iy summa */
  | 'fixed'
  /** Kamomadning foizi (faqat `cash_shortfall` uchun ma'noli) */
  | 'percent_of_shortfall'
  /** Kunlik maoshning foizi */
  | 'percent_of_daily_salary'

/**
 * JARIMA QOIDASI — klinika egasi belgilaydigan "qonun".
 *
 * Qoida yozilgach, uni buzgan xodim avtomatik jarimaga tortiladi va
 * jarima o'z profilida ko'rinadi. Qo'lda hech kim hech kimga jarima
 * yozmaydi — shu bilan "boshliq xafa bo'ldi" degan omil yo'qoladi.
 */
export interface PenaltyRule {
  id: ID
  clinicId: ID
  name: string
  trigger: PenaltyTrigger
  /**
   * Chegara. Ma'nosi triggerga bog'liq:
   *   'discipline_below'  — intizom balli (masalan 70)
   *   'cash_shortfall'    — e'tiborsiz qoldiriladigan farq (so'm)
   *   'late'              — oyiga nechta kechikish kechiriladi
   * Qolganlarida 0.
   */
  threshold: number
  amountType: PenaltyAmountType
  /** Summa yoki foiz — `amountType` ga qarab */
  amountValue: number
  /** Qaysi lavozimlarga tegishli. Bo'sh bo'lsa — hammaga. */
  positions: StaffPosition[]
  isActive: boolean
  createdAt: ISODateTime
}

export type PenaltyStatus =
  /** Hisoblangan, oylikdan ushlanadi */
  | 'applied'
  /** Egasi kechirgan */
  | 'waived'

/**
 * Xodimga qo'llangan jarima.
 *
 * Tizim tomonidan hisoblanadi, xodimning profilida avtomatik
 * ko'rinadi. Egasi faqat KECHIRA oladi — summani qo'lda oshirish
 * imkoni yo'q, aks holda qoidaning ma'nosi qolmaydi.
 */
export interface Penalty {
  /** Qoida + xodim + kun asosida barqaror id — takror yozilmaydi */
  id: ID
  clinicId: ID
  staffId: ID
  staffName: string
  positionTitle: string
  /** "2026-09" */
  period: string
  /** Qaysi kun uchun */
  date: ISODate
  ruleId: ID
  ruleName: string
  trigger: PenaltyTrigger
  amount: UZS
  /** Nima uchun qo'llangani — aniq raqamlar bilan */
  reason: string
  status: PenaltyStatus
}

/**
 * Kechirilgan jarima yozuvi.
 *
 * Jarimalar har safar qaytadan hisoblanadi, shuning uchun ular
 * saqlanmaydi. Kechirish esa egasining QARORI — uni qayta hisoblab
 * bo'lmaydi, shuning uchun alohida saqlanadi.
 */
export interface PenaltyWaiver {
  id: ID
  clinicId: ID
  /** Qaysi jarima kechirilgani (barqaror id) */
  penaltyId: ID
  note: string
  createdAt: ISODateTime
}

/** Xodimning bir oylik jarima xulosasi */
export interface PenaltySummary {
  staffId: ID
  period: string
  items: Penalty[]
  /** Kechirilmaganlar yig'indisi — oylikdan ushlanadi */
  total: UZS
  waivedTotal: UZS
}

/** Tizim taklif qilgan bonus - egasi tasdiqlaydi yoki o'zgartiradi */
export interface BonusSuggestion {
  staffId: ID
  staffName: string
  position: StaffPosition
  performancePct: number | null
  rating: number | null
  amount: UZS
  /** Qaysi qoidadan kelib chiqqani. null = umumiy tavsiya. */
  ruleId: ID | null
  ruleName: string
  reason: string
}

/* ================================================================== */
/* KASSA NAZORATI                                                     */
/* ================================================================== */

/**
 * Smena yopish — kun oxirida administrator jismoniy naqd pulni sanab
 * kiritadi. Tizim o'zidagi summa bilan solishtiradi.
 */
export interface ShiftClosure {
  id: ID
  clinicId: ID
  userId: ID
  userName: string
  date: ISODate
  /** Tizim hisoblagan naqd summa */
  expectedCash: UZS
  /** Administrator sanab kiritgan summa */
  declaredCash: UZS
  /** declared − expected. Manfiy = kamomad. */
  difference: UZS
  note: string
  closedAt: ISODateTime
}

/**
 * Kassa nazorati hisoboti — FAQAT egasi ko'radi.
 *
 * Asosiy g'oya: xizmat ko'rsatilganini SHIFOKOR qayd qiladi, pulni
 * ADMINISTRATOR qayd qiladi. Ikki yozuvni turli odam kiritgani uchun
 * ularning farqi haqiqiy signal beradi.
 */
export interface CashControlReport {
  /** Yakunlangan tashriflar bo'yicha kutilgan summa */
  expected: UZS
  /** Kassaga haqiqatda tushgan summa */
  collected: UZS
  /** expected − collected. Musbat = yetishmayapti. */
  gap: UZS
  /** Yakunlangan, lekin to'lanmagan tashriflar */
  unpaidVisits: { count: number; amount: UZS }
  /** "Kutilmoqda" holatidagi to'lovlar */
  pendingPayments: { count: number; amount: UZS }
  /** Qaytarilgan to'lovlar */
  refunds: { count: number; amount: UZS }
  /** Bemor kelgandan KEYIN bekor qilingan qabullar — shubhali holat */
  cancelledAfterCheckIn: number
  /** Xodimlar kesimida */
  byUser: {
    userId: ID
    userName: string
    collected: UZS
    transactions: number
    /** Smena kamomadlari yig'indisi */
    shortfall: UZS
  }[]
  shiftClosures: ShiftClosure[]
}

/* ================================================================== */
/* SHIFOKORLAR YUKLAMASI (kalendar "yuklama" ko'rinishi)              */
/* ================================================================== */

/**
 * Bitta shifokorning kunlar bo'yicha bandligi.
 *
 * Egasi uchun: qaysi shifokor to'la band, qaysinisida bo'sh soat ko'p.
 * Bo'sh turgan soat — yo'qotilgan daromad.
 */
export interface DoctorLoadRow {
  doctorId: ID
  doctorName: string
  specialty: string
  /** Har bir kun uchun qabullar soni (kunlar tartibida) */
  counts: number[]
  /** Har bir kun uchun ish vaqtiga nisbatan bandlik, 0–100 */
  utilization: number[]
  total: number
  /** O'rtacha bandlik, 0–100 */
  averageUtilization: number
}

export interface DoctorLoad {
  days: ISODate[]
  rows: DoctorLoadRow[]
  /** Rang shkalasi uchun eng katta kunlik son */
  maxCount: number
}

/* ================================================================== */
/* IZOHLAR (bemor fikri)                                              */
/* ================================================================== */

export type FeedbackStatus = 'new' | 'reviewed' | 'archived'

/**
 * Bemor fikri.
 *
 * IDENTIFIKATSIYA: bemor faqat telefon raqamini kiritadi. Tizim shu
 * raqam bo'yicha bazadan uni topadi va oxirgi tashriflarini ko'rsatadi.
 * Bu eng past to'siq: bemorga parol ham, ro'yxatdan o'tish ham kerak emas.
 *
 * MAXFIYLIK: raqam bo'yicha qidiruv NATIJASI faqat "topildi/topilmadi" va
 * bemorning O'Z tashriflari bo'lishi kerak. Boshqa bemor ma'lumoti
 * qaytmasligi shart. Serverda bu endpoint tezlik bo'yicha cheklanishi
 * kerak (rate limit), aks holda raqamlarni birma-bir sinab ko'rish mumkin.
 */
export interface Feedback {
  id: ID
  clinicId: ID
  /** Fikr bildiruvchining telefon raqami */
  phone: string
  /** Telefon orqali topilgan bemor. Topilmasa null. */
  patientId: ID | null
  patientName: string
  /** Qaysi shifokor haqida */
  doctorId: ID | null
  /** Qaysi qabulga tegishli */
  appointmentId: ID | null
  /** Umumiy baho, 1-5 */
  rating: number
  /** Alohida yo'nalishlar bo'yicha baholar, 1-5 */
  scores: {
    doctor: number
    service: number
    cleanliness: number
    waiting: number
  }
  text: string
  /**
   * Shifokorga anonim ko'rsatiladimi.
   *
   * Shifokor o'z ishi haqidagi fikrni ko'rishi kerak, lekin kim
   * yozganini bilmasligi kerak - aks holda bemor rostini yozmaydi.
   */
  isAnonymous: boolean
  /**
   * Fikr SHIFOKORGA qachon ko'rinadi.
   *
   * NEGA KECHIKTIRILADI: fikr tashrifdan darhol keyin ko'rinsa,
   * anonimlik shunchaki so'z bo'lib qoladi — shifokor o'sha kuni
   * kimni qabul qilganini eslaydi va yozgan odamni topadi.
   *
   * Bir necha kunlik tasodifiy kechikish shu bog'lanishni uzadi:
   * fikr kelganda uni aniq bir tashrifga bog'lab bo'lmaydi. Klinika
   * egasi va registratura esa fikrni darhol ko'radi — ularga
   * anonimlik shart emas, ular bemor bilan ishlashi kerak.
   */
  revealAt: ISODateTime
  status: FeedbackStatus
  /** Klinika javobi */
  reply: string
  repliedAt: ISODateTime | null
  createdAt: ISODateTime
}

/** Telefon bo'yicha qidiruv natijasi */
export interface FeedbackLookup {
  found: boolean
  patientId: ID | null
  patientName: string
  /** Bemorning oxirgi tashriflari - qaysi biriga fikr bildirishni tanlaydi */
  recentVisits: {
    appointmentId: ID
    date: ISODate
    doctorId: ID
    doctorName: string
    serviceName: string
    /** Bu tashrifga allaqachon fikr bildirilganmi */
    hasFeedback: boolean
  }[]
}

export interface FeedbackStats {
  /** O'rtacha baho, 0-5 */
  average: number
  total: number
  /** Baholar taqsimoti: [1 ball soni, 2 ball, ..., 5 ball] */
  distribution: number[]
  /** Yo'nalishlar bo'yicha o'rtacha */
  byScore: {
    doctor: number
    service: number
    cleanliness: number
    waiting: number
  }
  /** Shifokorlar kesimida */
  byDoctor: {
    doctorId: ID
    doctorName: string
    average: number
    count: number
  }[]
  /** Oxirgi davr dinamikasi */
  series: SeriesPoint[]
  /** Javob kutayotgan izohlar */
  unanswered: number
}

/* ================================================================== */
/* OYLIK YIG'MA MA'LUMOT VA PROGNOZ                                   */
/* ================================================================== */

/**
 * Oylik yig'ma ko'rsatkichlar.
 *
 * NEGA ALOHIDA JADVAL: prognoz uchun 12-18 oylik tarix kerak, lekin
 * har bir qabul va to'lovni shuncha vaqtga saqlab, har safar qaytadan
 * hisoblash sekin. Shuning uchun tugagan oylar bo'yicha yig'ma yozuv
 * saqlanadi (rollup) — prognoz shundan o'qiydi.
 *
 * Backendda buni tunda ishlaydigan vazifa to'ldiradi.
 */
export interface MonthlyStat {
  clinicId: ID
  /** "2026-09" */
  period: string
  revenue: UZS
  /** Barcha xarajatlar: maosh, foiz, bonus, ijara, kommunal va h.k. */
  expenses: UZS
  patients: number
  newPatients: number
  appointments: number
}

/** Prognoz davri */
export type ForecastHorizon = 3 | 6 | 12

/** Bitta oy uchun prognoz qiymati */
export interface ForecastPoint {
  period: string
  label: string
  /** Haqiqiy qiymat (o'tgan oylar uchun) */
  actual: number | null
  /** Prognoz qiymati (kelgusi oylar uchun) */
  forecast: number | null
  /** Ishonch oralig'i */
  low: number | null
  high: number | null
}

export type ForecastRisk = 'ok' | 'watch' | 'alert'

/**
 * Moliyaviy prognoz.
 *
 * MUHIM: bu bashorat, kafolat emas. Tarixiy tendensiyaga qurilgan va
 * kutilmagan hodisalarni (epidemiya, yangi raqobatchi, narx o'zgarishi)
 * hisobga olmaydi. Shuning uchun interfeysda doim "taxminiy" deb
 * belgilanadi va ishonch oralig'i ko'rsatiladi.
 */
export interface Forecast {
  horizon: ForecastHorizon
  /** Nechta oylik tarixga asoslangan */
  basedOnMonths: number
  /** Daromad qatori: o'tgan + prognoz */
  revenue: ForecastPoint[]
  /** Xarajat qatori */
  expenses: ForecastPoint[]
  /** Foyda qatori */
  profit: ForecastPoint[]

  /** Prognoz davridagi jami */
  totals: {
    revenue: UZS
    expenses: UZS
    profit: UZS
  }
  /** Oylik o'sish sur'ati, % */
  growthRate: number
  /** Prognozning ishonchliligi, 0-100. Tarix qancha uzun va barqaror bo'lsa, shuncha yuqori. */
  confidence: number

  /** Xavf darajasi */
  risk: ForecastRisk
  /** Ogohlantirishlar — i18n kaliti va o'rin egallovchilar */
  warnings: {
    key: string
    vars: Record<string, string | number>
    severity: 'warn' | 'bad'
  }[]
  /** Zarar kutilayotgan birinchi oy */
  firstLossPeriod: string | null
  /** Zarar bo'lmasligi uchun kerakli qo'shimcha oylik tushum */
  breakEvenGap: UZS
}

/* ================================================================== */
/* XODIMLAR CHATI                                                     */
/* ================================================================== */

export type ChatKind = 'group' | 'direct'

/**
 * Suhbat.
 *
 * 'group'  — nomlangan guruh (Umumiy, Shifokorlar, Registratura)
 * 'direct' — ikki kishi orasidagi shaxsiy yozishma
 */
export interface ChatGroup {
  id: ID
  clinicId: ID
  name: string
  kind: ChatKind
  /** Ishtirokchilar — foydalanuvchi id'lari */
  memberIds: ID[]
  /** Guruh tavsifi */
  description: string
  createdBy: ID
  createdAt: ISODateTime
}

export interface ChatMessage {
  id: ID
  clinicId: ID
  groupId: ID
  authorId: ID
  authorName: string
  text: string
  createdAt: ISODateTime
  /** Kim o'qigan — foydalanuvchi id'lari */
  readBy: ID[]
  /**
   * Tizim xabari (masalan "Aziz guruhga qo'shildi").
   * Bunday xabar boshqacha ko'rinishda chiqadi.
   */
  isSystem: boolean
}

/** Ro'yxat uchun — oxirgi xabar va o'qilmaganlar bilan */
export interface ChatGroupSummary extends ChatGroup {
  lastMessage: {
    text: string
    authorName: string
    createdAt: ISODateTime
    isSystem: boolean
  } | null
  unreadCount: number
  /** Ishtirokchilar ismlari — avatarlar uchun */
  memberNames: string[]
}

/* ================================================================== */
/* REGISTRATURA PANELI                                                */
/* ================================================================== */

/** Navbatdagi yoki kutilayotgan bemor */
export interface ReceptionQueueItem {
  appointmentId: ID
  patientId: ID
  patientName: string
  patientPhone: string
  doctorId: ID
  doctorName: string
  serviceId: ID
  serviceName: string
  startsAt: ISODateTime
  checkedInAt: ISODateTime | null
  /** Kelganidan beri necha daqiqa kutmoqda */
  waitingMinutes: number
  /** Belgilangan vaqtdan qancha kechikilgan (manfiy = hali vaqti kelmagan) */
  delayMinutes: number
  status: AppointmentStatus
  paymentStatus: AppointmentPaymentStatus
  /** Xizmat oldindan to'lanadimi */
  prepaid: boolean
  /** To'lanadigan summa (chegirma hisobga olingan) */
  price: UZS
}

/**
 * Registratura paneli.
 *
 * Egasining paneli TAHLILIY — "biznes qanday ketyapti". Registratorga
 * esa OPERATSION panel kerak: "hozir nima qilishim kerak".
 *
 * Shuning uchun bu yerda o'sish foizlari va oylik daromad yo'q; o'rniga
 * navbat, qo'ng'iroq qilinadiganlar va olinmagan to'lovlar turadi.
 */
export interface ReceptionSummary {
  /** Kelgan va shifokorni kutayotganlar — eng muhim ro'yxat */
  waiting: ReceptionQueueItem[]
  /** Bugungi keyingi qabullar */
  upcoming: ReceptionQueueItem[]

  today: {
    total: number
    completed: number
    remaining: number
    noShow: number
    cancelled: number
  }

  /** Darhol harakat talab qiladigan narsalar */
  attention: {
    /** Tasdiqlanmagan qabullar — qo'ng'iroq qilish kerak */
    unconfirmed: number
    /** Yakunlangan, lekin to'lanmagan */
    unpaid: { count: number; amount: UZS }
    /**
     * Oldindan to'lanadigan xizmatga yozilgan, kelgan, lekin hali
     * to'lamagan bemorlar. Ularni shifokorga yuborishdan oldin pul
     * olinishi kerak - shuning uchun alohida signal.
     */
    prepaidUnpaid: { count: number; amount: UZS }
    /**
     * Bugungi davomati belgilanmagan xodimlar soni.
     *
     * Davomatni har kuni registratura to'ldiradi — shuning uchun
     * eslatma aynan uning panelida turadi.
     */
    unmarkedAttendance: number
    /** Takroriy tashrif muddati kelganlar */
    followUps: number
  }

  /** Bugungi kassa — smenani yopish uchun */
  cash: {
    cash: UZS
    card: UZS
    transfer: UZS
    total: UZS
    /** Bugungi smena allaqachon yopilganmi */
    shiftClosed: boolean
  }
}

/* ================================================================== */
/* BEMOR UCHUN NARX                                                   */
/* ================================================================== */

/**
 * Aniq bemor uchun aniq xizmat narxi.
 *
 * Registratura pul so'rashdan oldin shuni ko'radi: bazaviy narx, bemorga
 * tegishli sodiqlik chegirmasi va yakuniy summa. Chegirma qo'lda emas,
 * bemorning shu xizmatdan necha marta foydalanganiga qarab AVTOMATIK
 * qo'llanadi — bu registratorning "o'zicha chegirma qilish" imkonini
 * yopadi.
 */
export interface PricePreview {
  serviceId: ID
  serviceName: string
  basePrice: UZS
  /** Qo'llanilgan chegirma, % */
  discountPct: number
  /** To'lanadigan yakuniy summa */
  price: UZS
  /** Bemor shu xizmatdan necha marta foydalangan */
  visitCount: number
  /** Keyingi pog'onagacha necha tashrif qoldi. null = boshqa pog'ona yo'q. */
  nextTierIn: number | null
  /** Keyingi pog'onadagi chegirma */
  nextTierPct: number | null
  paymentTiming: PaymentTiming
}
