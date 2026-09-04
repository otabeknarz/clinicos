import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { CrossTenantAccessError, forClinic } from '../src/prisma/tenant.extension'

/**
 * KLINIKA AJRATISHNI SINASH.
 *
 * Bu tizimning eng muhim tekshiruvi. U buzilsa, bir klinika
 * boshqasining bemorlarini ko'radi — bundan keyin mahsulotning
 * ma'nosi qolmaydi.
 *
 * Ishga tushirish:  npm run test:isolation
 *
 * Sinov `npm run db:seed` dan keyin ishlaydi: unda ikkita klinika
 * va ularning bemorlari bo'ladi.
 */

const base = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log('  OK   ' + name)
  } else {
    failed++
    console.log('  XATO ' + name + (detail ? ' — ' + detail : ''))
  }
}

async function main() {
  const clinics = await base.clinic.findMany({ orderBy: { createdAt: 'asc' } })
  if (clinics.length < 2) {
    console.error('Kamida ikkita klinika kerak. Avval: npm run db:seed')
    process.exit(1)
  }

  const [a, b] = clinics
  const dbA = forClinic(base, a.id)
  const dbB = forClinic(base, b.id)

  console.log(`\nKlinika A: ${a.name}\nKlinika B: ${b.name}\n`)

  /* ---------- 1. O'qish ---------- */
  console.log('O‘qish')

  const allPatients = await base.patient.findMany()
  const patientsA = await dbA.patient.findMany()
  const patientsB = await dbB.patient.findMany()

  check(
    'A faqat o‘z bemorlarini ko‘radi',
    patientsA.length > 0 && patientsA.every((p) => p.clinicId === a.id),
  )
  check(
    'B faqat o‘z bemorlarini ko‘radi',
    patientsB.length > 0 && patientsB.every((p) => p.clinicId === b.id),
  )
  check(
    'ikkalasi birgalikda hammasini beradi',
    patientsA.length + patientsB.length === allPatients.length,
    `${patientsA.length} + ${patientsB.length} ≠ ${allPatients.length}`,
  )

  /* ---------- 2. Boshqa klinikaning yozuvini id bo'yicha olish ---------- */
  console.log('\nBegona yozuvni id bo‘yicha olish')

  const victim = patientsB[0]

  check(
    'findUnique begona yozuvni bermaydi',
    (await dbA.patient.findUnique({ where: { id: victim.id } })) === null,
  )
  check(
    'findFirst begona yozuvni bermaydi',
    (await dbA.patient.findFirst({ where: { id: victim.id } })) === null,
  )

  /* ---------- 3. Sanash va guruhlash ---------- */
  console.log('\nSanash')

  check(
    'count faqat o‘z klinikasini sanaydi',
    (await dbA.patient.count()) === patientsA.length,
  )

  /* ---------- 4. Yozish ---------- */
  console.log('\nYozish')

  /*
    ATAYLAB B klinikaning id'sini beramiz.

    Hujjatdagi 1-qoida: `clinicId` mijozdan olinmaydi. Filtr uni
    bosib yozishi kerak, aks holda so'rov tanasiga begona klinika
    id'sini yozib, o'sha klinikaga yozuv qo'shib bo'lardi.
  */
  const created = await dbA.patient.create({
    data: {
      clinicId: b.id,
      fullName: 'Sinov Bemorov',
      phone: '+998 90 999 99 99',
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
    },
  })
  check(
    'create berilgan begona clinicId ni bosib yozadi',
    created.clinicId === a.id,
    `yozuv ${created.clinicId === b.id ? 'B klinikaga tushdi' : 'noma’lum klinikada'}`,
  )

  /* ---------- 5. Eng muhimi: begona yozuvni o'zgartirish ---------- */
  console.log('\nBegona yozuvni o‘zgartirish (eng muhim sinov)')

  let updateBlocked = false
  try {
    await dbA.patient.update({
      where: { id: victim.id },
      data: { fullName: 'BUZILDI' },
    })
  } catch (error) {
    updateBlocked = error instanceof CrossTenantAccessError
  }
  check('update begona yozuvni o‘zgartira olmaydi', updateBlocked)

  let deleteBlocked = false
  try {
    await dbA.patient.delete({ where: { id: victim.id } })
  } catch (error) {
    deleteBlocked = error instanceof CrossTenantAccessError
  }
  check('delete begona yozuvni o‘chira olmaydi', deleteBlocked)

  const stillThere = await base.patient.findUnique({ where: { id: victim.id } })
  check(
    'begona yozuv o‘zgarmagan',
    stillThere !== null && stillThere.fullName === victim.fullName,
  )

  /* ---------- 6. updateMany / deleteMany ham cheklanadi ---------- */
  console.log('\nOmmaviy amallar')

  const touched = await dbA.patient.updateMany({ data: { status: 'ACTIVE' } })
  check(
    'updateMany faqat o‘z klinikasiga tegadi',
    touched.count === patientsA.length + 1,
    `${touched.count} ta yozuvga tegdi`,
  )

  /* ---------- Tozalash ---------- */
  await base.patient.delete({ where: { id: created.id } })

  console.log(`\n${passed} ta o‘tdi, ${failed} ta xato\n`)
  await base.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (error) => {
  console.error(error)
  await base.$disconnect()
  process.exit(1)
})
