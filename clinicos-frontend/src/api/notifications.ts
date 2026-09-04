/**
 * Bildirishnomalar.
 *
 * MVP'da ular hech qayerda saqlanmaydi — mavjud ma'lumotdan hisoblanadi:
 * bugungi qabullar, tasdiqlanmaganlar, kutilayotgan to'lovlar, takroriy
 * tashrif muddati kelganlar.
 *
 * Keyingi bosqichda haqiqiy `notifications` jadvali va o'qilgan holati
 * qo'shiladi — shuning uchun model allaqachon `readAt` maydoniga ega.
 */

import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { endOfDay, startOfDay, toISODate } from '@/lib/dates'
import type { AppNotification } from '@/types/models'

// GET /notifications
export async function listNotifications(): Promise<AppNotification[]> {
  if (!USE_MOCK) return request<AppNotification[]>('GET', '/notifications')

  const { clinicId, scopeDoctorId } = apiContext()
  const db = getDb()
  const now = new Date()
  const dayStart = startOfDay(now).getTime()
  const dayEnd = endOfDay(now).getTime()

  const appts = db.appointments
    .all(clinicId)
    .filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)

  const today = appts.filter((a) => {
    const t = new Date(a.startsAt).getTime()
    return t >= dayStart && t <= dayEnd && a.status !== 'cancelled'
  })

  const unconfirmed = today.filter((a) => a.status === 'scheduled')
  const noShows = today.filter((a) => a.status === 'no_show')

  const pendingPayments = db.payments
    .all(clinicId)
    .filter((p) => !scopeDoctorId || p.doctorId === scopeDoctorId)
    .filter((p) => p.status === 'pending')

  const dueDate = toISODate(now)
  const followUps = db.followUps
    .all(clinicId)
    .filter((f) => !scopeDoctorId || f.doctorId === scopeDoctorId)
    .filter((f) => f.status === 'pending' && f.recommendedDate <= dueDate)

  const iso = now.toISOString()
  const items: AppNotification[] = []

  const add = (
    kind: AppNotification['kind'],
    count: number,
    href: string,
    severity: AppNotification['severity'],
  ) => {
    if (count <= 0) return
    items.push({
      id: `ntf_${kind}`,
      clinicId,
      kind,
      count,
      href,
      severity,
      createdAt: iso,
      readAt: null,
    })
  }

  add('appointments_today', today.length, '/appointments', 'info')
  add('unconfirmed', unconfirmed.length, '/appointments?status=scheduled', 'warn')
  add('pending_payments', pendingPayments.length, '/payments?status=pending', 'warn')
  add('follow_ups_due', followUps.length, '/patients?filter=followup', 'info')
  add('no_shows', noShows.length, '/appointments?status=no_show', 'bad')

  return delay(items, 120)
}
