import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * RUXSAT NOMLARINI TEKSHIRISH.
 *
 * Ikkita narsani tekshiradi:
 *
 *   1. Kontrollerlarda ishlatilgan har bir ruxsat haqiqatan
 *      mavjudmi. Noto'g'ri yozilgan nom hech qachon mos kelmaydi
 *      va endpoint HAMMAGA yopiq bo'lib qoladi — bunday xato
 *      sinovsiz sezilmaydi.
 *
 *   2. Backend ro'yxati frontendникi bilan bir xilmi. Ular
 *      ajralib ketsa, interfeys tugmani ko'rsatadi, server esa
 *      rad etadi.
 *
 * Ishga tushirish:  npm run check:permissions
 */

const API_ROOT = path.resolve(__dirname, '..')
/*
  Frontendda `Permission` turi `types/models.ts` da e'lon qilingan
  (`lib/permissions.ts` da emas) — u yerda faqat rollar taqsimoti.
*/
const FRONTEND_PERMISSIONS = path.resolve(
  API_ROOT, '..', 'clinicos', 'src', 'types', 'models.ts',
)

function readPermissionUnion(source: string): Set<string> {
  const match = /export type Permission\s*=([\s\S]*?)(?:\n\n|\nexport )/.exec(source)
  const body = match ? match[1] : source
  return new Set([...body.matchAll(/'([\w.]+)'/g)].map((m) => m[1]))
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.controller.ts')) out.push(full)
  }
  return out
}

const backend = readPermissionUnion(
  fs.readFileSync(path.join(API_ROOT, 'src', 'common', 'permissions.ts'), 'utf8'),
)

let failed = false

// --- 1. Kontrollerlardagi nomlar ---
for (const file of walk(path.join(API_ROOT, 'src'))) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/@RequirePermission\('([\w.]+)'\)/g)) {
    if (!backend.has(match[1])) {
      failed = true
      console.error(`XATO  ${path.relative(API_ROOT, file)}: '${match[1]}' — bunday ruxsat yo'q`)
    }
  }
}

// --- 2. Frontend bilan solishtirish ---
if (fs.existsSync(FRONTEND_PERMISSIONS)) {
  const frontend = readPermissionUnion(fs.readFileSync(FRONTEND_PERMISSIONS, 'utf8'))
  const missing = [...frontend].filter((p) => !backend.has(p))
  const extra = [...backend].filter((p) => !frontend.has(p))

  if (missing.length) {
    failed = true
    console.error('XATO  backendda yo\'q:', missing.join(', '))
  }
  if (extra.length) {
    failed = true
    console.error('XATO  frontendda yo\'q:', extra.join(', '))
  }
} else {
  console.warn('Ogohlantirish: frontend topilmadi, solishtirish o\'tkazilmadi')
}

console.log(failed ? '\nRuxsatlarda muammo bor' : `Ruxsatlar joyida (${backend.size} ta)`)
process.exit(failed ? 1 : 0)
