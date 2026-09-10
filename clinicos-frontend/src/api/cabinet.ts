/**
 * BEMOR KABINETI.
 *
 * Telegram mini app ichida ochiladigan qism. Bemor faqat O'Z
 * ma'lumotini ko'radi: tashriflari, tashxislari va qarzi.
 *
 * BEMOR ID SO'ROVDA KELMAYDI. Haqiqiy backendda u tokendan olinadi —
 * `/patient/*` marshrutlari bemor tokeni bilan ochiladi va token
 * ichida qaysi bemor ekani yozilgan. So'rovdan olinsa, bemor id ni
 * almashtirib qo'shnisining tashxisini o'qib olardi.
 *
 * Demo rejimda "kim kirgani" `patient-context` da saqlanadi va shu
 * yerga uzatiladi — bu FAQAT demo uchun, shuning uchun parametr
 * `demoPatientId` deb ataldi va haqiqiy so'rovga umuman qo'shilmaydi.
 */
import { delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { MAIN_CLINIC_ID } from '@/mock/seed'
import type {
  CabinetDebt,
  CabinetProfile,
  CabinetVisit,
  ID,
} from '@/types/models'

/* ------------------------------------------------------------------ */

// GET /patient/card
export async function getCabinetProfile(demoPatientId?: ID): Promise<CabinetProfile> {
  if (!USE_MOCK) return request<CabinetProfile>('GET', '/patient/card', { session: 'patient' })

  const db = getDb()
  const patient = requirePatient(demoPatientId)
  const clinic = db.clinics.allAcrossTenants().find((c) => c.id === MAIN_CLINIC_ID)

  const visits = db.visits
    .all(MAIN_CLINIC_ID)
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))

  const now = Date.now()
  const next = db.appointments
    .all(MAIN_CLINIC_ID)
    .filter((a) => a.patientId === patient.id)
    .filter((a) => a.status !== 'cancelled' && a.status !== 'completed')
    .filter((a) => new Date(a.startsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]

  const doctors = new Map(db.doctors.all(MAIN_CLINIC_ID).map((d) => [d.id, d]))
  const services = new Map(db.services.all(MAIN_CLINIC_ID).map((s) => [s.id, s]))

  return delay(
    {
      patientId: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      clinicName: clinic?.name ?? '',
      visitCount: visits.length,
      lastVisitAt: visits[0]?.visitedAt.slice(0, 10) ?? null,
      nextAppointment: next
        ? {
            id: next.id,
            startsAt: next.startsAt,
            doctorName: doctors.get(next.doctorId)?.fullName ?? '',
            serviceName: services.get(next.serviceId)?.name ?? '',
          }
        : null,
      debtTotal: debtOf(patient.id).total,
    },
    220,
  )
}

// GET /patient/visits
export async function listCabinetVisits(demoPatientId?: ID): Promise<CabinetVisit[]> {
  if (!USE_MOCK) return request<CabinetVisit[]>('GET', '/patient/visits', { session: 'patient' })

  const db = getDb()
  const patient = requirePatient(demoPatientId)
  const doctors = new Map(db.doctors.all(MAIN_CLINIC_ID).map((d) => [d.id, d]))
  const services = new Map(db.services.all(MAIN_CLINIC_ID).map((s) => [s.id, s]))
  const appointments = new Map(db.appointments.all(MAIN_CLINIC_ID).map((a) => [a.id, a]))

  const rows = db.visits
    .all(MAIN_CLINIC_ID)
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
    .map((visit) => {
      const serviceId = appointments.get(visit.appointmentId)?.serviceId
      return {
        id: visit.id,
        visitedAt: visit.visitedAt,
        doctorName: doctors.get(visit.doctorId)?.fullName ?? '',
        serviceName: serviceId ? (services.get(serviceId)?.name ?? null) : null,
        complaint: visit.complaint,
        diagnosis: visit.diagnosis,
        treatment: visit.treatment,
        /* `notes` ATAYLAB olinmaydi — shifokorning ichki eslatmasi */
        images: visit.images,
      }
    })

  return delay(rows, 240)
}

// GET /patient/debt
export async function getCabinetDebt(demoPatientId?: ID): Promise<CabinetDebt> {
  if (!USE_MOCK) return request<CabinetDebt>('GET', '/patient/debt', { session: 'patient' })

  const patient = requirePatient(demoPatientId)
  return delay(debtOf(patient.id), 200)
}

/* ------------------------------------------------------------------ */

function requirePatient(demoPatientId?: ID) {
  const db = getDb()
  const patient = demoPatientId
    ? db.patients.find(demoPatientId, MAIN_CLINIC_ID)
    : db.patients.all(MAIN_CLINIC_ID)[0]
  if (!patient) throw new Error('Bemor topilmadi')
  return patient
}

/**
 * Qarz — narx minus to'lovlar.
 *
 * Xodimlar tomonidagi `GET /debts` bilan bir xil mantiq, lekin bitta
 * bemor uchun. Kechirilgan qarz (`DebtWaiver`) ro'yxatdan chiqadi:
 * klinika uni yozmaslikka qaror qilgan, ya'ni bemordan so'ralmaydi.
 */
function debtOf(patientId: ID): CabinetDebt {
  const db = getDb()
  const doctors = new Map(db.doctors.all(MAIN_CLINIC_ID).map((d) => [d.id, d]))
  const services = new Map(db.services.all(MAIN_CLINIC_ID).map((s) => [s.id, s]))
  const waived = new Set(
    db.debtWaivers
      .all(MAIN_CLINIC_ID)
      .map((w) => w.appointmentId)
      .filter((id): id is string => Boolean(id)),
  )

  const payments = db.payments.all(MAIN_CLINIC_ID)

  const items = db.appointments
    .all(MAIN_CLINIC_ID)
    .filter((a) => a.patientId === patientId)
    .filter((a) => a.status === 'completed')
    .filter((a) => !waived.has(a.id))
    .map((a) => {
      const service = services.get(a.serviceId)
      const total = service?.price ?? 0
      const paid = payments
        .filter((p) => p.appointmentId === a.id && p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0)
      return {
        appointmentId: a.id,
        serviceName: service?.name ?? '',
        doctorName: doctors.get(a.doctorId)?.fullName ?? '',
        completedAt: a.completedAt ?? a.startsAt,
        total,
        paid,
        remaining: Math.max(0, total - paid),
      }
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  return { items, total: items.reduce((sum, row) => sum + row.remaining, 0) }
}


/* ------------------------------------------------------------------ */
/* Kirish                                                              */
/* ------------------------------------------------------------------ */

/** Bir odam ikki klinikada bemor bo'lsa — tanlash uchun */
export interface CabinetClinicChoice {
  id: ID
  name: string
}

export interface CabinetAuthResult {
  /** `null` — avval klinika tanlanishi kerak */
  token: string | null
  clinics: CabinetClinicChoice[] | null
}

/**
 * Telegram imzosi bilan kabinetga kirish.
 *
 * Parol yo'q va bo'lmaydi: bemor kabinetni mini app ichida ochadi,
 * Telegram imzolangan `initData` beradi, server uni BEMOR BOTINING
 * tokeni bilan tekshiradi. Biz `initData` ni O'QIMAYMIZ — imzoni
 * tekshirish uchun bot tokeni kerak, u esa mijozda bo'lmasligi shart.
 */
// POST /patient/auth
export async function cabinetSignIn(
  initData: string,
  clinicId?: ID,
): Promise<CabinetAuthResult> {
  if (!USE_MOCK) {
    return request<CabinetAuthResult>('POST', '/patient/auth', {
      body: { initData, clinicId },
    })
  }
  /* Demo rejimda bot yo'q — kirish "Bemor" tugmasi orqali */
  return delay({ token: null, clinics: null }, 80)
}
