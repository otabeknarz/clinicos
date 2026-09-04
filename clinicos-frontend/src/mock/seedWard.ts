/**
 * Statsionar va xodimlar uchun demo ma'lumot.
 *
 * `seed.ts` allaqachon katta, shuning uchun bu ikki modul alohida
 * faylda. Ular bir xil tasodifiy generatordan foydalanadi, demak
 * natija ham deterministik.
 */

import type { Random } from './random'
import { addDays, startOfDay, toISODate } from '@/lib/dates'
import type {
  Admission,
  AdmissionStatus,
  Bed,
  Doctor,
  Patient,
  Room,
  RoomCategory,
  ShiftClosure,
  User,
} from '@/types/models'

/* ================================================================== */
/* STATSIONAR                                                         */
/* ================================================================== */

/** Xona toifalari: nechta xona, har birida nechta koyka, kunlik narx */
const ROOM_PLAN: {
  category: RoomCategory
  count: number
  bedsPerRoom: number
  dailyRate: number
  floor: number
}[] = [
  { category: 'luxury', count: 2, bedsPerRoom: 1, dailyRate: 800_000, floor: 3 },
  { category: 'standard', count: 6, bedsPerRoom: 2, dailyRate: 450_000, floor: 2 },
  { category: 'general', count: 4, bedsPerRoom: 4, dailyRate: 250_000, floor: 1 },
]

export interface WardSeed {
  rooms: Room[]
  beds: Bed[]
  admissions: Admission[]
}

export function generateWard(
  r: Random,
  clinicId: string,
  today: Date,
  patients: Patient[],
  doctors: Doctor[],
  historyDays: number,
): WardSeed {
  const iso = (d: Date) => d.toISOString()

  /* --- Xonalar va koykalar --- */

  const rooms: Room[] = []
  const beds: Bed[] = []
  let roomSeq = 0

  for (const plan of ROOM_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      roomSeq++
      const number = `${plan.floor}${String(i + 1).padStart(2, '0')}`
      const roomId = `room_${roomSeq}`

      rooms.push({
        id: roomId,
        clinicId,
        number,
        floor: plan.floor,
        category: plan.category,
        dailyRate: plan.dailyRate,
        // Bitta xona ta'mirda tursin — holat ko'rsatkichi jonli ko'rinsin
        status: roomSeq === 9 ? 'maintenance' : 'active',
        notes: '',
        createdAt: iso(addDays(today, -400)),
      })

      for (let b = 0; b < plan.bedsPerRoom; b++) {
        beds.push({
          id: `bed_${roomId}_${b + 1}`,
          clinicId,
          roomId,
          label: `${number}-${b + 1}`,
          status: 'free',
          createdAt: iso(addDays(today, -400)),
        })
      }
    }
  }

  /* --- Yotqizishlar --- */

  const admissions: Admission[] = []
  const activeDoctors = doctors.filter((d) => d.status === 'active')
  const usableBeds = beds.filter((bed) => {
    const room = rooms.find((x) => x.id === bed.roomId)
    return room?.status === 'active'
  })

  let admissionSeq = 0

  /**
   * Har bir koyka uchun vaqt bo'ylab yuramiz: bir necha kun band,
   * keyin bir necha kun bo'sh. Shu tarzda bandlik ~70% atrofida chiqadi
   * va shaxmatkada tabiiy ko'rinish hosil bo'ladi.
   */
  for (const bed of usableBeds) {
    const room = rooms.find((x) => x.id === bed.roomId)
    if (!room) continue

    let cursor = -historyDays

    while (cursor < 10) {
      // Bo'sh turish davri
      cursor += r.int(0, 4)
      if (cursor >= 10) break

      const stayDays = r.weighted<number>([
        [2, 2],
        [3, 4],
        [4, 5],
        [5, 4],
        [6, 3],
        [7, 2],
        [10, 1],
      ])

      const admittedAt = new Date(addDays(today, cursor))
      admittedAt.setHours(r.int(9, 17), r.chance(0.5) ? 0 : 30, 0, 0)

      const dischargeDay = cursor + stayDays
      const patient = r.pick(patients)
      const doctor = r.pick(activeDoctors)

      let status: AdmissionStatus
      let dischargedAt: string | null = null

      if (cursor > 0) {
        status = 'planned'
      } else if (dischargeDay <= 0) {
        status = 'discharged'
        const out = new Date(addDays(today, dischargeDay))
        out.setHours(r.int(10, 14), 0, 0, 0)
        dischargedAt = iso(out)
      } else {
        status = 'active'
      }

      admissionSeq++
      admissions.push({
        id: `adm_${admissionSeq}`,
        clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        roomId: room.id,
        bedId: bed.id,
        admittedAt: iso(admittedAt),
        expectedDischargeAt: toISODate(addDays(today, dischargeDay)),
        dischargedAt,
        status,
        diagnosis: r.pick(WARD_DIAGNOSES),
        dailyRate: room.dailyRate,
        notes: '',
        createdBy: 'usr_reception_1',
        createdAt: iso(admittedAt),
      })

      // Keyingi yotqizish chiqishdan keyin boshlanadi
      cursor = dischargeDay + 1
    }
  }

  // Hozir band bo'lgan koykalarni belgilaymiz
  const occupied = new Set(
    admissions.filter((a) => a.status === 'active').map((a) => a.bedId),
  )
  for (const bed of beds) {
    const room = rooms.find((x) => x.id === bed.roomId)
    if (room?.status === 'maintenance') {
      bed.status = 'maintenance'
    } else if (occupied.has(bed.id)) {
      bed.status = 'occupied'
    }
  }

  return { rooms, beds, admissions }
}

const WARD_DIAGNOSES = [
  'O‘tkir pnevmoniya',
  'Gipertonik kriz',
  'O‘tkir pankreatit',
  'Operatsiyadan keyingi kuzatuv',
  'O‘tkir appendisit, operatsiyadan keyin',
  'Qandli diabet, dekompensatsiya',
  'Anemiya, og‘ir shakl',
  'Buyrak sanchig‘i',
  'Bronxial astma, xuruj',
  'Miya chayqalishi',
]

/* ================================================================== */
/* SMENA YOPISHLARI                                                   */
/* ================================================================== */

/**
 * Kun oxirida administrator kassani sanab topshiradi.
 *
 * Demo ma'lumotda ko'pchilik kun to'g'ri chiqadi, ba'zilarida kichik
 * farq bo'ladi — egasi nazorat hisobotida aynan shularni ko'radi.
 */
export function generateShiftClosures(
  r: Random,
  clinicId: string,
  today: Date,
  users: User[],
  cashByDayAndUser: Map<string, number>,
): ShiftClosure[] {
  const closures: ShiftClosure[] = []
  const receptionists = users.filter((u) => u.role === 'receptionist')
  let seq = 0

  for (let offset = -30; offset <= -1; offset++) {
    const day = addDays(startOfDay(today), offset)
    const date = toISODate(day)

    for (const user of receptionists) {
      const expected = cashByDayAndUser.get(`${date}|${user.id}`) ?? 0
      if (expected === 0) continue

      // 80% kun aniq to'g'ri keladi
      let declared = expected
      if (r.chance(0.2)) {
        // Kamomad ko'proq uchraydi, ortiqcha kamroq
        const sign = r.chance(0.75) ? -1 : 1
        // Farq kutilgan summadan oshib ketmasin - manfiy naqd pul
        // topshirib bo'lmaydi
        const maxGap = Math.min(8, Math.floor(expected / 10_000)) || 1
        declared = Math.max(0, expected + sign * r.int(1, maxGap) * 10_000)
      }

      seq++
      const closedAt = new Date(day)
      closedAt.setHours(19, r.int(0, 40), 0, 0)

      closures.push({
        id: `shc_${seq}`,
        clinicId,
        userId: user.id,
        userName: user.fullName,
        date,
        expectedCash: expected,
        declaredCash: declared,
        difference: declared - expected,
        note: '',
        closedAt: closedAt.toISOString(),
      })
    }
  }

  return closures
}
