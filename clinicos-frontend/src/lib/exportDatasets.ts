import type { Permission } from '@/types/models'

/**
 * EKSPORT BO'LIMLARI — interfeys uchun ro'yxat.
 *
 * Serverdagi `src/export/export.datasets.ts` ning ko'zgusi: u yerda
 * ma'lumot va ruxsat tekshiruvi, bu yerda esa nom va tartib. Ikkalasi
 * ajralib ketmasligi uchun kalitlar AYNAN bir xil yozilgan.
 *
 * `sheet` — Google Sheets havolasi berilishi mumkinmi. Bemorlar
 * bazasi, tashriflar va statsionarga berilmaydi: havola parolsiz
 * ochiladi, tashxis va shikoyat esa bunday yurmaydi.
 */
export interface ExportDatasetInfo {
  key: string
  permission: Permission
  sheet: boolean
  /** Platforma paneli bo'limi */
  platform?: boolean
  /** Apteka paneli bo'limi */
  pharmacy?: boolean
}

export const EXPORT_DATASETS: ExportDatasetInfo[] = [
  { key: 'patients', permission: 'patients.view', sheet: false },
  { key: 'appointments', permission: 'appointments.view', sheet: true },
  { key: 'visits', permission: 'visits.view', sheet: false },
  { key: 'payments', permission: 'payments.view', sheet: true },
  { key: 'debts', permission: 'debts.view', sheet: true },
  { key: 'services', permission: 'services.view', sheet: true },
  { key: 'staff', permission: 'staff.view', sheet: true },
  { key: 'attendance', permission: 'attendance.view', sheet: true },
  { key: 'feedback', permission: 'feedback.view', sheet: true },
  { key: 'admissions', permission: 'ward.view', sheet: false },

  { key: 'pharmacy-medicines', permission: 'pharmacy.view', sheet: true, pharmacy: true },
  { key: 'pharmacy-stock', permission: 'pharmacy.view', sheet: true, pharmacy: true },
  { key: 'pharmacy-sales', permission: 'pharmacy.view', sheet: true, pharmacy: true },
  { key: 'pharmacy-purchases', permission: 'pharmacy.receive', sheet: true, pharmacy: true },
  { key: 'pharmacy-suppliers', permission: 'pharmacy.view', sheet: true, pharmacy: true },
  {
    key: 'pharmacy-shifts',
    permission: 'pharmacy.cashcontrol',
    sheet: true,
    pharmacy: true,
  },

  { key: 'platform-clinics', permission: 'platform.view', sheet: true, platform: true },
  { key: 'platform-pharmacies', permission: 'platform.view', sheet: true, platform: true },
  { key: 'platform-invoices', permission: 'platform.view', sheet: true, platform: true },
]

/** Sana oralig'i ma'noga ega bo'lgan bo'limlar */
export const DATED_DATASETS = new Set([
  'patients',
  'appointments',
  'visits',
  'payments',
  'attendance',
  'feedback',
  'admissions',
  'pharmacy-sales',
  'pharmacy-purchases',
  'pharmacy-shifts',
  'platform-invoices',
])
