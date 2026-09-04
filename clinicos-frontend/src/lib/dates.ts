/**
 * Sana bilan ishlash yordamchilari.
 * Barcha funksiyalar mahalliy vaqt mintaqasida ishlaydi (klinika bitta shaharda).
 */

import type { DateRange, DateRangePreset, ISODate } from '@/types/models'

export const DAY_MS = 86_400_000

/** Date → "2026-09-01" */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "2026-09-01" → Date (mahalliy yarim tun) */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000)
}

/** Hafta boshi — dushanba */
export function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const shift = day === 0 ? -6 : 1 - day
  return startOfDay(addDays(d, shift))
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

/** Haftaning 7 kuni (dushanbadan) */
export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Ikki sana orasidagi barcha kunlar */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = []
  let cursor = startOfDay(from)
  const end = startOfDay(to)
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Davr tanlagichlari                                                  */
/* ------------------------------------------------------------------ */

export function rangeFromPreset(preset: DateRangePreset, now = new Date()): DateRange {
  const to = toISODate(now)

  switch (preset) {
    case 'today':
      return { preset, from: to, to }
    case '7d':
      return { preset, from: toISODate(addDays(now, -6)), to }
    case '30d':
      return { preset, from: toISODate(addDays(now, -29)), to }
    case 'year':
      return { preset, from: toISODate(startOfYear(now)), to }
    case 'custom':
      return { preset, from: toISODate(addDays(now, -29)), to }
  }
}

/** Solishtirish uchun oldingi teng uzunlikdagi davr */
export function previousRange(range: DateRange): DateRange {
  const from = fromISODate(range.from)
  const to = fromISODate(range.to)
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
  return {
    preset: 'custom',
    from: toISODate(addDays(from, -days)),
    to: toISODate(addDays(to, -days)),
  }
}

/** Sana davrga kiradimi (chegaralar qo'shilgan holda) */
export function inRange(value: Date | string, range: DateRange): boolean {
  const d = startOfDay(typeof value === 'string' ? new Date(value) : value)
  return d >= fromISODate(range.from) && d <= fromISODate(range.to)
}

/* ------------------------------------------------------------------ */
/* Vaqt slotlari                                                       */
/* ------------------------------------------------------------------ */

/** "09:00" → 540 (yarim tundan boshlab daqiqalar) */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** 540 → "09:00" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Kalendar uchun vaqt shkalasi: ["08:00", "08:30", …] */
export function timeSlots(open: string, close: string, stepMinutes: number): string[] {
  const out: string[] = []
  for (let m = timeToMinutes(open); m < timeToMinutes(close); m += stepMinutes) {
    out.push(minutesToTime(m))
  }
  return out
}

/** Sana + "09:30" → Date */
export function atTime(day: Date, t: string): Date {
  const [h, m] = t.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0)
}
