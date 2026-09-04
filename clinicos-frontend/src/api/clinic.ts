/** Klinika profili va sozlamalari. */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { Clinic, WorkingHours } from '@/types/models'

// GET /clinic
export async function getClinic(): Promise<Clinic | null> {
  if (!USE_MOCK) return request<Clinic>('GET', '/clinic')

  const { clinicId } = apiContext()
  return delay(getDb().clinics.find(clinicId, clinicId), 80)
}

export interface ClinicInput {
  name: string
  phone: string
  address: string
  workingHours: WorkingHours[]
  slotMinutes: number
}

// PATCH /clinic  — faqat `settings.manage` ruxsati bilan
export async function updateClinic(patch: Partial<ClinicInput>): Promise<Clinic> {
  if (!USE_MOCK) return request<Clinic>('PATCH', '/clinic', { body: patch })

  const { clinicId } = apiContext()
  const updated = getDb().clinics.update(clinicId, patch as Partial<Clinic>, clinicId)
  if (!updated) throw new Error('Klinika topilmadi')
  return delay(updated, 280)
}
