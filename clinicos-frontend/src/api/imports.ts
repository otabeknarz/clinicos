/**
 * IMPORT — Excel'dan ko'chirish.
 *
 * Ikki qadam: avval fayl TEKSHIRILADI (nechta qator tayyor, qayerda
 * xato), keyin yoziladi. Bir qadamda qilinsa, odam faylni ko'rmasdan
 * bazaga yozib yuborardi va uni orqaga qaytarib bo'lmasdi.
 */

import { delay, upload, USE_MOCK } from './client'
import { mockImport } from '@/mock/imports'

export interface ImportColumnInfo {
  field: string
  header: string
  required: boolean
  example: string
}

export interface ImportDatasetInfo {
  key: string
  columns: ImportColumnInfo[]
}

export interface ImportRowError {
  row: number
  message: string
}

export interface ImportPreview {
  headers: string[]
  total: number
  ready: number
  errors: ImportRowError[]
  sample: Record<string, string>[]
}

export interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: ImportRowError[]
}

/* Demo rejimda qaysi bo'limlar bor va qanday ustun kutiladi */
const DEMO_DATASETS: ImportDatasetInfo[] = [
  {
    key: 'patients',
    columns: [
      { field: 'fullName', header: 'Ism', required: true, example: 'Aziza Yusupova' },
      { field: 'phone', header: 'Telefon', required: true, example: '+998 90 123 45 67' },
      { field: 'birthDate', header: 'Tug‘ilgan sana', required: true, example: '1994-05-12' },
      { field: 'gender', header: 'Jinsi', required: true, example: 'Ayol' },
      { field: 'address', header: 'Manzil', required: false, example: 'Toshkent' },
      { field: 'notes', header: 'Izoh', required: false, example: '' },
    ],
  },
  {
    key: 'services',
    columns: [
      { field: 'name', header: 'Nomi', required: true, example: 'Kardiolog qabuli' },
      { field: 'category', header: 'Turkum', required: true, example: 'Kardiologiya' },
      { field: 'price', header: 'Narx', required: true, example: '150000' },
      { field: 'durationMinutes', header: 'Davomiylik', required: false, example: '30' },
    ],
  },
  {
    key: 'pharmacy-medicines',
    columns: [
      { field: 'name', header: 'Nomi', required: true, example: 'Paratsetamol 500 mg' },
      { field: 'sellPrice', header: 'Sotuv narxi', required: true, example: '12000' },
      { field: 'manufacturer', header: 'Ishlab chiqaruvchi', required: false, example: 'Nobel' },
      { field: 'country', header: 'Mamlakat', required: false, example: 'Turkiya' },
      { field: 'barcode', header: 'Shtrix-kod', required: false, example: '4780012345678' },
      { field: 'unit', header: 'O‘lchov', required: false, example: 'dona' },
      { field: 'prescriptionOnly', header: 'Retsept bilan', required: false, example: 'yo‘q' },
    ],
  },
  {
    key: 'pharmacy-suppliers',
    columns: [
      { field: 'name', header: 'Nomi', required: true, example: 'Grand Pharm' },
      { field: 'phone', header: 'Telefon', required: false, example: '+998 71 200 00 00' },
      { field: 'inn', header: 'INN', required: false, example: '305112233' },
      { field: 'note', header: 'Izoh', required: false, example: '' },
    ],
  },
]

// GET /import/datasets
export async function listImportDatasets(): Promise<ImportDatasetInfo[]> {
  if (!USE_MOCK) {
    const { request } = await import('./client')
    return request<ImportDatasetInfo[]>('GET', '/import/datasets')
  }
  return delay(DEMO_DATASETS)
}

// POST /import/:dataset/preview
export async function previewImport(dataset: string, file: File): Promise<ImportPreview> {
  if (!USE_MOCK) {
    return upload<ImportPreview>(`/import/${dataset}/preview`, file, file.name)
  }

  const text = await file.text()
  const result = mockImport(dataset, text, false)
  return delay({
    headers: [],
    total: result.total,
    ready: result.ready,
    errors: result.errors,
    sample: [],
  })
}

// POST /import/:dataset/apply
export async function applyImport(dataset: string, file: File): Promise<ImportResult> {
  if (!USE_MOCK) {
    return upload<ImportResult>(`/import/${dataset}/apply`, file, file.name)
  }

  const text = await file.text()
  const result = mockImport(dataset, text, true)
  return delay({
    total: result.total,
    created: result.created,
    skipped: result.skipped,
    errors: result.errors,
  })
}
