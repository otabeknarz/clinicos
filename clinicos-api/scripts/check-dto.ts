import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * YARATISH VA TAHRIRLASH DTO'LARI AJRALIB KETMASIN.
 *
 * MUAMMO TARIXI: yettita `PATCH` endpoint yaratish DTO'sini
 * qayta ishlatardi. Unda maydonlar MAJBURIY, interfeys esa
 * faqat o'zgargan maydonni yuboradi — natijada har qanday
 * qisman tahrir 400 olardi. Bunday xatoni tip tekshiruvi ham,
 * `check:endpoints` ham ushlamaydi: marshrut bor, tiplar to'g'ri,
 * faqat ishlatib ko'rgandagina bilinadi.
 *
 * Endi har bir `<X>InputDto` uchun `Update<X>Dto` bor. Ular
 * ajralib ketmasligi kerak: yaratishga yangi maydon qo'shilib,
 * tahrirga qo'shilmasa — o'sha maydonni hech qachon o'zgartirib
 * bo'lmaydi va buni hech kim sezmaydi.
 *
 * ATAYLAB tashlab ketilgan maydon uchun `Update` klassining
 * izohiga aniq belgi yoziladi:
 *
 *     ATAYLAB YO'Q: bedCount
 *
 * Shunchaki izohda maydon nomini eslatish YETMAYDI — aks holda
 * tasodifan tilga olingan nom tekshiruvni jimgina o'chirib
 * qo'yardi (aynan shunday bo'ldi ham).
 *
 * Ishga tushirish:  npm run check:dto
 */

const API_ROOT = path.resolve(__dirname, '..')

interface DtoClass {
  file: string
  body: string
  fields: Set<string>
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.dto.ts')) out.push(full)
  }
  return out
}

/** Klass tanasidagi maydon nomlari: `name!: string` / `price?: number` */
function fieldsOf(body: string): Set<string> {
  const out = new Set<string>()
  for (const m of body.matchAll(/^\s{2}(\w+)[!?]?:\s/gm)) out.add(m[1])
  return out
}

const classes = new Map<string, DtoClass>()

for (const file of walk(path.join(API_ROOT, 'src'))) {
  const source = fs.readFileSync(file, 'utf8')
  /*
    Klass tanasi bilan birga UNDAN OLDINGI izoh ham olinadi:
    ataylab tashlangan maydon odatda o'sha izohda tushuntiriladi
    (`RoomInputDto` dagi `bedCount` kabi).
  */
  for (const m of source.matchAll(
    /(\/\*\*[\s\S]*?\*\/\s*)?export class (\w+)[^{]*\{([\s\S]*?)\n\}/g,
  )) {
    const doc = m[1] ?? ''
    classes.set(m[2], {
      file: path.relative(API_ROOT, file),
      body: doc + m[3],
      fields: fieldsOf(m[3]),
    })
  }
}

let failed = false
let checked = 0

for (const [name, input] of classes) {
  const base = /^(\w+)InputDto$/.exec(name)?.[1]
  if (!base) continue

  const update = classes.get(`Update${base}Dto`)
  if (!update) continue // juftsiz DTO — bu skript uchun muammo emas

  checked++

  /* Izohdagi `ATAYLAB YO'Q: a, b` belgisi bilan e'lon qilinganlar */
  const waived = new Set<string>()
  for (const m of update.body.matchAll(/ATAYLAB YO['‘’]Q:\s*([\w,\s]+)/g)) {
    for (const f of m[1].split(',')) {
      const name = f.trim()
      if (name) waived.add(name)
    }
  }

  const missing = [...input.fields].filter(
    (f) => !update.fields.has(f) && !waived.has(f),
  )

  if (missing.length) {
    failed = true
    console.error(
      `XATO  Update${base}Dto (${update.file}) da yo'q: ${missing.join(', ')}`,
    )
    console.error(
      `      Qo'shing, yoki ataylab tashlangan bo'lsa izohga yozing: ` +
        `ATAYLAB YO'Q: ${missing.join(', ')}`,
    )
  }

  /* Tahrirlash DTO'sida MAJBURIY maydon bo'lmasligi kerak */
  const required = [...update.body.matchAll(/^\s{2}(\w+)!:\s/gm)].map((m) => m[1])
  if (required.length) {
    failed = true
    console.error(
      `XATO  Update${base}Dto da majburiy maydon bor: ${required.join(', ')}. ` +
        `Qisman tahrir shu maydonsiz kelsa 400 oladi.`,
    )
  }

  /* Sukut qiymat (`= ...`) tahrirlash DTO'sida yubormagan maydonni bosib yozadi */
  const withDefault = [...update.body.matchAll(/^\s{2}(\w+)\??:\s[^=\n]+=\s*[^\n]/gm)].map(
    (m) => m[1],
  )
  if (withDefault.length) {
    failed = true
    console.error(
      `XATO  Update${base}Dto da sukut qiymatli maydon bor: ${withDefault.join(', ')}. ` +
        `So'rovda kelmasa ham yoziladi va eski qiymatni bosib ketadi.`,
    )
  }
}

console.log(
  failed
    ? '\nDTO juftliklarida muammo bor'
    : `DTO juftliklari joyida (${checked} ta tekshirildi)`,
)
process.exit(failed ? 1 : 0)
