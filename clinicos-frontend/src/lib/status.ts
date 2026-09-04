/**
 * Holat → rang va tarjima kaliti xaritalari.
 *
 * Bir joyda turadi, chunki bir xil holat jadval, kalendar va profil
 * sahifalarida bir xil ko'rinishi kerak.
 */

import type {
  AppointmentPaymentStatus,
  AppointmentStatus,
  DoctorStatus,
  PatientStatus,
  PaymentStatus,
  ServiceStatus,
} from '@/types/models'

export type Tone = 'neutral' | 'accent' | 'brand' | 'ok' | 'warn' | 'bad'

export const APPOINTMENT_TONE: Record<AppointmentStatus, Tone> = {
  scheduled: 'neutral',
  confirmed: 'accent',
  checked_in: 'warn',
  completed: 'ok',
  cancelled: 'neutral',
  no_show: 'bad',
}

export const APPOINTMENT_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'appts.status.scheduled',
  confirmed: 'appts.status.confirmed',
  checked_in: 'appts.status.checked_in',
  completed: 'appts.status.completed',
  cancelled: 'appts.status.cancelled',
  no_show: 'appts.status.no_show',
}

export const APPOINTMENT_PAYMENT_TONE: Record<AppointmentPaymentStatus, Tone> = {
  unpaid: 'warn',
  paid: 'ok',
  partial: 'accent',
}

export const APPOINTMENT_PAYMENT_LABEL: Record<AppointmentPaymentStatus, string> = {
  unpaid: 'appts.payment.unpaid',
  paid: 'appts.payment.paid',
  partial: 'appts.payment.partial',
}

export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  paid: 'ok',
  pending: 'warn',
  refunded: 'neutral',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: 'payments.status.paid',
  pending: 'payments.status.pending',
  refunded: 'payments.status.refunded',
}

export const PATIENT_TONE: Record<PatientStatus, Tone> = {
  active: 'ok',
  inactive: 'neutral',
}

export const PATIENT_LABEL: Record<PatientStatus, string> = {
  active: 'patients.status.active',
  inactive: 'patients.status.inactive',
}

export const DOCTOR_TONE: Record<DoctorStatus, Tone> = {
  active: 'ok',
  on_leave: 'warn',
  inactive: 'neutral',
}

export const DOCTOR_LABEL: Record<DoctorStatus, string> = {
  active: 'doctors.status.active',
  on_leave: 'doctors.status.on_leave',
  inactive: 'doctors.status.inactive',
}

export const SERVICE_TONE: Record<ServiceStatus, Tone> = {
  active: 'ok',
  archived: 'neutral',
}

export const SERVICE_LABEL: Record<ServiceStatus, string> = {
  active: 'services.status.active',
  archived: 'services.status.archived',
}

/** O'zgarish foizi ijobiymi — ba'zi ko'rsatkichlarda kamayish yaxshi */
export function deltaTone(changePct: number | null, lowerIsBetter = false): Tone {
  if (changePct === null || changePct === 0) return 'neutral'
  const good = lowerIsBetter ? changePct < 0 : changePct > 0
  return good ? 'ok' : 'bad'
}
