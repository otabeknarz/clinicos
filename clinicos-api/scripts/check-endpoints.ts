import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * SHARTNOMANI TEKSHIRISH.
 *
 * Frontend `src/api/` da har bir funksiya tepasida u kutayotgan
 * endpoint yozilgan:
 *
 *     // GET /patients?search=&filter=&page=
 *
 * Bu skript o'shalarni yig'ib, backendda haqiqatan shunday
 * marshrut borligini tekshiradi.
 *
 * NEGA KERAK: yo'lda bitta harf farq qilsa (`/follow-ups` va
 * `/followups`), frontend 404 oladi. Bunday xatoni faqat
 * qo'lda bosib ko'rish orqali topish mumkin — yoki shu skript
 * bilan bir soniyada.
 *
 * Ishga tushirish:  npm run check:endpoints
 */

const API_ROOT = path.resolve(__dirname, '..')
const FRONTEND_API = path.resolve(API_ROOT, '..', 'clinicos', 'src', 'api')

interface Route {
  method: string
  path: string
}

/* ------------------------------------------------------------------ */
/* Frontend kutayotgan endpointlar                                     */
/* ------------------------------------------------------------------ */

function expectedRoutes(): Route[] {
  const out: Route[] = []
  if (!fs.existsSync(FRONTEND_API)) return out

  for (const file of fs.readdirSync(FRONTEND_API)) {
    if (!file.endsWith('.ts') || file === 'client.ts') continue
    const source = fs.readFileSync(path.join(FRONTEND_API, file), 'utf8')

    for (const match of source.matchAll(
      /^\/\/ (GET|POST|PATCH|DELETE) (\S+)/gm,
    )) {
      // So'rov qismi va izohlarni kesamiz: "/patients?search=" -> "/patients"
      const raw = match[2].split('?')[0].replace(/[.,]$/, '')
      out.push({ method: match[1], path: normalize(raw) })
    }
  }

  return dedupe(out)
}

/* ------------------------------------------------------------------ */
/* Backendda mavjud marshrutlar                                        */
/* ------------------------------------------------------------------ */

function actualRoutes(): Route[] {
  const out: Route[] = []

  for (const file of walk(path.join(API_ROOT, 'src'))) {
    const source = fs.readFileSync(file, 'utf8')

    const controller = /@Controller\('([^']*)'\)/.exec(source)
    const prefix = controller ? controller[1] : ''

    for (const match of source.matchAll(
      /@(Get|Post|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/g,
    )) {
      const method = match[1].toUpperCase()
      const suffix = match[2] ?? ''
      out.push({ method, path: normalize(join(prefix, suffix)) })
    }
  }

  return dedupe(out)
}

/* ------------------------------------------------------------------ */

/** `:id` va `:patientId` kabi parametrlarni bir xil ko'rinishga keltiradi */
function normalize(value: string): string {
  return (
    '/' +
    value
      .split('/')
      .filter(Boolean)
      .map((part) => (part.startsWith(':') ? ':param' : part))
      .join('/')
  )
}

function join(prefix: string, suffix: string): string {
  return [prefix, suffix].filter(Boolean).join('/')
}

function dedupe(routes: Route[]): Route[] {
  const seen = new Set<string>()
  return routes.filter((r) => {
    const key = `${r.method} ${r.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.controller.ts')) out.push(full)
  }
  return out
}

/* ------------------------------------------------------------------ */

const expected = expectedRoutes()
const actual = actualRoutes()
const actualKeys = new Set(actual.map((r) => `${r.method} ${r.path}`))

const missing = expected.filter((r) => !actualKeys.has(`${r.method} ${r.path}`))

console.log(`Frontend kutadi : ${expected.length} ta`)
console.log(`Backendda bor   : ${actual.length} ta`)

if (missing.length) {
  console.log(`\nYETISHMAYDI (${missing.length} ta):`)
  for (const r of missing) console.log(`  ${r.method} ${r.path}`)
} else {
  console.log('\nHammasi joyida — yetishmayotgan endpoint yo‘q')
}

process.exit(missing.length ? 1 : 0)
