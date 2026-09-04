/**
 * Mock ma'lumotlar bazasi.
 *
 * Ishlash printsipi:
 *  - `generateSeed()` bir marta ishga tushadi va xotirada turadi (demo ma'lumot).
 *  - Foydalanuvchi biror narsa yaratsa/o'zgartirsa/o'chirsa — faqat SHU
 *    o'zgarishlar ("overrides") localStorage'ga yoziladi. Butun baza emas,
 *    shuning uchun localStorage to'lib qolmaydi.
 *  - Sahifa yangilanganda: seed + saqlangan o'zgarishlar birlashtiriladi.
 *
 * Backend tayyor bo'lgach bu fayl kerak bo'lmaydi — `src/api/` ichidagi
 * `USE_MOCK` bayrog'i o'chadi va hamma so'rov serverga ketadi.
 */

import { generateSeed, MAIN_CLINIC_ID } from './seed'
import type { SeedData } from './seed'

const STORAGE_KEY = 'clinicos.mock.v1'

/**
 * Har bir yozuvda `id` bor. `clinicId` — deyarli hammasida, bundan
 * mustasno faqat `Clinic`ning o'zi: uning tenant identifikatori — `id`.
 */
interface Entity {
  id: string
}

function tenantOf(row: Entity): string {
  return (row as Entity & { clinicId?: string }).clinicId ?? row.id
}

/** Bitta jadval uchun saqlanadigan o'zgarishlar */
interface CollectionOverrides<T> {
  /** Yangi yaratilganlar */
  created: T[]
  /** Tahrirlanganlar: id → to'liq yozuv */
  updated: Record<string, T>
  /** O'chirilganlar ro'yxati */
  deleted: string[]
}

type OverrideStore = Record<string, CollectionOverrides<Entity>>

function emptyOverrides<T>(): CollectionOverrides<T> {
  return { created: [], updated: {}, deleted: [] }
}

/* ------------------------------------------------------------------ */
/* Saqlash qatlami                                                     */
/* ------------------------------------------------------------------ */

function loadOverrides(): OverrideStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OverrideStore) : {}
  } catch {
    return {}
  }
}

function saveOverrides(store: OverrideStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Kvota to'lgan bo'lsa — o'zgarishlar faqat shu sessiyada qoladi.
    // Demo uchun bu yetarli, xato ko'rsatish shart emas.
  }
}

/* ------------------------------------------------------------------ */
/* Jadval                                                              */
/* ------------------------------------------------------------------ */

export class Collection<T extends Entity> {
  private key: string
  private base: T[]
  private store: OverrideStore
  private overrides: CollectionOverrides<T>
  /**
   * `all()` natijasi keshi.
   *
   * Bu jadvalda minglab yozuv bo'ladi va `all()` bir sahifa ochilganda
   * o'nlab marta chaqiriladi. Har safar massivni qaytadan yig'ish —
   * interfeysni sezilarli sekinlashtiradi. Har qanday o'zgarish
   * (insert/update/remove) keshni tozalaydi.
   */
  private cache = new Map<string, T[]>()

  constructor(key: string, base: T[], store: OverrideStore) {
    this.key = key
    this.base = base
    this.store = store
    this.overrides = (store[key] as CollectionOverrides<T> | undefined) ?? emptyOverrides<T>()
  }

  private persist() {
    this.cache.clear()
    this.store[this.key] = this.overrides as CollectionOverrides<Entity>
    saveOverrides(this.store)
  }

  /**
   * Klinika bo'yicha filtrlangan barcha yozuvlar.
   *
   * MULTI-TENANCY: bu yagona kirish nuqtasi. Har qanday o'qish shu yerdan
   * o'tadi, shuning uchun boshqa klinikaning yozuvi chiqib ketmaydi.
   * Serverda ham aynan shunday bitta majburiy filtr bo'lishi kerak.
   */
  all(clinicId: string = MAIN_CLINIC_ID): T[] {
    const cached = this.cache.get(clinicId)
    if (cached) return cached

    const deleted = new Set(this.overrides.deleted)
    const merged = [...this.base, ...this.overrides.created]
      .map((row) => this.overrides.updated[row.id] ?? row)
      .filter((row) => !deleted.has(row.id))
      .filter((row) => tenantOf(row) === clinicId)

    this.cache.set(clinicId, merged)
    return merged
  }

  /**
   * Klinika filtrisiz BARCHA yozuvlar.
   *
   * FAQAT PLATFORMA jadvallari uchun: klinikalar, tariflar, hisoblar.
   * Ular tabiatan klinikalararo — super admin hammasini ko'rishi
   * kerak, aks holda panelning ma'nosi qolmaydi.
   *
   * KLINIKA MA'LUMOTIDA HECH QACHON ISHLATILMAYDI: bemor, tashrif,
   * to'lov kabi jadvallarda bu metod chaqirilsa, multi-tenancy
   * himoyasi buziladi. Shuning uchun nomi ataylab boshqacha —
   * `all()` bilan adashtirib bo'lmaydi.
   */
  allAcrossTenants(): T[] {
    const deleted = new Set(this.overrides.deleted)
    return [...this.base, ...this.overrides.created]
      .map((row) => this.overrides.updated[row.id] ?? row)
      .filter((row) => !deleted.has(row.id))
  }

  /**
   * Klinika filtrisiz yangilash — faqat platforma jadvallari uchun.
   * Sabab `allAcrossTenants()` dagi bilan bir xil.
   */
  updateAcrossTenants(id: string, patch: Partial<T>): T | null {
    const current = this.allAcrossTenants().find((row) => row.id === id)
    if (!current) return null
    const next = { ...current, ...patch, id: current.id }
    this.overrides.updated[id] = next
    this.persist()
    return next
  }

  find(id: string, clinicId: string = MAIN_CLINIC_ID): T | null {
    return this.all(clinicId).find((row) => row.id === id) ?? null
  }

  insert(row: T): T {
    this.overrides.created.push(row)
    this.persist()
    return row
  }

  update(id: string, patch: Partial<T>, clinicId: string = MAIN_CLINIC_ID): T | null {
    const current = this.find(id, clinicId)
    if (!current) return null
    const next = { ...current, ...patch, id: current.id }
    this.overrides.updated[id] = next
    this.persist()
    return next
  }

  /** Klinika filtrisiz o'chirish — faqat platforma jadvallari uchun */
  removeAcrossTenants(id: string): boolean {
    const current = this.allAcrossTenants().find((row) => row.id === id)
    if (!current) return false
    this.overrides.deleted.push(id)
    this.persist()
    return true
  }

  remove(id: string, clinicId: string = MAIN_CLINIC_ID): boolean {
    const current = this.find(id, clinicId)
    if (!current) return false
    this.overrides.deleted.push(id)
    delete this.overrides.updated[id]
    this.overrides.created = this.overrides.created.filter((r) => r.id !== id)
    this.persist()
    return true
  }

  /** Yangi id yaratish — mock uchun yetarli darajada noyob */
  nextId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  }
}

/* ------------------------------------------------------------------ */
/* Baza                                                                */
/* ------------------------------------------------------------------ */

export interface MockDb {
  clinics: Collection<SeedData['clinics'][number]>
  users: Collection<SeedData['users'][number]>
  doctors: Collection<SeedData['doctors'][number]>
  services: Collection<SeedData['services'][number]>
  patients: Collection<SeedData['patients'][number]>
  appointments: Collection<SeedData['appointments'][number]>
  visits: Collection<SeedData['visits'][number]>
  payments: Collection<SeedData['payments'][number]>
  followUps: Collection<SeedData['followUps'][number]>
  rooms: Collection<SeedData['rooms'][number]>
  beds: Collection<SeedData['beds'][number]>
  admissions: Collection<SeedData['admissions'][number]>
  staff: Collection<SeedData['staff'][number]>
  shiftClosures: Collection<SeedData['shiftClosures'][number]>
  attendance: Collection<SeedData['attendance'][number]>
  bonuses: Collection<SeedData['bonuses'][number]>
  bonusRules: Collection<SeedData['bonusRules'][number]>
  penaltyRules: Collection<SeedData['penaltyRules'][number]>
  plans: Collection<SeedData['plans'][number]>
  tenants: Collection<SeedData['tenants'][number]>
  tenantInvoices: Collection<SeedData['tenantInvoices'][number]>
  impersonations: Collection<SeedData['impersonations'][number]>
  tenantDoctors: Collection<SeedData['tenantDoctors'][number]>
  tenantPatients: Collection<SeedData['tenantPatients'][number]>
  team: Collection<SeedData['team'][number]>
  penaltyWaivers: Collection<SeedData['penaltyWaivers'][number]>
  feedback: Collection<SeedData['feedback'][number]>
  monthlyStats: Collection<SeedData['monthlyStats'][number] & { id: string }>
  chatGroups: Collection<SeedData['chatGroups'][number]>
  chatMessages: Collection<SeedData['chatMessages'][number]>
}

let instance: MockDb | null = null

export function getDb(): MockDb {
  if (instance) return instance

  const seed = generateSeed()
  const store = loadOverrides()

  const db: MockDb = {
    clinics: new Collection('clinics', seed.clinics, store),
    users: new Collection('users', seed.users, store),
    doctors: new Collection('doctors', seed.doctors, store),
    services: new Collection('services', seed.services, store),
    patients: new Collection('patients', seed.patients, store),
    appointments: new Collection('appointments', seed.appointments, store),
    visits: new Collection('visits', seed.visits, store),
    payments: new Collection('payments', seed.payments, store),
    followUps: new Collection('followUps', seed.followUps, store),
    rooms: new Collection('rooms', seed.rooms, store),
    beds: new Collection('beds', seed.beds, store),
    admissions: new Collection('admissions', seed.admissions, store),
    staff: new Collection('staff', seed.staff, store),
    shiftClosures: new Collection('shiftClosures', seed.shiftClosures, store),
    attendance: new Collection('attendance', seed.attendance, store),
    bonuses: new Collection('bonuses', seed.bonuses, store),
    bonusRules: new Collection('bonusRules', seed.bonusRules, store),
    penaltyRules: new Collection('penaltyRules', seed.penaltyRules, store),
    plans: new Collection('plans', seed.plans, store),
    tenants: new Collection('tenants', seed.tenants, store),
    tenantInvoices: new Collection('tenantInvoices', seed.tenantInvoices, store),
    impersonations: new Collection('impersonations', seed.impersonations, store),
    tenantDoctors: new Collection('tenantDoctors', seed.tenantDoctors, store),
    tenantPatients: new Collection('tenantPatients', seed.tenantPatients, store),
    team: new Collection('team', seed.team, store),
    penaltyWaivers: new Collection('penaltyWaivers', seed.penaltyWaivers, store),
    feedback: new Collection('feedback', seed.feedback, store),
    // Oylik yig'ma yozuvlarda `id` yo'q - davr kaliti id vazifasini bajaradi
    monthlyStats: new Collection(
      'monthlyStats',
      seed.monthlyStats.map((m) => ({ ...m, id: m.period })),
      store,
    ),
    chatGroups: new Collection('chatGroups', seed.chatGroups, store),
    chatMessages: new Collection('chatMessages', seed.chatMessages, store),
  }

  instance = db
  return db
}

/** Demo ma'lumotni boshlang'ich holatga qaytarish (sozlamalardan chaqiriladi) */
export function resetDb() {
  localStorage.removeItem(STORAGE_KEY)
  instance = null
}
