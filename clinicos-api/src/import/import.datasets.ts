import type { Permission } from '../common/permissions'
import type { TenantDb } from '../export/export.datasets'

/**
 * IMPORT BO'LIMLARI.
 *
 * Excel'da ishlab kelgan klinika birinchi kuni bazani qo'lda
 * kiritishdan qo'rqadi — shuning uchun ko'chirish shu yerdan
 * boshlanadi.
 *
 * QOIDALAR:
 *
 *   1. Ustun nomlari erkin: "Ism", "F.I.O", "Full name" — hammasi
 *      bitta maydonga tushadi. Odam faylni bizning shaklimizga
 *      moslab o'tirmasin.
 *   2. Har bir qator alohida tekshiriladi va xatosi QATOR RAQAMI
 *      bilan aytiladi. "Fayl noto'g'ri" degan javob foydasiz.
 *   3. TAKROR YOZUV YARATILMAYDI. Bemor telefon bo'yicha, xizmat
 *      va dori nom bo'yicha solishtiriladi: ikkinchi marta
 *      yuklansa, baza ikkilanmaydi.
 *   4. Import faqat QO'SHADI. Mavjud yozuvni fayl ustidan
 *      yozib yubormaydi: bir odam eski nusxani yuklab, bir kunlik
 *      ishni yo'q qilib qo'yishi mumkin edi.
 */

export interface ImportColumn {
  field: string
  /** Qabul qilinadigan sarlavhalar (kichik harflarda solishtiriladi) */
  headers: string[]
  required?: boolean
  /** Interfeysda ko'rsatiladigan namuna */
  example: string
}

export interface ImportRowError {
  row: number
  message: string
}

export interface ImportDataset {
  key: string
  /** Yozish ruxsati — `data.import` ga QO'SHIMCHA */
  permission: Permission
  columns: ImportColumn[]
  /** Qatordan yozuv yasaydi */
  build(row: Record<string, string>): { value?: Record<string, unknown>; error?: string }
  /** Bazaga yozadi. Takrorlar — `skipped` ga tushadi */
  save(
    db: TenantDb,
    items: { row: number; value: Record<string, unknown> }[],
  ): Promise<{ created: number; skipped: ImportRowError[] }>
}

/* ------------------------------------------------------------------ */
/* Qiymatlarni o'qish                                                  */
/* ------------------------------------------------------------------ */

/** Sarlavhalarni solishtirish uchun: kichik harf, ortiqcha belgisiz */
function norm(value: string): string {
  return value.toLowerCase().replace(/[\s._'’`-]/g, '')
}

export function pick(row: Record<string, string>, column: ImportColumn): string {
  const wanted = column.headers.map(norm)
  for (const [header, value] of Object.entries(row)) {
    if (wanted.includes(norm(header))) return value.trim()
  }
  return ''
}

/** "1 200 000", "1.200.000 so'm" → 1200000 */
function toNumber(value: string): number | null {
  const digits = value.replace(/[^\d.,-]/g, '').replace(/[.,](?=\d{3}\b)/g, '')
  const parsed = Number(digits.replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

/** "2026-09-12", "12.09.2026", "12/09/2026" */
function toDate(value: string): Date | null {
  const text = value.trim()
  if (!text) return null

  /*
    UTC YARIM TUN. Sana ustunlari (`@db.Date`) shunday saqlanadi:
    mahalliy yarim tunda yasalsa, Toshkent vaqti UTC dan 5 soat
    oldinda bo'lgani uchun bazaga BIR KUN OLDINGI sana tushardi —
    tug'ilgan kun ham, qabul sanasi ham surilib ketardi.
  */
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))

  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text)
  if (local) return new Date(Date.UTC(Number(local[3]), Number(local[2]) - 1, Number(local[1])))

  /* "1990/01/05" — yil oldinda */
  const slashed = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(text)
  if (slashed) {
    return new Date(Date.UTC(Number(slashed[1]), Number(slashed[2]) - 1, Number(slashed[3])))
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  /* Boshqa har qanday ko'rinish ham UTC yarim tunga keltiriladi */
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

/**
 * Telefonni BIR XIL ko'rinishga soladi: "+998 90 123 45 67".
 *
 * Takrorni telefon bo'yicha topamiz — "998901234567" va
 * "+998 90 123 45 67" boshqa-boshqa yozuv bo'lib qolmasligi kerak.
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits
  if (local.length !== 9) return value.trim()
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
}

function toGender(value: string): 'MALE' | 'FEMALE' | null {
  const text = norm(value)
  if (['erkak', 'erkek', 'male', 'm', 'м', 'мужской', 'мужчина'].includes(text)) return 'MALE'
  if (['ayol', 'female', 'f', 'ж', 'женский', 'женщина'].includes(text)) return 'FEMALE'
  return null
}

function toBool(value: string): boolean {
  return ['ha', 'yes', 'true', '1', 'да', '+'].includes(norm(value))
}

/* ------------------------------------------------------------------ */

const PATIENT_COLUMNS: ImportColumn[] = [
  { field: 'fullName', headers: ['Ism', 'F.I.O', 'FIO', 'Bemor', 'Full name', 'ФИО'], required: true, example: 'Aziza Yusupova' },
  { field: 'phone', headers: ['Telefon', 'Phone', 'Телефон', 'Raqam'], required: true, example: '+998 90 123 45 67' },
  { field: 'birthDate', headers: ['Tug‘ilgan sana', 'Tugilgan sana', 'Birth date', 'Дата рождения'], required: true, example: '1994-05-12' },
  { field: 'gender', headers: ['Jinsi', 'Gender', 'Пол'], required: true, example: 'Erkak' },
  { field: 'address', headers: ['Manzil', 'Address', 'Адрес'], example: 'Toshkent' },
  { field: 'notes', headers: ['Izoh', 'Notes', 'Примечание'], example: '' },
]

const SERVICE_COLUMNS: ImportColumn[] = [
  { field: 'name', headers: ['Nomi', 'Xizmat', 'Name', 'Название'], required: true, example: 'Kardiolog qabuli' },
  { field: 'category', headers: ['Turkum', 'Kategoriya', 'Category', 'Категория'], required: true, example: 'Kardiologiya' },
  { field: 'price', headers: ['Narx', 'Price', 'Цена'], required: true, example: '150000' },
  { field: 'durationMinutes', headers: ['Davomiylik', 'Duration', 'Длительность'], example: '30' },
]

const MEDICINE_COLUMNS: ImportColumn[] = [
  { field: 'name', headers: ['Nomi', 'Dori', 'Name', 'Название'], required: true, example: 'Paratsetamol 500 mg' },
  { field: 'sellPrice', headers: ['Sotuv narxi', 'Narx', 'Price', 'Цена'], required: true, example: '12000' },
  { field: 'manufacturer', headers: ['Ishlab chiqaruvchi', 'Manufacturer', 'Производитель'], example: 'Nobel' },
  { field: 'country', headers: ['Mamlakat', 'Country', 'Страна'], example: 'Turkiya' },
  { field: 'barcode', headers: ['Shtrix-kod', 'Barcode', 'Штрихкод'], example: '4780012345678' },
  { field: 'unit', headers: ['O‘lchov', 'Olchov', 'Unit', 'Единица'], example: 'dona' },
  { field: 'prescriptionOnly', headers: ['Retsept bilan', 'Retsept', 'Prescription'], example: 'yo‘q' },
]

const SUPPLIER_COLUMNS: ImportColumn[] = [
  { field: 'name', headers: ['Nomi', 'Ta’minotchi', 'Name', 'Поставщик'], required: true, example: 'Grand Pharm' },
  { field: 'phone', headers: ['Telefon', 'Phone', 'Телефон'], example: '+998 71 200 00 00' },
  { field: 'inn', headers: ['INN', 'STIR', 'ИНН'], example: '305112233' },
  { field: 'note', headers: ['Izoh', 'Note', 'Примечание'], example: '' },
]

/** Majburiy ustunlarni tekshiradi */
function required(row: Record<string, string>, columns: ImportColumn[]): string | null {
  for (const column of columns) {
    if (column.required && !pick(row, column)) {
      return `${column.headers[0]} to‘ldirilmagan`
    }
  }
  return null
}

export const IMPORT_DATASETS: ImportDataset[] = [
  {
    key: 'patients',
    /*
      `patients.create` EMAS: bemorni kundalik ishda registrator
      qo'shadi va egasida bu ruxsat yo'q. Bazani Excel'dan ko'chirish
      esa aynan egasining ishi — yozish huquqini `data.import` beradi,
      bu yerdagi ruxsat esa "shu bo'lim bilan umuman ishlaydimi"
      degan savolga javob beradi.
    */
    permission: 'patients.view',
    columns: PATIENT_COLUMNS,
    build(row) {
      const missing = required(row, PATIENT_COLUMNS)
      if (missing) return { error: missing }

      const birthDate = toDate(pick(row, PATIENT_COLUMNS[2]))
      if (!birthDate) return { error: 'Tug‘ilgan sana o‘qilmadi' }

      const gender = toGender(pick(row, PATIENT_COLUMNS[3]))
      if (!gender) return { error: 'Jinsi “Erkak” yoki “Ayol” bo‘lishi kerak' }

      const phone = normalizePhone(pick(row, PATIENT_COLUMNS[1]))
      if (phone.replace(/\D/g, '').length < 7) return { error: 'Telefon raqami to‘liq emas' }

      return {
        value: {
          fullName: pick(row, PATIENT_COLUMNS[0]),
          phone,
          birthDate,
          gender,
          address: pick(row, PATIENT_COLUMNS[4]),
          notes: pick(row, PATIENT_COLUMNS[5]),
        },
      }
    },
    async save(db, items) {
      const existing = new Set(
        (await db.patient.findMany({ select: { phone: true } })).map((p) =>
          p.phone.replace(/\D/g, ''),
        ),
      )
      return insert(db, 'patient', items, (value) => String(value.phone).replace(/\D/g, ''), existing, 'Bu telefon bilan bemor bor')
    },
  },
  {
    key: 'services',
    permission: 'services.manage',
    columns: SERVICE_COLUMNS,
    build(row) {
      const missing = required(row, SERVICE_COLUMNS)
      if (missing) return { error: missing }

      const price = toNumber(pick(row, SERVICE_COLUMNS[2]))
      if (price === null || price < 0) return { error: 'Narx son bo‘lishi kerak' }

      const duration = toNumber(pick(row, SERVICE_COLUMNS[3])) ?? 30

      return {
        value: {
          name: pick(row, SERVICE_COLUMNS[0]),
          category: pick(row, SERVICE_COLUMNS[1]),
          price,
          durationMinutes: duration > 0 ? duration : 30,
        },
      }
    },
    async save(db, items) {
      const existing = new Set(
        (await db.service.findMany({ select: { name: true } })).map((s) => s.name.toLowerCase()),
      )
      return insert(db, 'service', items, (value) => String(value.name).toLowerCase(), existing, 'Bunday xizmat bor')
    },
  },
  {
    key: 'pharmacy-medicines',
    permission: 'pharmacy.manage',
    columns: MEDICINE_COLUMNS,
    build(row) {
      const missing = required(row, MEDICINE_COLUMNS)
      if (missing) return { error: missing }

      const price = toNumber(pick(row, MEDICINE_COLUMNS[1]))
      if (price === null || price < 0) return { error: 'Sotuv narxi son bo‘lishi kerak' }

      return {
        value: {
          name: pick(row, MEDICINE_COLUMNS[0]),
          sellPrice: price,
          manufacturer: pick(row, MEDICINE_COLUMNS[2]),
          country: pick(row, MEDICINE_COLUMNS[3]),
          barcode: pick(row, MEDICINE_COLUMNS[4]),
          unit: pick(row, MEDICINE_COLUMNS[5]) || 'dona',
          prescriptionOnly: toBool(pick(row, MEDICINE_COLUMNS[6])),
        },
      }
    },
    async save(db, items) {
      const rows = await db.medicine.findMany({ select: { name: true, barcode: true } })
      const existing = new Set<string>()
      for (const row of rows) {
        existing.add(row.name.toLowerCase())
        if (row.barcode) existing.add(row.barcode)
      }
      return insert(
        db,
        'medicine',
        items,
        (value) => (value.barcode ? String(value.barcode) : String(value.name).toLowerCase()),
        existing,
        'Bunday dori bor',
      )
    },
  },
  {
    key: 'pharmacy-suppliers',
    permission: 'pharmacy.manage',
    columns: SUPPLIER_COLUMNS,
    build(row) {
      const missing = required(row, SUPPLIER_COLUMNS)
      if (missing) return { error: missing }

      return {
        value: {
          name: pick(row, SUPPLIER_COLUMNS[0]),
          phone: normalizePhone(pick(row, SUPPLIER_COLUMNS[1])),
          inn: pick(row, SUPPLIER_COLUMNS[2]),
          note: pick(row, SUPPLIER_COLUMNS[3]),
        },
      }
    },
    async save(db, items) {
      const existing = new Set(
        (await db.supplier.findMany({ select: { name: true } })).map((s) => s.name.toLowerCase()),
      )
      return insert(db, 'supplier', items, (value) => String(value.name).toLowerCase(), existing, 'Bunday ta’minotchi bor')
    },
  },
]

/**
 * Yozuvlarni qo'shish.
 *
 * Takror ikki joydan qaraladi: BAZADAGI yozuvlar va SHU FAYLNING
 * o'zi — bitta faylda bir odam ikki marta uchrashi odatiy hol.
 *
 * `createMany` bitta so'rovda yozadi: import yuz-ming qatorli
 * bo'lishi mumkin, har qatorga alohida so'rov yuborilsa, bu
 * bazani ham, sabrni ham tugatardi. Klinika filtri `clinicId` ni
 * har bir qatorga o'zi qo'shadi.
 */
async function insert(
  db: TenantDb,
  model: 'patient' | 'service' | 'medicine' | 'supplier',
  items: { row: number; value: Record<string, unknown> }[],
  keyOf: (value: Record<string, unknown>) => string,
  existing: Set<string>,
  duplicateMessage: string,
): Promise<{ created: number; skipped: ImportRowError[] }> {
  const skipped: ImportRowError[] = []
  const fresh: Record<string, unknown>[] = []
  const seen = new Set(existing)

  for (const item of items) {
    const key = keyOf(item.value)
    if (seen.has(key)) {
      skipped.push({ row: item.row, message: duplicateMessage })
      continue
    }
    seen.add(key)
    fresh.push(item.value)
  }

  if (fresh.length > 0) {
    const delegate = db[model] as unknown as {
      createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>
    }
    await delegate.createMany({ data: fresh })
  }

  return { created: fresh.length, skipped }
}
