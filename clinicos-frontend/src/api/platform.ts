/**
 * Platforma paneli — ClinicOS ning o'z boshqaruvi.
 *
 * Bu API klinika ichidagi API'lardan BUTUNLAY ajratilgan: u
 * klinikalar, tariflar va obunalar ustida ishlaydi. Bemor, tashrif,
 * to'lov kabi tibbiy va moliyaviy ma'lumotga umuman tegmaydi.
 *
 * NEGA MULTI-TENANCY FILTRI YO'Q: bu yerdagi so'rovlar ataylab
 * BARCHA klinikalarni qamraydi. Shuning uchun `allAcrossTenants()`
 * va `updateAcrossTenants()` ishlatiladi — klinika ma'lumotida
 * bu metodlar HECH QACHON chaqirilmaydi.
 *
 * RUXSAT (SERVERDA MAJBURIY):
 *   `platform.view`        — ko'rish
 *   `platform.manage`      — tarif, holat o'zgartirish
 *   `platform.impersonate` — klinika paneliga kirish
 *
 * Bu ruxsatlar klinika rollariga HECH QACHON berilmaydi. Server
 * har bir so'rovda foydalanuvchi rolini tekshirishi shart —
 * frontenddagi menyu yashirish himoya emas.
 */

import { delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { addDays, toISODate } from '@/lib/dates'
import { COMPLAINT_KEYS, SERVICE_KEYS, SPECIALTIES } from '@/i18n/data'
import type {
  ID,
  ImpersonationLog,
  Metric,
  Paginated,
  Plan,
  PlatformStats,
  Tenant,
  TenantInvoice,
  TenantStatus,
  UZS,
  PlatformDataStats,
  TenantDoctor,
  TenantPatient,
  PlatformMember,
  PlatformPermission,
  PlatformAnalytics,
  PlatformSearchHit,
  PlatformSearchScope,
} from '@/types/models'

/* ------------------------------------------------------------------ */
/* Klinikalar                                                          */
/* ------------------------------------------------------------------ */

export interface TenantQuery {
  search?: string
  status?: TenantStatus | 'all'
  planId?: ID | 'all'
  page?: number
  pageSize?: number
}

// GET /platform/tenants?search=&status=&planId=&page=
export async function listTenants(query: TenantQuery = {}): Promise<Paginated<Tenant>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<Tenant>>('GET', '/platform/tenants', {
      query: {
        search: query.search,
        status: query.status,
        planId: query.planId,
        page,
        pageSize,
      },
    })
  }

  const needle = (query.search ?? '').trim().toLowerCase()

  const rows = getDb()
    .tenants.allAcrossTenants()
    .filter((t) => !query.status || query.status === 'all' || t.status === query.status)
    .filter((t) => !query.planId || query.planId === 'all' || t.planId === query.planId)
    .filter(
      (t) =>
        !needle ||
        t.name.toLowerCase().includes(needle) ||
        t.city.toLowerCase().includes(needle) ||
        t.ownerName.toLowerCase().includes(needle) ||
        t.ownerEmail.toLowerCase().includes(needle),
    )
    // E'tibor talab qiladiganlar tepada: qarzdor → sinovda → qolganlari
    .sort((a, b) => {
      const rank = (t: Tenant) =>
        t.status === 'past_due' ? 0 : t.status === 'trial' ? 1 : 2
      const diff = rank(a) - rank(b)
      if (diff !== 0) return diff
      return b.createdAt.localeCompare(a.createdAt)
    })

  const start = (page - 1) * pageSize

  return delay(
    {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
    },
    200,
  )
}

// GET /platform/tenants/:id
export async function getTenant(id: ID): Promise<Tenant | null> {
  if (!USE_MOCK) return request<Tenant>('GET', `/platform/tenants/${id}`)

  const row = getDb().tenants.allAcrossTenants().find((t) => t.id === id)
  return delay(row ?? null, 150)
}

/**
 * Klinikaning kirishini to'xtatish.
 *
 * MA'LUMOT O'CHIRILMAYDI. To'xtatilgan klinika tizimga kira olmaydi,
 * lekin bemorlari, tashriflari, hisobotlari joyida qoladi — to'lov
 * tiklansa, ish o'sha joydan davom etadi.
 *
 * Sabab MAJBURIY: klinika egasi nima uchun yopilganini bilishi kerak.
 */
// POST /platform/tenants/:id/suspend
export async function suspendTenant(id: ID, reason: string): Promise<Tenant> {
  if (!USE_MOCK) {
    return request<Tenant>('POST', `/platform/tenants/${id}/suspend`, { body: { reason } })
  }

  const updated = getDb().tenants.updateAcrossTenants(id, {
    status: 'suspended',
    suspendReason: reason,
  })
  if (!updated) throw new Error('Klinika topilmadi')
  return delay(updated, 300)
}

// POST /platform/tenants/:id/activate
export async function activateTenant(id: ID): Promise<Tenant> {
  if (!USE_MOCK) return request<Tenant>('POST', `/platform/tenants/${id}/activate`)

  const db = getDb()
  const tenant = db.tenants.allAcrossTenants().find((t) => t.id === id)
  if (!tenant) throw new Error('Klinika topilmadi')

  /*
    Qayta yoqilganda holat sinovga emas, to'lovga qaytadi: sinov
    muddati bir marta beriladi. Keyingi hisob sanasi bir oydan keyin.
  */
  const updated = db.tenants.updateAcrossTenants(id, {
    status: 'active',
    suspendReason: '',
    subscribedAt: tenant.subscribedAt ?? toISODate(new Date()),
    nextInvoiceAt: toISODate(addDays(new Date(), 30)),
  })
  if (!updated) throw new Error('Klinika topilmadi')
  return delay(updated, 300)
}

/**
 * Tarifni o'zgartirish.
 *
 * Yangi narx keyingi hisobdan boshlab qo'llanadi — joriy oy uchun
 * chiqarilgan hisob o'zgarmaydi. Aks holda mijoz allaqachon
 * ko'rgan summa o'zgarib qolardi.
 */
// POST /platform/tenants/:id/plan
export async function changeTenantPlan(id: ID, planId: ID): Promise<Tenant> {
  if (!USE_MOCK) {
    return request<Tenant>('POST', `/platform/tenants/${id}/plan`, { body: { planId } })
  }

  const db = getDb()
  const plan = db.plans.allAcrossTenants().find((p) => p.id === planId)
  if (!plan) throw new Error('Tarif topilmadi')

  const updated = db.tenants.updateAcrossTenants(id, {
    planId: plan.id,
    planName: plan.name,
    pricePerMonth: plan.pricePerMonth,
  })
  if (!updated) throw new Error('Klinika topilmadi')
  return delay(updated, 300)
}

/* ------------------------------------------------------------------ */
/* Tariflar                                                            */
/* ------------------------------------------------------------------ */

// GET /platform/plans
export async function listPlans(): Promise<Plan[]> {
  if (!USE_MOCK) return request<Plan[]>('GET', '/platform/plans')
  return delay(getDb().plans.allAcrossTenants(), 120)
}

export interface PlanInput {
  name: string
  pricePerMonth: UZS
  limits: Plan['limits']
  features: Plan['features']
  isActive: boolean
}

// PATCH /platform/plans/:id
export async function updatePlan(id: ID, patch: Partial<PlanInput>): Promise<Plan> {
  if (!USE_MOCK) return request<Plan>('PATCH', `/platform/plans/${id}`, { body: patch })

  const updated = getDb().plans.updateAcrossTenants(id, patch)
  if (!updated) throw new Error('Tarif topilmadi')
  return delay(updated, 260)
}

/* ------------------------------------------------------------------ */
/* Hisoblar                                                            */
/* ------------------------------------------------------------------ */

export interface InvoiceQuery {
  tenantId?: ID
  status?: TenantInvoice['status'] | 'all'
  page?: number
  pageSize?: number
}

// GET /platform/invoices?tenantId=&status=&page=
export async function listInvoices(
  query: InvoiceQuery = {},
): Promise<Paginated<TenantInvoice>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<TenantInvoice>>('GET', '/platform/invoices', {
      query: { tenantId: query.tenantId, status: query.status, page, pageSize },
    })
  }

  const rows = getDb()
    .tenantInvoices.allAcrossTenants()
    .filter((i) => !query.tenantId || i.tenantId === query.tenantId)
    .filter((i) => !query.status || query.status === 'all' || i.status === query.status)
    // To'lanmaganlar tepada — ular bilan ishlash kerak
    .sort((a, b) => {
      const rank = (i: TenantInvoice) =>
        i.status === 'overdue' ? 0 : i.status === 'pending' ? 1 : 2
      const diff = rank(a) - rank(b)
      if (diff !== 0) return diff
      return b.issuedAt.localeCompare(a.issuedAt)
    })

  const start = (page - 1) * pageSize

  return delay(
    { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize },
    180,
  )
}

/**
 * Hisobni to'langan deb belgilash.
 *
 * DASTURCHIGA: haqiqiy tizimda buni to'lov tizimi (Payme, Click)
 * webhook orqali qiladi. Qo'lda belgilash faqat bank o'tkazmasi
 * kabi holatlar uchun qoladi.
 */
// POST /platform/invoices/:id/paid
export async function markInvoicePaid(id: ID): Promise<TenantInvoice> {
  if (!USE_MOCK) return request<TenantInvoice>('POST', `/platform/invoices/${id}/paid`)

  const db = getDb()
  const invoice = db.tenantInvoices.updateAcrossTenants(id, {
    status: 'paid',
    paidAt: new Date().toISOString(),
  })
  if (!invoice) throw new Error('Hisob topilmadi')

  // Qarzdor klinika to'lasa, holati ham tiklanadi
  const tenant = db.tenants.allAcrossTenants().find((t) => t.id === invoice.tenantId)
  if (tenant?.status === 'past_due') {
    db.tenants.updateAcrossTenants(tenant.id, {
      status: 'active',
      nextInvoiceAt: toISODate(addDays(new Date(), 30)),
    })
  }

  return delay(invoice, 280)
}

/* ------------------------------------------------------------------ */
/* Klinika paneliga kirish                                             */
/* ------------------------------------------------------------------ */

// GET /platform/impersonations
export async function listImpersonations(
  limit = 20,
  tenantId?: ID,
): Promise<ImpersonationLog[]> {
  if (!USE_MOCK) {
    return request<ImpersonationLog[]>('GET', '/platform/impersonations', {
      query: { limit, tenantId },
    })
  }

  const rows = getDb()
    .impersonations.allAcrossTenants()
    .filter((row) => !tenantId || row.tenantId === tenantId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)

  return delay(rows, 140)
}

/**
 * Klinika paneliga yordam uchun kirish.
 *
 * Sabab MAJBURIY va yozuv o'chirilmaydi. Bu imkoniyat kuchli:
 * platforma egasi klinikaning butun panelini ko'radi. Yozuvsiz
 * bunday kirish ishonchni buzadi, shuning uchun har bir kirish
 * qayd etiladi va klinika egasiga ko'rinadi.
 *
 * Server QISQA MUDDATLI token qaytaradi (30 daqiqa) va o'sha
 * sessiyada faqat KO'RISH mumkin — yozish ruxsatlari berilmaydi.
 * Chiqish uchun `endImpersonation()`.
 */
// POST /platform/tenants/:id/impersonate
export async function startImpersonation(
  tenantId: ID,
  adminName: string,
  reason: string,
): Promise<ImpersonationLog> {
  if (!USE_MOCK) {
    return request<ImpersonationLog>('POST', `/platform/tenants/${tenantId}/impersonate`, {
      body: { reason },
    })
  }

  const db = getDb()
  const tenant = db.tenants.allAcrossTenants().find((t) => t.id === tenantId)
  if (!tenant) throw new Error('Klinika topilmadi')

  const log: ImpersonationLog = {
    id: db.impersonations.nextId('imp'),
    tenantId,
    tenantName: tenant.name,
    adminName,
    reason,
    startedAt: new Date().toISOString(),
    endedAt: null,
  }

  db.impersonations.insert(log)
  return delay(log, 260)
}

/**
 * Klinika panelidan chiqish.
 *
 * Server kirish yozuvini yopadi, shundan keyin kirish tokeni
 * yaroqsiz bo'ladi. Id yuborilmaydi — server uni tokendan oladi,
 * ya'ni odam faqat o'zi kirgan sessiyani yopa oladi.
 */
// POST /platform/impersonations/end
export async function endImpersonation(): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('POST', '/platform/impersonations/end')
    return
  }
  await delay(null, 120)
}

/* ------------------------------------------------------------------ */
/* Platforma ko'rsatkichlari                                           */
/* ------------------------------------------------------------------ */

/** Ikki qiymatni Metric ko'rinishiga keltirish */
function metric(value: number, previous: number): Metric {
  return {
    value,
    changePct: previous > 0 ? ((value - previous) / previous) * 100 : null,
  }
}

// GET /platform/stats
export async function getPlatformStats(): Promise<PlatformStats> {
  if (!USE_MOCK) return request<PlatformStats>('GET', '/platform/stats')

  const db = getDb()
  const tenants = db.tenants.allAcrossTenants()
  const plans = db.plans.allAcrossTenants()
  const invoices = db.tenantInvoices.allAcrossTenants()

  const now = new Date()
  const thisMonth = toISODate(now).slice(0, 7)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = toISODate(lastMonthDate).slice(0, 7)

  const countOf = (status: TenantStatus) =>
    tenants.filter((t) => t.status === status).length

  /*
    MRR — faqat HAQIQATDA to'layotgan klinikalardan.

    Sinovdagi klinika hali pul to'lamaydi, to'xtatilgani ham. Ularni
    MRR ga qo'shish o'zini aldash bo'ladi. Qarzdor klinika hisobga
    olinadi: u hali mijoz va odatda to'laydi.
  */
  const payingNow = tenants.filter(
    (t) => t.status === 'active' || t.status === 'past_due',
  )
  const mrrValue = payingNow.reduce((sum, t) => sum + t.pricePerMonth, 0)

  /*
    O'tgan oy MRR — AYNAN SHU o'lchov bilan, bir oy oldingi holatda:
    o'sha paytda allaqachon obuna bo'lganlar.

    Hisoblardan olish ham mumkin edi, lekin u boshqa o'lchov: hisob
    chiqarilgani bilan obuna bo'lgani bir xil emas. Ikki xil manbani
    solishtirish esa ma'nosiz foiz beradi.
  */
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const lastMonthEndKey = toISODate(lastMonthEnd)

  const mrrPrevious = tenants
    .filter((t) => t.subscribedAt !== null && t.subscribedAt <= lastMonthEndKey)
    // O'sha paytda hali ketmagan va to'xtatilmaganlar
    .filter((t) => t.status !== 'cancelled')
    .reduce((sum, t) => sum + t.pricePerMonth, 0)

  const newThisMonth = tenants.filter(
    (t) => t.createdAt.slice(0, 7) === thisMonth,
  ).length
  const newLastMonth = tenants.filter(
    (t) => t.createdAt.slice(0, 7) === lastMonth,
  ).length

  const churnedTotal = countOf('cancelled')
  const activeTotal = payingNow.length

  /* --- Oylar bo'yicha tarix --- */

  const history: PlatformStats['history'] = []
  for (let back = 11; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

    const monthInvoices = invoices.filter((i) => i.period === period)

    history.push({
      period,
      mrr: monthInvoices.reduce((sum, i) => sum + i.amount, 0),
      tenants: monthInvoices.length,
    })
  }

  /* --- Tarif kesimi --- */

  const byPlan = plans.map((plan) => {
    const rows = payingNow.filter((t) => t.planId === plan.id)
    return {
      planId: plan.id,
      planName: plan.name,
      count: rows.length,
      mrr: rows.reduce((sum, t) => sum + t.pricePerMonth, 0),
    }
  })

  /* --- To'lanmagan hisoblar --- */

  const overdueRows = invoices.filter((i) => i.status === 'overdue')

  /*
    Sinovdan to'lovga o'tish ulushi.

    Maxraj — sinovni TUGATGANLAR: hozir sinovda turganlar kirmaydi,
    chunki ularning taqdiri hali ma'lum emas.

    Surat — ulardan hech bo'lmasa bir marta to'lovga o'tganlar
    (`subscribedAt` bor). Keyinchalik ketgan bo'lsa ham, u sinovni
    muvaffaqiyatli o'tgan — bu boshqa ko'rsatkich (churn) hisobi.
  */
  const finishedTrial = tenants.filter((t) => t.status !== 'trial').length
  const converted = tenants.filter(
    (t) => t.status !== 'trial' && t.subscribedAt !== null,
  ).length

  return delay(
    {
      tenants: {
        total: tenants.length,
        trial: countOf('trial'),
        active: countOf('active'),
        pastDue: countOf('past_due'),
        suspended: countOf('suspended'),
        cancelled: churnedTotal,
      },
      mrr: metric(mrrValue, mrrPrevious),
      newThisMonth: metric(newThisMonth, newLastMonth),
      churnedThisMonth: metric(churnedTotal, churnedTotal),
      churnRate: activeTotal > 0 ? (churnedTotal / (activeTotal + churnedTotal)) * 100 : 0,
      trialConversionRate: finishedTrial > 0 ? (converted / finishedTrial) * 100 : 0,
      byPlan,
      history,
      overdue: {
        count: overdueRows.length,
        amount: overdueRows.reduce((sum, i) => sum + i.amount, 0),
      },
    },
    260,
  )
}

/* ------------------------------------------------------------------ */
/* Ma'lumot bazasi                                                     */
/* ------------------------------------------------------------------ */

/**
 * Barqaror "tasodifiy" son — matn kalitidan hosil qilinadi.
 *
 * NEGA `Math.random` EMAS: bu ko'rsatkichlar har sahifa ochilganda
 * o'zgarib tursa, ularga ishonib bo'lmaydi. Bir xil kalit har doim
 * bir xil son beradi, shuning uchun raqamlar barqaror.
 */
function hashed(key: string, min: number, max: number): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const unit = ((h >>> 0) % 10_000) / 10_000
  return min + unit * (max - min)
}

/**
 * Platformada to'plangan bozor ma'lumoti.
 *
 * MANBA: hamma klinikalarning JAMLANGAN ko'rsatkichlari. Hech qanday
 * bemor yozuvi bu yerga kirmaydi — faqat yig'indi va ulushlar.
 *
 * DASTURCHIGA: haqiqiy tizimda buni har kecha bir marta hisoblab,
 * alohida jadvalga yozish kerak. Har so'rovda butun bazani sanash
 * o'nlab klinika bo'lganda ham og'ir bo'ladi.
 */
// GET /platform/data
export async function getPlatformData(): Promise<PlatformDataStats> {
  if (!USE_MOCK) return request<PlatformDataStats>('GET', '/platform/data')

  const db = getDb()
  const tenants = db.tenants.allAcrossTenants()
  const now = new Date()

  /* --- Umumiy hajm --- */

  const patients = tenants.reduce((sum, t) => sum + t.usage.patients, 0)
  const doctors = tenants.reduce((sum, t) => sum + t.usage.doctors, 0)

  /*
    Butun tarix bo'yicha qabullar taxminan: klinikaning bu oydagi
    qabuli × platformada necha oy turgani. Aniq son server tomonda
    haqiqiy yozuvlardan olinadi.
  */
  const appointments = tenants.reduce((sum, t) => {
    const months = Math.max(
      1,
      Math.round(
        (now.getTime() - new Date(t.createdAt).getTime()) / (30 * 86_400_000),
      ),
    )
    return sum + t.usage.appointmentsThisMonth * months
  }, 0)

  const oldest = tenants.reduce(
    (min, t) => (t.createdAt < min ? t.createdAt : min),
    tenants[0]?.createdAt ?? now.toISOString(),
  )

  /* --- Baza o'sishi --- */

  const growth: PlatformDataStats['growth'] = []
  for (let back = 11; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

    // O'sha oyga qadar ro'yxatdan o'tgan klinikalar
    const active = tenants.filter((t) => new Date(t.createdAt) <= month)

    growth.push({
      period,
      patients: active.reduce((sum, t) => sum + t.usage.patients, 0),
      appointments: active.reduce((sum, t) => sum + t.usage.appointmentsThisMonth, 0),
    })
  }

  /* --- Hududlar --- */

  const cityMap = new Map<string, { clinics: number; patients: number }>()
  for (const tenant of tenants) {
    const row = cityMap.get(tenant.city) ?? { clinics: 0, patients: 0 }
    row.clinics += 1
    row.patients += tenant.usage.patients
    cityMap.set(tenant.city, row)
  }

  const byCity = [...cityMap.entries()]
    .map(([city, row]) => ({
      city,
      clinics: row.clinics,
      patients: row.patients,
      // Hududlar orasidagi narx farqi — poytaxtda qimmatroq
      avgCheck: Math.round(hashed(`check_${city}`, 90_000, 240_000) / 1000) * 1000,
    }))
    .sort((a, b) => b.patients - a.patients)

  /* --- Xizmatlar bozori --- */

  const rawShares = SERVICE_KEYS.map((key) => ({
    key,
    weight: hashed(`share_${key}`, 1, 10),
  }))
  const totalWeight = rawShares.reduce((sum, r) => sum + r.weight, 0)

  const topServices = rawShares
    .map((row) => {
      const avgPrice = Math.round(hashed(`price_${row.key}`, 60_000, 480_000) / 5000) * 5000
      // Klinikalar orasidagi tarqoqlik — bozor uchun eng qimmatli raqam
      const spread = hashed(`spread_${row.key}`, 0.18, 0.55)

      return {
        key: row.key,
        share: (row.weight / totalWeight) * 100,
        avgPrice,
        priceMin: Math.round((avgPrice * (1 - spread)) / 5000) * 5000,
        priceMax: Math.round((avgPrice * (1 + spread)) / 5000) * 5000,
      }
    })
    .sort((a, b) => b.share - a.share)
    .slice(0, 8)

  /* --- Mutaxassisliklar --- */

  const specWeights = SPECIALTIES.map((key) => ({
    key,
    weight: hashed(`spec_${key}`, 1, 8),
  }))
  const specTotal = specWeights.reduce((sum, r) => sum + r.weight, 0)

  const bySpecialty = specWeights
    .map((row) => ({
      key: row.key,
      share: (row.weight / specTotal) * 100,
      changePct: hashed(`spec_ch_${row.key}`, -14, 32),
    }))
    .sort((a, b) => b.share - a.share)

  /* --- Bemorlar qanday muammo bilan kelgan --- */

  const condWeights = COMPLAINT_KEYS.map((key) => ({
    key,
    weight: hashed(`cond_${key}`, 1, 9),
  }))
  const condTotal = condWeights.reduce((sum, r) => sum + r.weight, 0)

  const byCondition = condWeights
    .map((row) => ({
      key: row.key,
      share: (row.weight / condTotal) * 100,
      changePct: hashed(`cond_ch_${row.key}`, -18, 36),
      avgVisits: Math.round(hashed(`cond_v_${row.key}`, 1.2, 4.6) * 10) / 10,
    }))
    .sort((a, b) => b.share - a.share)

  /* --- Mavsumiylik --- */

  const seasonality = Array.from({ length: 12 }, (_, i) => ({
    month: i,
    index: Math.round(hashed(`season_${i}`, 72, 134)),
  }))

  return delay(
    {
      totals: {
        clinics: tenants.length,
        patients,
        doctors,
        appointments,
        since: toISODate(new Date(oldest)),
      },
      growth,
      byCity,
      topServices,
      bySpecialty,
      byCondition,
      seasonality,
    },
    280,
  )
}

/* ------------------------------------------------------------------ */
/* Klinikalar kesimidagi ro'yxatlar                                    */
/* ------------------------------------------------------------------ */

/**
 * Shifokorlar ro'yxati — klinikalar kesimida.
 *
 * NEGA KONTAKT BILAN: klinikalar tarmog'ini qurishda shifokorlar
 * bilan bevosita ishlash kerak bo'ladi. Bu klinikaning XODIMI
 * haqidagi ish ma'lumoti — bemor ma'lumoti emas.
 */
// GET /platform/doctors?tenantId=&search=&page=
export interface DoctorQuery {
  tenantId?: ID
  search?: string
  /** Mutaxassislik kaliti */
  specialty?: string
  /** Eng kam reyting: 4 = "4 va undan yuqori" */
  minRating?: number
  /** Eng kam qabullar soni (30 kunda) */
  minLoad?: number
  /** Eng kam oylik */
  minPay?: number
  sort?: 'load' | 'rating' | 'name' | 'pay'
  page?: number
  pageSize?: number
}

export async function listTenantDoctors(
  query: DoctorQuery = {},
): Promise<Paginated<TenantDoctor>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<TenantDoctor>>('GET', '/platform/doctors', {
      query: {
        tenantId: query.tenantId,
        search: query.search,
        specialty: query.specialty,
        minRating: query.minRating,
        minLoad: query.minLoad,
        minPay: query.minPay,
        sort: query.sort,
        page,
        pageSize,
      },
    })
  }

  const needle = (query.search ?? '').trim().toLowerCase()

  const rows = getDb()
    .tenantDoctors.allAcrossTenants()
    .filter((d) => !query.tenantId || d.tenantId === query.tenantId)
    .filter((d) => !query.specialty || d.specialty === query.specialty)
    /*
      Reyting bo'yicha filtrda bahosi YO'Q shifokorlar chiqmaydi.
      "4 va undan yuqori" so'ralganda bahosi noma'lum odamni
      ko'rsatish — javobni buzish.
    */
    .filter((d) => !query.minRating || (d.rating !== null && d.rating >= query.minRating))
    .filter((d) => !query.minLoad || d.completedLast30d >= query.minLoad)
    .filter((d) => !query.minPay || d.monthlyPay >= query.minPay)
    .filter(
      (d) =>
        !needle ||
        d.fullName.toLowerCase().includes(needle) ||
        d.tenantName.toLowerCase().includes(needle) ||
        d.phone.includes(needle),
    )
    .sort((a, b) => {
      if (query.sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (query.sort === 'pay') return b.monthlyPay - a.monthlyPay
      if (query.sort === 'name') return a.fullName.localeCompare(b.fullName)
      return b.completedLast30d - a.completedLast30d
    })

  const start = (page - 1) * pageSize

  return delay(
    { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize },
    200,
  )
}

/**
 * Bemorlar ro'yxati — klinikalar kesimida.
 *
 * TIBBIY MA'LUMOT YO'Q: tashxis, davolash, tashrif yozuvi bu yerga
 * chiqmaydi. Ko'rinadigan narsa — kim, qachon, necha marta, qancha.
 *
 * MAQSAD: klinikaning halol ishlayotganini tekshirish (masalan
 * tashrif ko'p, tushum kam) va xizmat sifatini baholash (qaytib
 * kelganlar ulushi). Buning uchun tashxis kerak emas.
 *
 * DASTURCHIGA: bu eng nozik so'rov. Serverda u ALOHIDA ruxsat talab
 * qilishi, har bir chaqiruv audit jurnaliga yozilishi va javob
 * sahifalanishi kerak. Butun bazani bir so'rovda berish — xavf.
 */
// GET /platform/patients?tenantId=&search=&page=
/** Yosh guruhlari — filtrda tanlanadigan oraliqlar */
export const AGE_GROUPS: { key: string; min: number; max: number }[] = [
  { key: 'child', min: 0, max: 17 },
  { key: 'young', min: 18, max: 34 },
  { key: 'adult', min: 35, max: 54 },
  { key: 'senior', min: 55, max: 200 },
]

export interface PatientQuery {
  tenantId?: ID
  search?: string
  /** Shahar */
  city?: string
  /** Murojaat sababi */
  condition?: string
  /** Yosh guruhi kaliti */
  ageGroup?: string
  /** Eng kam tashriflar soni */
  minVisits?: number
  /** Eng kam to'lagan summa */
  minSpent?: number
  sort?: 'recent' | 'visits' | 'spent'
  page?: number
  pageSize?: number
}

export async function listTenantPatients(
  query: PatientQuery = {},
): Promise<Paginated<TenantPatient>> {
  const { page = 1, pageSize = 20 } = query

  if (!USE_MOCK) {
    return request<Paginated<TenantPatient>>('GET', '/platform/patients', {
      query: {
        tenantId: query.tenantId,
        search: query.search,
        city: query.city,
        condition: query.condition,
        ageGroup: query.ageGroup,
        minVisits: query.minVisits,
        minSpent: query.minSpent,
        sort: query.sort,
        page,
        pageSize,
      },
    })
  }

  const needle = (query.search ?? '').trim().toLowerCase()
  const group = AGE_GROUPS.find((g) => g.key === query.ageGroup)

  const rows = getDb()
    .tenantPatients.allAcrossTenants()
    .filter((p) => !query.tenantId || p.tenantId === query.tenantId)
    .filter((p) => !query.city || p.city === query.city)
    .filter((p) => !query.condition || p.condition === query.condition)
    .filter((p) => !group || (p.age >= group.min && p.age <= group.max))
    .filter((p) => !query.minVisits || p.visitCount >= query.minVisits)
    .filter((p) => !query.minSpent || p.totalSpent >= query.minSpent)
    .filter(
      (p) =>
        !needle ||
        p.fullName.toLowerCase().includes(needle) ||
        p.tenantName.toLowerCase().includes(needle) ||
        p.phone.includes(needle),
    )
    .sort((a, b) => {
      if (query.sort === 'visits') return b.visitCount - a.visitCount
      if (query.sort === 'spent') return b.totalSpent - a.totalSpent
      return (b.lastVisitAt ?? '').localeCompare(a.lastVisitAt ?? '')
    })

  const start = (page - 1) * pageSize

  return delay(
    { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize },
    220,
  )
}

/* ------------------------------------------------------------------ */
/* Platforma jamoasi                                                   */
/* ------------------------------------------------------------------ */

// GET /platform/team
export async function listTeam(): Promise<PlatformMember[]> {
  if (!USE_MOCK) return request<PlatformMember[]>('GET', '/platform/team')

  const rows = getDb()
    .team.allAcrossTenants()
    .sort((a, b) => Number(b.isActive) - Number(a.isActive))

  return delay(rows, 160)
}

export interface MemberInput {
  fullName: string
  email: string
  phone: string
  position: string
  permissions: PlatformPermission[]
  isActive: boolean
}

// POST /platform/team
export async function createMember(input: MemberInput): Promise<PlatformMember> {
  if (!USE_MOCK) return request<PlatformMember>('POST', '/platform/team', { body: input })

  const db = getDb()
  const member: PlatformMember = {
    id: db.team.nextId('pm'),
    lastActiveAt: null,
    createdAt: new Date().toISOString(),
    ...input,
  }

  db.team.insert(member)
  return delay(member, 300)
}

/**
 * Xodimni tahrirlash — ruxsatlar ham shu yerda o'zgaradi.
 *
 * DASTURCHIGA: ruxsat o'zgarishi audit jurnaliga yozilishi kerak.
 * "Kim kimga bemorlar ro'yxatini ochgan" degan savolga javob
 * bo'lishi shart.
 */
// PATCH /platform/team/:id
export async function updateMember(
  id: ID,
  patch: Partial<MemberInput>,
): Promise<PlatformMember> {
  if (!USE_MOCK) return request<PlatformMember>('PATCH', `/platform/team/${id}`, { body: patch })

  const updated = getDb().team.updateAcrossTenants(id, patch)
  if (!updated) throw new Error('Xodim topilmadi')
  return delay(updated, 260)
}

// DELETE /platform/team/:id
export async function deleteMember(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('DELETE', `/platform/team/${id}`)
    return
  }
  getDb().team.removeAcrossTenants(id)
  await delay(null, 220)
}

/* ------------------------------------------------------------------ */
/* Platforma analitikasi                                               */
/* ------------------------------------------------------------------ */

/**
 * Klinikalarning o'rtacha maosh fondi — aylanmaning ulushi sifatida.
 *
 * NEGA TAXMINIY: klinikalarning haqiqiy maosh fondi tizimda bor,
 * lekin platforma darajasida uni yig'ish uchun har bir klinikaning
 * xodimlar jadvaliga kirish kerak bo'ladi. Bu esa ortiqcha kirish.
 *
 * O'zbekistondagi xususiy klinikalarda maosh odatda aylanmaning
 * 45–55 foizini tashkil qiladi. Shuning uchun 50% olinadi va
 * natija ATAYLAB "taxminiy" deb ataladi.
 */
const PAYROLL_SHARE = 0.5

/**
 * Bir qabuldan o'rtacha tushum.
 *
 * Klinikalarning haqiqiy narxlari turlicha, lekin platforma
 * darajasidagi baho uchun o'rtacha chek yetarli.
 */
const AVG_CHECK = 180_000

// GET /platform/analytics
export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  if (!USE_MOCK) return request<PlatformAnalytics>('GET', '/platform/analytics')

  const db = getDb()
  const tenants = db.tenants.allAcrossTenants()
  const doctors = db.tenantDoctors.allAcrossTenants()
  const patients = db.tenantPatients.allAcrossTenants()

  const now = new Date()

  /* --- Aylanma --- */

  const active = tenants.filter(
    (t) => t.status === 'active' || t.status === 'past_due' || t.status === 'trial',
  )

  const turnoverOf = (tenant: (typeof tenants)[number]) =>
    tenant.usage.appointmentsThisMonth * AVG_CHECK

  const turnover = active.reduce((sum, t) => sum + turnoverOf(t), 0)
  const profit = Math.round(turnover * (1 - PAYROLL_SHARE))

  const ourRevenue = tenants
    .filter((t) => t.status === 'active' || t.status === 'past_due')
    .reduce((sum, t) => sum + t.pricePerMonth, 0)

  /*
    O'tgan oy bilan solishtirish uchun bir oy oldin ro'yxatda
    bo'lgan klinikalar olinadi. Yangi qo'shilganlar o'sishni
    ko'rsatadi, bu to'g'ri.
  */
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const before = active.filter((t) => new Date(t.createdAt) <= lastMonthStart)

  const turnoverPrev = before.reduce((sum, t) => sum + turnoverOf(t), 0)
  const ourRevenuePrev = before
    .filter((t) => t.status === 'active' || t.status === 'past_due')
    .reduce((sum, t) => sum + t.pricePerMonth, 0)

  /* --- Tarix --- */

  const history: PlatformAnalytics['history'] = []
  for (let back = 11; back >= 0; back--) {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const period = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

    const live = active.filter((t) => new Date(t.createdAt) <= month)
    const monthTurnover = live.reduce((sum, t) => sum + turnoverOf(t), 0)

    history.push({
      period,
      turnover: monthTurnover,
      profit: Math.round(monthTurnover * (1 - PAYROLL_SHARE)),
      ourRevenue: live.reduce((sum, t) => sum + t.pricePerMonth, 0),
    })
  }

  /* --- Eng kuchli klinikalar --- */

  const topClinics = active
    .map((tenant) => {
      const value = turnoverOf(tenant)
      return {
        tenantId: tenant.id,
        name: tenant.name,
        city: tenant.city,
        planName: tenant.planName,
        turnover: value,
        profit: Math.round(value * (1 - PAYROLL_SHARE)),
        patients: tenant.usage.patients,
        perPatient:
          tenant.usage.patients > 0 ? Math.round(value / tenant.usage.patients) : 0,
      }
    })
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 10)

  /* --- Eng ko'p daromad keltirgan shifokorlar --- */

  const topDoctors = doctors
    .filter((d) => d.status === 'active')
    .map((doctor) => ({
      id: doctor.id,
      fullName: doctor.fullName,
      tenantName: doctor.tenantName,
      specialty: doctor.specialty,
      revenue: doctor.completedLast30d * AVG_CHECK,
      appointments: doctor.completedLast30d,
      rating: doctor.rating,
      monthlyPay: doctor.monthlyPay,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  /*
    Maosh bo'yicha reyting.

    Daromad reytingidan ALOHIDA, chunki ular bir xil emas: foizli
    shifokor ko'p daromad keltirib, o'zi kam olishi mumkin. Tarmoq
    qurishda aynan ikkinchi raqam kerak — raqobatchiga o'tib
    ketmasligi uchun qancha taklif qilish kerakligi shundan chiqadi.
  */
  const topPaid = doctors
    .filter((d) => d.status === 'active')
    .map((doctor) => ({
      id: doctor.id,
      fullName: doctor.fullName,
      tenantName: doctor.tenantName,
      specialty: doctor.specialty,
      monthlyPay: doctor.monthlyPay,
      payType: doctor.payType,
      percentRate: doctor.percentRate,
      revenue: doctor.completedLast30d * AVG_CHECK,
    }))
    .sort((a, b) => b.monthlyPay - a.monthlyPay)
    .slice(0, 10)

  /** Bozordagi o'rtacha oylik — taklif tayyorlashda tayanch raqam */
  const activeDoctors = doctors.filter((d) => d.status === 'active')
  const avgPay =
    activeDoctors.length > 0
      ? Math.round(
          activeDoctors.reduce((sum, d) => sum + d.monthlyPay, 0) / activeDoctors.length,
        )
      : 0

  /* --- Murojaat sabablari — haqiqiy bemor yozuvlaridan --- */

  const condCounts = new Map<string, number>()
  for (const patient of patients) {
    condCounts.set(patient.condition, (condCounts.get(patient.condition) ?? 0) + 1)
  }

  const condTotal = patients.length || 1
  const topConditions = [...condCounts.entries()]
    .map(([key, count]) => ({
      key,
      share: (count / condTotal) * 100,
      changePct: hashed(`cond_ch_${key}`, -18, 36),
    }))
    .sort((a, b) => b.share - a.share)

  /* --- Mutaxassisliklar bo'yicha daromad --- */

  const specRevenue = new Map<string, number>()
  for (const doctor of doctors) {
    if (doctor.status !== 'active') continue
    const value = doctor.completedLast30d * AVG_CHECK
    specRevenue.set(doctor.specialty, (specRevenue.get(doctor.specialty) ?? 0) + value)
  }

  const specTotal = [...specRevenue.values()].reduce((sum, v) => sum + v, 0) || 1
  const revenueBySpecialty = [...specRevenue.entries()]
    .map(([key, revenue]) => ({ key, revenue, share: (revenue / specTotal) * 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  const metricOf = (value: number, previous: number): Metric => ({
    value,
    changePct: previous > 0 ? ((value - previous) / previous) * 100 : null,
  })

  return delay(
    {
      turnover: metricOf(turnover, turnoverPrev),
      estimatedProfit: metricOf(profit, Math.round(turnoverPrev * (1 - PAYROLL_SHARE))),
      payrollShare: PAYROLL_SHARE * 100,
      ourRevenue: metricOf(ourRevenue, ourRevenuePrev),
      takeRate: turnover > 0 ? (ourRevenue / turnover) * 100 : 0,
      history,
      topClinics,
      topDoctors,
      topPaid,
      avgPay,
      topConditions,
      revenueBySpecialty,
    },
    300,
  )
}

/* ------------------------------------------------------------------ */
/* Platforma qidiruvi                                                  */
/* ------------------------------------------------------------------ */

/**
 * Klinikalar, shifokorlar va bemorlar bo'yicha yagona qidiruv.
 *
 * NEGA TURKUM BILAN: "Karimov" deb qidirsangiz, ham shifokor, ham
 * bemor chiqadi. Qaysi biri kerakligini oldindan aytish — natijani
 * o'nlab qatordan tozalab o'tirishdan tez.
 *
 * Har bir turkumdan cheklangan soni olinadi: qidiruv oynasi javob
 * berish uchun, ro'yxatni almashtirish uchun emas. To'liq ro'yxat
 * "Ro'yxatlar" bo'limida, u yerda filtrlar ham bor.
 */
// GET /platform/search?q=&scope=
export async function platformSearch(
  query: string,
  scope: PlatformSearchScope = 'all',
): Promise<PlatformSearchHit[]> {
  if (!USE_MOCK) {
    return request<PlatformSearchHit[]>('GET', '/platform/search', {
      query: { q: query, scope },
    })
  }

  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return delay([], 60)

  const db = getDb()
  const hits: PlatformSearchHit[] = []

  // Bitta turkumdan nechta natija ko'rsatiladi
  const LIMIT = 5

  if (scope === 'all' || scope === 'clinic') {
    db.tenants
      .allAcrossTenants()
      .filter(
        (t) =>
          t.name.toLowerCase().includes(needle) ||
          t.city.toLowerCase().includes(needle) ||
          t.ownerName.toLowerCase().includes(needle),
      )
      .slice(0, LIMIT)
      .forEach((t) =>
        hits.push({
          id: t.id,
          scope: 'clinic',
          title: t.name,
          subtitle: `${t.city} · ${t.ownerName}`,
          meta: t.planName,
          href: `/platform/clinics/${t.id}`,
        }),
      )
  }

  if (scope === 'all' || scope === 'doctor') {
    db.tenantDoctors
      .allAcrossTenants()
      .filter(
        (d) =>
          d.fullName.toLowerCase().includes(needle) ||
          d.phone.includes(needle) ||
          d.tenantName.toLowerCase().includes(needle),
      )
      .slice(0, LIMIT)
      .forEach((d) =>
        hits.push({
          id: d.id,
          scope: 'doctor',
          title: d.fullName,
          subtitle: d.tenantName,
          meta: d.phone,
          // Topilgan shifokorni ro'yxatda ko'rsatamiz — ismi bo'yicha
          href: `/platform/registry?view=doctors&tenant=${d.tenantId}`,
        }),
      )
  }

  if (scope === 'all' || scope === 'patient') {
    db.tenantPatients
      .allAcrossTenants()
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(needle) ||
          p.phone.includes(needle) ||
          p.tenantName.toLowerCase().includes(needle),
      )
      .slice(0, LIMIT)
      .forEach((p) =>
        hits.push({
          id: p.id,
          scope: 'patient',
          title: p.fullName,
          subtitle: `${p.tenantName} · ${p.city}`,
          meta: p.phone,
          href: `/platform/registry?view=patients&tenant=${p.tenantId}`,
        }),
      )
  }

  return delay(hits, 180)
}
