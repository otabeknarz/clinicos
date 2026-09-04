/**
 * Bemor fikrlari.
 *
 * ISHLASH TARTIBI: bemor telefon raqamini kiritadi -> tizim uni bazadan
 * topadi va oxirgi tashriflarini ko'rsatadi -> bemor tashrifni tanlab
 * baho va izoh qoldiradi.
 *
 * XAVFSIZLIK (dasturchiga):
 *   - `/feedback/lookup` endpointi RATE LIMIT ostida bo'lishi shart.
 *     Aks holda raqamlarni birma-bir sinab, klinika bemorlari bazasini
 *     yig'ib olish mumkin.
 *   - Javobda faqat "topildi/topilmadi", bemor ismi va O'SHA bemorning
 *     tashriflari qaytadi. Boshqa hech narsa.
 *   - Ishonchliroq variant: raqamga bir martalik SMS kod yuborish.
 *     MVP'da bu yo'q, chunki SMS - doimiy xarajat.
 *
 * SHIFOKORGA: fikr anonim ko'rsatiladi. Shifokor kim yozganini bilsa,
 * bemor rostini yozmaydi.
 */

import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { addDays, startOfDay } from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
  Feedback,
  FeedbackLookup,
  FeedbackStats,
  FeedbackStatus,
  ID,
  Paginated,
  SeriesPoint,
} from '@/types/models'

/* ------------------------------------------------------------------ */
/* Telefon bo'yicha qidiruv                                            */
/* ------------------------------------------------------------------ */

// POST /feedback/lookup  { phone }
export async function lookupByPhone(phone: string): Promise<FeedbackLookup> {
  if (!USE_MOCK) {
    return request<FeedbackLookup>('POST', '/feedback/lookup', { body: { phone } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const digits = phone.replace(/\D/g, '')
  const patient = db.patients
    .all(clinicId)
    .find((p) => p.phone.replace(/\D/g, '') === digits)

  if (!patient) {
    return delay({ found: false, patientId: null, patientName: '', recentVisits: [] }, 400)
  }

  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))
  const services = new Map(db.services.all(clinicId).map((s) => [s.id, s]))
  const withFeedback = new Set(
    db.feedback
      .all(clinicId)
      .filter((f) => f.patientId === patient.id)
      .map((f) => f.appointmentId),
  )

  const recentVisits = db.appointments
    .all(clinicId)
    .filter((a) => a.patientId === patient.id && a.status === 'completed')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 5)
    .map((a) => ({
      appointmentId: a.id,
      date: a.startsAt.slice(0, 10),
      doctorId: a.doctorId,
      doctorName: doctors.get(a.doctorId)?.fullName ?? '—',
      serviceName: services.get(a.serviceId)?.name ?? '—',
      hasFeedback: withFeedback.has(a.id),
    }))

  return delay(
    {
      found: true,
      patientId: patient.id,
      patientName: patient.fullName,
      recentVisits,
    },
    450,
  )
}

/* ------------------------------------------------------------------ */
/* Ro'yxat                                                             */
/* ------------------------------------------------------------------ */

/**
 * Shifokorga beriladigan fikrdan kim yozgani olib tashlanadi.
 *
 * Telefon, ism va bemor id'si — uchalasi ham. Bittasi qolsa,
 * qolganini topish qiyin emas: telefon bo'yicha bemorni qidirish
 * registraturada bir soniyalik ish.
 *
 * Qaysi qabulga tegishli ekani ham olib tashlanadi — sana va
 * vaqt bo'yicha bemorni aniqlash mumkin bo'lardi.
 */
function anonymize(row: Feedback): Feedback {
  return {
    ...row,
    phone: '',
    patientId: null,
    patientName: '',
    appointmentId: null,
  }
}

/**
 * Fikr shifokorga ko'rinadigan bo'ldimi.
 *
 * Kechiktirish faqat SHIFOKORGA tegishli: egasi va registratura
 * fikrni darhol ko'rishi kerak, chunki ular bemor bilan ishlaydi.
 */
function isRevealed(row: Feedback, now: number): boolean {
  return new Date(row.revealAt).getTime() <= now
}

export interface FeedbackQuery {
  search?: string
  rating?: number | 'all'
  doctorId?: ID | 'all'
  status?: FeedbackStatus | 'all'
  page?: number
  pageSize?: number
}

// GET /feedback?search=&rating=&doctorId=&status=&page=
export async function listFeedback(
  query: FeedbackQuery = {},
): Promise<Paginated<Feedback>> {
  const { page = 1, pageSize = 15 } = query

  if (!USE_MOCK) {
    return request<Paginated<Feedback>>('GET', '/feedback', {
      query: {
        search: query.search,
        rating: query.rating,
        doctorId: query.doctorId,
        status: query.status,
        page,
        pageSize,
      },
    })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  const now = Date.now()

  const rows = getDb()
    .feedback.all(clinicId)
    // Shifokor faqat o'zi haqidagi fikrlarni ko'radi
    .filter((f) => !scopeDoctorId || f.doctorId === scopeDoctorId)
    .filter((f) => !scopeDoctorId || isRevealed(f, Date.now()))
    // ...va faqat ochilish vaqti kelganlarini
    .filter((f) => !scopeDoctorId || isRevealed(f, now))
    .map((f) => (scopeDoctorId ? anonymize(f) : f))
    .filter((f) => !query.rating || query.rating === 'all' || f.rating === query.rating)
    .filter(
      (f) => !query.doctorId || query.doctorId === 'all' || f.doctorId === query.doctorId,
    )
    .filter((f) => !query.status || query.status === 'all' || f.status === query.status)
    .filter(
      (f) =>
        !query.search || matches(f.text, query.search) || matches(f.patientName, query.search),
    )
    .map((f) => maskIfNeeded(f, Boolean(scopeDoctorId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return delay(paginate(rows, page, pageSize))
}

/**
 * Anonim fikrni shifokorga ko'rsatishdan oldin ismni yashiramiz.
 *
 * DIQQAT: haqiqiy backendda bu SERVERDA qilinishi shart. Bu yerda
 * yashirish faqat interfeys uchun — agar ism javobda kelsa, uni
 * brauzerdan ko'rish mumkin.
 */
function maskIfNeeded(feedback: Feedback, viewerIsDoctor: boolean): Feedback {
  if (!viewerIsDoctor || !feedback.isAnonymous) return feedback
  return { ...feedback, patientName: '', phone: '', patientId: null }
}

export interface FeedbackInput {
  phone: string
  patientId: ID | null
  patientName: string
  doctorId: ID | null
  appointmentId: ID | null
  rating: number
  scores: Feedback['scores']
  text: string
  isAnonymous: boolean
}

// POST /feedback
export async function createFeedback(input: FeedbackInput): Promise<Feedback> {
  if (!USE_MOCK) return request<Feedback>('POST', '/feedback', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const now = new Date()

  /*
    Shifokorga ochilish vaqti — 1 dan 14 kungacha tasodifiy.

    Bu anonimlikning texnik asosi: fikr darhol ko'rinsa, shifokor
    o'sha kuni kimni qabul qilganini eslab, yozgan odamni topadi.
    Bir necha kunlik noaniq kechikish bu bog'lanishni uzadi.

    DASTURCHIGA: serverda ham SHU maydon bo'yicha filtrlash SHART.
    Frontend faqat ko'rsatmaydi — API javobida kelgan fikrni
    yashirish himoya emas.
  */
  const revealHours = 24 + Math.floor(Math.random() * 13 * 24)

  const feedback: Feedback = {
    id: db.feedback.nextId('fbk'),
    clinicId,
    status: 'new',
    reply: '',
    repliedAt: null,
    createdAt: now.toISOString(),
    revealAt: new Date(now.getTime() + revealHours * 3_600_000).toISOString(),
    ...input,
  }

  db.feedback.insert(feedback)
  return delay(feedback, 350)
}

// POST /feedback/:id/reply  { text }
export async function replyToFeedback(id: ID, text: string): Promise<Feedback> {
  if (!USE_MOCK) {
    return request<Feedback>('POST', `/feedback/${id}/reply`, { body: { text } })
  }

  const updated = getDb().feedback.update(
    id,
    { reply: text, repliedAt: new Date().toISOString(), status: 'reviewed' },
    apiContext().clinicId,
  )
  if (!updated) throw new Error('Izoh topilmadi')
  return delay(updated, 280)
}

// PATCH /feedback/:id  { status }
export async function setFeedbackStatus(
  id: ID,
  status: FeedbackStatus,
): Promise<Feedback> {
  if (!USE_MOCK) return request<Feedback>('PATCH', `/feedback/${id}`, { body: { status } })

  const updated = getDb().feedback.update(id, { status }, apiContext().clinicId)
  if (!updated) throw new Error('Izoh topilmadi')
  return delay(updated, 220)
}

/* ------------------------------------------------------------------ */
/* Statistika                                                          */
/* ------------------------------------------------------------------ */

// GET /feedback/stats?days=
export async function getFeedbackStats(days = 90): Promise<FeedbackStats> {
  if (!USE_MOCK) return request<FeedbackStats>('GET', '/feedback/stats', { query: { days } })

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()

  const from = startOfDay(addDays(new Date(), -days)).getTime()
  const rows = db.feedback
    .all(clinicId)
    .filter((f) => !scopeDoctorId || f.doctorId === scopeDoctorId)
    .filter((f) => new Date(f.createdAt).getTime() >= from)

  const total = rows.length
  const average = total ? rows.reduce((sum, f) => sum + f.rating, 0) / total : 0

  const distribution = [1, 2, 3, 4, 5].map(
    (star) => rows.filter((f) => f.rating === star).length,
  )

  const avgOf = (pick: (f: Feedback) => number) =>
    total ? rows.reduce((sum, f) => sum + pick(f), 0) / total : 0

  /* --- Shifokorlar kesimida --- */
  const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d.fullName]))
  const byDoctorMap = new Map<string, { sum: number; count: number }>()

  for (const row of rows) {
    if (!row.doctorId) continue
    const entry = byDoctorMap.get(row.doctorId) ?? { sum: 0, count: 0 }
    entry.sum += row.rating
    entry.count += 1
    byDoctorMap.set(row.doctorId, entry)
  }

  const byDoctor = [...byDoctorMap.entries()]
    .map(([doctorId, value]) => ({
      doctorId,
      doctorName: doctors.get(doctorId) ?? '—',
      average: value.sum / value.count,
      count: value.count,
    }))
    .sort((a, b) => b.average - a.average)

  /* --- Haftalik dinamika --- */
  const series: SeriesPoint[] = []
  const weeks = Math.min(12, Math.ceil(days / 7))

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = addDays(new Date(), -i * 7)
    const weekStart = addDays(weekEnd, -6)
    const inWeek = rows.filter((f) => {
      const t = new Date(f.createdAt).getTime()
      return t >= startOfDay(weekStart).getTime() && t <= weekEnd.getTime()
    })
    series.push({
      label: dateCompact(weekStart),
      value: inWeek.length
        ? Number((inWeek.reduce((sum, f) => sum + f.rating, 0) / inWeek.length).toFixed(2))
        : 0,
    })
  }

  return delay({
    average,
    total,
    distribution,
    byScore: {
      doctor: avgOf((f) => f.scores.doctor),
      service: avgOf((f) => f.scores.service),
      cleanliness: avgOf((f) => f.scores.cleanliness),
      waiting: avgOf((f) => f.scores.waiting),
    },
    byDoctor,
    series,
    unanswered: rows.filter((f) => f.status === 'new' && f.rating <= 3).length,
  })
}

/**
 * Shifokorga YAQINDA ochilgan fikrlar.
 *
 * Bosh sahifadagi karta uchun: shifokor tizimga kirganida "sizga
 * yangi fikr keldi" degan xabarni ko'radi. Fikr qachon kelgani
 * oldindan bilinmaydi — aynan shu tasodifiylik anonimlikni
 * saqlaydi.
 *
 * RUXSAT: `feedback.view` + shifokor doirasi. Server javobda
 * bemor ma'lumotini QAYTARMASLIGI shart.
 */
// GET /me/feedback?days=
export async function listRecentFeedbackForDoctor(days = 7): Promise<Feedback[]> {
  if (!USE_MOCK) {
    return request<Feedback[]>('GET', '/me/feedback', { query: { days } })
  }

  const { clinicId, scopeDoctorId } = apiContext()
  if (!scopeDoctorId) return delay([], 80)

  const now = Date.now()
  const from = now - days * 86_400_000

  const rows = getDb()
    .feedback.all(clinicId)
    .filter((f) => f.doctorId === scopeDoctorId)
    .filter((f) => {
      const revealed = new Date(f.revealAt).getTime()
      return revealed <= now && revealed >= from
    })
    .map(anonymize)
    .sort((a, b) => b.revealAt.localeCompare(a.revealAt))

  return delay(rows, 150)
}
