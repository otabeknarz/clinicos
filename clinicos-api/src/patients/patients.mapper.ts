import { Patient } from '@prisma/client'

import { toApi, toApiDate, toApiDateTime } from '../common/api-enum'

/**
 * Bazadagi yozuvni interfeys kutgan shaklga o'girish.
 *
 * NEGA ALOHIDA FAYL: Prisma yozuvini to'g'ridan-to'g'ri qaytarib
 * yuborish oson, lekin xavfli. Sxemaga yangi ustun qo'shilsa
 * (masalan ichki izoh yoki xesh), u avtomatik interfeysga chiqib
 * ketardi. Bu yerda nima chiqishi ANIQ sanab yozilgan.
 */
export function toApiPatient(row: Patient) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fullName: row.fullName,
    phone: row.phone,
    birthDate: toApiDate(row.birthDate)!,
    gender: toApi(row.gender),
    address: row.address,
    notes: row.notes,
    status: toApi(row.status),
    primaryDoctorId: row.primaryDoctorId,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

export interface PatientStats {
  visitCount: number
  lastVisitAt: string | null
  totalSpent: number
  isReturning: boolean
  nextFollowUpAt: string | null
}

export function toApiPatientWithStats(row: Patient, stats: PatientStats) {
  return { ...toApiPatient(row), stats }
}
