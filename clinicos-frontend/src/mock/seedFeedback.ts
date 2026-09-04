/**
 * Bemor fikrlari uchun demo ma'lumot.
 *
 * Fikrlar yakunlangan qabullarga bog'lanadi — bemor faqat o'zi bo'lgan
 * tashrif haqida yozadi.
 */

import type { Random } from './random'
import type { Appointment, Doctor, Feedback, Patient } from '@/types/models'

/** Qaysi baho uchun qanday matn yoziladi */
const TEXTS: Record<number, string[]> = {
  5: [
    'Shifokor juda diqqat bilan tingladi, hammasini tushuntirib berdi. Rahmat!',
    'Navbat kutmadim, hamma narsa tez va toza. Tavsiya qilaman.',
    'Bolamni olib bordim, juda yaxshi munosabatda bo‘lishdi.',
    'Narxlari o‘rinli, xizmat sifatli. Yana keldim.',
    'Registratura ham, shifokor ham juda madaniyatli.',
  ],
  4: [
    'Umuman yaxshi, faqat biroz kutishga to‘g‘ri keldi.',
    'Shifokor yaxshi, lekin kabinet biroz sovuq edi.',
    'Hammasi joyida, keyingi safar ham shu yerga kelaman.',
    'Xizmatdan mamnunman, tahlil natijasi biroz kechikdi.',
  ],
  3: [
    'O‘rtacha. Kutish vaqti uzoq bo‘ldi.',
    'Shifokor shoshib qabul qildi, savollarimga to‘liq javob bermadi.',
    'Yomon emas, lekin yaxshiroq bo‘lishi mumkin edi.',
  ],
  2: [
    'Belgilangan vaqtdan 40 daqiqa kech qabul qilishdi.',
    'Registraturada uzoq kutdim, tushuntirish berishmadi.',
  ],
  1: [
    'Yozilgan vaqtimda qabul qilishmadi, qayta kelishimni aytishdi.',
    'Munosabat yoqmadi, boshqa kelmayman.',
  ],
}

export function generateFeedback(
  r: Random,
  clinicId: string,
  patients: Patient[],
  doctors: Doctor[],
  appointments: Appointment[],
): Feedback[] {
  const rows: Feedback[] = []
  const patientById = new Map(patients.map((p) => [p.id, p]))
  const doctorById = new Map(doctors.map((d) => [d.id, d]))

  // Faqat yakunlangan qabullar uchun fikr bo'lishi mumkin
  const completed = appointments.filter((a) => a.status === 'completed')

  let seq = 0

  for (const appointment of completed) {
    // Amalda bemorlarning ~12% i fikr yozadi
    if (!r.chance(0.12)) continue

    const patient = patientById.get(appointment.patientId)
    const doctor = doctorById.get(appointment.doctorId)
    if (!patient || !doctor) continue

    // Baholar taqsimoti: ko'pchilik mamnun, ozchiligi norozi
    const rating = r.weighted<number>([
      [5, 55],
      [4, 25],
      [3, 10],
      [2, 6],
      [1, 4],
    ])

    /** Alohida baho — umumiy bahodan biroz farq qiladi */
    const near = (base: number) => {
      const shift = r.weighted<number>([
        [0, 6],
        [1, 2],
        [-1, 2],
      ])
      return Math.max(1, Math.min(5, base + shift))
    }

    const createdAt = new Date(appointment.startsAt)
    createdAt.setHours(createdAt.getHours() + r.int(2, 48))

    seq++
    const answered = rating <= 3 && r.chance(0.6)

    rows.push({
      id: `fbk_${seq}`,
      clinicId,
      phone: patient.phone,
      patientId: patient.id,
      patientName: patient.fullName,
      doctorId: doctor.id,
      appointmentId: appointment.id,
      rating,
      scores: {
        doctor: near(rating),
        service: near(rating),
        cleanliness: near(rating),
        // Kutish vaqti odatda eng past baholanadigan yo'nalish
        waiting: Math.max(1, near(rating) - (r.chance(0.4) ? 1 : 0)),
      },
      text: r.pick(TEXTS[rating]),
      // Ko'pchilik anonim qoldirishni afzal ko'radi
      isAnonymous: r.chance(0.65),
      status: answered ? 'reviewed' : 'new',
      reply: answered
        ? 'Fikringiz uchun rahmat. Kamchilikni bartaraf etish ustida ishlayapmiz.'
        : '',
      // Shifokorga 1–14 kun oralig'ida tasodifiy vaqtda ochiladi
      revealAt: new Date(
        createdAt.getTime() + r.int(24, 14 * 24) * 3_600_000,
      ).toISOString(),
      repliedAt: answered ? new Date(createdAt.getTime() + 86_400_000).toISOString() : null,
      createdAt: createdAt.toISOString(),
    })
  }

  return rows
}
