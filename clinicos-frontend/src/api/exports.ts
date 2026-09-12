/**
 * EKSPORT — Excel va Google Sheets.
 *
 * Fayl SERVERDA yig'iladi: ekranda 20 ta qator ko'rinadi, Excel'da
 * ishlaydigan odam esa hammasini kutadi. Demo rejimda esa fayl mock
 * bazadan yig'iladi (`mock/exports.ts`).
 *
 * Google Sheets havolasi — `=IMPORTDATA("...")` uchun: jadval o'zi
 * yangilanib turadi. Token faqat yaratilganda ko'rinadi, keyin
 * serverda xesh bo'lib qoladi.
 */

import { delay, request, requestFile, USE_MOCK } from './client'
import { downloadCsv, downloadCsvText } from '@/lib/csv'
import { EXPORT_DATASETS } from '@/lib/exportDatasets'
import { mockExport } from '@/mock/exports'
import type { ExportLinkCreated, ExportLinkInfo } from '@/types/models'

export interface ExportRange {
  from?: string
  to?: string
}

/** Server ruxsat bergan bo'limlar */
// GET /export/datasets
export async function listExportDatasets(): Promise<{ key: string; sheet: boolean }[]> {
  if (!USE_MOCK) {
    return request<{ key: string; sheet: boolean }[]>('GET', '/export/datasets')
  }
  return delay(EXPORT_DATASETS.map((d) => ({ key: d.key, sheet: d.sheet })))
}

/**
 * Faylni yuklab olish.
 *
 * Serverdan kelgan faylning NOMI ham serverniki: u bo'lim va sanadan
 * yasaladi, brauzerda qayta o'ylab topilmaydi.
 */
// GET /export/:dataset
export async function downloadExport(dataset: string, range: ExportRange = {}): Promise<void> {
  if (!USE_MOCK) {
    const file = await requestFile(`/export/${dataset}`, { from: range.from, to: range.to })
    downloadCsvText(file.filename, file.text)
    return
  }

  const { headers, rows } = mockExport(dataset)
  await delay(null, 220)
  downloadCsv(`${dataset}-demo.csv`, [headers, ...rows])
}

/* ------------------------------------------------------------------ */
/* Google Sheets havolalari                                            */
/* ------------------------------------------------------------------ */

// GET /export/links
export async function listExportLinks(): Promise<ExportLinkInfo[]> {
  if (!USE_MOCK) return request<ExportLinkInfo[]>('GET', '/export/links')
  return delay(mockLinks)
}

// POST /export/links
export async function createExportLink(input: {
  dataset: string
  days?: number
}): Promise<ExportLinkCreated> {
  if (!USE_MOCK) {
    return request<ExportLinkCreated>('POST', '/export/links', { body: input })
  }

  const created: ExportLinkCreated = {
    id: `link_${Date.now()}`,
    dataset: input.dataset,
    createdByName: 'Demo',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (input.days ?? 90) * 86_400_000).toISOString(),
    lastUsedAt: null,
    useCount: 0,
    revoked: false,
    path: `/export/sheet/demo-${input.dataset}`,
  }
  mockLinks = [created, ...mockLinks]
  return delay(created)
}

// DELETE /export/links/:id
export async function revokeExportLink(id: string): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('DELETE', `/export/links/${id}`)
    return
  }
  mockLinks = mockLinks.map((link) => (link.id === id ? { ...link, revoked: true } : link))
  await delay(null)
}

/* Demo rejimda havolalar faqat shu sahifa ochiq turganda yashaydi */
let mockLinks: ExportLinkInfo[] = []
