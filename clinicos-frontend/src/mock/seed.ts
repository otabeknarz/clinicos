/**
 * Demo ma'lumot generatori.
 *
 * Bu FAQAT frontendni jonli ko'rsatish uchun. Backend tayyor bo'lgach
 * butun `src/mock/` papkasini o'chirib tashlash mumkin — `src/api/` esa
 * o'zgarmaydi (u yerda mock rejim shunchaki o'chadi).
 *
 * Ma'lumot deterministik: bir kunda necha marta yangilamang, bir xil chiqadi.
 *
 * TENANT TEKSHIRUVI: ataylab IKKI klinika yaratiladi. Interfeysda faqat
 * `clinic_1` ko'rinishi shart. Agar `clinic_2` bemori biror joyda paydo
 * bo'lsa — demak filtrlashda xato bor.
 */

import { createRandom } from './random'
import {
  DISTRICTS,
  FEMALE_NAMES,
  MALE_NAMES,
  OPERATOR_CODES,
  STREETS,
  SURNAME_STEMS,
} from './names'
import { generateShiftClosures, generateWard } from './seedWard'
import { generateFeedback } from './seedFeedback'
import { generateChat } from './seedChat'
import { generateMonthlyStats } from './seedMonthly'
import {
  generateAttendance,
  generateBonuses,
  generateBonusRules,
  generateStaff,
} from './seedStaff'
import { COMPLAINT_KEYS } from '@/i18n/data'
import { addDays, addMinutes, atTime, startOfDay, toISODate } from '@/lib/dates'
import type {
  Admission,
  Appointment,
  Attendance,
  Bonus,
  BonusRule,
  ChatGroup,
  ChatMessage,
  Feedback,
  MonthlyStat,
  AppointmentStatus,
  Bed,
  Clinic,
  Doctor,
  FollowUp,
  Patient,
  Payment,
  PaymentMethod,
  Room,
  Service,
  ShiftClosure,
  Staff,
  User,
  Visit,
  PenaltyRule,
  PenaltyWaiver,
  ImpersonationLog,
  Plan,
  Tenant,
  TenantInvoice,
  TenantDoctor,
  TenantPatient,
  PlatformMember,
} from '@/types/models'

import {
  generateImpersonations,
  generateInvoices,
  generatePlans,
  generateTenantDoctors,
  generateTeam,
  generateTenantPatients,
  generateTenants,
} from './seedPlatform'

export const MAIN_CLINIC_ID = 'clinic_1'
const OTHER_CLINIC_ID = 'clinic_2'

/** Nechta kun tarix va nechta kun oldinga rejalashtiriladi */
const HISTORY_DAYS = 120
const FUTURE_DAYS = 14

export interface SeedData {
  clinics: Clinic[]
  users: User[]
  doctors: Doctor[]
  services: Service[]
  patients: Patient[]
  appointments: Appointment[]
  visits: Visit[]
  payments: Payment[]
  followUps: FollowUp[]
  rooms: Room[]
  beds: Bed[]
  admissions: Admission[]
  staff: Staff[]
  shiftClosures: ShiftClosure[]
  attendance: Attendance[]
  bonuses: Bonus[]
  bonusRules: BonusRule[]
  penaltyRules: PenaltyRule[]
  plans: Plan[]
  tenants: Tenant[]
  tenantInvoices: TenantInvoice[]
  impersonations: ImpersonationLog[]
  tenantDoctors: TenantDoctor[]
  tenantPatients: TenantPatient[]
  team: PlatformMember[]
  penaltyWaivers: PenaltyWaiver[]
  feedback: Feedback[]
  monthlyStats: MonthlyStat[]
  chatGroups: ChatGroup[]
  chatMessages: ChatMessage[]
}

/* ------------------------------------------------------------------ */
/* Xizmat katalogi                                                     */
/* ------------------------------------------------------------------ */

const SERVICE_CATALOG: {
  key: string
  category: string
  price: number
  duration: number
  /** To'lov xizmatdan oldin olinadimi */
  prepaid?: boolean
  /** Sodiqlik chegirmalari */
  loyalty?: { afterVisits: number; discountPct: number }[]
}[] = [
  {
    key: 'consultation_primary',
    category: 'consultation',
    price: 150_000,
    duration: 30,
  },
  {
    key: 'consultation_repeat',
    category: 'consultation',
    price: 100_000,
    duration: 20,
    loyalty: [
      { afterVisits: 3, discountPct: 10 },
      { afterVisits: 8, discountPct: 20 },
    ],
  },
  {
    key: 'ultrasound_abdomen',
    category: 'diagnostics',
    price: 200_000,
    duration: 30,
    prepaid: true,
  },
  {
    key: 'ultrasound_thyroid',
    category: 'diagnostics',
    price: 180_000,
    duration: 25,
    prepaid: true,
  },
  { key: 'ecg', category: 'diagnostics', price: 90_000, duration: 20 },
  {
    key: 'blood_general',
    category: 'lab',
    price: 80_000,
    duration: 15,
    prepaid: true,
  },
  {
    key: 'blood_biochem',
    category: 'lab',
    price: 180_000,
    duration: 15,
    prepaid: true,
  },
  {
    key: 'urine_general',
    category: 'lab',
    price: 60_000,
    duration: 10,
    prepaid: true,
  },
  { key: 'dressing', category: 'procedure', price: 70_000, duration: 15 },
  { key: 'injection', category: 'procedure', price: 40_000, duration: 10 },
  {
    key: 'iv_drip',
    category: 'procedure',
    price: 150_000,
    duration: 60,
    loyalty: [{ afterVisits: 5, discountPct: 10 }],
  },
  {
    key: 'physiotherapy',
    category: 'procedure',
    price: 120_000,
    duration: 40,
    loyalty: [
      { afterVisits: 5, discountPct: 15 },
      { afterVisits: 10, discountPct: 25 },
    ],
  },
  { key: 'dental_cleaning', category: 'dental', price: 350_000, duration: 45 },
  { key: 'dental_filling', category: 'dental', price: 450_000, duration: 60 },
  { key: 'dental_extraction', category: 'dental', price: 300_000, duration: 40 },
  {
    key: 'minor_surgery',
    category: 'surgery',
    price: 900_000,
    duration: 90,
    prepaid: true,
  },
]

/* ------------------------------------------------------------------ */
/* Shifokorlar                                                         */
/* ------------------------------------------------------------------ */

const DOCTOR_SEEDS: {
  name: string
  specialty: string
  fee: number
  /** Shu shifokor odatda bajaradigan xizmatlar */
  services: string[]
}[] = [
  {
    name: 'Aziz Karimov',
    specialty: 'therapist',
    fee: 150_000,
    services: ['consultation_primary', 'consultation_repeat', 'ecg', 'blood_general', 'injection'],
  },
  {
    name: 'Madina Rahimova',
    specialty: 'pediatrician',
    fee: 150_000,
    services: ['consultation_primary', 'consultation_repeat', 'blood_general', 'urine_general'],
  },
  {
    name: 'Sardor Aliyev',
    specialty: 'cardiologist',
    fee: 250_000,
    services: ['consultation_primary', 'ecg', 'blood_biochem', 'consultation_repeat'],
  },
  {
    name: 'Dilnoza Xasanova',
    specialty: 'gynecologist',
    fee: 220_000,
    services: ['consultation_primary', 'ultrasound_abdomen', 'consultation_repeat'],
  },
  {
    name: 'Otabek Yusupov',
    specialty: 'dentist',
    fee: 120_000,
    services: ['dental_cleaning', 'dental_filling', 'dental_extraction'],
  },
  {
    name: 'Nilufar Tursunova',
    specialty: 'neurologist',
    fee: 230_000,
    services: ['consultation_primary', 'consultation_repeat', 'physiotherapy'],
  },
  {
    name: 'Jasur Ibragimov',
    specialty: 'surgeon',
    fee: 250_000,
    services: ['consultation_primary', 'minor_surgery', 'dressing'],
  },
  {
    name: 'Zarina Nazarova',
    specialty: 'ultrasound',
    fee: 180_000,
    services: ['ultrasound_abdomen', 'ultrasound_thyroid'],
  },
]

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function generateSeed(seed = 20260901): SeedData {
  const r = createRandom(seed)
  const now = new Date()
  const today = startOfDay(now)
  const iso = (d: Date) => d.toISOString()

  /* --- Klinikalar --- */

  const clinics: Clinic[] = [
    {
      id: MAIN_CLINIC_ID,
      name: 'Shifo Med Klinikasi',
      logoUrl: null,
      phone: '+998 71 200 45 45',
      address: "Toshkent, Yunusobod tumani, Amir Temur ko'chasi 108",
      workingHours: [
        { weekday: 1, open: '08:00', close: '19:00', isClosed: false },
        { weekday: 2, open: '08:00', close: '19:00', isClosed: false },
        { weekday: 3, open: '08:00', close: '19:00', isClosed: false },
        { weekday: 4, open: '08:00', close: '19:00', isClosed: false },
        { weekday: 5, open: '08:00', close: '19:00', isClosed: false },
        { weekday: 6, open: '09:00', close: '15:00', isClosed: false },
        { weekday: 0, open: '09:00', close: '15:00', isClosed: true },
      ],
      slotMinutes: 30,
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      createdAt: iso(addDays(today, -400)),
    },
    {
      // Tenant izolyatsiyasini tekshirish uchun — interfeysda ko'rinmasligi shart
      id: OTHER_CLINIC_ID,
      name: 'Boshqa Klinika (tenant testi)',
      logoUrl: null,
      phone: '+998 71 100 00 00',
      address: 'Samarqand',
      workingHours: [],
      slotMinutes: 30,
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      createdAt: iso(addDays(today, -200)),
    },
  ]

  /* --- Xizmatlar --- */

  const services: Service[] = SERVICE_CATALOG.map((s, i) => ({
    id: `svc_${i + 1}`,
    clinicId: MAIN_CLINIC_ID,
    name: s.key,
    category: s.category,
    price: s.price,
    durationMinutes: s.duration,
    paymentTiming: s.prepaid ? 'prepaid' : 'postpaid',
    loyaltyTiers: s.loyalty ?? [],
    status: 'active',
    createdAt: iso(addDays(today, -390)),
  }))

  const serviceByKey = new Map(services.map((s) => [s.name, s]))

  /* --- Shifokorlar --- */

  const doctors: Doctor[] = DOCTOR_SEEDS.map((d, i) => {
    return {
      id: `doc_${i + 1}`,
      clinicId: MAIN_CLINIC_ID,
      fullName: d.name,
      specialty: d.specialty,
      phone: makePhone(r),
      email: `${slug(d.name)}@shifomed.uz`,
      avatarUrl: null,
      consultationFee: d.fee,
      // Bittasi ta'tilda bo'lsin — holat ko'rsatkichi jonli ko'rinsin
      status: i === 7 ? 'on_leave' : 'active',
      workdays: i % 3 === 0 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
      shiftStart: i % 2 === 0 ? '08:00' : '10:00',
      shiftEnd: i % 2 === 0 ? '16:00' : '19:00',
      hiredAt: toISODate(addDays(today, -r.int(120, 900))),
      createdAt: iso(addDays(today, -r.int(120, 900))),
    }
  })

  const doctorServices = new Map<string, string[]>(
    doctors.map((d, i) => [d.id, DOCTOR_SEEDS[i].services]),
  )

  /* --- Foydalanuvchilar --- */

  const users: User[] = [
    {
      id: 'usr_owner',
      clinicId: MAIN_CLINIC_ID,
      fullName: 'Anvar Ahmadjonov',
      email: 'owner@shifomed.uz',
      phone: makePhone(r),
      role: 'owner',
      avatarUrl: null,
      extraPermissions: [],
      isActive: true,
      lastLoginAt: iso(addMinutes(now, -35)),
      createdAt: iso(addDays(today, -400)),
      doctorId: null,
    },
    /*
      Platforma egasi — ClinicOS ning o'zi.

      `clinicId` bor, chunki model uni talab qiladi, lekin u
      MA'NOSIZ: super admin biror klinikaga tegishli emas. Uning
      ruxsatlari klinika ma'lumotiga umuman kirmaydi.
    */
    {
      id: 'usr_platform_1',
      clinicId: MAIN_CLINIC_ID,
      fullName: 'Anvar Ahmadjonov',
      email: 'admin@clinicos.uz',
      phone: makePhone(r),
      role: 'superadmin',
      avatarUrl: null,
      extraPermissions: [],
      isActive: true,
      lastLoginAt: iso(addMinutes(now, -5)),
      createdAt: iso(addDays(today, -730)),
      doctorId: null,
    },
    {
      id: 'usr_reception_1',
      clinicId: MAIN_CLINIC_ID,
      fullName: 'Kamola Sobirova',
      email: 'reception@shifomed.uz',
      phone: makePhone(r),
      role: 'receptionist',
      avatarUrl: null,
      extraPermissions: [],
      isActive: true,
      lastLoginAt: iso(addMinutes(now, -12)),
      createdAt: iso(addDays(today, -320)),
      doctorId: null,
    },
    {
      id: 'usr_reception_2',
      clinicId: MAIN_CLINIC_ID,
      fullName: 'Sevara Ergasheva',
      email: 'reception2@shifomed.uz',
      phone: makePhone(r),
      role: 'receptionist',
      avatarUrl: null,
      extraPermissions: [],
      isActive: true,
      lastLoginAt: iso(addDays(now, -2)),
      createdAt: iso(addDays(today, -180)),
      doctorId: null,
    },
    ...doctors.map((d, i) => ({
      id: `usr_doc_${i + 1}`,
      clinicId: MAIN_CLINIC_ID,
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      role: 'doctor' as const,
      avatarUrl: null,
      extraPermissions: [],
      isActive: d.status !== 'inactive',
      lastLoginAt: iso(addMinutes(now, -r.int(20, 600))),
      createdAt: d.createdAt,
      doctorId: d.id,
    })),
  ]

  /* --- Bemorlar --- */

  const PATIENT_COUNT = 620
  const patients: Patient[] = []

  for (let i = 0; i < PATIENT_COUNT; i++) {
    const female = r.chance(0.54)
    const first = female ? r.pick(FEMALE_NAMES) : r.pick(MALE_NAMES)
    const stem = r.pick(SURNAME_STEMS)
    const surname = female ? `${stem}ova` : `${stem}ov`
    // Klinika o'smoqda: so'nggi oylarda ro'yxatdan o'tganlar ko'proq.
    // pow(r, 1.6) qiymatlarni nolga (ya'ni bugunga) yaqinlashtiradi.
    const daysAgo = Math.floor(Math.pow(r.next(), 1.6) * (HISTORY_DAYS + 300))

    patients.push({
      id: `pat_${i + 1}`,
      clinicId: MAIN_CLINIC_ID,
      fullName: `${first} ${surname}`,
      phone: makePhone(r),
      birthDate: toISODate(addDays(today, -r.int(365 * 3, 365 * 74))),
      gender: female ? 'female' : 'male',
      address: `Toshkent, ${r.pick(DISTRICTS)}, ${r.pick(STREETS)} ko'chasi ${r.int(1, 140)}`,
      notes: '',
      status: 'active',
      primaryDoctorId: r.chance(0.7) ? r.pick(doctors).id : null,
      createdAt: iso(addDays(today, -daysAgo)),
    })
  }

  // Boshqa klinika bemorlari — hech qachon ko'rinmasligi kerak
  for (let i = 0; i < 3; i++) {
    patients.push({
      id: `other_pat_${i + 1}`,
      clinicId: OTHER_CLINIC_ID,
      fullName: `BOSHQA KLINIKA ${i + 1}`,
      phone: '+998 90 000 00 0' + i,
      birthDate: '1990-01-01',
      gender: 'male',
      address: 'Samarqand',
      notes: 'Bu yozuv interfeysda KO‘RINMASLIGI kerak',
      status: 'active',
      primaryDoctorId: null,
      createdAt: iso(addDays(today, -100)),
    })
  }

  const mainPatients = patients.filter((p) => p.clinicId === MAIN_CLINIC_ID)

  /* --- Qabullar, tashriflar, to'lovlar --- */

  const appointments: Appointment[] = []
  const visits: Visit[] = []
  const payments: Payment[] = []
  const followUps: FollowUp[] = []

  let apptSeq = 0
  let visitSeq = 0
  let paySeq = 0
  let followSeq = 0

  const activeDoctors = doctors.filter((d) => d.status === 'active')

  for (let dayOffset = -HISTORY_DAYS; dayOffset <= FUTURE_DAYS; dayOffset++) {
    const day = addDays(today, dayOffset)
    const weekday = day.getDay()
    if (weekday === 0) continue // yakshanba — klinika yopiq

    // Kunlik hajm.
    // Haqiqiy klinikada oqim barqaror: kundan kunga ±40% sakramaydi.
    // Shuning uchun bazaviy son qat'iy, ustiga kichik tebranish (±8%)
    // va hafta kuni koeffitsienti qo'shiladi.
    const WEEKDAY_FACTOR = [0, 1.08, 1.0, 1.0, 0.98, 1.06, 0.45]
    // 8 shifokorli o'rta klinika: har biriga kuniga ~6-7 bemor.
    // Bu shifokor bandligini ~45-60% ga olib chiqadi — real ko'rsatkich.
    const base = 46 * WEEKDAY_FACTOR[weekday]
    // Vaqt o'tishi bilan klinika o'sadi — eski kunlarda kamroq qabul
    const growth = 1 + (dayOffset + HISTORY_DAYS) / (HISTORY_DAYS * 3)
    const jitter = 0.95 + r.next() * 0.1
    // Kelajakdagi kunlar hali to'lmagan — jadval asta-sekin to'ldiriladi
    const futureFill = dayOffset > 0 ? 0.75 : 1
    const count = Math.max(3, Math.round(base * growth * jitter * futureFill))

    for (let k = 0; k < count; k++) {
      const doctor = r.pick(activeDoctors)
      if (!doctor.workdays.includes(weekday)) continue

      const serviceKeys = doctorServices.get(doctor.id) ?? []
      const service = serviceByKey.get(r.pick(serviceKeys))
      if (!service) continue

      // Ish vaqti ichida tasodifiy slot
      const startMin = timeToMin(doctor.shiftStart)
      const endMin = timeToMin(doctor.shiftEnd) - service.durationMinutes
      if (endMin <= startMin) continue
      const slot = startMin + Math.floor(r.int(0, (endMin - startMin) / 15)) * 15
      const startsAt = atTime(day, minToTime(slot))

      // Bemorni tanlash: shu sanadan oldin ro'yxatdan o'tganlar orasidan
      const patient = pickPatient(r, mainPatients, day)
      if (!patient) continue

      apptSeq++
      const id = `apt_${apptSeq}`
      const isPast = startsAt.getTime() < now.getTime()
      const status = pickStatus(r, isPast, startsAt, now)

      const appointment: Appointment = {
        id,
        clinicId: MAIN_CLINIC_ID,
        patientId: patient.id,
        doctorId: doctor.id,
        serviceId: service.id,
        startsAt: iso(startsAt),
        durationMinutes: service.durationMinutes,
        status,
        paymentStatus: status === 'completed' ? 'paid' : 'unpaid',
        notes: '',
        checkedInAt:
          status === 'checked_in' ||
          status === 'completed' ||
          // Bemor kelgan, keyin qabul bekor qilingan — shubhali holat.
          // Kassa nazorati aynan shuni ushlaydi.
          (status === 'cancelled' && r.chance(0.12))
            ? iso(addMinutes(startsAt, -r.int(2, 15)))
            : null,
        completedAt:
          status === 'completed' ? iso(addMinutes(startsAt, service.durationMinutes)) : null,
        cancelledAt: status === 'cancelled' ? iso(addMinutes(startsAt, -r.int(60, 2880))) : null,
        cancelReason: status === 'cancelled' ? 'Bemor iltimosiga ko‘ra' : null,
        createdBy: r.chance(0.8) ? 'usr_reception_1' : 'usr_reception_2',
        createdAt: iso(addDays(startsAt, -r.int(0, 12))),
      }

      // Ba'zi to'langan bo'lsa ham "kutilmoqda" holatida qolsin
      if (status === 'completed' && r.chance(0.06)) {
        appointment.paymentStatus = 'unpaid'
      }

      appointments.push(appointment)

      /* --- Yakunlangan qabul → tashrif + to'lov --- */

      if (status === 'completed') {
        visitSeq++
        const visitedAt = addMinutes(startsAt, service.durationMinutes)
        const complaint = r.pick(COMPLAINT_KEYS)

        visits.push({
          id: `vis_${visitSeq}`,
          clinicId: MAIN_CLINIC_ID,
          appointmentId: id,
          patientId: patient.id,
          doctorId: doctor.id,
          visitedAt: iso(visitedAt),
          complaint,
          diagnosis: DIAGNOSIS_BY_COMPLAINT[complaint] ?? '',
          treatment: r.pick(TREATMENTS),
          notes: '',
          createdAt: iso(visitedAt),
        })

        if (appointment.paymentStatus === 'paid') {
          paySeq++
          payments.push({
            id: `pay_${paySeq}`,
            clinicId: MAIN_CLINIC_ID,
            patientId: patient.id,
            doctorId: doctor.id,
            serviceId: service.id,
            appointmentId: id,
            amount: service.price,
            method: r.weighted<PaymentMethod>([
              ['cash', 5],
              ['card', 4],
              ['transfer', 1],
            ]),
            status: r.chance(0.015) ? 'refunded' : 'paid',
            paidAt: iso(addMinutes(visitedAt, r.int(1, 20))),
            notes: '',
            // Kassada ikki administrator navbatma-navbat ishlaydi.
            // Nazorat hisoboti xodimlar kesimini shu bo'yicha quradi.
            createdBy: r.chance(0.62) ? 'usr_reception_1' : 'usr_reception_2',
            createdAt: iso(addMinutes(visitedAt, r.int(1, 20))),
          })
        } else {
          // To'lanmagan — "kutilmoqda" holatidagi to'lov yozuvi
          paySeq++
          payments.push({
            id: `pay_${paySeq}`,
            clinicId: MAIN_CLINIC_ID,
            patientId: patient.id,
            doctorId: doctor.id,
            serviceId: service.id,
            appointmentId: id,
            amount: service.price,
            method: 'cash',
            status: 'pending',
            paidAt: iso(visitedAt),
            notes: '',
            createdBy: r.chance(0.62) ? 'usr_reception_1' : 'usr_reception_2',
            createdAt: iso(visitedAt),
          })
        }

        /* --- Takroriy tashrif tavsiyasi --- */

        if (r.chance(0.28)) {
          followSeq++
          const recommended = addDays(startsAt, r.int(7, 45))
          const isFuture = recommended.getTime() > now.getTime()
          followUps.push({
            id: `fup_${followSeq}`,
            clinicId: MAIN_CLINIC_ID,
            patientId: patient.id,
            doctorId: doctor.id,
            visitId: `vis_${visitSeq}`,
            recommendedDate: toISODate(recommended),
            reason: 'Nazorat ko‘rigi',
            status: isFuture ? 'pending' : r.chance(0.55) ? 'done' : 'missed',
            appointmentId: null,
            createdAt: iso(visitedAt),
          })
        }
      }
    }
  }

  /* --- Bemor holatini tarixga qarab aniqlash --- */

  const lastVisitByPatient = new Map<string, number>()
  for (const a of appointments) {
    if (a.status !== 'completed') continue
    const t = new Date(a.startsAt).getTime()
    const prev = lastVisitByPatient.get(a.patientId) ?? 0
    if (t > prev) lastVisitByPatient.set(a.patientId, t)
  }

  for (const p of patients) {
    if (p.clinicId !== MAIN_CLINIC_ID) continue
    const last = lastVisitByPatient.get(p.id)
    // 90 kundan beri kelmagan bemor — nofaol
    p.status = last && now.getTime() - last < 90 * 86_400_000 ? 'active' : 'inactive'
  }

  /* --- Statsionar --- */

  const ward = generateWard(r, MAIN_CLINIC_ID, today, mainPatients, doctors, HISTORY_DAYS)

  /* --- Xodimlar --- */

  const staff = generateStaff(
    r,
    MAIN_CLINIC_ID,
    today,
    doctors,
    users,
    MALE_NAMES,
    FEMALE_NAMES,
    SURNAME_STEMS,
    () => makePhone(r),
  )

  /* --- Smena yopishlari --- */

  // Kun + xodim kesimida naqd tushum — smenani solishtirish uchun
  const cashByDayAndUser = new Map<string, number>()
  for (const payment of payments) {
    if (payment.method !== 'cash' || payment.status !== 'paid') continue
    const key = `${payment.paidAt.slice(0, 10)}|${payment.createdBy}`
    cashByDayAndUser.set(key, (cashByDayAndUser.get(key) ?? 0) + payment.amount)
  }

  const shiftClosures = generateShiftClosures(r, MAIN_CLINIC_ID, today, users, cashByDayAndUser)

  /* --- Davomat va bonuslar --- */

  const attendance = generateAttendance(r, MAIN_CLINIC_ID, today, staff, 90)
  const bonusRules = generateBonusRules(MAIN_CLINIC_ID, today)

  /**
   * Jarima qoidalari — namuna sifatida uchtasi.
   *
   * Demo klinikada ular yoqilgan holda keladi, shunda tizim qanday
   * ishlashi darhol ko'rinadi. Haqiqiy klinikada egasi o'zi yozadi.
   */
  /* --- Platforma: klinikalar, tariflar, hisoblar --- */

  const plans = generatePlans(now)
  const tenants = generateTenants(plans, now, r)
  const tenantInvoices = generateInvoices(tenants, now, r)
  const impersonations = generateImpersonations(tenants, now, r)
  const tenantDoctors = generateTenantDoctors(tenants, now, r)
  const tenantPatients = generateTenantPatients(tenants, now, r)
  const team = generateTeam(now)

  const penaltyRules: PenaltyRule[] = [
    {
      id: 'prl_1',
      clinicId: MAIN_CLINIC_ID,
      name: 'Kechikish',
      trigger: 'late',
      // Oyiga ikkita kechikish kechiriladi — hayotda bo'ladigan holat
      threshold: 2,
      amountType: 'fixed',
      amountValue: 50_000,
      positions: [],
      isActive: true,
      createdAt: addDays(today, -180).toISOString(),
    },
    {
      id: 'prl_2',
      clinicId: MAIN_CLINIC_ID,
      name: 'Sababsiz kelmaslik',
      trigger: 'absent',
      threshold: 0,
      amountType: 'percent_of_daily_salary',
      amountValue: 100,
      positions: [],
      isActive: true,
      createdAt: addDays(today, -180).toISOString(),
    },
    {
      id: 'prl_3',
      clinicId: MAIN_CLINIC_ID,
      name: 'Kassa kamomadi',
      trigger: 'cash_shortfall',
      // 10 000 so'mgacha farq e'tiborsiz — mayda pul qaytarishda bo'ladi
      threshold: 10_000,
      amountType: 'percent_of_shortfall',
      amountValue: 100,
      positions: ['receptionist'],
      isActive: true,
      createdAt: addDays(today, -180).toISOString(),
    },
    {
      id: 'prl_4',
      clinicId: MAIN_CLINIC_ID,
      name: 'Davomat vaqtini orqaga surish',
      trigger: 'backdated_attendance',
      threshold: 0,
      amountType: 'fixed',
      amountValue: 100_000,
      positions: ['receptionist'],
      isActive: true,
      createdAt: addDays(today, -120).toISOString(),
    },
  ]
  const bonuses = generateBonuses(r, MAIN_CLINIC_ID, today, staff)

  /* --- Bemor fikrlari --- */

  const feedback = generateFeedback(r, MAIN_CLINIC_ID, mainPatients, doctors, appointments)

  /* --- Oylik yig'ma tarix (prognoz uchun) --- */

  // Joriy oydagi haqiqiy tushum — yig'ma tarix shunga moslashtiriladi
  const monthKey = toISODate(today).slice(0, 7)
  const currentMonthRevenue = payments
    .filter((p) => p.status === 'paid' && p.paidAt.slice(0, 7) === monthKey)
    .reduce((sum, p) => sum + p.amount, 0)

  const chat = generateChat(r, MAIN_CLINIC_ID, today, users)

  const monthlyStats = generateMonthlyStats(
    r,
    MAIN_CLINIC_ID,
    today,
    // Oyning boshida haqiqiy tushum kam bo'ladi - o'rtacha oylikka keltiramiz
    Math.max(currentMonthRevenue * (30 / Math.max(1, today.getDate())), 150_000_000),
  )

  return {
    clinics,
    users,
    doctors,
    services,
    patients,
    appointments,
    visits,
    payments,
    followUps,
    rooms: ward.rooms,
    beds: ward.beds,
    admissions: ward.admissions,
    staff,
    shiftClosures,
    attendance,
    bonuses,
    bonusRules,
    plans,
    tenants,
    tenantInvoices,
    impersonations,
    tenantDoctors,
    tenantPatients,
    team,
    penaltyRules,
    penaltyWaivers: [],
    feedback,
    monthlyStats,
    chatGroups: chat.groups,
    chatMessages: chat.messages,
  }
}

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */

const DIAGNOSIS_BY_COMPLAINT: Record<string, string> = {
  headache: 'Migren, kuchsiz shakl',
  fever: "O'tkir respirator infeksiya",
  cough: "O'tkir bronxit",
  back_pain: 'Bel-dumg‘aza osteoxondrozi',
  stomach_pain: 'Surunkali gastrit, remissiya',
  checkup: 'Patologiya aniqlanmadi',
  fatigue: 'Temir tanqisligi anemiyasi, yengil',
  blood_pressure: 'Arterial gipertenziya, I daraja',
}

const TREATMENTS = [
  'Dori vositalari retsept bo‘yicha, 10 kun. Nazorat ko‘rigi 2 haftadan so‘ng.',
  'Parhez, suyuqlik ko‘p ichish, dam olish rejimi.',
  'Fizioterapiya kursi — 8 seans. Og‘riq saqlansa qayta murojaat.',
  'Qo‘shimcha tahlillar topshirish tavsiya etildi.',
  'Davolash kursi belgilandi, holat yaxshilanmoqda.',
  'Kuzatuv rejimi. Holat o‘zgarsa darhol murojaat qilish.',
]

function makePhone(r: ReturnType<typeof createRandom>): string {
  const code = r.pick(OPERATOR_CODES)
  const a = String(r.int(100, 999))
  const b = String(r.int(10, 99))
  const c = String(r.int(10, 99))
  return `+998 ${code} ${a} ${b} ${c}`
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['`’]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '')
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Shu sanada allaqachon ro'yxatda bo'lgan bemorni tanlash */
function pickPatient(
  r: ReturnType<typeof createRandom>,
  pool: Patient[],
  day: Date,
): Patient | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = r.pick(pool)
    if (new Date(p.createdAt).getTime() <= day.getTime()) return p
  }
  return pool.find((p) => new Date(p.createdAt).getTime() <= day.getTime()) ?? null
}

/** Sanaga qarab realistik holat tanlash */
function pickStatus(
  r: ReturnType<typeof createRandom>,
  isPast: boolean,
  startsAt: Date,
  now: Date,
): AppointmentStatus {
  if (!isPast) {
    // Kelajakdagi qabul: yaqinroq bo'lsa tasdiqlangan bo'lish ehtimoli yuqori
    const daysAhead = (startsAt.getTime() - now.getTime()) / 86_400_000
    return r.chance(daysAhead < 3 ? 0.7 : 0.4) ? 'confirmed' : 'scheduled'
  }

  // Bugun, lekin hozirgi vaqtdan 45 daqiqa ichida — bemor kutmoqda
  const minutesAgo = (now.getTime() - startsAt.getTime()) / 60_000
  if (minutesAgo < 45 && r.chance(0.5)) return 'checked_in'

  return r.weighted<AppointmentStatus>([
    ['completed', 82],
    ['no_show', 7],
    ['cancelled', 11],
  ])
}
