/**
 * IMKONIYATLAR VA SINOV SHARTLARI — PLATFORMA TOMONI.
 *
 * Cheklov bo'limni yopadi va SABABINI aytadi. Bu `disabledModules`
 * dan farq qiladi: u jimgina yashiradi, bu esa ko'rsatib turadi —
 * "tez kunda", "tarifingizda yo'q", "texnik ishlar".
 */

import { delay, request, USE_MOCK } from './client'
import type { ID } from '@/types/models'

export type BlockReason = 'soon' | 'plan' | 'maintenance' | 'off'

export interface Restriction {
  id: ID
  /** null — barcha klinikalar uchun */
  clinicId: ID | null
  clinicName: string
  module: string
  reason: BlockReason
  note: string
}

export interface AccessList {
  modules: string[]
  items: Restriction[]
}

export interface TrialPolicy {
  /** `default` yoki klinika yo'nalishi */
  direction: string
  days: number
  /** Sinov davrida YOPIQ bo'limlar */
  disabledModules: string[]
  /** Bazada alohida yozuv bormi — yo'qsa sukut qiymat */
  custom: boolean
}

export interface TrialList {
  modules: string[]
  items: TrialPolicy[]
}

/*
  Demo rejimda qoidalar xotirada yashaydi — sahifa bo'sh
  ko'rinmasligi va tugmalar haqiqatan ishlashi uchun.
*/
const MOCK_MODULES = [
  'ward',
  'prescriptions',
  'chat',
  'feedback',
  'analytics',
  'attendance',
  'cashcontrol',
  'calendar',
  'debts',
  'revenue',
]

let mockRestrictions: Restriction[] = [
  {
    id: 'res_1',
    clinicId: null,
    clinicName: '',
    module: 'prescriptions',
    reason: 'soon',
    note: '',
  },
]

let mockTrials: TrialPolicy[] = [
  'default',
  'general',
  'dental',
  'eye',
  'lab',
].map((direction) => ({
  direction,
  days: 14,
  disabledModules: ['revenue', 'analytics', 'cashcontrol', 'ward'],
  custom: false,
}))

// GET /platform/access
export async function listRestrictions(): Promise<AccessList> {
  if (!USE_MOCK) return request<AccessList>('GET', '/platform/access')
  return delay({ modules: MOCK_MODULES, items: mockRestrictions })
}

// POST /platform/access
export async function setRestriction(input: {
  module: string
  reason: BlockReason
  clinicId?: ID
  note?: string
}): Promise<void> {
  if (!USE_MOCK) {
    await request<{ id: string }>('POST', '/platform/access', { body: input })
    return
  }

  mockRestrictions = [
    ...mockRestrictions.filter(
      (one) => !(one.module === input.module && one.clinicId === (input.clinicId ?? null)),
    ),
    {
      id: `res_${Date.now()}`,
      clinicId: input.clinicId ?? null,
      clinicName: '',
      module: input.module,
      reason: input.reason,
      note: input.note ?? '',
    },
  ]
  await delay(null)
}

// DELETE /platform/access/:id
export async function removeRestriction(id: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('DELETE', `/platform/access/${id}`)
    return
  }
  mockRestrictions = mockRestrictions.filter((one) => one.id !== id)
  await delay(null)
}

// GET /platform/trial
export async function listTrialPolicies(): Promise<TrialList> {
  if (!USE_MOCK) return request<TrialList>('GET', '/platform/trial')
  return delay({ modules: MOCK_MODULES, items: mockTrials })
}

// POST /platform/trial
export async function setTrialPolicy(input: {
  direction: string
  days: number
  disabledModules: string[]
}): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('POST', '/platform/trial', { body: input })
    return
  }

  mockTrials = mockTrials.map((one) =>
    one.direction === input.direction
      ? { ...one, days: input.days, disabledModules: input.disabledModules, custom: true }
      : one,
  )
  await delay(null)
}
