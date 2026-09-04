/**
 * Platforma demo ma'lumoti — klinikalar, tariflar, hisoblar.
 *
 * Bu ma'lumot klinika ichidagi ma'lumotdan MUSTAQIL: bu yerda
 * bemorlar ham, tashriflar ham yo'q. Faqat klinikalarning o'zi va
 * ularning obunasi.
 *
 * Demo maqsadi — panel bo'sh ko'rinmasligi va har bir holat
 * (sinovda, to'lovda, qarzdor, to'xtatilgan, ketgan) real ko'rinishi.
 */

import type {
  ImpersonationLog,
  PayType,
  Plan,
  PlatformMember,
  Tenant,
  TenantDoctor,
  TenantInvoice,
  TenantPatient,
  TenantStatus,
} from '@/types/models'
import { UNLIMITED } from '@/types/models'
import { addDays, toISODate } from '@/lib/dates'
import { FEMALE_NAMES, MALE_NAMES, OPERATOR_CODES, SURNAME_STEMS } from './names'
import { COMPLAINT_KEYS, SPECIALTIES } from '@/i18n/data'
import type { Random } from './random'

const CITIES = [
  'Toshkent',
  'Samarqand',
  'Buxoro',
  'Namangan',
  'Andijon',
  'Farg‘ona',
  'Qarshi',
  'Nukus',
  'Urganch',
  'Jizzax',
  'Navoiy',
  'Termiz',
]

const CLINIC_NAMES = [
  'Shifomed',
  'Med Plaza',
  'Sog‘lom Avlod',
  'Nur Medical',
  'Doctor Plus',
  'Hayot Klinika',
  'Zamon Med',
  'Oq Yo‘l Shifo',
  'Sihat Center',
  'Barakat Med',
  'Umid Klinika',
  'Vita Med',
  'Salomat',
  'Ishonch Shifo',
  'Diyor Medical',
  'Universal Med',
  'Anor Klinika',
  'Buyuk Shifo',
  'Ehson Med',
  'Farovon Klinika',
  'Grand Medical',
  'Hilol Shifo',
  'Imkon Med',
  'Jasorat Klinika',
  'Kamalak Med',
  'Lider Shifo',
  'Marhamat Med',
  'Najot Klinika',
  'Orzu Medical',
  'Poytaxt Shifo',
  'Rohat Med',
  'Sardor Klinika',
  'Tabassum Shifo',
  'Ulug‘bek Med',
  'Vatan Klinika',
]

const OWNER_NAMES = [
  'Anvar Ahmadjonov',
  'Bekzod Rasulov',
  'Dilshod Karimov',
  'Elyor Sobirov',
  'Farrux Yo‘ldoshev',
  'G‘ayrat Nazarov',
  'Hasan Qodirov',
  'Ilhom To‘xtasinov',
  'Jamshid Ergashev',
  'Kamol Islomov',
  'Lola Sharipova',
  'Malika Yusupova',
  'Nodira Aliyeva',
  'Ozoda Rahimova',
  'Parvina Sultonova',
  'Qobil Mirzayev',
  'Rustam Xolmatov',
  'Sanjar Umarov',
  'Tohir Bekmurodov',
  'Umida Hakimova',
]

/* ------------------------------------------------------------------ */
/* Tariflar                                                            */
/* ------------------------------------------------------------------ */

export function generatePlans(now: Date): Plan[] {
  const createdAt = addDays(now, -730).toISOString()

  return [
    {
      id: 'plan_starter',
      tier: 'starter',
      name: 'Boshlang‘ich',
      pricePerMonth: 1_200_000,
      limits: { doctors: 3, staff: 10 },
      // Kichik klinikaga statsionar ham, kassa nazorati ham kerak emas
      features: ['chat'],
      isActive: true,
      createdAt,
    },
    {
      id: 'plan_standard',
      tier: 'standard',
      name: 'Standart',
      pricePerMonth: 2_500_000,
      limits: { doctors: 10, staff: 40 },
      features: ['ward', 'analytics', 'staff', 'chat'],
      isActive: true,
      createdAt,
    },
    {
      id: 'plan_premium',
      tier: 'premium',
      name: 'Premium',
      pricePerMonth: 4_500_000,
      limits: { doctors: UNLIMITED, staff: UNLIMITED },
      features: ['ward', 'analytics', 'cashControl', 'staff', 'chat', 'api'],
      isActive: true,
      createdAt,
    },
  ]
}

/* ------------------------------------------------------------------ */
/* Klinikalar                                                          */
/* ------------------------------------------------------------------ */

/** Sinov muddati — ro'yxatdan o'tgandan keyin necha kun bepul */
export const TRIAL_DAYS = 14

/**
 * Holatlar taqsimoti.
 *
 * Haqiqiy SaaS'da ko'pchilik to'lovda bo'ladi, bir qismi sinovda,
 * kichik qismi qarzdor va ketgan. Demo shu nisbatni takrorlaydi —
 * aks holda panel haqiqatga o'xshamaydi.
 */
const STATUS_WEIGHTS: [TenantStatus, number][] = [
  ['active', 0.6],
  ['trial', 0.16],
  ['past_due', 0.1],
  ['suspended', 0.07],
  ['cancelled', 0.07],
]

export function generateTenants(plans: Plan[], now: Date, r: Random): Tenant[] {
  const tenants: Tenant[] = []

  CLINIC_NAMES.forEach((name, index) => {
    // Birinchi klinika — demo klinikasi, u har doim to'lovda va Premium
    const isDemo = index === 0

    const status: TenantStatus = isDemo ? 'active' : r.weighted(STATUS_WEIGHTS)

    /*
      Eski klinikalar kattaroq tarifda bo'ladi: ular o'sgan va
      ko'proq imkoniyat kerak bo'lgan. Yangi kelganlar odatda
      boshlang'ichdan boshlaydi.
    */
    const ageDays = isDemo ? 400 : r.int(3, 720)
    const createdAt = addDays(now, -ageDays)

    const plan = isDemo
      ? plans[2]
      : ageDays > 400
        ? r.weighted<Plan>([
            [plans[2], 0.5],
            [plans[1], 0.4],
            [plans[0], 0.1],
          ])
        : ageDays > 120
          ? r.weighted<Plan>([
              [plans[2], 0.2],
              [plans[1], 0.5],
              [plans[0], 0.3],
            ])
          : r.weighted<Plan>([
              [plans[2], 0.05],
              [plans[1], 0.3],
              [plans[0], 0.65],
            ])

    const trialEndsAt =
      status === 'trial' ? toISODate(addDays(now, r.int(1, TRIAL_DAYS))) : null

    /*
      Ketgan klinikalarning bir qismi SINOV paytida ketgan — ular
      hech qachon to'lamagan. Bu farq muhim: sinovdan to'lovga o'tish
      ulushi aynan shu ikki guruhning nisbatidan chiqadi. Hammasiga
      `subscribedAt` qo'yilsa, konversiya doim 100% bo'lib qolardi.
    */
    const leftDuringTrial = status === 'cancelled' && r.chance(0.45)

    const subscribedAt =
      status === 'trial' || leftDuringTrial
        ? null
        : toISODate(addDays(createdAt, TRIAL_DAYS))

    const nextInvoiceAt =
      status === 'active'
        ? toISODate(addDays(now, r.int(1, 30)))
        : status === 'past_due'
          ? toISODate(addDays(now, -r.int(3, 25)))
          : null

    /*
      Foydalanish tarifga mos bo'lishi kerak, lekin ba'zilari
      chegaradan oshgan bo'lsin — panelda aynan shunday klinikalar
      e'tibor talab qiladi.
    */
    const overLimit = !isDemo && r.chance(0.12)
    const doctorCap = plan.limits.doctors === UNLIMITED ? 24 : plan.limits.doctors
    const doctors = isDemo ? 8 : overLimit ? doctorCap + r.int(1, 3) : r.int(1, doctorCap)

    const staffCap = plan.limits.staff === UNLIMITED ? 60 : plan.limits.staff
    const staff = isDemo ? 30 : Math.min(staffCap + (overLimit ? r.int(1, 5) : 0), doctors * 4 + r.int(2, 8))

    const active = status === 'active' || status === 'trial' || status === 'past_due'

    tenants.push({
      id: isDemo ? 'clinic_1' : `clinic_${index + 1}`,
      name,
      logoUrl: null,
      city: isDemo ? 'Toshkent' : r.pick(CITIES),
      phone: `+998 ${r.int(90, 99)} ${r.int(100, 999)} ${r.int(10, 99)} ${r.int(10, 99)}`,
      ownerName: isDemo ? 'Anvar Ahmadjonov' : r.pick(OWNER_NAMES),
      ownerEmail: `owner@${name.toLowerCase().replace(/[^a-z]/g, '')}.uz`,
      ownerPhone: `+998 ${r.int(90, 99)} ${r.int(100, 999)} ${r.int(10, 99)} ${r.int(10, 99)}`,
      status,
      planId: plan.id,
      planName: plan.name,
      pricePerMonth: plan.pricePerMonth,
      trialEndsAt,
      subscribedAt,
      nextInvoiceAt,
      suspendReason:
        status === 'suspended' ? 'To‘lov 30 kundan ortiq kechikkani uchun' : '',
      usage: {
        doctors,
        staff,
        patients: isDemo ? 1200 : doctors * r.int(80, 260),
        users: isDemo ? 11 : Math.max(2, Math.round(staff * 0.4)),
        appointmentsThisMonth: active ? doctors * r.int(40, 140) : 0,
      },
      lastActiveAt: active
        ? addDays(now, -r.int(0, 3)).toISOString()
        : status === 'suspended'
          ? addDays(now, -r.int(20, 60)).toISOString()
          : addDays(now, -r.int(40, 200)).toISOString(),
      createdAt: createdAt.toISOString(),
    })
  })

  return tenants
}

/* ------------------------------------------------------------------ */
/* Hisoblar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Oxirgi 12 oy uchun hisoblar.
 *
 * Faqat to'layotgan klinikalarga yoziladi: sinovdagi klinikaga hisob
 * chiqarilmaydi, ketganiga esa ketganidan keyin chiqarilmaydi.
 */
export function generateInvoices(
  tenants: Tenant[],
  now: Date,
  r: Random,
): TenantInvoice[] {
  const invoices: TenantInvoice[] = []
  let seq = 0

  for (const tenant of tenants) {
    if (!tenant.subscribedAt) continue

    const subscribed = new Date(tenant.subscribedAt)

    for (let back = 11; back >= 0; back--) {
      const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
      if (month < subscribed) continue

      // Ketgan klinikaga ketganidan keyin hisob chiqarilmaydi
      if (tenant.status === 'cancelled' && back < 2) continue

      const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      const issuedAt = toISODate(month)
      const dueAt = toISODate(addDays(month, 10))

      /*
        Joriy oy hisobi holatga qarab: to'lovdagi klinika to'lagan,
        qarzdorda muddat o'tgan, qolganlari kutilmoqda.
      */
      const isCurrent = back === 0
      let status: TenantInvoice['status'] = 'paid'

      if (isCurrent) {
        status =
          tenant.status === 'past_due'
            ? 'overdue'
            : tenant.status === 'active'
              ? r.chance(0.75)
                ? 'paid'
                : 'pending'
              : 'pending'
      } else if (tenant.status === 'past_due' && back <= 1) {
        status = 'overdue'
      }

      seq++
      invoices.push({
        id: `inv_${seq}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        period,
        planName: tenant.planName,
        amount: tenant.pricePerMonth,
        status,
        issuedAt,
        dueAt,
        paidAt:
          status === 'paid'
            ? addDays(month, r.int(1, 9)).toISOString()
            : null,
      })
    }
  }

  return invoices
}

/* ------------------------------------------------------------------ */
/* Klinika paneliga kirishlar                                          */
/* ------------------------------------------------------------------ */

const SUPPORT_REASONS = [
  'Kalendar noto‘g‘ri ko‘rsatayotgani bo‘yicha murojaat',
  'To‘lov qo‘shishda xatolik — tekshirish',
  'Hisobot yuklanmayapti degan shikoyat',
  'Xodim qo‘shishda yordam so‘radi',
  'Statsionar bo‘limi sozlanmagan — ko‘rib berish',
]

export function generateImpersonations(
  tenants: Tenant[],
  now: Date,
  r: Random,
): ImpersonationLog[] {
  const rows: ImpersonationLog[] = []
  const pool = tenants.filter((t) => t.status !== 'cancelled')

  for (let i = 0; i < 14; i++) {
    const tenant = r.pick(pool)
    const startedAt = addDays(now, -r.int(1, 90))
    startedAt.setHours(r.int(9, 18), r.int(0, 59), 0, 0)

    rows.push({
      id: `imp_${i + 1}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      adminName: 'Anvar Ahmadjonov',
      reason: r.pick(SUPPORT_REASONS),
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + r.int(3, 40) * 60_000).toISOString(),
    })
  }

  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}


/* ------------------------------------------------------------------ */
/* Klinikalar kesimidagi ro'yxatlar                                    */
/* ------------------------------------------------------------------ */

function makeName(r: Random, female: boolean): string {
  const first = r.pick(female ? FEMALE_NAMES : MALE_NAMES)
  const stem = r.pick(SURNAME_STEMS)
  return `${first} ${stem}${female ? 'ova' : 'ov'}`
}

function makePhone(r: Random): string {
  return `+998 ${r.pick(OPERATOR_CODES)} ${r.int(100, 999)} ${r.int(10, 99)} ${r.int(10, 99)}`
}

/**
 * Har bir klinikaning shifokorlari.
 *
 * Soni klinikaning `usage.doctors` raqamiga mos keladi — aks holda
 * ro'yxat bilan hisob bir-biriga to'g'ri kelmaydi.
 */
export function generateTenantDoctors(
  tenants: Tenant[],
  now: Date,
  r: Random,
): TenantDoctor[] {
  const rows: TenantDoctor[] = []
  let seq = 0

  for (const tenant of tenants) {
    if (tenant.status === 'cancelled') continue

    for (let i = 0; i < tenant.usage.doctors; i++) {
      seq++
      const female = r.chance(0.45)

      /*
        Ta'tildagi va ishdan ketgan shifokorlar ham bo'lishi kerak:
        ro'yxatda hamma "ishda" bo'lsa, u haqiqatga o'xshamaydi.
      */
      const status = r.weighted<TenantDoctor['status']>([
        ['active', 0.86],
        ['on_leave', 0.09],
        ['inactive', 0.05],
      ])

      const completed = status === 'active' ? r.int(30, 190) : r.int(0, 25)

      /*
        To'lov modeli: shifokorlarning ko'pchiligi foiz evaziga
        ishlaydi — O'zbekistondagi xususiy klinikalarda odatiy holat.
      */
      const payType = r.weighted<PayType>([
        ['percent', 0.45],
        ['salary_percent', 0.35],
        ['salary', 0.2],
      ])

      const percentRate = payType === 'salary' ? 0 : r.int(25, 45)
      const baseSalary = payType === 'percent' ? 0 : r.int(4, 12) * 1_000_000

      // Foizli qism: qabullardan tushgan pulning ulushi
      const fromPercent =
        payType === 'salary'
          ? 0
          : Math.round((completed * 180_000 * percentRate) / 100)

      rows.push({
        id: `tdoc_${seq}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        fullName: makeName(r, female),
        specialty: r.pick(SPECIALTIES),
        phone: makePhone(r),
        email: `doc${seq}@${tenant.name.toLowerCase().replace(/[^a-z]/g, '')}.uz`,
        status,
        completedLast30d: completed,
        monthlyPay: baseSalary + fromPercent,
        payType,
        percentRate,
        // Yangi kelgan shifokorda baho hali yo'q
        rating: completed < 20 ? null : Math.round(r.int(32, 50)) / 10,
        hiredAt: toISODate(addDays(now, -r.int(30, 1200))),
      })
    }
  }

  return rows
}

/**
 * Klinikalarning bemorlari — CHEKLANGAN namuna.
 *
 * Demo uchun har bir klinikadan 40 tagacha yozuv olinadi. Haqiqiy
 * tizimda bu ro'yxat sahifalab so'raladi; butun bazani bir so'rovda
 * yuklash na mijozga, na serverga to'g'ri keladi.
 */
const PATIENTS_PER_TENANT = 40

export function generateTenantPatients(
  tenants: Tenant[],
  now: Date,
  r: Random,
): TenantPatient[] {
  const rows: TenantPatient[] = []
  let seq = 0

  for (const tenant of tenants) {
    if (tenant.status === 'cancelled') continue

    const count = Math.min(PATIENTS_PER_TENANT, tenant.usage.patients)

    for (let i = 0; i < count; i++) {
      seq++
      const female = r.chance(0.52)
      const registeredAt = addDays(now, -r.int(1, 700))
      const visitCount = r.int(1, 14)

      /*
        Oxirgi tashrif ro'yxatga olingandan keyin bo'ladi. Aks holda
        "ro'yxatdan o'tishidan oldin kelgan" degan mantiqsiz yozuv
        chiqadi va u tekshiruvda ko'zga tashlanadi.
      */
      const daysSince = r.int(0, Math.max(1, Math.round((now.getTime() - registeredAt.getTime()) / 86_400_000)))
      const lastVisit = addDays(now, -daysSince)

      rows.push({
        id: `tpat_${seq}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        fullName: makeName(r, female),
        phone: makePhone(r),
        gender: female ? 'female' : 'male',
        /*
          Yosh taqsimoti tekis emas: klinikaga eng ko'p 25–55 yoshdagilar
          murojaat qiladi. Tekis taqsimot demo'ni haqiqatga o'xshamas
          qilib qo'yadi.
        */
        age: r.weighted<number>([
          [r.int(1, 17), 0.16],
          [r.int(18, 34), 0.28],
          [r.int(35, 54), 0.32],
          [r.int(55, 88), 0.24],
        ]),
        city: tenant.city,
        condition: r.pick(COMPLAINT_KEYS),
        registeredAt: toISODate(registeredAt),
        lastVisitAt: toISODate(lastVisit),
        visitCount,
        totalSpent: visitCount * r.int(80_000, 420_000),
        isReturning: visitCount > 1,
      })
    }
  }

  return rows
}


/* ------------------------------------------------------------------ */
/* Platforma jamoasi                                                   */
/* ------------------------------------------------------------------ */

/**
 * Demo jamoa.
 *
 * Ruxsatlar ataylab turlicha: panelni ochgan odam darhol ko'radi —
 * har kimga hamma narsa berilmaydi. Bemorlar ro'yxati faqat
 * egasida va sifat nazoratchisida.
 */
export function generateTeam(now: Date): PlatformMember[] {
  const created = addDays(now, -400).toISOString()

  return [
    {
      id: 'pm_1',
      fullName: 'Anvar Ahmadjonov',
      email: 'admin@clinicos.uz',
      phone: '+998 90 123 45 67',
      position: 'Asoschi',
      permissions: [
        'clinics.view',
        'clinics.manage',
        'billing.view',
        'billing.manage',
        'data.view',
        'registry.doctors',
        'registry.patients',
        'clinics.impersonate',
        'team.manage',
      ],
      isActive: true,
      lastActiveAt: now.toISOString(),
      createdAt: created,
    },
    {
      id: 'pm_2',
      fullName: 'Dilshod Rasulov',
      email: 'sales@clinicos.uz',
      phone: '+998 90 234 56 78',
      position: 'Sotuv menejeri',
      // Sotuvga klinikalar va hisoblar kerak, bemorlar kerak emas
      permissions: ['clinics.view', 'billing.view', 'data.view', 'registry.doctors'],
      isActive: true,
      lastActiveAt: addDays(now, -1).toISOString(),
      createdAt: addDays(now, -180).toISOString(),
    },
    {
      id: 'pm_3',
      fullName: 'Nodira Yusupova',
      email: 'support@clinicos.uz',
      phone: '+998 90 345 67 89',
      position: 'Yordam xizmati',
      // Yordam berish uchun panelga kirish kerak
      permissions: ['clinics.view', 'clinics.impersonate'],
      isActive: true,
      lastActiveAt: addDays(now, -0).toISOString(),
      createdAt: addDays(now, -120).toISOString(),
    },
    {
      id: 'pm_4',
      fullName: 'Kamola Sharipova',
      email: 'finance@clinicos.uz',
      phone: '+998 90 456 78 90',
      position: 'Buxgalter',
      permissions: ['billing.view', 'billing.manage'],
      isActive: true,
      lastActiveAt: addDays(now, -3).toISOString(),
      createdAt: addDays(now, -90).toISOString(),
    },
    {
      id: 'pm_5',
      fullName: 'Sardor Toshmatov',
      email: 'quality@clinicos.uz',
      phone: '+998 90 567 89 01',
      position: 'Sifat nazorati',
      // Klinikalar halol ishlayotganini tekshiradi
      permissions: ['clinics.view', 'data.view', 'registry.doctors', 'registry.patients'],
      isActive: false,
      lastActiveAt: addDays(now, -40).toISOString(),
      createdAt: addDays(now, -60).toISOString(),
    },
  ]
}
