import { getDb } from './db'
import { apiContext } from '@/api/client'

/**
 * DEMO REJIMDAGI EKSPORT.
 *
 * Serverda har bir bo'lim uchun ustunlar qo'lda yozilgan. Demoda
 * server yo'q, shuning uchun jadval mock bazadagi yozuvlardan
 * O'ZI yig'iladi: kalitlar o'zbekcha nomga o'giriladi, id'lar esa
 * ism-nomga almashtiriladi (bemor, shifokor, xizmat...).
 *
 * Bu FAQAT demo uchun: serverga ulangan holatda fayl serverdan
 * keladi va ustunlar o'sha yerda belgilanadi.
 */

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Ism',
  name: 'Nomi',
  phone: 'Telefon',
  email: 'Email',
  address: 'Manzil',
  city: 'Shahar',
  birthDate: 'Tug‘ilgan sana',
  gender: 'Jinsi',
  status: 'Holat',
  notes: 'Izoh',
  note: 'Izoh',
  category: 'Turkum',
  price: 'Narx',
  amount: 'Summa',
  total: 'Jami',
  discount: 'Chegirma',
  method: 'To‘lov turi',
  paidAt: 'To‘langan',
  paymentStatus: 'To‘lov holati',
  paymentTiming: 'To‘lov tartibi',
  priceMode: 'Narx turi',
  minPrice: 'Eng kam',
  maxPrice: 'Eng ko‘p',
  durationMinutes: 'Davomiylik (daqiqa)',
  startsAt: 'Boshlanishi',
  visitedAt: 'Tashrif sanasi',
  complaint: 'Shikoyat',
  diagnosis: 'Tashxis',
  treatment: 'Davolash',
  createdAt: 'Yaratilgan',
  admittedAt: 'Yotqizilgan',
  dischargedAt: 'Chiqarilgan',
  dailyRate: 'Kunlik narx',
  date: 'Sana',
  rating: 'Baho',
  text: 'Matn',
  reply: 'Javob',
  isAnonymous: 'Anonim',
  position: 'Lavozim',
  positionTitle: 'Lavozim',
  department: 'Bo‘lim',
  salary: 'Oylik',
  percentRate: 'Foiz %',
  workRate: 'Stavka %',
  payType: 'To‘lov turi',
  hiredAt: 'Ishga olingan',
  shiftStart: 'Ish boshlanishi',
  shiftEnd: 'Ish tugashi',
  lateMinutes: 'Kechikish (daqiqa)',
  workedMinutes: 'Ishlagan (daqiqa)',
  arrivedAt: 'Kelgan vaqt',
  form: 'Shakli',
  manufacturer: 'Ishlab chiqaruvchi',
  country: 'Mamlakat',
  barcode: 'Shtrix-kod',
  unit: 'O‘lchov',
  sellPrice: 'Sotuv narxi',
  buyPrice: 'Tannarx',
  quantity: 'Miqdori',
  code: 'Partiya',
  expiresAt: 'Muddati',
  receivedAt: 'Qabul sanasi',
  soldAt: 'Sotilgan',
  soldByName: 'Sotuvchi',
  sellerName: 'Sotuvchi',
  number: 'Raqami',
  invoiceNumber: 'Hujjat raqami',
  supplierName: 'Ta’minotchi',
  inn: 'INN',
  receipts: 'Cheklar',
  cardTotal: 'Karta',
  expectedCash: 'Kutilgan naqd',
  countedCash: 'Sanalgan naqd',
  difference: 'Farq',
  flagged: 'Belgilangan',
  period: 'Davr',
  planName: 'Tarif',
  issuedAt: 'Berilgan',
  dueAt: 'Muddat',
  dueDate: 'Muddat',
  ownerName: 'Egasi',
  ownerEmail: 'Egasining emaili',
  termMonths: 'Muddat (oy)',
  termPrice: 'Muddat narxi',
  nextInvoiceAt: 'Keyingi hisob',
}

const VALUE_LABELS: Record<string, string> = {
  male: 'Erkak',
  female: 'Ayol',
  active: 'Faol',
  inactive: 'Nofaol',
  archived: 'Arxivda',
  scheduled: 'Rejalashtirilgan',
  confirmed: 'Tasdiqlangan',
  checked_in: 'Navbatda',
  completed: 'Yakunlangan',
  cancelled: 'Bekor qilingan',
  no_show: 'Kelmadi',
  unpaid: 'To‘lanmagan',
  paid: 'To‘langan',
  partial: 'Qisman',
  pending: 'Kutilmoqda',
  refunded: 'Qaytarilgan',
  overdue: 'Muddati o‘tgan',
  credit: 'Qarzga',
  cash: 'Naqd',
  card: 'Karta',
  transfer: 'O‘tkazma',
  present: 'Keldi',
  late: 'Kechikdi',
  absent: 'Kelmadi',
  excused: 'Sababli',
  day_off: 'Dam olish',
  planned: 'Rejada',
  discharged: 'Chiqarilgan',
  fired: 'Ishdan chiqqan',
  on_leave: 'Ta’tilda',
}

/** Ko'rsatilmaydigan xizmat maydonlari */
const HIDDEN = new Set(['id', 'clinicId', 'createdBy', 'updatedAt', 'images', 'loyaltyTiers'])

/** Id maydoni qaysi nom bilan chiqadi */
const ID_LABELS: Record<string, string> = {
  patientId: 'Bemor',
  doctorId: 'Shifokor',
  primaryDoctorId: 'Biriktirilgan shifokor',
  serviceId: 'Xizmat',
  staffId: 'Xodim',
  medicineId: 'Dori',
  supplierId: 'Ta’minotchi',
  roomId: 'Palata',
}

type Row = Record<string, unknown>

export function mockExport(dataset: string): { headers: string[]; rows: (string | number)[][] } {
  const { clinicId } = apiContext()
  const db = getDb()

  const names = {
    patientId: new Map(db.patients.allAcrossTenants().map((p) => [p.id, p.fullName])),
    doctorId: new Map(db.doctors.allAcrossTenants().map((d) => [d.id, d.fullName])),
    primaryDoctorId: new Map(db.doctors.allAcrossTenants().map((d) => [d.id, d.fullName])),
    serviceId: new Map(db.services.allAcrossTenants().map((s) => [s.id, s.name])),
    staffId: new Map(db.staff.allAcrossTenants().map((s) => [s.id, s.fullName])),
    medicineId: new Map(db.medicines.allAcrossTenants().map((m) => [m.id, m.name])),
    supplierId: new Map(db.suppliers.allAcrossTenants().map((s) => [s.id, s.name])),
    roomId: new Map(db.rooms.allAcrossTenants().map((r) => [r.id, `№${r.number}`])),
  } as Record<string, Map<string, string>>

  const source = rowsOf(dataset, clinicId) as Row[]
  if (source.length === 0) return { headers: ['Ma’lumot yo‘q'], rows: [] }

  const keys = Object.keys(source[0]).filter((key) => {
    if (HIDDEN.has(key)) return false
    const value = (source[0] as Row)[key]
    return typeof value !== 'object' || value === null
  })

  const headers = keys.map((key) => ID_LABELS[key] ?? FIELD_LABELS[key] ?? key)
  const rows = source.map((row) => keys.map((key) => cell(key, (row as Row)[key], names)))
  return { headers, rows }
}

function cell(key: string, value: unknown, names: Record<string, Map<string, string>>): string | number {
  if (value === null || value === undefined) return ''
  if (names[key]) return names[key].get(String(value)) ?? ''
  if (typeof value === 'boolean') return value ? 'ha' : 'yo‘q'
  if (typeof value === 'number') return value
  if (Array.isArray(value)) return value.join(' ')

  const text = String(value)
  if (VALUE_LABELS[text]) return VALUE_LABELS[text]
  /* ISO sana-vaqt: "2026-09-12T14:30:00.000Z" → "2026-09-12 14:30" */
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return `${text.slice(0, 10)} ${text.slice(11, 16)}`
  return text
}

/* Har bir to'plamning o'z turi bor — bu yerda faqat kalit-qiymat kerak */
function rowsOf(dataset: string, clinicId: string): object[] {
  const db = getDb()
  switch (dataset) {
    case 'patients':
      return db.patients.all(clinicId)
    case 'appointments':
      return db.appointments.all(clinicId)
    case 'visits':
      return db.visits.all(clinicId)
    case 'payments':
      return db.payments.all(clinicId)
    case 'debts':
      return db.appointments.all(clinicId).filter((a) => a.paymentStatus !== 'paid')
    case 'services':
      return db.services.all(clinicId)
    case 'staff':
      return db.staff.all(clinicId)
    case 'attendance':
      return db.attendance.all(clinicId)
    case 'feedback':
      return db.feedback.all(clinicId)
    case 'admissions':
      return db.admissions.all(clinicId)
    case 'pharmacy-medicines':
      return db.medicines.all(clinicId)
    case 'pharmacy-stock':
      return db.batches.all(clinicId)
    case 'pharmacy-sales':
      return db.sales.all(clinicId)
    case 'pharmacy-purchases':
      return db.purchases.all(clinicId)
    case 'pharmacy-suppliers':
      return db.suppliers.all(clinicId)
    case 'pharmacy-shifts':
      return db.pharmacyShifts.all(clinicId)
    case 'platform-clinics':
      return db.tenants.allAcrossTenants()
    case 'platform-pharmacies':
      return db.pharmacies.allAcrossTenants()
    case 'platform-invoices':
      return db.tenantInvoices.allAcrossTenants()
    default:
      return []
  }
}
