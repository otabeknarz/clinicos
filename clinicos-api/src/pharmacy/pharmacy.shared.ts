import type {
  Medicine,
  MedicineBatch,
  PharmacyShift,
  PharmacyStaff,
  Prescription,
  Sale,
  SaleItem,
  Supplier,
} from '@prisma/client'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'

/**
 * Aptekaning umumiy qoidalari va javob shakllari.
 *
 * Chegaralar frontenddagi (`src/api/pharmacy.ts`) bilan BIR XIL
 * bo'lishi shart: aks holda interfeys "tugayapti" deb ko'rsatgan
 * dori server hisobotida "yetarli" bo'lib chiqardi.
 */

/** Muddati shu kundan kam qolgan partiya "tugayapti" */
export const EXPIRY_WARN_DAYS = 90

/** Shundan kam qolgan dori "tugab qolgan" */
export const LOW_STOCK = 10

/**
 * Smenada shundan katta kamomad rahbarga yuboriladi.
 *
 * Qaytim xatosi shuncha bo'lishi mumkin; har safar rahbarni
 * chaqirsak, belgining o'zi ma'nosini yo'qotardi. Interfeysdagi
 * ogohlantirish ham shu songa qarab chiqadi.
 */
export const SHIFT_TOLERANCE = 5000

const DAY_MS = 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/* Sana                                                                */
/* ------------------------------------------------------------------ */

/**
 * Server vaqti bo'yicha sana — `YYYY-MM-DD`.
 *
 * `toISOString()` UTC beradi va Toshkentda ertalab 05:00 gacha
 * kechagi kunni ko'rsatardi — smena sanasi noto'g'ri kunga tushardi.
 */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * `YYYY-MM-DD` → sana ustuni uchun qiymat.
 *
 * `@db.Date` ustuni vaqtsiz, Prisma uni UTC yarim tun deb o'qiydi.
 * Shuning uchun sana matndan UTC da yig'iladi — mahalliy `new Date()`
 * dan olinsa, yarim tunga yaqin paytda bir kun siljib ketardi.
 */
export function dateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

/** Bugun — sana ustuni uchun */
export function todayDate(): Date {
  return dateOnly(localDate())
}

/** Server vaqti bo'yicha kun boshi — vaqt ustunlari uchun */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS)
}

/** Muddatigacha necha kun. Manfiy — o'tib ketgan. */
export function daysLeft(expiresAt: Date): number {
  return Math.round((expiresAt.getTime() - todayDate().getTime()) / DAY_MS)
}

/** `09:00` → 540 daqiqa */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/* ------------------------------------------------------------------ */
/* Pul                                                                 */
/* ------------------------------------------------------------------ */

/** Chekning sof tushumi — chegirmadan keyin */
export function saleNet(sale: Pick<Sale, 'total' | 'discount'>): number {
  return sale.total - sale.discount
}

/**
 * Chekning foydasi — HAR BIR QATORDAN: sotuv narxi minus o'sha
 * partiyaning tannarxi. Umumiy ustama foizi noto'g'ri chiqardi —
 * dorilarning ustamasi har xil.
 */
export function saleProfit(sale: Sale & { items: SaleItem[] }): number {
  return (
    sale.items.reduce((sum, it) => sum + (it.price - it.buyPrice) * it.quantity, 0) -
    sale.discount
  )
}

/* ------------------------------------------------------------------ */
/* Javob shakllari — `types/pharmacy.ts` bilan bir xil                 */
/* ------------------------------------------------------------------ */

export function apiMedicine(m: Medicine) {
  return {
    id: m.id,
    clinicId: m.clinicId,
    name: m.name,
    form: toApi(m.form),
    manufacturer: m.manufacturer,
    country: m.country,
    barcode: m.barcode,
    unit: m.unit,
    prescriptionOnly: m.prescriptionOnly,
    sellPrice: m.sellPrice,
    status: toApi(m.status),
    createdAt: toApiDateTime(m.createdAt),
  }
}

export function apiBatch(b: MedicineBatch) {
  return {
    id: b.id,
    clinicId: b.clinicId,
    medicineId: b.medicineId,
    code: b.code,
    expiresAt: toApiDate(b.expiresAt),
    quantity: b.quantity,
    buyPrice: b.buyPrice,
    supplierId: b.supplierId,
    receivedAt: toApiDate(b.receivedAt),
  }
}

export function apiSupplier(s: Supplier) {
  return {
    id: s.id,
    clinicId: s.clinicId,
    name: s.name,
    phone: s.phone,
    inn: s.inn,
    note: s.note,
  }
}

export function apiSale(s: Sale & { items: SaleItem[] }) {
  return {
    id: s.id,
    clinicId: s.clinicId,
    number: String(s.number),
    soldAt: toApiDateTime(s.soldAt),
    items: s.items.map((it) => ({
      medicineId: it.medicineId,
      medicineName: it.medicineName,
      batchId: it.batchId,
      quantity: it.quantity,
      price: it.price,
      buyPrice: it.buyPrice,
    })),
    total: s.total,
    discount: s.discount,
    method: toApi(s.method),
    patientId: s.patientId,
    prescriptionId: s.prescriptionId,
    soldById: s.soldById,
    soldByName: s.soldByName,
  }
}

export function apiPrescription(p: Prescription) {
  return {
    id: p.id,
    clinicId: p.clinicId,
    patientId: p.patientId ?? '',
    patientName: p.patientName,
    doctorName: p.doctorName,
    createdAt: toApiDateTime(p.createdAt),
    items: Array.isArray(p.items) ? p.items : [],
    status: toApi(p.status),
    note: p.note,
  }
}

export function apiShift(s: PharmacyShift) {
  return {
    id: s.id,
    clinicId: s.clinicId,
    sellerId: s.sellerId,
    sellerName: s.sellerName,
    date: toApiDate(s.date),
    expectedCash: s.expectedCash,
    countedCash: s.countedCash,
    difference: s.difference,
    cardTotal: s.cardTotal,
    receipts: s.receipts,
    note: s.note,
    handedToId: s.handedToId,
    handedToName: s.handedToName,
    flagged: s.flagged,
    closedAt: toApiDateTime(s.closedAt),
  }
}

export function apiStaff(s: PharmacyStaff) {
  return {
    id: s.id,
    clinicId: s.clinicId,
    fullName: s.fullName,
    phone: s.phone,
    login: s.login,
    role: s.role === 'PHARMACY_OWNER' ? ('pharmacy_owner' as const) : ('pharmacist' as const),
    salary: s.salary,
    workdays: s.workdays,
    shiftStart: s.shiftStart,
    shiftEnd: s.shiftEnd,
    status: toApi(s.status),
    hiredAt: toApiDate(s.hiredAt),
    canReceive: s.role === 'PHARMACY_OWNER' ? true : s.canReceive,
  }
}
