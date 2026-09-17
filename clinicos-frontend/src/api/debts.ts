/**
 * Qarzdorlik.
 *
 * Qarz saqlanmaydi — xizmat narxi minus to'langan summa sifatida
 * hisoblanadi. Shuning uchun bu yerda "qarz yaratish" degan amal yo'q:
 * qarz to'lov yozilishi bilan o'zi kamayadi va nolga yetganda o'zi
 * yo'qoladi.
 *
 * RUXSAT: ko'rish `payments.view` (egasi ham, registrator ham),
 * kechirish `debts.waive` (faqat egasi).
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { startOfDay, toISODate } from '@/lib/dates'
import type {
  DebtList,
  DebtWaiver,
  ID,
  Payment,
  PaymentMethod,
  VisitDebt,
  WardDebt,
} from '@/types/models'

/** Muddat holati — server `dueInfo` bilan bir xil */
function dueInfo(dueDate: string | null | undefined): {
  dueDate: string | null
  overdueDays: number | null
} {
  if (!dueDate) return { dueDate: null, overdueDays: null }
  const today = new Date(`${toISODate(new Date())}T00:00:00Z`).getTime()
  const due = new Date(`${dueDate}T00:00:00Z`).getTime()
  return { dueDate, overdueDays: Math.round((today - due) / 86_400_000) }
}

// GET /debts
export async function listDebts(): Promise<DebtList> {
  if (!USE_MOCK) return request<DebtList>('GET', '/debts')

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()
  const now = Date.now()

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))
  const rooms = new Map(db.rooms.all(clinicId).map((r) => [r.id, r]))

  const waivedAppointments = new Set(
    db.debtWaivers.all(clinicId).map((w) => w.appointmentId),
  )
  const waivedAdmissions = new Set(db.debtWaivers.all(clinicId).map((w) => w.admissionId))

  /** Bitta qabulga to'langan summa */
  const paidFor = (appointmentId: ID) =>
    db.payments
      .all(clinicId)
      .filter((p) => p.appointmentId === appointmentId && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0)

  const days = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000))

  /* --- Ko'rik qarzi --- */

  const visits: VisitDebt[] = db.appointments
    .all(clinicId)
    .filter(
      (a) =>
        a.status === 'completed' &&
        a.paymentStatus !== 'paid' &&
        !waivedAppointments.has(a.id) &&
        // Shifokor faqat o'z bemorlarinikini ko'radi
        (!scopeDoctorId || a.doctorId === scopeDoctorId),
    )
    .map((a) => {
      const service = services.get(a.serviceId)
      if (!service) return null

      /*
        Narxni shifokor belgilaydigan xizmatda summa ko'rikda turadi.
        Belgilanmagan bo'lsa qarz emas — summa aytilmagan.
      */
      const visit = db.visits.all(clinicId).find((v) => v.appointmentId === a.id)
      const total = service.priceMode === 'doctor_set' ? visit?.price : service.price
      if (total === null || total === undefined) return null

      const paid = paidFor(a.id)
      const remaining = total - paid
      if (remaining <= 0) return null

      const since = a.completedAt ?? a.startsAt

      return {
        appointmentId: a.id,
        patientId: a.patientId,
        patientName: patients.get(a.patientId)?.fullName ?? '—',
        patientPhone: patients.get(a.patientId)?.phone ?? '',
        doctorId: a.doctorId,
        doctorName: doctors.get(a.doctorId)?.fullName ?? '—',
        serviceId: a.serviceId,
        serviceName: service.name,
        completedAt: since,
        daysOverdue: days(since),
        ...dueInfo(a.debtDueDate),
        total,
        paid,
        remaining,
      }
    })
    .filter((row): row is VisitDebt => row !== null)
    // Eng eskisi tepada
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))

  /* --- Statsionar qarzi --- */

  const ward: WardDebt[] = db.admissions
    .all(clinicId)
    .filter(
      (a) =>
        (a.status === 'active' || a.status === 'discharged') &&
        !waivedAdmissions.has(a.id) &&
        (!scopeDoctorId || a.doctorId === scopeDoctorId),
    )
    .map((a) => {
      /*
        Hisob: yotgan kunlar × kunlik narx.

        Demo rejimda to'lov yotqizishga BOG'LANMAYDI — mock qatlamida
        `Payment` da `admissionId` yo'q (`api/ward.ts` da ham shu
        cheklov bor). Shuning uchun bu yerda ham `paid` nol; haqiqiy
        backendda summalar serverdan keladi.
      */
      const admitted = new Date(a.admittedAt)
      const end = a.dischargedAt ? new Date(a.dischargedAt) : new Date()
      const stayed = Math.max(
        1,
        Math.round((startOfDay(end).getTime() - startOfDay(admitted).getTime()) / 86_400_000) + 1,
      )
      const planned = a.expectedDischargeAt
        ? Math.max(
            1,
            Math.round(
              (startOfDay(new Date(a.expectedDischargeAt)).getTime() -
                startOfDay(admitted).getTime()) /
                86_400_000,
            ) + 1,
          )
        : 0

      const total = Math.max(planned, stayed) * a.dailyRate
      const paid = 0
      const remaining = total - paid
      if (remaining <= 0) return null

      return {
        admissionId: a.id,
        patientId: a.patientId,
        patientName: patients.get(a.patientId)?.fullName ?? '—',
        patientPhone: patients.get(a.patientId)?.phone ?? '',
        roomNumber: rooms.get(a.roomId)?.number ?? '—',
        admittedAt: a.admittedAt,
        daysOverdue: days(a.admittedAt),
        ...dueInfo(a.debtDueDate),
        total,
        paid,
        remaining,
      }
    })
    .filter((row): row is WardDebt => row !== null)
    .sort((a, b) => a.admittedAt.localeCompare(b.admittedAt))

  const visitsTotal = visits.reduce((sum, d) => sum + d.remaining, 0)
  const wardTotal = ward.reduce((sum, d) => sum + d.remaining, 0)

  return delay({
    visits,
    ward,
    totals: { visits: visitsTotal, ward: wardTotal, all: visitsTotal + wardTotal },
  })
}

export interface WaiveDebtInput {
  appointmentId?: ID
  admissionId?: ID
  note: string
}

/**
 * Umidsiz qarzni yopish.
 *
 * SERVERDA: faqat `debts.waive` ruxsati borida ishlaydi va audit
 * jurnaliga tushadi. Qarz o'chirilmaydi — kechirish alohida yozuv
 * bo'lib qo'shiladi.
 */
// POST /debts/waive
export async function waiveDebt(input: WaiveDebtInput): Promise<DebtWaiver> {
  if (!USE_MOCK) return request<DebtWaiver>('POST', '/debts/waive', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const waiver: DebtWaiver = {
    id: db.debtWaivers.nextId('dwv'),
    clinicId,
    appointmentId: input.appointmentId ?? null,
    admissionId: input.admissionId ?? null,
    note: input.note,
    // Kechirishni faqat egasi qila oladi — demo qatlamda o'sha yoziladi
    createdBy: 'usr_owner',
    createdAt: new Date().toISOString(),
  }

  db.debtWaivers.insert(waiver)
  return delay(waiver, 260)
}

export interface DebtTarget {
  appointmentId?: ID
  admissionId?: ID
}

/**
 * Qarz to'lash muddati. `null` — muddatni olib tashlash.
 * O'sha kuni bemorga botda eslatma boradi.
 */
// POST /debts/due
export async function setDebtDue(
  input: DebtTarget & { dueDate: string | null },
): Promise<{ dueDate: string | null; overdueDays: number | null }> {
  if (!USE_MOCK) {
    return request('POST', '/debts/due', { body: input })
  }
  const { clinicId } = apiContext()
  const db = getDb()
  if (input.appointmentId) {
    db.appointments.update(input.appointmentId, { debtDueDate: input.dueDate }, clinicId)
  } else if (input.admissionId) {
    db.admissions.update(input.admissionId, { debtDueDate: input.dueDate }, clinicId)
  }
  return delay(dueInfo(input.dueDate), 200)
}

export interface CollectDebtInput extends DebtTarget {
  amount: number
  method: PaymentMethod
  notes: string
  /** Qisman to'lovda qolganini qachongacha to'laydi */
  dueDate?: string
}

/**
 * Qarz bo'yicha to'lov. Bemor, shifokor va xizmat serverda qarzning
 * o'zidan olinadi; summa qolgan qarzdan oshmaydi.
 */
// POST /debts/collect
export async function collectDebt(input: CollectDebtInput): Promise<Payment> {
  if (!USE_MOCK) return request<Payment>('POST', '/debts/collect', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const list = await listDebts()
  const debt = input.appointmentId
    ? list.visits.find((d) => d.appointmentId === input.appointmentId)
    : list.ward.find((d) => d.admissionId === input.admissionId)
  if (!debt) throw new Error('Qarz topilmadi')
  if (input.amount > debt.remaining) {
    throw new Error(`Summa qolgan qarzdan oshib ketdi (${debt.remaining} so‘m)`)
  }

  const now = new Date().toISOString()
  const payment: Payment = {
    id: db.payments.nextId('pay'),
    clinicId,
    patientId: debt.patientId,
    doctorId: 'doctorId' in debt ? debt.doctorId : '',
    serviceId: 'serviceId' in debt ? debt.serviceId : '',
    appointmentId: 'appointmentId' in debt ? debt.appointmentId : null,
    amount: input.amount,
    method: input.method,
    status: 'paid',
    paidAt: now,
    notes: input.notes,
    createdBy: 'usr_reception_1',
    createdAt: now,
  }
  db.payments.insert(payment)

  if (input.appointmentId) {
    const full = input.amount >= debt.remaining
    db.appointments.update(
      input.appointmentId,
      {
        paymentStatus: full ? 'paid' : 'partial',
        debtDueDate: full ? null : (input.dueDate ?? undefined),
      },
      clinicId,
    )
  }
  return delay(payment, 280)
}
