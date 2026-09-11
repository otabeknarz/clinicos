/**
 * APTEKA.
 *
 * HOZIRCHA FAQAT DEMO QATLAMI. Backend hali yozilmagan, shuning
 * uchun bu yerda `// GET /path` izohlari ATAYLAB YO'Q: o'sha
 * izohlar `docs/API.md` va backenddagi `check:endpoints` uchun
 * manba bo'lib xizmat qiladi va marshrut mavjud bo'lmasa,
 * tekshiruv yiqilardi. Backend yozilganda izohlar qo'shiladi va
 * har bir funksiya `USE_MOCK` bo'yicha ikkiga bo'linadi —
 * qolgan modullardagi kabi.
 */
import { delay } from './client'
import { apiContext } from './client'
import { getDb } from '@/mock/db'
import type { ID, ISODate, UZS } from '@/types/models'
import type {
  Batch,
  CartLine,
  Medicine,
  MedicineInput,
  MedicineStock,
  PharmacyAnalytics,
  PharmacyShift,
  PharmacyStaff,
  PharmacyStaffStats,
  Prescription,
  Purchase,
  PurchaseItem,
  PurchasePayment,
  SupplierInput,
  Sale,
  Supplier,
} from '@/types/pharmacy'

/** Muddati shu kundan kam qolgan partiya "tugayapti" hisoblanadi */
export const EXPIRY_WARN_DAYS = 90

/** Shundan kam qolgan dori "tugab qolgan" hisoblanadi */
export const LOW_STOCK = 10

export function daysUntil(date: string): number {
  const ms = new Date(date).getTime() - Date.now()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

/* ------------------------------------------------------------------ */
/* Katalog                                                             */
/* ------------------------------------------------------------------ */

export interface MedicineQuery {
  search?: string
  /** `all` — hammasi, `low` — tugab qolganlar, `out` — tugaganlar */
  stock?: 'all' | 'low' | 'out'
  prescriptionOnly?: boolean
}

/**
 * Dorilar katalogi — zaxira bilan birga.
 *
 * Zaxira PARTIYALARDAN yig'iladi: dorining o'zida "qancha bor"
 * degan ustun yo'q va bo'lmasligi ham kerak — u partiyalar bilan
 * darrov ziddiyatga tushardi.
 */
export async function listMedicines(query: MedicineQuery = {}): Promise<MedicineStock[]> {
  const { clinicId } = apiContext()
  const db = getDb()

  const batches = db.batches.all(clinicId)
  const search = (query.search ?? '').trim().toLowerCase()

  const rows = db.medicines
    .all(clinicId)
    .filter((m) => m.status === 'active')
    .filter(
      (m) =>
        !search ||
        m.name.toLowerCase().includes(search) ||
        m.manufacturer.toLowerCase().includes(search) ||
        m.barcode.includes(search),
    )
    .filter((m) => !query.prescriptionOnly || m.prescriptionOnly)
    .map((medicine) => withStock(medicine, batches))
    .filter((row) => {
      if (query.stock === 'low') return row.inStock > 0 && row.inStock <= LOW_STOCK
      if (query.stock === 'out') return row.inStock === 0
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return delay(rows, 160)
}

function withStock(medicine: Medicine, batches: Batch[]): MedicineStock {
  const mine = batches.filter((b) => b.medicineId === medicine.id && b.quantity > 0)

  const nearest = mine
    .map((b) => b.expiresAt)
    .sort()
    .at(0)

  return {
    ...medicine,
    inStock: mine.reduce((sum, b) => sum + b.quantity, 0),
    nearestExpiry: nearest ?? null,
    expiringSoon: mine
      .filter((b) => daysUntil(b.expiresAt) <= EXPIRY_WARN_DAYS)
      .reduce((sum, b) => sum + b.quantity, 0),
  }
}

/* ------------------------------------------------------------------ */
/* Zaxira                                                              */
/* ------------------------------------------------------------------ */

export interface BatchRow extends Batch {
  medicineName: string
  unit: string
  supplierName: string
  /** Muddatigacha necha kun. Manfiy — o'tib ketgan. */
  daysLeft: number
}

export async function listBatches(filter: 'all' | 'expiring' | 'expired' = 'all') {
  const { clinicId } = apiContext()
  const db = getDb()

  const medicines = new Map(db.medicines.all(clinicId).map((m) => [m.id, m]))
  const suppliers = new Map(db.suppliers.all(clinicId).map((s) => [s.id, s]))

  const rows: BatchRow[] = db.batches
    .all(clinicId)
    .filter((b) => b.quantity > 0)
    .map((batch) => ({
      ...batch,
      medicineName: medicines.get(batch.medicineId)?.name ?? '',
      unit: medicines.get(batch.medicineId)?.unit ?? '',
      supplierName: batch.supplierId ? (suppliers.get(batch.supplierId)?.name ?? '') : '',
      daysLeft: daysUntil(batch.expiresAt),
    }))
    .filter((row) => {
      if (filter === 'expiring') return row.daysLeft >= 0 && row.daysLeft <= EXPIRY_WARN_DAYS
      if (filter === 'expired') return row.daysLeft < 0
      return true
    })
    /* Muddati yaqinlari tepada — aynan ular e'tibor talab qiladi */
    .sort((a, b) => a.daysLeft - b.daysLeft)

  return delay(rows, 160)
}

/* ------------------------------------------------------------------ */
/* Kassa                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sotuvga tayyor qatorlar — bitta dorining har bir partiyasi alohida.
 *
 * FIFO EMAS, TANLAB OLINADI: farmatsevt qutini qo'lida ushlab
 * turibdi va aynan qaysi partiya ekanini u biladi. Tizim o'zi
 * tanlab qo'ysa, kassadagi yozuv javondagi haqiqatdan uzilib
 * qolardi.
 */
export async function searchForSale(term: string): Promise<CartLine[]> {
  const { clinicId } = apiContext()
  const db = getDb()
  const search = term.trim().toLowerCase()
  if (!search) return delay([], 60)

  const batches = db.batches.all(clinicId).filter((b) => b.quantity > 0)

  const found = db.medicines
    .all(clinicId)
    .filter((m) => m.status === 'active')
    .filter(
      (m) => m.name.toLowerCase().includes(search) || m.barcode.includes(search),
    )
    .slice(0, 12)

  const lines: CartLine[] = []

  for (const medicine of found) {
    const mine = batches
      .filter((b) => b.medicineId === medicine.id)
      /* Muddati yaqinlari birinchi — ular avval sotilishi kerak */
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))

    for (const batch of mine) {
      lines.push({
        medicineId: medicine.id,
        name: medicine.name,
        batchId: batch.id,
        expiresAt: batch.expiresAt,
        price: medicine.sellPrice,
        quantity: 1,
        available: batch.quantity,
        prescriptionOnly: medicine.prescriptionOnly,
      })
    }
  }

  return delay(lines, 120)
}

export interface SaleInput {
  lines: CartLine[]
  discount: UZS
  method: Sale['method']
  patientId: ID | null
}

/**
 * Sotuvni yakunlash.
 *
 * Zaxira SHU YERDA kamayadi. Demo bo'lsa ham haqiqiy kamayadi —
 * aks holda ekranlarni sinab ko'rib bo'lmasdi: sotgandan keyin
 * ham qoldiq o'zgarmasa, hech narsa ishlayotgani bilinmasdi.
 */
export async function createSale(input: SaleInput): Promise<Sale> {
  const { clinicId } = apiContext()
  const db = getDb()

  const total = input.lines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  const buyPriceByBatch = new Map<string, number>()

  for (const line of input.lines) {
    const batch = db.batches.find(line.batchId, clinicId)
    if (!batch) continue
    buyPriceByBatch.set(line.batchId, batch.buyPrice)
    db.batches.update(
      line.batchId,
      { quantity: Math.max(0, batch.quantity - line.quantity) },
      clinicId,
    )
  }

  const sale = db.sales.insert({
    id: db.sales.nextId('sale'),
    clinicId,
    number: `A-${Date.now().toString().slice(-6)}`,
    soldAt: new Date().toISOString(),
    items: input.lines.map((line) => ({
      medicineId: line.medicineId,
      medicineName: line.name,
      batchId: line.batchId,
      quantity: line.quantity,
      price: line.price,
      buyPrice: buyPriceByBatch.get(line.batchId) ?? 0,
    })),
    total,
    discount: input.discount,
    method: input.method,
    patientId: input.patientId,
    prescriptionId: null,
    soldById: currentSeller()?.id ?? '',
    soldByName: currentSeller()?.fullName ?? '',
  })

  return delay(sale, 220)
}

/* ------------------------------------------------------------------ */
/* Savdo tarixi va hisobot                                             */
/* ------------------------------------------------------------------ */

export async function listSales(days = 7): Promise<Sale[]> {
  const { clinicId } = apiContext()
  const from = Date.now() - days * 24 * 60 * 60 * 1000

  const rows = getDb()
    .sales.all(clinicId)
    .filter((s) => new Date(s.soldAt).getTime() >= from)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt))

  return delay(rows, 180)
}

export interface PharmacySummary {
  /** Bugungi tushum va cheklar soni */
  todayRevenue: UZS
  todaySales: number
  /** Bugungi foyda: sotuv narxi minus tannarx */
  todayProfit: UZS
  /** Muddati yaqin qolgan partiyalar soni */
  expiringBatches: number
  /** Tugab qolgan dorilar soni */
  lowStock: number
  /** Butunlay tugaganlar */
  outOfStock: number
  /** Javondagi tovarning tannarxdagi qiymati */
  stockValue: UZS
}

export async function pharmacySummary(): Promise<PharmacySummary> {
  const { clinicId } = apiContext()
  const db = getDb()

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const todaySales = db.sales
    .all(clinicId)
    .filter((s) => new Date(s.soldAt).getTime() >= start.getTime())

  const batches = db.batches.all(clinicId).filter((b) => b.quantity > 0)
  const medicines = db.medicines.all(clinicId).filter((m) => m.status === 'active')

  const stockByMedicine = new Map<string, number>()
  for (const batch of batches) {
    stockByMedicine.set(
      batch.medicineId,
      (stockByMedicine.get(batch.medicineId) ?? 0) + batch.quantity,
    )
  }

  return delay(
    {
      todayRevenue: todaySales.reduce((sum, s) => sum + s.total - s.discount, 0),
      todaySales: todaySales.length,
      todayProfit: todaySales.reduce(
        (sum, s) =>
          sum +
          s.items.reduce((n, it) => n + (it.price - it.buyPrice) * it.quantity, 0) -
          s.discount,
        0,
      ),
      expiringBatches: batches.filter(
        (b) => daysUntil(b.expiresAt) >= 0 && daysUntil(b.expiresAt) <= EXPIRY_WARN_DAYS,
      ).length,
      lowStock: medicines.filter((m) => {
        const qty = stockByMedicine.get(m.id) ?? 0
        return qty > 0 && qty <= LOW_STOCK
      }).length,
      outOfStock: medicines.filter((m) => (stockByMedicine.get(m.id) ?? 0) === 0).length,
      stockValue: batches.reduce((sum, b) => sum + b.buyPrice * b.quantity, 0),
    },
    200,
  )
}

/* ------------------------------------------------------------------ */
/* Retseptlar                                                          */
/* ------------------------------------------------------------------ */

export async function listPrescriptions(
  status: 'all' | Prescription['status'] = 'all',
): Promise<Prescription[]> {
  const { clinicId } = apiContext()

  const rows = getDb()
    .prescriptions.all(clinicId)
    .filter((p) => status === 'all' || p.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return delay(rows, 160)
}

/** Retseptni berilgan deb belgilash */
export async function dispensePrescription(id: ID): Promise<Prescription | null> {
  const { clinicId } = apiContext()
  const row = getDb().prescriptions.update(id, { status: 'dispensed' }, clinicId)
  return delay(row, 200)
}

/* ------------------------------------------------------------------ */
/* Smena — sotuvchi kassani topshiradi                                 */
/* ------------------------------------------------------------------ */

/** Bugungi smena holati: yopilganmi va tizim qancha deb hisoblayapti */
export interface TodayShift {
  closed: boolean
  expectedCash: UZS
  cardTotal: UZS
  receipts: number
}

export async function todayShift(): Promise<TodayShift> {
  const { clinicId } = apiContext()
  const db = getDb()

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const today = isoToday()

  const sales = db.sales
    .all(clinicId)
    .filter((s) => new Date(s.soldAt).getTime() >= start.getTime())

  return delay(
    {
      closed: db.pharmacyShifts.all(clinicId).some((s) => s.date === today),
      expectedCash: sales
        .filter((s) => s.method === 'cash')
        .reduce((sum, s) => sum + s.total - s.discount, 0),
      cardTotal: sales
        .filter((s) => s.method !== 'cash')
        .reduce((sum, s) => sum + s.total - s.discount, 0),
      receipts: sales.length,
    },
    180,
  )
}

/**
 * Smenani yopish.
 *
 * `flagged` — sotuvchi ogohlantirishni ko'rib turib, tizim
 * summasidan KAM summa kiritgan. Bu yozuv rahbarning kassa
 * nazoratida alohida belgilanadi: tasodifiy kamomad bilan
 * ataylab kiritilganini ajratish kerak.
 */
export async function closePharmacyShift(
  counted: UZS,
  note: string,
  flagged = false,
  handedToId: ID | null = null,
) {
  const { clinicId } = apiContext()
  const db = getDb()
  const state = await todayShift()
  const seller = currentSeller()
  const handedTo = handedToId
    ? db.pharmacyStaff.find(handedToId, clinicId)
    : null

  return delay(
    db.pharmacyShifts.insert({
      id: db.pharmacyShifts.nextId('psh'),
      clinicId,
      sellerId: seller?.id ?? '',
      sellerName: seller?.fullName ?? '',
      date: isoToday(),
      expectedCash: state.expectedCash,
      countedCash: counted,
      difference: counted - state.expectedCash,
      cardTotal: state.cardTotal,
      receipts: state.receipts,
      note: note.trim(),
      handedToId,
      handedToName: handedTo?.fullName ?? '',
      flagged,
      closedAt: new Date().toISOString(),
    }),
    220,
  )
}

/**
 * Kassani kimga topshirish mumkin.
 *
 * O'zidan boshqa faol xodimlar. O'zini tanlash mumkin bo'lsa,
 * "topshirish" so'zining ma'nosi qolmasdi.
 */
export async function handoverCandidates(): Promise<PharmacyStaff[]> {
  const { clinicId } = apiContext()
  const me = currentSeller()

  const rows = getDb()
    .pharmacyStaff.all(clinicId)
    .filter((one) => one.status === 'active' && one.id !== me?.id)

  return delay(rows, 120)
}

export async function listPharmacyShifts(days = 30): Promise<PharmacyShift[]> {
  const { clinicId } = apiContext()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const limit = from.toISOString().slice(0, 10)

  const rows = getDb()
    .pharmacyShifts.all(clinicId)
    .filter((s) => s.date >= limit)
    .sort((a, b) => b.date.localeCompare(a.date))

  return delay(rows, 180)
}

/**
 * Kirgan farmatsevtning xodim yozuvi.
 *
 * Demo rejimda login bo'yicha topiladi. Haqiqiy ishlashda buni
 * server TOKENDAN oladi — mijoz kim ekanini aytib turmaydi.
 */
function currentSeller() {
  const { clinicId, userEmail } = apiContext()
  const staff = getDb().pharmacyStaff.all(clinicId)
  return staff.find((one) => one.login === userEmail) ?? null
}

function isoToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/* ------------------------------------------------------------------ */
/* Analitika                                                           */
/* ------------------------------------------------------------------ */

/**
 * Davr bo'yicha hisobot.
 *
 * Foyda HAR BIR QATORDAN hisoblanadi: sotuv narxi minus o'sha
 * partiyaning tannarxi. Umumiy ustama foizini qo'llash oson
 * bo'lardi-yu, noto'g'ri chiqardi — bir dorida ustama 20%, boshqasida
 * 45% va sotuv tarkibi har kuni o'zgaradi.
 */
export async function pharmacyAnalytics(days = 30): Promise<PharmacyAnalytics> {
  const { clinicId } = apiContext()
  const db = getDb()

  const from = Date.now() - days * 24 * 60 * 60 * 1000
  const sales = db.sales
    .all(clinicId)
    .filter((s) => new Date(s.soldAt).getTime() >= from)

  const revenue = sales.reduce((sum, s) => sum + s.total - s.discount, 0)
  const profit = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce((n, it) => n + (it.price - it.buyPrice) * it.quantity, 0) -
      s.discount,
    0,
  )

  /* --- Kunlar --- */
  const dayMap = new Map<string, { revenue: number; profit: number; receipts: number }>()
  for (const sale of sales) {
    const key = sale.soldAt.slice(0, 10)
    const acc = dayMap.get(key) ?? { revenue: 0, profit: 0, receipts: 0 }
    acc.revenue += sale.total - sale.discount
    acc.profit +=
      sale.items.reduce((n, it) => n + (it.price - it.buyPrice) * it.quantity, 0) -
      sale.discount
    acc.receipts += 1
    dayMap.set(key, acc)
  }

  /* --- Dorilar --- */
  const topMap = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const acc = topMap.get(item.medicineId) ?? {
        name: item.medicineName,
        quantity: 0,
        revenue: 0,
        profit: 0,
      }
      acc.quantity += item.quantity
      acc.revenue += item.price * item.quantity
      acc.profit += (item.price - item.buyPrice) * item.quantity
      topMap.set(item.medicineId, acc)
    }
  }

  /* --- Harakatsiz tovar --- */
  const sold = new Set(sales.flatMap((s) => s.items.map((i) => i.medicineId)))
  const batches = db.batches.all(clinicId).filter((b) => b.quantity > 0)

  const deadMap = new Map<string, { name: string; quantity: number; value: number }>()
  for (const batch of batches) {
    if (sold.has(batch.medicineId)) continue
    const medicine = db.medicines.find(batch.medicineId, clinicId)
    if (!medicine) continue
    const acc = deadMap.get(batch.medicineId) ?? {
      name: medicine.name,
      quantity: 0,
      value: 0,
    }
    acc.quantity += batch.quantity
    acc.value += batch.quantity * batch.buyPrice
    deadMap.set(batch.medicineId, acc)
  }

  const methodTotals = (['cash', 'card', 'transfer'] as const).map((method) => ({
    method,
    total: sales
      .filter((s) => s.method === method)
      .reduce((sum, s) => sum + s.total - s.discount, 0),
  }))

  return delay(
    {
      revenue,
      profit,
      receipts: sales.length,
      averageReceipt: sales.length ? Math.round(revenue / sales.length) : 0,
      marginPct: revenue ? Math.round((profit / revenue) * 100) : 0,
      byDay: [...dayMap.entries()]
        .map(([date, value]) => ({ date, ...value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byMethod: methodTotals.filter((m) => m.total > 0),
      top: [...topMap.entries()]
        .map(([medicineId, value]) => ({ medicineId, ...value }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      dead: [...deadMap.entries()]
        .map(([medicineId, value]) => ({ medicineId, ...value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    },
    240,
  )
}

/* ------------------------------------------------------------------ */
/* Xodimlar                                                            */
/* ------------------------------------------------------------------ */

export interface StaffWithStats extends PharmacyStaff {
  stats: PharmacyStaffStats
}

/**
 * Xodimlar va ularning natijasi.
 *
 * Natija SMENALARDAN va SOTUVLARDAN yig'iladi: ikkalasi ham
 * xodim id'siga bog'langan. Alohida "ko'rsatkich" jadvali
 * ochilmadi — u sotuvlar bilan darrov ziddiyatga tushardi va
 * qaysi biri to'g'ri ekanini aytib bo'lmasdi.
 */
export async function listPharmacyStaff(days = 30): Promise<StaffWithStats[]> {
  const { clinicId } = apiContext()
  const db = getDb()

  const from = Date.now() - days * 24 * 60 * 60 * 1000
  const sales = db.sales.all(clinicId).filter((s) => new Date(s.soldAt).getTime() >= from)

  const limit = new Date(from).toISOString().slice(0, 10)
  const shifts = db.pharmacyShifts.all(clinicId).filter((s) => s.date >= limit)

  const rows = db.pharmacyStaff.all(clinicId).map((person) => {
    const mySales = sales.filter((s) => s.soldById === person.id)
    const myShifts = shifts.filter((s) => s.sellerId === person.id)

    const revenue = mySales.reduce((sum, s) => sum + s.total - s.discount, 0)

    return {
      ...person,
      stats: {
        staffId: person.id,
        daysWorked: myShifts.length,
        receipts: mySales.length,
        revenue,
        profit: mySales.reduce(
          (sum, s) =>
            sum +
            s.items.reduce((n, it) => n + (it.price - it.buyPrice) * it.quantity, 0) -
            s.discount,
          0,
        ),
        /* Bitta chek — bitta xaridor */
        customers: mySales.length,
        cashShort: myShifts
          .filter((s) => s.difference < 0)
          .reduce((sum, s) => sum + Math.abs(s.difference), 0),
        cashOver: myShifts
          .filter((s) => s.difference > 0)
          .reduce((sum, s) => sum + s.difference, 0),
        gapDays: myShifts.filter((s) => s.difference !== 0).length,
        dailyAverage: myShifts.length ? Math.round(revenue / myShifts.length) : 0,
      },
    }
  })

  /* Faol xodimlar tepada, ichida savdosi yuqorisi birinchi */
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    return b.stats.revenue - a.stats.revenue
  })

  return delay(rows, 200)
}

export type PharmacyStaffInput = Omit<PharmacyStaff, 'id' | 'clinicId'>

export async function createPharmacyStaff(input: PharmacyStaffInput) {
  const { clinicId } = apiContext()
  const db = getDb()

  return delay(
    db.pharmacyStaff.insert({ id: db.pharmacyStaff.nextId('pst'), clinicId, ...input }),
    220,
  )
}

export async function updatePharmacyStaff(id: ID, patch: Partial<PharmacyStaffInput>) {
  const { clinicId } = apiContext()
  return delay(getDb().pharmacyStaff.update(id, patch, clinicId), 220)
}

/**
 * Xodimni ishdan chiqarish.
 *
 * YOZUV O'CHIRILMAYDI, `fired` ga o'tadi: uning sotuvlari va
 * smenalari joyida qolishi kerak. O'chirilsa, o'tgan oyning
 * hisoboti qayta hisoblanganda savdo egasiz qolardi.
 */
export async function firePharmacyStaff(id: ID) {
  const { clinicId } = apiContext()
  return delay(getDb().pharmacyStaff.update(id, { status: 'fired' }, clinicId), 220)
}

/* ------------------------------------------------------------------ */
/* Kirim — tovar bazaga shu yerdan tushadi                             */
/* ------------------------------------------------------------------ */

export async function listSuppliers(): Promise<Supplier[]> {
  const { clinicId } = apiContext()
  return delay(getDb().suppliers.all(clinicId), 120)
}

/**
 * Yangi ta'minotchi.
 *
 * Kirim oynasining ICHIDAN ochiladi: yangi ta'minotchi bilan
 * birinchi kirim bir vaqtda keladi va odamni alohida ekranga
 * yuborish shu yerda ishni to'xtatib qo'yardi.
 */
export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { clinicId } = apiContext()
  const db = getDb()
  return delay(
    db.suppliers.insert({ id: db.suppliers.nextId('sup'), clinicId, ...input }),
    200,
  )
}

/**
 * Ta'minotchilarga qarz — to'lanmagan kirimlar.
 *
 * Hisoblanadi, saqlanmaydi: saqlangan qoldiq kirimlar bilan
 * darrov ziddiyatga tushardi va qaysi biri to'g'riligini aytib
 * bo'lmasdi. Klinikadagi bemor qarzi ham shunday.
 */
export interface SupplierDebt {
  supplierId: ID
  supplierName: string
  /** To'lanmagan qoldiq */
  remaining: UZS
  /** Nechta hujjat bo'yicha */
  invoices: number
  /** Eng eski muddat. O'tib ketgan bo'lsa manfiy kun. */
  oldestDue: ISODate | null
}

export async function supplierDebts(): Promise<SupplierDebt[]> {
  const { clinicId } = apiContext()
  const db = getDb()

  const map = new Map<string, SupplierDebt>()

  for (const purchase of db.purchases.all(clinicId)) {
    const remaining = purchase.total - purchase.paidAmount
    if (remaining <= 0) continue

    const key = purchase.supplierId ?? 'none'
    const acc = map.get(key) ?? {
      supplierId: key,
      supplierName: purchase.supplierName,
      remaining: 0,
      invoices: 0,
      oldestDue: null,
    }
    acc.remaining += remaining
    acc.invoices += 1
    if (purchase.dueDate && (!acc.oldestDue || purchase.dueDate < acc.oldestDue)) {
      acc.oldestDue = purchase.dueDate
    }
    map.set(key, acc)
  }

  return delay(
    [...map.values()].sort((a, b) => b.remaining - a.remaining),
    180,
  )
}

export async function listPurchases(days = 90): Promise<Purchase[]> {
  const { clinicId } = apiContext()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const limit = from.toISOString().slice(0, 10)

  const rows = getDb()
    .purchases.all(clinicId)
    .filter((p) => p.receivedAt >= limit)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return delay(rows, 180)
}

/** Kirimning bitta qatori — forma yuboradigan shakl */
export interface PurchaseLineInput {
  /** Katalogda bor bo'lsa — id, yangi dori bo'lsa `null` */
  medicineId: ID | null
  /** `medicineId` bo'sh bo'lsa shu yerdan yangi dori ochiladi */
  medicine: MedicineInput | null
  batchCode: string
  expiresAt: string
  quantity: number
  buyPrice: UZS
  sellPrice: UZS
}

export interface PurchaseInput {
  supplierId: ID | null
  invoiceNumber: string
  receivedAt: string
  payment: PurchasePayment
  /** `partial` da qo'lda kiritiladi, qolganida o'zi hisoblanadi */
  paidAmount: UZS
  dueDate: string | null
  /** Hujjat rasmlarining kalitlari */
  documents: string[]
  note: string
  lines: PurchaseLineInput[]
}

/**
 * KIRIMNI QABUL QILISH.
 *
 * Bir amalda uch narsa bo'ladi:
 *
 *   1. katalogda yo'q dorilar OCHILADI
 *   2. har bir qator uchun PARTIYA yaratiladi
 *   3. sotuv narxi o'zgargan bo'lsa, katalogda yangilanadi
 *
 * NEGA BITTA AMALDA: farmatsevt qutini qo'lida ushlab turibdi.
 * Uni "avval katalogga dori qo'sh, keyin partiya och, keyin
 * narxni yangila" deb uchta ekranga yugurtirsak, u tizimni
 * chetlab o'tib, daftarga yozishni afzal ko'radi.
 *
 * NARX TARIXI BUZILMAYDI: eski partiyalarning tannarxi
 * o'zgarmaydi, ya'ni allaqachon sotilgan tovarning foydasi
 * qanday hisoblangan bo'lsa, shundayligicha qoladi.
 */
export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const { clinicId } = apiContext()
  const db = getDb()

  const supplier = input.supplierId
    ? db.suppliers.find(input.supplierId, clinicId)
    : null

  const items: PurchaseItem[] = []

  for (const line of input.lines) {
    let medicineId = line.medicineId
    let name = ''

    if (!medicineId && line.medicine) {
      const created = db.medicines.insert({
        id: db.medicines.nextId('med'),
        clinicId,
        ...line.medicine,
        sellPrice: line.sellPrice,
        status: 'active',
        createdAt: new Date().toISOString(),
      })
      medicineId = created.id
      name = created.name
    } else if (medicineId) {
      const existing = db.medicines.find(medicineId, clinicId)
      name = existing?.name ?? ''
      /* Narx o'zgargan bo'lsa katalog ham yangilanadi */
      if (existing && existing.sellPrice !== line.sellPrice) {
        db.medicines.update(medicineId, { sellPrice: line.sellPrice }, clinicId)
      }
    }

    if (!medicineId) continue

    db.batches.insert({
      id: db.batches.nextId('bat'),
      clinicId,
      medicineId,
      code: line.batchCode.trim() || `P-${Date.now().toString().slice(-5)}`,
      expiresAt: line.expiresAt,
      quantity: line.quantity,
      buyPrice: line.buyPrice,
      supplierId: input.supplierId,
      receivedAt: input.receivedAt,
    })

    items.push({
      medicineId,
      medicineName: name,
      batchCode: line.batchCode,
      expiresAt: line.expiresAt,
      quantity: line.quantity,
      buyPrice: line.buyPrice,
      sellPrice: line.sellPrice,
    })
  }

  const total = items.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0)
  const receiver = currentSeller()

  return delay(
    db.purchases.insert({
      id: db.purchases.nextId('pur'),
      clinicId,
      supplierId: input.supplierId,
      supplierName: supplier?.name ?? '',
      invoiceNumber: input.invoiceNumber.trim(),
      receivedAt: input.receivedAt,
      items,
      total,
      payment: input.payment,
      paidAmount:
        input.payment === 'paid'
          ? total
          : input.payment === 'credit'
            ? 0
            : Math.min(input.paidAmount, total),
      dueDate: input.payment === 'paid' ? null : input.dueDate,
      documents: input.documents,
      receivedById: receiver?.id ?? '',
      receivedByName: receiver?.fullName ?? '',
      note: input.note.trim(),
      createdAt: new Date().toISOString(),
    }),
    260,
  )
}

/** Katalogdagi dorini tahrirlash — narx, nom, shakl */
export async function updateMedicine(id: ID, patch: Partial<MedicineInput>) {
  const { clinicId } = apiContext()
  return delay(getDb().medicines.update(id, patch, clinicId), 200)
}

/**
 * Dorini arxivlash.
 *
 * O'CHIRILMAYDI: sotuv tarixi unga bog'langan. O'chirilsa,
 * o'tgan oyning hisoboti "nomsiz dori" bilan to'lib ketardi.
 */
export async function archiveMedicine(id: ID) {
  const { clinicId } = apiContext()
  return delay(getDb().medicines.update(id, { status: 'archived' }, clinicId), 200)
}

/* ------------------------------------------------------------------ */
/* Hozir kim smenada                                                   */
/* ------------------------------------------------------------------ */

export interface OnDuty {
  /** Hozir kassani ushlab turgan odam. `null` — hech kim. */
  holder: PharmacyStaff | null
  /** Kirgan odamning o'zimi */
  isMe: boolean
  /**
   * Nima uchun shu odam: topshirish zanjiridan yoki jadvaldan.
   *
   * Interfeys sababni aytishi kerak — "sotolmaysiz" degan quruq
   * yozuv odamni boshqaruvga qo'ng'iroq qilishga majbur qilardi.
   */
  reason: 'handover' | 'schedule' | 'none'
}

/** `09:00` → 540 daqiqa */
function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * HOZIR KIM SMENADA.
 *
 * Ikki manba, shu tartibda:
 *
 *   1. TOPSHIRISH ZANJIRI — oxirgi yopilgan smena kimga
 *      topshirilgan bo'lsa, kassa o'shanda. Bu jadvaldan
 *      kuchliroq: haqiqatda kim turgani muhim, rejada kim
 *      yozilgani emas.
 *   2. JADVAL — topshirish yozilmagan bo'lsa, bugungi ish
 *      kuni va soatiga qarab topiladi.
 *
 * Hech biri chiqmasa `null`: kassa bo'sh turibdi va uni kim
 * ochsa, o'sha ishlaydi. Bu ataylab yumshoq — aks holda
 * jadvalda xatolik bo'lgan kuni butun apteka ishlay olmasdi.
 */
export async function onDutyNow(): Promise<OnDuty> {
  const { clinicId } = apiContext()
  const db = getDb()
  const me = currentSeller()

  const staff = db.pharmacyStaff.all(clinicId).filter((one) => one.status === 'active')

  /*
    1. Topshirish zanjiri — FAQAT BUGUNGISI.

    Kunning ichida topshirish jadvaldan kuchli: haqiqatda kim
    turgani muhim. Lekin kechagi topshirish bugun ham amal qilsa,
    kassa o'sha odamda muzlab qolardi va bugun jadval bo'yicha
    kelgan sotuvchi ishlay olmasdi — smenani yopib topshirish esa
    faqat kassani ushlab turgan odamning qo'lidan keladi, ya'ni
    apteka o'zini o'zi qulflab qo'yardi.
  */
  const today = isoToday()
  const lastClosed = db.pharmacyShifts
    .all(clinicId)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (lastClosed?.date === today && lastClosed.handedToId) {
    const holder = staff.find((one) => one.id === lastClosed.handedToId) ?? null
    if (holder) {
      return { holder, isMe: holder.id === me?.id, reason: 'handover' }
    }
  }

  /* 2. Jadval */
  const now = new Date()
  const weekday = now.getDay()
  const minutes = now.getHours() * 60 + now.getMinutes()

  const scheduled = staff.find((one) => {
    if (!one.workdays.includes(weekday)) return false
    const from = minutesOf(one.shiftStart)
    const to = minutesOf(one.shiftEnd)
    /* Tunda tugaydigan smena: oxiri boshidan kichik */
    return to > from ? minutes >= from && minutes < to : minutes >= from || minutes < to
  })

  if (scheduled) {
    return { holder: scheduled, isMe: scheduled.id === me?.id, reason: 'schedule' }
  }

  return { holder: null, isMe: false, reason: 'none' }
}
