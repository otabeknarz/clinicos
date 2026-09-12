/**
 * GOOGLE SHEETS INTEGRATSIYASI.
 *
 * Klinika o'z Google hisobini ulaydi, tizim esa uning Drive'ida
 * jadval yaratib, ma'lumotni to'ldiradi. Har safar yuborilganda
 * o'sha jadval yangilanadi — yangisi yaratilmaydi.
 *
 * Demo rejimda ulanmaydi: Google haqiqiy hisob va server kalitlarini
 * talab qiladi. Interfeys buni ochiq aytadi.
 */

import { delay, request, USE_MOCK } from './client'
import type { ISODateTime } from '@/types/models'

export interface GoogleStatus {
  /** Serverda kalitlar bormi (`GOOGLE_CLIENT_ID`/`SECRET`) */
  configured: boolean
  connected: boolean
  email: string | null
  connectedBy: string | null
  connectedAt: ISODateTime | null
}

export interface GoogleSheetInfo {
  dataset: string
  url: string
  rows: number
  lastSyncAt: ISODateTime
}

// GET /integrations/google
export async function googleStatus(): Promise<GoogleStatus> {
  if (!USE_MOCK) return request<GoogleStatus>('GET', '/integrations/google')
  return delay({
    configured: false,
    connected: false,
    email: null,
    connectedBy: null,
    connectedAt: null,
  })
}

// POST /integrations/google/connect
export async function googleConnectUrl(): Promise<{ url: string }> {
  return request<{ url: string }>('POST', '/integrations/google/connect')
}

// DELETE /integrations/google
export async function googleDisconnect(): Promise<void> {
  await request<{ ok: boolean }>('DELETE', '/integrations/google')
}

// GET /integrations/google/sheets
export async function listGoogleSheets(): Promise<GoogleSheetInfo[]> {
  if (!USE_MOCK) return request<GoogleSheetInfo[]>('GET', '/integrations/google/sheets')
  return delay([])
}

// POST /integrations/google/sheets/:dataset
export async function syncGoogleSheet(
  dataset: string,
  range: { from?: string; to?: string } = {},
): Promise<GoogleSheetInfo> {
  return request<GoogleSheetInfo>('POST', `/integrations/google/sheets/${dataset}`, {
    body: range,
  })
}
