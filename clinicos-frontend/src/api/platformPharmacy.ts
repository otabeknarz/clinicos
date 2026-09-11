/**
 * PLATFORMA: APTEKALAR.
 *
 * Apteka — platformaning ALOHIDA mijozi. Klinikaga biriktirilmaydi
 * va klinikalar bilan bir ro'yxatga qo'shilmaydi: o'z egasi, o'z
 * xodimlari, o'z holati bor. Ma'lumotlari aptekaning `id` si
 * ostida saqlanadi (`types/pharmacy.ts` dagi `Pharmacy` izohi).
 *
 * HOZIRCHA FAQAT DEMO QATLAMI — `pharmacy.ts` dagi sababdan. Backend
 * yozilmagan, `// GET /path` izohlari esa backenddagi
 * `check:endpoints` uchun manba: marshrut bo'lmasa tekshiruv
 * yiqilardi. Kelajakdagi yo'l har bir funksiya ustida oddiy matn
 * bilan yozilgan; backend yozilganda izohga aylanadi.
 *
 * PLATFORMA EGASI APTEKANING ICHIGA KIRMAYDI. Dori nomlari, kimga
 * nima sotilgani, retseptdagi bemor — hech biri bu yerda yo'q.
 * Faqat sonlar: tushum, cheklar, kassa farqi, zaxira holati.
 * Klinika kartasidagi "bemor ma'lumoti yo'q" qoidasi bilan bir xil.
 */
import { delay } from './client'
import { EXPIRY_WARN_DAYS, LOW_STOCK, daysUntil } from './pharmacy'
import { getDb } from '@/mock/db'
import { addDays, toISODate } from '@/lib/dates'
import type { ID, ISODate, ISODateTime, OwnerPasswordReset, UZS } from '@/types/models'
import type { Pharmacy, PharmacyStaff } from '@/types/pharmacy'

/** Kuzatuv oynasi — ro'yxat ham, karta ham shu davrni oladi */
export const WATCH_DAYS = 30

export interface PharmacyOverview extends Pharmacy {
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  /** Ishlayotgan xodimlar, rahbar bilan */
  staffCount: number
  /* --- Oxirgi 30 kun --- */
  revenue: UZS
  receipts: number
  todayRevenue: UZS
  /** Sotuvchi ogohlantirishni ko'rib turib kam summa bilan yopgan smenalar */
  flaggedShifts: number
  /** Kamomad yig'indisi — musbat son */
  cashShort: UZS
  /* --- Zaxira, hozir --- */
  expiringBatches: number
  /** Muddati o'tgan, lekin javonda turgan partiyalar */
  expiredBatches: number
  lowStock: number
  lastSaleAt: ISODateTime | null
}

export interface PharmacyStaffRow
  extends Pick<
    PharmacyStaff,
    'id' | 'fullName' | 'role' | 'login' | 'status' | 'shiftStart' | 'shiftEnd'
  > {
  lastLoginAt: ISODateTime | null
}

export interface PharmacyShiftRow {
  id: ID
  date: ISODate
  sellerName: string
  handedToName: string
  difference: UZS
  flagged: boolean
}

export interface PharmacyDetail extends PharmacyOverview {
  profit: UZS
  avgReceipt: UZS
  /** Kunlik tushum, eskisidan yangisiga — grafik uchun */
  daily: { date: ISODate; revenue: UZS }[]
  medicines: number
  outOfStock: number
  /** Javondagi tovar tannarxda */
  stockValue: UZS
  pendingPrescriptions: number
  staff: PharmacyStaffRow[]
  /** Oxirgi 30 kundagi smenalar, yangisi birinchi */
  shifts: PharmacyShiftRow[]
}

/* ------------------------------------------------------------------ */
/* Hisoblash                                                           */
/* ------------------------------------------------------------------ */

function overviewOf(pharmacy: Pharmacy): PharmacyOverview {
  const db = getDb()
  /* Aptekaning ma'lumot kaliti — o'z id si */
  const key = pharmacy.id

  const since = addDays(new Date(), -WATCH_DAYS).getTime()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const allSales = db.sales.all(key)
  const sales = allSales.filter((s) => new Date(s.soldAt).getTime() >= since)
  const shifts = db.pharmacyShifts
    .all(key)
    .filter((s) => new Date(s.date).getTime() >= since)
  const batches = db.batches.all(key).filter((b) => b.quantity > 0)
  const medicines = db.medicines.all(key).filter((m) => m.status === 'active')

  const stock = new Map<string, number>()
  for (const batch of batches) {
    stock.set(batch.medicineId, (stock.get(batch.medicineId) ?? 0) + batch.quantity)
  }

  const owner = db.users.allAcrossTenants().find((u) => u.id === pharmacy.ownerUserId)

  return {
    ...pharmacy,
    ownerName: owner?.fullName ?? '',
    ownerEmail: owner?.email ?? '',
    ownerPhone: owner?.phone ?? '',
    staffCount: db.pharmacyStaff.all(key).filter((s) => s.status === 'active').length,
    revenue: sales.reduce((sum, s) => sum + s.total - s.discount, 0),
    receipts: sales.length,
    todayRevenue: sales
      .filter((s) => new Date(s.soldAt).getTime() >= todayStart.getTime())
      .reduce((sum, s) => sum + s.total - s.discount, 0),
    flaggedShifts: shifts.filter((s) => s.flagged).length,
    cashShort: shifts
      .filter((s) => s.difference < 0)
      .reduce((sum, s) => sum - s.difference, 0),
    expiringBatches: batches.filter((b) => {
      const left = daysUntil(b.expiresAt)
      return left >= 0 && left <= EXPIRY_WARN_DAYS
    }).length,
    expiredBatches: batches.filter((b) => daysUntil(b.expiresAt) < 0).length,
    lowStock: medicines.filter((m) => {
      const qty = stock.get(m.id) ?? 0
      return qty > 0 && qty <= LOW_STOCK
    }).length,
    lastSaleAt:
      allSales
        .map((s) => s.soldAt)
        .sort()
        .at(-1) ?? null,
  }
}

function detailOf(pharmacy: Pharmacy): PharmacyDetail {
  const db = getDb()
  const key = pharmacy.id
  const base = overviewOf(pharmacy)

  const since = addDays(new Date(), -WATCH_DAYS).getTime()
  const sales = db.sales.all(key).filter((s) => new Date(s.soldAt).getTime() >= since)

  /* Har bir kun bo'sh bo'lsa ham qator bo'ladi — grafikda teshik qolmasin */
  const byDay = new Map<string, number>()
  for (let i = WATCH_DAYS - 1; i >= 0; i--) {
    byDay.set(toISODate(addDays(new Date(), -i)), 0)
  }
  for (const sale of sales) {
    const day = toISODate(new Date(sale.soldAt))
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + sale.total - sale.discount)
  }

  const batches = db.batches.all(key).filter((b) => b.quantity > 0)
  const medicines = db.medicines.all(key).filter((m) => m.status === 'active')
  const inStock = new Set(batches.map((b) => b.medicineId))
  const users = db.users.allAcrossTenants().filter((u) => u.clinicId === key)

  return {
    ...base,
    profit: sales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce((n, it) => n + (it.price - it.buyPrice) * it.quantity, 0) -
        s.discount,
      0,
    ),
    avgReceipt: sales.length ? Math.round(base.revenue / sales.length) : 0,
    daily: [...byDay].map(([date, revenue]) => ({ date, revenue })),
    medicines: medicines.length,
    outOfStock: medicines.filter((m) => !inStock.has(m.id)).length,
    stockValue: batches.reduce((sum, b) => sum + b.buyPrice * b.quantity, 0),
    pendingPrescriptions: db.prescriptions.all(key).filter((p) => p.status === 'pending')
      .length,
    staff: db.pharmacyStaff
      .all(key)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        role: s.role,
        login: s.login,
        status: s.status,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        lastLoginAt: users.find((u) => u.email === s.login)?.lastLoginAt ?? null,
      }))
      /* Ishlayotganlar tepada, rahbar birinchi */
      .sort(
        (a, b) =>
          Number(a.status === 'fired') - Number(b.status === 'fired') ||
          Number(b.role === 'pharmacy_owner') - Number(a.role === 'pharmacy_owner'),
      ),
    shifts: db.pharmacyShifts
      .all(key)
      .filter((s) => new Date(s.date).getTime() >= since)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({
        id: s.id,
        date: s.date,
        sellerName: s.sellerName,
        handedToName: s.handedToName,
        difference: s.difference,
        flagged: s.flagged,
      })),
  }
}

function findPharmacy(id: ID): Pharmacy {
  const row = getDb().pharmacies.allAcrossTenants().find((p) => p.id === id)
  if (!row) throw new Error('Apteka topilmadi')
  return row
}

/* ------------------------------------------------------------------ */
/* O'qish                                                              */
/* ------------------------------------------------------------------ */

/** Kelajakdagi yo'l: GET /platform/pharmacies */
export async function listPharmacies(): Promise<PharmacyOverview[]> {
  const rows = getDb()
    .pharmacies.allAcrossTenants()
    .map(overviewOf)
    .sort((a, b) => b.revenue - a.revenue)
  return delay(rows, 180)
}

/** Kelajakdagi yo'l: GET /platform/pharmacies/:id */
export async function getPharmacy(id: ID): Promise<PharmacyDetail | null> {
  const row = getDb().pharmacies.allAcrossTenants().find((p) => p.id === id)
  return delay(row ? detailOf(row) : null, 200)
}

/* ------------------------------------------------------------------ */
/* Yozish                                                              */
/* ------------------------------------------------------------------ */

export interface PharmacyCreateInput {
  name: string
  city: string
  address: string
  phone: string
  ownerName: string
  /** To'liq login: `nom@clinic-os.uz` */
  ownerEmail: string
  ownerPhone: string
}

export interface PharmacyCreated {
  pharmacy: Pharmacy
  ownerEmail: string
  /** Boshlang'ich parol — FAQAT shu javobda, keyin ko'rsatib bo'lmaydi */
  ownerPassword: string
}

/**
 * Apteka ochish.
 *
 * Uch narsa birga yaratiladi — serverda bitta tranzaksiyada bo'lishi
 * shart: apteka yozuvi, rahbarning kirish hisobi va uning xodim
 * yozuvi. Xodim yozuvisiz rahbar "Xodimlar" ro'yxatida ko'rinmasdi
 * va smena, kirim uni tanimasdi.
 *
 * Login butun platformada band bo'lmasligi kerak: kirishda odam
 * qaysi biznesda ishlashi hali noma'lum, ya'ni bir xil login ikki
 * joyda bo'lsa, parol noto'g'ri hisobga tekshirilardi.
 *
 * Kelajakdagi yo'l: POST /platform/pharmacies
 */
export async function createPharmacy(input: PharmacyCreateInput): Promise<PharmacyCreated> {
  const db = getDb()

  const email = input.ownerEmail.trim().toLowerCase()
  if (db.users.allAcrossTenants().some((u) => u.email.toLowerCase() === email)) {
    throw new Error(`${email} logini band — boshqa nom tanlang`)
  }

  const now = new Date().toISOString()
  const id = db.pharmacies.nextId('pharm')
  const userId = db.users.nextId('usr')

  db.users.insert({
    id: userId,
    clinicId: id,
    fullName: input.ownerName.trim(),
    email,
    phone: input.ownerPhone,
    role: 'pharmacy_owner',
    avatarUrl: null,
    extraPermissions: [],
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    doctorId: null,
    mustChangePassword: true,
  })

  db.pharmacyStaff.insert({
    id: db.pharmacyStaff.nextId('pst'),
    clinicId: id,
    fullName: input.ownerName.trim(),
    phone: input.ownerPhone,
    login: email,
    role: 'pharmacy_owner',
    salary: 0,
    workdays: [1, 2, 3, 4, 5],
    shiftStart: '09:00',
    shiftEnd: '18:00',
    status: 'active',
    hiredAt: toISODate(new Date()),
    canReceive: true,
  })

  const pharmacy = db.pharmacies.insert({
    id,
    name: input.name.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    phone: input.phone,
    status: 'active',
    suspendReason: '',
    ownerUserId: userId,
    createdAt: now,
  })

  return delay({ pharmacy, ownerEmail: email, ownerPassword: 'demo1234' }, 320)
}

export type PharmacyUpdateInput = Partial<Pick<Pharmacy, 'name' | 'city' | 'address' | 'phone'>>

/** Kelajakdagi yo'l: PATCH /platform/pharmacies/:id */
export async function updatePharmacy(id: ID, patch: PharmacyUpdateInput): Promise<Pharmacy> {
  findPharmacy(id)
  const updated = getDb().pharmacies.updateAcrossTenants(id, patch)
  if (!updated) throw new Error('Apteka topilmadi')
  return delay(updated, 240)
}

/**
 * Aptekani to'xtatish.
 *
 * MA'LUMOT O'CHIRILMAYDI: dorilar, sotuvlar, smenalar joyida qoladi.
 * Faqat apteka xodimlari kira olmaydi — to'lov tiklanganda ish shu
 * joydan davom etadi.
 *
 * Sabab MAJBURIY: rahbar kirishga urinib uni o'qiydi.
 *
 * Kelajakdagi yo'l: POST /platform/pharmacies/:id/suspend
 */
export async function suspendPharmacy(id: ID, reason: string): Promise<Pharmacy> {
  findPharmacy(id)
  const updated = getDb().pharmacies.updateAcrossTenants(id, {
    status: 'suspended',
    suspendReason: reason.trim(),
  })
  if (!updated) throw new Error('Apteka topilmadi')
  return delay(updated, 260)
}

/** Kelajakdagi yo'l: POST /platform/pharmacies/:id/activate */
export async function activatePharmacy(id: ID): Promise<Pharmacy> {
  findPharmacy(id)
  const updated = getDb().pharmacies.updateAcrossTenants(id, {
    status: 'active',
    suspendReason: '',
  })
  if (!updated) throw new Error('Apteka topilmadi')
  return delay(updated, 260)
}

/**
 * Apteka rahbarining parolini tiklash.
 *
 * Klinika egasi uchun qilingani bilan bir xil sababdan: pochta
 * xizmati yo'q, rahbar parolini unutsa boshqa yo'l qolmaydi.
 * Sotuvchilarning parolini esa rahbar o'zi tiklaydi.
 *
 * Kelajakdagi yo'l: POST /platform/pharmacies/:id/reset-owner-password
 */
export async function resetPharmacyOwnerPassword(id: ID): Promise<OwnerPasswordReset> {
  const pharmacy = findPharmacy(id)
  const db = getDb()
  const owner = db.users.allAcrossTenants().find((u) => u.id === pharmacy.ownerUserId)
  if (!owner) throw new Error('Apteka rahbarining hisobi topilmadi')

  db.users.updateAcrossTenants(owner.id, { mustChangePassword: true })
  return delay(
    { ownerName: owner.fullName, ownerEmail: owner.email, password: 'demo1234' },
    300,
  )
}
