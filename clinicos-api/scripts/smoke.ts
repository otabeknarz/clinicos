import 'dotenv/config'

/**
 * BARCHA ENDPOINTLARNI BOSIB CHIQISH.
 *
 * Har bir GET marshrutini har bir rol nomidan chaqiradi va
 * javob kodini yozadi. Maqsad — 500 xatolarini topish:
 * 401/403/404 kutilgan javoblar, 500 esa kodda xato.
 *
 * NEGA KERAK: 130 dan ortiq endpointni qo'lda bosib ko'rish
 * uzoq. Bu skript bir daqiqada hammasini tekshiradi.
 *
 * Ishga tushirish (server ishlab turishi kerak):
 *   npm run smoke
 */

const BASE = process.env.SMOKE_URL ?? 'http://localhost:3000'
const PASSWORD = 'demo1234'

const ACCOUNTS = [
  { label: 'platforma', email: 'admin@clinicos.uz' },
  { label: 'egasi', email: 'owner@shifomed.uz' },
  { label: 'registrator', email: 'reception@shifomed.uz' },
  { label: 'shifokor', email: 'aziz.karimov@shifomed.uz' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const MONTH = new Date().toISOString().slice(0, 7)

/**
 * Sinaladigan GET yo'llari.
 *
 * `:id` bo'lgan yo'llar bu yerda yo'q — ular haqiqiy id talab
 * qiladi va alohida sinovlarda tekshirilgan.
 */
const ROUTES = [
  '/auth/me',
  '/clinic',
  '/users',
  '/notifications',
  '/search?q=aa',
  '/patients',
  '/appointments',
  '/appointments/today',
  `/appointments/range?from=${TODAY}&to=${TODAY}`,
  `/appointments/load?from=${TODAY}&to=${TODAY}`,
  '/services',
  '/doctors',
  '/doctors?fields=short',
  '/payments',
  '/payments/summary',
  `/reports/revenue?from=${TODAY}&to=${TODAY}`,
  `/reports/analytics?from=${TODAY}&to=${TODAY}`,
  '/reports/monthly',
  '/reception/summary',
  '/follow-ups',
  `/cash-control?from=${TODAY}&to=${TODAY}`,
  '/shifts/current',
  '/ward/rooms',
  '/ward/admissions',
  `/ward/board?from=${TODAY}&to=${TODAY}`,
  `/ward/stats?from=${TODAY}&to=${TODAY}`,
  '/staff',
  '/me/profile',
  `/me/schedule?month=${MONTH}`,
  `/me/penalties?period=${MONTH}`,
  '/me/feedback',
  `/attendance/daily?date=${TODAY}`,
  '/attendance/flags',
  `/bonuses?period=${MONTH}`,
  `/bonuses/suggestions?period=${MONTH}`,
  '/bonus-rules',
  '/penalty-rules',
  `/penalties?period=${MONTH}`,
  '/feedback',
  '/feedback/stats',
  '/chat/groups',
  '/dashboard/summary',
  '/dashboard/revenue?period=week',
  '/dashboard/performance',
  '/forecast',
  '/platform/tenants',
  '/platform/stats',
  '/platform/data',
  '/platform/analytics',
  '/platform/plans',
  '/platform/invoices',
  '/platform/impersonations',
  '/platform/doctors',
  '/platform/patients',
  '/platform/team',
  '/platform/search?q=aa',
]

async function login(email: string): Promise<string> {
  const response = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!response.ok) throw new Error(`${email}: kirish muvaffaqiyatsiz`)
  const data = (await response.json()) as { token: string }
  return data.token
}

async function main() {
  let serverErrors = 0
  let checked = 0

  for (const account of ACCOUNTS) {
    const token = await login(account.email)
    const failures: string[] = []

    for (const route of ROUTES) {
      const response = await fetch(BASE + route, {
        headers: { Authorization: `Bearer ${token}` },
      })
      checked++

      // 500 va undan yuqorisi — kodda xato. Qolgani kutilgan javob.
      if (response.status >= 500) {
        serverErrors++
        const body = await response.text()
        failures.push(`${response.status} ${route} — ${body.slice(0, 120)}`)
      }
    }

    const mark = failures.length === 0 ? 'toza' : `${failures.length} ta xato`
    console.log(`${account.label.padEnd(12)} ${mark}`)
    for (const f of failures) console.log(`    ${f}`)
  }

  console.log(`\n${checked} ta so‘rov, ${serverErrors} ta server xatosi`)
  process.exit(serverErrors > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
