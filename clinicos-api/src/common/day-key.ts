/**
 * KUN KALITI — "2026-09-15".
 *
 * Qabul vaqti serverning MAHALLIY kuniga tegishli (kalendar, "bugun",
 * kassa — hammasi shunday). Dam olish kuni esa `@db.Date` ustunida
 * UTC yarim tuni sifatida saqlanadi. Ikkalasi shu kalit orqali
 * solishtiriladi — `toISOString()` ishlatilmaydi, u UTC beradi va
 * Toshkentda kechqurun 19:00 dan keyin ertangi kunni ko'rsatardi.
 */
export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "2026-09-15" → `@db.Date` ustuniga yoziladigan qiymat */
export function dayKeyToDb(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

/** `@db.Date` ustunidan o'qilgan qiymat → "2026-09-15" */
export function dbDateToKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** Kalitlar oralig'i, ikkala chegara ham kiradi */
export function dayKeysBetween(from: string, to: string): string[] {
  const out: string[] = []
  const cursor = dayKeyToDb(from)
  const end = dayKeyToDb(to)
  while (cursor <= end) {
    out.push(dbDateToKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}
