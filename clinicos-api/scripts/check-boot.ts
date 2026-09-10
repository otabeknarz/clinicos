/**
 * ILOVA KO'TARILADIMI.
 *
 * NEGA KERAK: NestJS bog'lanishlari (DI) KOMPILYATSIYADA
 * tekshirilmaydi. `tsc` ham, `nest build` ham bemalol o'tadi,
 * ilova esa ishga tushishda yiqiladi:
 *
 *     Nest can't resolve dependencies of the PatientAuthService
 *
 * Bir marta aynan shu tarzda serverga chiqib ketdi va konteyner
 * qayta-qayta ishga tushishga urinib, API 502 qaytardi. Xato
 * mahalliy tekshiruvlarning birortasida ko'rinmadi.
 *
 * Bu skript yig'ilgan ilovani SOXTA muhitda ishga tushiradi va
 * "tayyor" yozuvini kutadi. Bazaga tegmaydi: Prisma ulanishni
 * kechiktiradi, ya'ni mavjud bo'lmagan manzil ham xalaqit
 * bermaydi.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const ENTRY = 'dist/main.js'
const TIMEOUT_MS = 60_000

if (!existsSync(ENTRY)) {
  console.error(`${ENTRY} yo‘q — avval "npm run build" ni ishga tushiring`)
  process.exit(1)
}

const child = spawn(process.execPath, [ENTRY], {
  env: {
    ...process.env,
    /* Haqiqiy sozlamalar ustidan yozamiz — sinov hech narsaga tegmasin */
    DATABASE_URL: 'postgresql://sinov:sinov@127.0.0.1:59999/sinov',
    JWT_SECRET: 'faqat-yuklanishni-tekshirish-uchun-kalit',
    PORT: '3987',
    /* Xabar yuboriladigan xizmatlar o'chirilgan holatda ham ko'tarilishi kerak */
    TELEGRAM_BOT_TOKEN: '',
    PATIENT_BOT_TOKEN: '',
    S3_ENDPOINT: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
let done = false

function finish(code: number, message: string) {
  if (done) return
  done = true
  clearTimeout(timer)
  child.kill()
  console.log(message)
  if (code !== 0) console.error(output.slice(-2000))
  process.exit(code)
}

const timer = setTimeout(
  () => finish(1, `Ilova ${TIMEOUT_MS / 1000} soniyada ko‘tarilmadi`),
  TIMEOUT_MS,
)

function onData(chunk: Buffer) {
  output += chunk.toString()

  if (output.includes('Server tayyor')) {
    finish(0, 'Ilova ko‘tarildi — bog‘lanishlar joyida')
  }

  /*
    DI xatosi `ExceptionHandler` orqali chiqadi. Uni alohida
    ushlaymiz: aks holda sinov to'liq kutib turib, "vaqt tugadi"
    deb tugardi va sabab ko'rinmasdi.
  */
  if (output.includes('UnknownDependenciesException') || output.includes("can't resolve")) {
    finish(1, 'Bog‘lanish xatosi — modul ro‘yxatini tekshiring')
  }
}

child.stdout.on('data', onData)
child.stderr.on('data', onData)
child.on('error', (error) => finish(1, `Ishga tushirib bo‘lmadi: ${String(error)}`))
child.on('exit', (code) => finish(1, `Ilova ${code} kodi bilan to‘xtadi`))
