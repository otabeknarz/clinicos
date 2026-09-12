/**
 * SOTUV SO'ROVLARI.
 *
 * O'zi ro'yxatdan o'tgan har bir klinika shu ro'yxatga tushadi:
 * telefon, lavozim, yo'nalish va klinikaning hozirgi holati.
 * Platforma paneli shu bilan ishlaydi.
 */

import { request, USE_MOCK, delay } from './client'
import type { ID, ISODate, ISODateTime, Paginated, TenantStatus } from '@/types/models'

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost'

export interface Lead {
  id: ID
  /** Shu so'rovdan ochilgan klinika. O'chirilgan bo'lsa ham yozuv qoladi. */
  clinicId: ID | null
  clinicName: string
  fullName: string
  phone: string
  /** `leadPosition.*` kaliti */
  position: string
  /** `direction.*` kaliti */
  direction: string
  city: string
  /** "1-5", "6-15", "16-40", "40+" */
  staffCount: string
  status: LeadStatus
  note: string
  createdAt: ISODateTime
  /* --- Klinika qanchalik jonli --- */
  patients: number
  users: number
  trialEndsAt: ISODate | null
  tenantStatus: TenantStatus | null
  clinicDeleted: boolean
}

export interface LeadPage extends Paginated<Lead> {
  /** Hali qo'ng'iroq qilinmagan so'rovlar soni */
  fresh: number
}

// GET /platform/leads
export async function listLeads(query: {
  search?: string
  status?: LeadStatus | 'all'
  page?: number
  pageSize?: number
}): Promise<LeadPage> {
  if (!USE_MOCK) {
    return request<LeadPage>('GET', '/platform/leads', {
      query: {
        search: query.search,
        status: query.status,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
      },
    })
  }

  /*
    Demo rejimda so'rov yo'q: u faqat haqiqiy ro'yxatdan o'tishdan
    paydo bo'ladi, demo esa hech kimni ro'yxatdan o'tkazmaydi.
  */
  return delay({
    items: [] as Lead[],
    total: 0,
    page: 1,
    pageSize: 20,
    fresh: 0,
  })
}

// PATCH /platform/leads/:id
export async function updateLead(
  id: ID,
  patch: { status?: LeadStatus; note?: string },
): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('PATCH', `/platform/leads/${id}`, { body: patch })
    return
  }
  await delay(null)
}
