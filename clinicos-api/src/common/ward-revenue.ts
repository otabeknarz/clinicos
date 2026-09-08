/**
 * Statsionar to'lovlari hisobotda qanday ko'rinadi.
 *
 * Yotoq to'lovida katalog xizmati BO'LMAYDI: narx palataning
 * kunlik narxi va yotgan kunlar sonidan chiqadi. Xizmatlar
 * bo'yicha taqsimotda ular shu nom ostida bir joyga yig'iladi —
 * aks holda klinikaning bir qismi hisobotdan butunlay tushib
 * qolardi.
 *
 * Bitta joyda, chunki ikkita hisobotda ishlatiladi.
 */
export const WARD_KEY = 'ward'
export const WARD_LABEL = 'Statsionar'

/**
 * Yotgan kunlar soni. KIRGAN KUNNING O'ZI HAM hisoblanadi —
 * `ward.service.ts` dagi qoida bilan bir xil bo'lishi shart,
 * aks holda ikkita joyda ikki xil summa chiqardi.
 */
export function inclusiveDays(from: Date, to: Date): number {
  const startOfDay = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

/** `wardBalance` uchun kerak bo'ladigan yotqizish maydonlari */
export interface WardBalanceInput {
  admittedAt: Date
  expectedDischargeAt: Date | null
  dischargedAt: Date | null
  status: string
  dailyRate: number
  payments: { amount: number; status: string }[]
}

/**
 * Yotqizish hisobi: jami qancha, qancha to'langan, qancha qolgan.
 *
 * Chegara — REJA va HAQIQAT dan KATTAROG'I. Nega kattarog'i:
 * rejalashtirilgan bemordan oldindan to'liq summani olish mumkin
 * bo'lishi kerak, rejadan uzoq yotgan bemordan esa haqiqiy summani.
 *
 * BITTA JOYDA, chunki ikkita joy shu javobga tayanadi: to'lov
 * chegarasi (`payments.service.ts`) va qarz ro'yxati
 * (`debts.service.ts`). Ikki marta yozilsa, biri o'zgarib ikkinchisi
 * eskirib qolardi — pulda bu qimmatga tushadi.
 */
export function wardBalance(admission: WardBalanceInput): {
  cap: number
  paid: number
  remaining: number
} {
  const plannedDays = admission.expectedDischargeAt
    ? inclusiveDays(admission.admittedAt, admission.expectedDischargeAt)
    : 0

  // Rejalashtirilgan bemor hali yotmagan — haqiqiy kun yo'q
  const stayedDays =
    admission.status === 'PLANNED'
      ? 0
      : inclusiveDays(admission.admittedAt, admission.dischargedAt ?? new Date())

  const cap = Math.max(plannedDays, stayedDays) * admission.dailyRate

  const paid = admission.payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0)

  return { cap, paid, remaining: Math.max(0, cap - paid) }
}
