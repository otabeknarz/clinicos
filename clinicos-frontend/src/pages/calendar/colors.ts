import type { AppointmentStatus } from '@/types/models'

/**
 * SHIFOKOR RANGLARI.
 *
 * Kalendarda rang SHIFOKORNI bildiradi, holatni emas. "Barcha shifokorlar"
 * ko'rinishida registrator birinchi navbatda "bu kimning bemori" deb
 * qidiradi — holat esa kartadagi kichik belgida turadi. Holatni rang bilan
 * berganimizda kun boshida hamma karta bir xil kulrang edi ("rejada") va
 * kalendar o'qilmas bo'lib qolardi.
 *
 * Qizil ATAYLAB yo'q: u "kelmagan" holatiga band.
 */
const PALETTE = [
  '#3b82f6', // ko'k
  '#8b5cf6', // binafsha
  '#14b8a6', // moviy-yashil
  '#f97316', // to'q sariq
  '#ec4899', // pushti
  '#0ea5e9', // havorang
  '#65a30d', // yashil
  '#d946ef', // siyohrang
  '#ca8a04', // oltin
  '#6366f1', // indigo
]

/**
 * Rang shifokorlar ro'yxatidagi TARTIBGA qarab beriladi — shunda izoh va
 * kartalar doim mos keladi. Ro'yxatda yo'q shifokor (masalan ishdan
 * ketgan, lekin eski qabuli bor) id'dan hisoblangan rang oladi.
 */
export function doctorColors(doctorIds: string[]): (id: string) => string {
  const map = new Map(doctorIds.map((id, index) => [id, PALETTE[index % PALETTE.length]]))
  return (id: string) => map.get(id) ?? PALETTE[hash(id) % PALETTE.length]
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

/** Karta foni — rangning och tusi, lekin SHAFFOF EMAS: to'r chiziqlari ustidan o'tmasin */
export function tint(color: string, percent = 16): string {
  return `color-mix(in srgb, ${color} ${percent}%, var(--surface-raised))`
}

/** Holat belgisining rangi */
export const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: 'bg-label-tertiary',
  confirmed: 'bg-accent',
  checked_in: 'bg-warn',
  completed: 'bg-ok',
  cancelled: 'bg-fill-2',
  no_show: 'bg-bad',
}

/** Izohda ko'rsatiladigan holatlar tartibi — kunning o'tishi bo'yicha */
export const STATUS_ORDER: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'no_show',
]
