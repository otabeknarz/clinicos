import { getDb } from './db'
import { apiContext } from '@/api/client'
import { parseCsvText } from '@/lib/csv'

/**
 * DEMO REJIMDAGI IMPORT.
 *
 * Haqiqiy tekshiruv serverda: ustun nomlari, sana va telefon
 * shakli, takrorlar. Demoda server yo'q, shuning uchun shu yerda
 * uning QISQARTIRILGAN nusxasi ishlaydi — maqsad ko'rsatish:
 * fayl o'qiladi, qatorlar sanaladi, bemor va xizmat demo bazaga
 * qo'shiladi.
 *
 * Boshqa bo'limlar demoda faqat sanaladi — bazaga yozilmaydi.
 */

export interface MockImportResult {
  total: number
  ready: number
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

const HEADERS: Record<string, Record<string, string[]>> = {
  patients: {
    fullName: ['ism', 'fio', 'f.i.o', 'bemor', 'full name', 'фио'],
    phone: ['telefon', 'phone', 'телефон', 'raqam'],
    birthDate: ['tug‘ilgan sana', 'tugilgan sana', 'birth date', 'дата рождения'],
    gender: ['jinsi', 'gender', 'пол'],
    address: ['manzil', 'address', 'адрес'],
  },
  services: {
    name: ['nomi', 'xizmat', 'name', 'название'],
    category: ['turkum', 'kategoriya', 'category', 'категория'],
    price: ['narx', 'price', 'цена'],
    durationMinutes: ['davomiylik', 'duration', 'длительность'],
  },
}

function value(row: Record<string, string>, aliases: string[]): string {
  for (const [header, cell] of Object.entries(row)) {
    if (aliases.includes(header.trim().toLowerCase())) return cell.trim()
  }
  return ''
}

function phone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('998') ? digits.slice(3) : digits
  if (local.length !== 9) return raw.trim()
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
}

function date(raw: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) return raw
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(raw)
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`
  return null
}

export function mockImport(dataset: string, text: string, write: boolean): MockImportResult {
  const { clinicId } = apiContext()
  const rows = parseCsvText(text)
  const errors: { row: number; message: string }[] = []
  const db = getDb()

  let created = 0
  let skipped = 0

  if (dataset === 'patients') {
    const known = new Set(db.patients.all(clinicId).map((p) => p.phone.replace(/\D/g, '')))

    rows.forEach((row, index) => {
      const line = index + 2
      const fullName = value(row, HEADERS.patients.fullName)
      const raw = value(row, HEADERS.patients.phone)
      const birthDate = date(value(row, HEADERS.patients.birthDate))
      const genderText = value(row, HEADERS.patients.gender).toLowerCase()

      if (!fullName) return errors.push({ row: line, message: 'Ism to‘ldirilmagan' })
      if (!raw) return errors.push({ row: line, message: 'Telefon to‘ldirilmagan' })
      if (!birthDate) return errors.push({ row: line, message: 'Tug‘ilgan sana o‘qilmadi' })

      const gender = ['erkak', 'male', 'm'].includes(genderText)
        ? 'male'
        : ['ayol', 'female', 'f'].includes(genderText)
          ? 'female'
          : null
      if (!gender) return errors.push({ row: line, message: 'Jinsi noto‘g‘ri' })

      const normalized = phone(raw)
      if (known.has(normalized.replace(/\D/g, ''))) {
        skipped++
        return errors.push({ row: line, message: 'Bu telefon bilan bemor bor' })
      }
      known.add(normalized.replace(/\D/g, ''))

      if (write) {
        db.patients.insert({
          id: `pat_imp_${Date.now()}_${index}`,
          clinicId,
          fullName,
          phone: normalized,
          birthDate,
          gender,
          address: value(row, HEADERS.patients.address),
          notes: '',
          status: 'active',
          primaryDoctorId: null,
          createdAt: new Date().toISOString(),
        } as never)
      }
      created++
    })
  } else if (dataset === 'services') {
    const known = new Set(db.services.all(clinicId).map((s) => s.name.toLowerCase()))

    rows.forEach((row, index) => {
      const line = index + 2
      const name = value(row, HEADERS.services.name)
      const category = value(row, HEADERS.services.category)
      const price = Number(value(row, HEADERS.services.price).replace(/[^\d]/g, ''))

      if (!name) return errors.push({ row: line, message: 'Nomi to‘ldirilmagan' })
      if (!category) return errors.push({ row: line, message: 'Turkum to‘ldirilmagan' })
      if (!price) return errors.push({ row: line, message: 'Narx son bo‘lishi kerak' })
      if (known.has(name.toLowerCase())) {
        skipped++
        return errors.push({ row: line, message: 'Bunday xizmat bor' })
      }
      known.add(name.toLowerCase())

      if (write) {
        db.services.insert({
          id: `srv_imp_${Date.now()}_${index}`,
          clinicId,
          name,
          category,
          price,
          priceMode: 'fixed',
          minPrice: null,
          maxPrice: null,
          durationMinutes: Number(value(row, HEADERS.services.durationMinutes)) || 30,
          paymentTiming: 'postpaid',
          loyaltyTiers: [],
          status: 'active',
          createdAt: new Date().toISOString(),
        } as never)
      }
      created++
    })
  } else {
    /* Demoda boshqa bo'limlar faqat sanaladi */
    return {
      total: rows.length,
      ready: rows.length,
      created: 0,
      skipped: 0,
      errors: [{ row: 0, message: 'Demo rejimda faqat bemorlar va xizmatlar yoziladi' }],
    }
  }

  return { total: rows.length, ready: created, created: write ? created : 0, skipped, errors }
}
