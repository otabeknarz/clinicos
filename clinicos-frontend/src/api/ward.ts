/**
 * Statsionar (yotoq xona).
 *
 * Tuzilma: xona → koyka → yotqizish.
 *
 * RUXSAT:
 *   `ward.view`   — ko'rish (egasi, administratsiya, shifokor)
 *   `ward.manage` — yotqizish/chiqarish, xona va koyka boshqaruvi
 *
 * Shifokor faqat o'z bemorlarini ko'radi (`scopeDoctorId`).
 */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { pick } from './patients'
import { getDb } from '@/mock/db'
import {
  addDays,
  eachDay,
  endOfDay,
  fromISODate,
  startOfDay,
  toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
  Admission,
  AdmissionExpanded,
  BedBoard,
  BedBoardRow,
  BedBoardSpan,
  DateRange,
  ID,
  Metric,
  Room,
  RoomCategory,
  SeriesPoint,
  WardStats,
} from '@/types/models'

/* ------------------------------------------------------------------ */
/* Xonalar va koykalar                                                 */
/* ------------------------------------------------------------------ */

// GET /ward/rooms
export async function listRooms(): Promise<Room[]> {
  if (!USE_MOCK) return request<Room[]>('GET', '/ward/rooms')

  const rows = getDb()
    .rooms.all(apiContext().clinicId)
    .sort((a, b) => a.number.localeCompare(b.number))

  return delay(rows, 120)
}

export interface RoomInput {
  number: string
  floor: number
  category: RoomCategory
  dailyRate: number
  status: Room['status']
  notes: string
}

// POST /ward/rooms
export async function createRoom(input: RoomInput): Promise<Room> {
  if (!USE_MOCK) return request<Room>('POST', '/ward/rooms', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()
  const room: Room = {
    id: db.rooms.nextId('room'),
    clinicId,
    createdAt: new Date().toISOString(),
    ...input,
  }
  db.rooms.insert(room)
  return delay(room, 280)
}

// PATCH /ward/rooms/:id
export async function updateRoom(id: ID, patch: Partial<RoomInput>): Promise<Room> {
  if (!USE_MOCK) return request<Room>('PATCH', `/ward/rooms/${id}`, { body: patch })

  const updated = getDb().rooms.update(id, patch as Partial<Room>, apiContext().clinicId)
  if (!updated) throw new Error('Xona topilmadi')
  return delay(updated, 240)
}

/* ------------------------------------------------------------------ */
/* Yotqizishlar                                                        */
/* ------------------------------------------------------------------ */

export interface AdmissionQuery {
  status?: Admission['status'] | 'all'
  search?: string
}

// GET /ward/admissions?status=&search=
export async function listAdmissions(
  query: AdmissionQuery = {},
): Promise<AdmissionExpanded[]> {
  if (!USE_MOCK) {
    return request<AdmissionExpanded[]>('GET', '/ward/admissions', {
      query: { status: query.status, search: query.search },
    })
  }

  const rows = expandAdmissions()
    .filter((a) => !query.status || query.status === 'all' || a.status === query.status)
    .filter((a) => !query.search || matches(a.patient.fullName, query.search))
    .sort((a, b) => b.admittedAt.localeCompare(a.admittedAt))

  return delay(rows)
}

export interface AdmissionInput {
  patientId: ID
  doctorId: ID
  bedId: ID
  admittedAt: string
  expectedDischargeAt: string | null
  diagnosis: string
  notes: string
}

// POST /ward/admissions
export async function admitPatient(input: AdmissionInput): Promise<Admission> {
  if (!USE_MOCK) return request<Admission>('POST', '/ward/admissions', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const bed = db.beds.find(input.bedId, clinicId)
  if (!bed) throw new Error('Koyka topilmadi')
  if (bed.status !== 'free') throw new Error('Koyka band')

  const room = db.rooms.find(bed.roomId, clinicId)
  if (!room) throw new Error('Xona topilmadi')

  const admission: Admission = {
    id: db.admissions.nextId('adm'),
    clinicId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    roomId: room.id,
    bedId: bed.id,
    admittedAt: input.admittedAt,
    expectedDischargeAt: input.expectedDischargeAt,
    dischargedAt: null,
    status: 'active',
    diagnosis: input.diagnosis,
    // Narx NUSXA sifatida saqlanadi — keyin xona narxi o'zgarsa,
    // bu yotqizishning hisobi o'zgarmaydi
    dailyRate: room.dailyRate,
    notes: input.notes,
    createdBy: 'usr_reception_1',
    createdAt: new Date().toISOString(),
  }

  db.admissions.insert(admission)
  db.beds.update(bed.id, { status: 'occupied' }, clinicId)

  return delay(admission, 320)
}

// POST /ward/admissions/:id/discharge
export async function dischargePatient(id: ID): Promise<Admission> {
  if (!USE_MOCK) return request<Admission>('POST', `/ward/admissions/${id}/discharge`)

  const { clinicId } = apiContext()
  const db = getDb()

  const updated = db.admissions.update(
    id,
    { status: 'discharged', dischargedAt: new Date().toISOString() },
    clinicId,
  )
  if (!updated) throw new Error('Yozuv topilmadi')

  db.beds.update(updated.bedId, { status: 'free' }, clinicId)
  return delay(updated, 300)
}

/* ------------------------------------------------------------------ */
/* Shaxmatka                                                           */
/* ------------------------------------------------------------------ */

/**
 * Koyka × kun jadvali.
 *
 * Har bir qator — bitta koyka, har bir ustun — bitta kun. Band davrlar
 * uzluksiz blok sifatida ko'rsatiladi, shuning uchun bir qarashda
 * "qaysi koyka qachon bo'shaydi" ko'rinadi.
 */
// GET /ward/board?from=&to=
export async function getBedBoard(from: Date, to: Date): Promise<BedBoard> {
  if (!USE_MOCK) {
    return request<BedBoard>('GET', '/ward/board', {
      query: { from: toISODate(from), to: toISODate(to) },
    })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const days = eachDay(from, to)
  const dayKeys = days.map(toISODate)
  const rangeStart = startOfDay(from).getTime()
  const rangeEnd = endOfDay(to).getTime()

  const rooms = new Map(db.rooms.all(clinicId).map((r) => [r.id, r]))
  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))

  const admissions = db.admissions
    .all(clinicId)
    .filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)

  const rows: BedBoardRow[] = db.beds
    .all(clinicId)
    .map((bed) => {
      const room = rooms.get(bed.roomId)
      const spans: BedBoardSpan[] = []

      for (const admission of admissions) {
        if (admission.bedId !== bed.id) continue

        const start = new Date(admission.admittedAt).getTime()
        const end = admission.dischargedAt
          ? new Date(admission.dischargedAt).getTime()
          : admission.expectedDischargeAt
            ? endOfDay(fromISODate(admission.expectedDischargeAt)).getTime()
            : rangeEnd

        // Oraliqqa umuman tushmasa — o'tkazib yuboramiz
        if (end < rangeStart || start > rangeEnd) continue

        const startKey = toISODate(new Date(Math.max(start, rangeStart)))
        const endKey = toISODate(new Date(Math.min(end, rangeEnd)))

        const fromIndex = dayKeys.indexOf(startKey)
        const toIndex = dayKeys.indexOf(endKey)
        if (fromIndex === -1 || toIndex === -1) continue

        spans.push({
          admissionId: admission.id,
          patientId: admission.patientId,
          patientName: patients.get(admission.patientId)?.fullName ?? '—',
          doctorName: doctors.get(admission.doctorId)?.fullName ?? '—',
          status: admission.status,
          fromIndex,
          toIndex,
          continuesBefore: start < rangeStart,
          continuesAfter: end > rangeEnd,
        })
      }

      spans.sort((a, b) => a.fromIndex - b.fromIndex)

      return {
        bed: pick(bed, ['id', 'label', 'status'])!,
        room: room
          ? pick(room, ['id', 'number', 'category'])!
          : { id: bed.roomId, number: '—', category: 'general' as RoomCategory },
        spans,
      }
    })
    .sort((a, b) => a.bed.label.localeCompare(b.bed.label))

  return delay({ days: dayKeys, rows }, 160)
}

/* ------------------------------------------------------------------ */
/* Ko'rsatkichlar                                                      */
/* ------------------------------------------------------------------ */

// GET /ward/stats?from=&to=
export async function getWardStats(range: DateRange): Promise<WardStats> {
  if (!USE_MOCK) {
    return request<WardStats>('GET', '/ward/stats', {
      query: { from: range.from, to: range.to },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const beds = db.beds.all(clinicId)
  const rooms = new Map(db.rooms.all(clinicId).map((r) => [r.id, r]))
  const admissions = db.admissions.all(clinicId)

  const usableBeds = beds.filter((b) => b.status !== 'maintenance')
  const occupiedBeds = beds.filter((b) => b.status === 'occupied').length

  const today = startOfDay(new Date())
  const todayKey = toISODate(today)

  const admittedToday = admissions.filter(
    (a) => a.admittedAt.slice(0, 10) === todayKey,
  ).length
  const dischargedToday = admissions.filter(
    (a) => a.dischargedAt?.slice(0, 10) === todayKey,
  ).length

  /* --- O'rtacha yotish davomiyligi --- */
  const finished = admissions.filter((a) => a.status === 'discharged' && a.dischargedAt)
  const totalDays = finished.reduce((sum, a) => sum + stayDays(a), 0)
  const averageStayDays = finished.length ? totalDays / finished.length : 0

  /* --- Daromad va bandlik dinamikasi --- */
  const from = fromISODate(range.from)
  const to = fromISODate(range.to)
  const days = eachDay(from, to)

  const occupancySeries: SeriesPoint[] = days.map((day) => ({
    label: dateCompact(day),
    value: usableBeds.length
      ? Math.round((occupiedOn(admissions, day) / usableBeds.length) * 100)
      : 0,
  }))

  const revenue = days.reduce((sum, day) => sum + accrualOn(admissions, day), 0)

  // Oldingi teng davr — solishtirish uchun
  const spanDays = days.length
  const prevDays = eachDay(addDays(from, -spanDays), addDays(from, -1))
  const prevRevenue = prevDays.reduce((sum, day) => sum + accrualOn(admissions, day), 0)

  const avgOccupancy = average(occupancySeries.map((p) => p.value))
  const prevOccupancy = average(
    prevDays.map((day) =>
      usableBeds.length ? (occupiedOn(admissions, day) / usableBeds.length) * 100 : 0,
    ),
  )

  /* --- Toifalar kesimida --- */
  const categories: RoomCategory[] = ['luxury', 'standard', 'general']
  const byCategory = categories.map((category) => {
    const categoryBeds = beds.filter((b) => rooms.get(b.roomId)?.category === category)
    const categoryBedIds = new Set(categoryBeds.map((b) => b.id))

    return {
      category,
      totalBeds: categoryBeds.length,
      occupiedBeds: categoryBeds.filter((b) => b.status === 'occupied').length,
      revenue: days.reduce(
        (sum, day) =>
          sum + accrualOn(admissions.filter((a) => categoryBedIds.has(a.bedId)), day),
        0,
      ),
    }
  })

  return delay({
    totalBeds: beds.length,
    occupiedBeds,
    occupancyPct: metric(avgOccupancy, prevOccupancy),
    admittedToday,
    dischargedToday,
    averageStayDays,
    revenue: metric(revenue, prevRevenue),
    byCategory,
    occupancySeries,
  })
}

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */

function expandAdmissions(): AdmissionExpanded[] {
  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const rooms = new Map(db.rooms.all(clinicId).map((r) => [r.id, r]))
  const beds = new Map(db.beds.all(clinicId).map((b) => [b.id, b]))

  return db.admissions
    .all(clinicId)
    .filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)
    .map((a) => {
      const days = stayDays(a)
      return {
        ...a,
        patient: pick(patients.get(a.patientId), ['id', 'fullName', 'phone']) ?? {
          id: a.patientId,
          fullName: '—',
          phone: '',
        },
        doctor: pick(doctors.get(a.doctorId), ['id', 'fullName', 'specialty']) ?? {
          id: a.doctorId,
          fullName: '—',
          specialty: '',
        },
        room: pick(rooms.get(a.roomId), ['id', 'number', 'category', 'dailyRate']) ?? {
          id: a.roomId,
          number: '—',
          category: 'general' as RoomCategory,
          dailyRate: 0,
        },
        bed: pick(beds.get(a.bedId), ['id', 'label']) ?? { id: a.bedId, label: '—' },
        daysStayed: days,
        accrued: days * a.dailyRate,
      }
    })
}

/** Yotgan kunlar soni. Hali yotgan bo'lsa — bugungacha. */
function stayDays(admission: Admission): number {
  const start = startOfDay(new Date(admission.admittedAt)).getTime()
  const end = admission.dischargedAt
    ? startOfDay(new Date(admission.dischargedAt)).getTime()
    : startOfDay(new Date()).getTime()
  // Kelgan kunning o'zi ham hisoblanadi
  return Math.max(1, Math.round((end - start) / 86_400_000))
}

/** Shu kunda nechta koyka band bo'lgan */
function occupiedOn(admissions: Admission[], day: Date): number {
  const key = startOfDay(day).getTime()
  return admissions.filter((a) => {
    if (a.status === 'planned') return false
    const start = startOfDay(new Date(a.admittedAt)).getTime()
    const end = a.dischargedAt
      ? startOfDay(new Date(a.dischargedAt)).getTime()
      : startOfDay(new Date()).getTime()
    return key >= start && key <= end
  }).length
}

/** Shu kun uchun hisoblangan koyka-kun daromadi */
function accrualOn(admissions: Admission[], day: Date): number {
  const key = startOfDay(day).getTime()
  return admissions.reduce((sum, a) => {
    if (a.status === 'planned') return sum
    const start = startOfDay(new Date(a.admittedAt)).getTime()
    const end = a.dischargedAt
      ? startOfDay(new Date(a.dischargedAt)).getTime()
      : startOfDay(new Date()).getTime()
    return key >= start && key <= end ? sum + a.dailyRate : sum
  }, 0)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function metric(current: number, previous: number): Metric {
  if (previous === 0) return { value: current, changePct: current === 0 ? 0 : null }
  return { value: current, changePct: ((current - previous) / previous) * 100 }
}
