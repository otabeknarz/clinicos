/**
 * ============================================================
 *  API MIJOZI — BACKEND BILAN YAGONA ULANISH NUQTASI
 * ============================================================
 *
 * DASTURCHIGA:
 *
 * Butun frontend backendga faqat shu papka (`src/api/`) orqali murojaat
 * qiladi. Boshqa hech qaerda `fetch` yo'q.
 *
 * Backend tayyor bo'lganda qilinadigan ish:
 *
 *   1. `.env` fayliga manzilni yozing:
 *        VITE_API_URL=https://api.clinicos.uz
 *
 *   2. Tamom. `USE_MOCK` avtomatik `false` bo'ladi va har bir funksiya
 *      demo ma'lumot o'rniga haqiqiy so'rov yuboradi.
 *
 * Har bir api funksiyasi tepasida u kutayotgan endpoint yozilgan, masalan:
 *
 *   // GET /patients?search=&status=&page=
 *
 * To'liq shartnoma (so'rov/javob JSON, rollar ruxsati) — `docs/API.md`.
 *
 * MUHIM: `src/api/` ichidagi barcha ruxsat tekshiruvlari faqat interfeys
 * uchun. Server o'z tekshiruvini mustaqil bajarishi SHART.
 */

const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** Backend manzili berilmagan bo'lsa — demo (mock) rejimda ishlaymiz */
export const USE_MOCK = !API_URL

/* ------------------------------------------------------------------ */
/* Xatolik                                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number
  /** Server qaytargan maydon xatolari: { phone: "Noto'g'ri format" } */
  fieldErrors: Record<string, string>

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/* ------------------------------------------------------------------ */
/* Sessiya (token)                                                     */
/* ------------------------------------------------------------------ */

const TOKEN_KEY = 'clinicos.session.token'

/*
  Token brauzerda SAQLANADI, aks holda sahifa yangilanganda yo'qoladi
  va foydalanuvchi har F5 da kirish sahifasiga tushib qolardi.

  Mock rejimda bu bilinmasdi: u yerda `me()` tokensiz, localStorage'dagi
  `userId` bo'yicha ishlaydi. Xato faqat haqiqiy backend ulanganda
  chiqadi — ya'ni aynan ishga tushirishda.

  XAVFSIZLIK: localStorage XSS ga ochiq. Ishonchliroq yo'l — serverdan
  HttpOnly cookie: u holda tokenni bu yerda umuman saqlamaslik kerak,
  `credentials: 'include'` esa allaqachon yozilgan. Backend cookie
  bergan kunda shu blokni o'chiring.
*/
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Brauzer saqlashni bloklagan bo'lishi mumkin (maxfiy oyna)
    return null
  }
}

let authToken: string | null = readStoredToken()

/** AuthContext kirish/chiqishda chaqiradi */
export function setAuthToken(token: string | null) {
  authToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Saqlanmasa ham joriy sessiya ishlaydi — faqat yangilashda uziladi
  }
}

export function getAuthToken(): string | null {
  return authToken
}

/* ------------------------------------------------------------------ */
/* Bemor sessiyasi — XODIMNIKIDAN ALOHIDA                              */
/* ------------------------------------------------------------------ */

/*
  ALOHIDA KALIT VA ALOHIDA O'ZGARUVCHI.

  Bemor tokeni xodimnikidan butunlay boshqa narsa: u faqat
  `/patient/*` marshrutlarini ochadi va serverda ham alohida
  qorovul tekshiradi. Ikkalasini bitta joyda saqlasak, bir
  qurilmada ham xodim, ham bemor sifatida kirib bo'lmasdi —
  ikkinchisi birinchisini o'chirib yuborardi. Klinika egasi
  o'z klinikasida bemor ham bo'lishi mumkin.
*/
const PATIENT_TOKEN_KEY = 'clinicos.cabinet.token'

let patientToken: string | null = (() => {
  try {
    return localStorage.getItem(PATIENT_TOKEN_KEY)
  } catch {
    return null
  }
})()

export function setPatientToken(token: string | null) {
  patientToken = token
  try {
    if (token) localStorage.setItem(PATIENT_TOKEN_KEY, token)
    else localStorage.removeItem(PATIENT_TOKEN_KEY)
  } catch {
    // Saqlanmasa ham joriy sessiya ishlaydi
  }
}

export function getPatientToken(): string | null {
  return patientToken
}

/* ------------------------------------------------------------------ */
/* So'rov konteksti                                                    */
/* ------------------------------------------------------------------ */

/**
 * Joriy sessiya konteksti.
 *
 * HAQIQIY BACKENDDA bu kontekst so'rov bilan YUBORILMAYDI — server uni
 * tokendan o'zi oladi. Bu yerda u faqat mock ma'lumotni to'g'ri filtrlash
 * uchun kerak (klinika + shifokorning o'z bemorlari).
 */
export interface ApiContext {
  clinicId: string
  /** Rol = doctor bo'lsa shifokor id'si, aks holda null */
  scopeDoctorId: string | null
  /**
   * Kirgan odamning emaili — FAQAT DEMO REJIM UCHUN.
   *
   * Haqiqiy ishlashda kim yozganini server TOKENDAN oladi va
   * mijozdan kelgan qiymatga umuman qaramaydi. Demoda esa
   * server yo'q: apteka smenasi va sotuvi kimga yozilishini
   * boshqa yo'l bilan bilib bo'lmaydi va hamma yozuv egasiz
   * qolardi.
   */
  userEmail?: string
}

let context: ApiContext = { clinicId: 'clinic_1', scopeDoctorId: null }

export function setApiContext(next: ApiContext) {
  context = next
}

export function apiContext(): ApiContext {
  return context
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  signal?: AbortSignal
  /**
   * Qaysi sessiya bilan yuborilsin.
   *
   * `patient` — bemor kabineti. Yo'lga qarab avtomatik tanlamadim:
   * marshrut nomi o'zgarsa, tanlov jimgina noto'g'ri tomonga
   * o'tib ketardi va bemor xodim tokeni bilan so'rov yuborardi.
   */
  session?: 'staff' | 'patient'
}

/**
 * Haqiqiy HTTP so'rov. Mock rejimda chaqirilmaydi.
 *
 * Autentifikatsiya: `Authorization: Bearer <token>`.
 * Agar backend HttpOnly cookie ishlatsa — `credentials: 'include'` qo'shing
 * va tokenni umuman saqlamang (bu xavfsizroq variant).
 */
export async function request<T>(
  method: Method,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path.replace(/^\//, ''), `${API_URL}/`)

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const token = options.session === 'patient' ? patientToken : authToken
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Serverga ulanib bo‘lmadi', 0)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload: unknown = text ? safeJson(text) : null

  if (!response.ok) {
    const err = payload as { message?: string; errors?: Record<string, string> } | null
    throw new ApiError(
      err?.message ?? `So‘rov muvaffaqiyatsiz (${response.status})`,
      response.status,
      err?.errors ?? {},
    )
  }

  return payload as T
}

/**
 * Fayl yuborish (`multipart/form-data`).
 *
 * `request()` dan alohida, chunki u tanani JSON qilib yuboradi va
 * `Content-Type` ni o'zi qo'yadi. Multipart'da esa chegara belgisini
 * brauzer o'zi hisoblaydi — sarlavhani QO'LDA qo'yish kerak emas va
 * qo'yilsa so'rov buziladi.
 */
export async function upload<T>(
  path: string,
  file: Blob,
  filename = 'file',
  session: 'staff' | 'patient' = 'staff',
): Promise<T> {
  const form = new FormData()
  form.append('file', file, filename)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = session === 'patient' ? patientToken : authToken
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(new URL(path.replace(/^\//, ''), `${API_URL}/`).toString(), {
      method: 'POST',
      headers,
      body: form,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Serverga ulanib bo‘lmadi', 0)
  }

  const text = await response.text()
  const payload: unknown = text ? safeJson(text) : null

  if (!response.ok) {
    const err = payload as { message?: string | string[] } | null
    const message = Array.isArray(err?.message) ? err.message[0] : err?.message
    throw new ApiError(message ?? `Fayl yuklanmadi (${response.status})`, response.status)
  }

  return payload as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Mock yordamchilari                                                  */
/* ------------------------------------------------------------------ */

/**
 * Demo rejimda tarmoq kechikishini taqlid qilamiz — shu tufayli
 * yuklanish holatlari (skeleton) haqiqiy sharoitdagidek ko'rinadi.
 */
export function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/** Matn bo'yicha oddiy qidiruv — registr va bo'shliqlarga befarq */
export function matches(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}

/** Ro'yxatni sahifalash */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
}
