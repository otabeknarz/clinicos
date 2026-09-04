import 'dotenv/config'
import * as crypto from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PlanTier, PrismaClient, Role } from '@prisma/client'
import * as argon2 from 'argon2'

/**
 * ISHLAB CHIQARISH UCHUN BOSHLANG'ICH YOZUVLAR.
 *
 * NEGA `db:seed` YARAMAYDI: u bazani AVVAL TOZALAYDI. Demo
 * ma'lumot uchun to'g'ri, ishlayotgan klinikada esa — falokat.
 * Shuning uchun alohida skript: bu yerda `deleteMany` yo'q va
 * bo'lmasligi kerak.
 *
 * Skript QAYTA ISHLATILISHI mumkin. Yozuv allaqachon bo'lsa
 * qo'shmaydi va buni aytadi — ikki marta ishga tushirib
 * qo'yishdan zarar yo'q.
 *
 * ---------------------------------------------------------------
 * ISHLATISH
 * ---------------------------------------------------------------
 *
 * 1) Platforma qatlami — tariflar va birinchi platforma egasi.
 *    Bir marta, eng birinchi:
 *
 *      ADMIN_EMAIL=admin@clinic-os.uz \
 *      ADMIN_NAME="Ism Familiya" \
 *      ADMIN_PHONE="+998 90 000 00 00" \
 *      npm run bootstrap -- platform
 *
 * 2) Klinika — har bir yangi mijoz uchun:
 *
 *      CLINIC_NAME="Shifo Med" \
 *      CLINIC_PHONE="+998 71 200 00 00" \
 *      CLINIC_ADDRESS="Toshkent, ..." \
 *      OWNER_EMAIL=owner@shifomed.uz \
 *      OWNER_NAME="Ism Familiya" \
 *      PLAN=STANDARD \
 *      npm run bootstrap -- clinic
 *
 * PAROL: `ADMIN_PASSWORD` / `OWNER_PASSWORD` berilmasa, skript
 * kuchli parol o'zi yasaydi va BIR MARTA ekranga chiqaradi.
 * Parol bazada faqat xesh holida saqlanadi — yo'qotsangiz
 * qaytarib bo'lmaydi, yangisini qo'yish kerak bo'ladi.
 */

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/** Platforma xodimlari turadigan klinika nomi */
const PLATFORM_CLINIC = 'ClinicOS platformasi'

function generatePassword(): string {
  // 18 belgi, o'qishda adashtiradiganlarsiz (0/O, 1/l/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from(
    crypto.randomBytes(18),
    (byte) => alphabet[byte % alphabet.length],
  ).join('')
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`XATO  ${name} berilmagan.`)
    console.error('       Skript tepasidagi izohda namuna bor.')
    process.exit(1)
  }
  return value
}

/* ================================================================
   1. PLATFORMA QATLAMI
   ================================================================ */

async function bootstrapPlatform() {
  const email = required('ADMIN_EMAIL').toLowerCase()
  const fullName = required('ADMIN_NAME')
  const phone = process.env.ADMIN_PHONE?.trim() ?? ''
  const password = process.env.ADMIN_PASSWORD?.trim() || generatePassword()
  const generated = !process.env.ADMIN_PASSWORD?.trim()

  const existing = await db.user.findFirst({ where: { email } })
  if (existing) {
    console.log(`Bunday email allaqachon bor: ${email}. Hech narsa o'zgartirilmadi.`)
    return
  }

  /*
    Tariflar. Bo'lmasa yaratamiz — obunasiz klinika platforma
    ro'yxatida ko'rinmaydi, obuna esa tarifsiz bo'lmaydi.
  */
  const planCount = await db.plan.count()
  if (planCount === 0) {
    await db.plan.createMany({
      data: [
        {
          tier: PlanTier.STARTER,
          name: 'Boshlang‘ich',
          pricePerMonth: 1_200_000,
          limitDoctors: 3,
          limitStaff: 10,
          features: ['analytics'],
        },
        {
          tier: PlanTier.STANDARD,
          name: 'Standart',
          pricePerMonth: 2_500_000,
          limitDoctors: 10,
          limitStaff: 40,
          features: ['analytics', 'staff', 'cashControl', 'chat'],
        },
        {
          tier: PlanTier.PREMIUM,
          name: 'Premium',
          pricePerMonth: 4_500_000,
          limitDoctors: 40,
          limitStaff: 150,
          features: ['analytics', 'staff', 'cashControl', 'chat', 'ward', 'forecast'],
        },
      ],
    })
    console.log('  Uchta tarif yaratildi (narxlarni keyin panelda tuzatasiz)')
  }

  /*
    Platforma egasi ham `User`, ya'ni unga `clinicId` kerak.
    Uni mijoz klinikasiga bog'lab qo'ymaymiz — o'sha klinika
    o'chirilsa platforma egasi ham yo'qolardi. Shuning uchun
    alohida klinika yozuvi. Unda obuna yo'q, demak platforma
    panelidagi mijozlar ro'yxatida ko'rinmaydi.
  */
  let home = await db.clinic.findFirst({ where: { name: PLATFORM_CLINIC } })
  if (!home) {
    home = await db.clinic.create({
      data: {
        name: PLATFORM_CLINIC,
        phone,
        address: '—',
      },
    })
  }

  const user = await db.user.create({
    data: {
      clinicId: home.id,
      fullName,
      email,
      phone,
      passwordHash: await argon2.hash(password),
      role: Role.SUPERADMIN,
    },
  })

  await db.platformMember.create({
    data: {
      userId: user.id,
      position: 'Asoschi',
      permissions: [
        'clinics.view',
        'clinics.manage',
        'billing.view',
        'billing.manage',
        'data.view',
        'registry.doctors',
        'registry.patients',
        'clinics.impersonate',
        'team.manage',
      ],
    },
  })

  console.log('\nPlatforma egasi yaratildi.')
  console.log(`  email  ${email}`)
  if (generated) {
    console.log(`  parol  ${password}`)
    console.log('\n  Parol BOSHQA KO‘RSATILMAYDI. Hozir saqlab qo‘ying.')
  }
}

/* ================================================================
   2. KLINIKA
   ================================================================ */

async function bootstrapClinic() {
  const name = required('CLINIC_NAME')
  const phone = required('CLINIC_PHONE')
  const address = required('CLINIC_ADDRESS')
  const ownerEmail = required('OWNER_EMAIL').toLowerCase()
  const ownerName = required('OWNER_NAME')
  const password = process.env.OWNER_PASSWORD?.trim() || generatePassword()
  const generated = !process.env.OWNER_PASSWORD?.trim()
  const tier = (process.env.PLAN?.trim().toUpperCase() ?? 'STANDARD') as PlanTier

  const plan = await db.plan.findFirst({ where: { tier } })
  if (!plan) {
    console.error(`XATO  '${tier}' tarifi topilmadi.`)
    console.error("       Avval: npm run bootstrap -- platform")
    process.exit(1)
  }

  /*
    Email KLINIKA ICHIDA noyob, butun tizimda emas — shuning
    uchun boshqa klinikada shu email bo'lishi mumkin. Bu yerda
    esa klinika hali yo'q, ya'ni tekshiradigan narsa ham yo'q.
    Baribir ogohlantiramiz: ko'p hollarda bu adashib ikki marta
    ishga tushirilgani bo'ladi.
  */
  const clash = await db.user.findFirst({
    where: { email: ownerEmail },
    include: { clinic: { select: { name: true } } },
  })
  if (clash) {
    console.log(`Diqqat: '${ownerEmail}' allaqachon '${clash.clinic.name}' da ishlatilgan.`)
    console.log('Yangi klinika baribir yaratiladi — email klinika ichida noyob.')
  }

  const clinic = await db.clinic.create({
    data: {
      name,
      phone,
      address,
      // Dushanbadan shanbagacha 09:00–18:00. Panelda o'zgartiriladi.
      workingHours: {
        create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          open: '09:00',
          close: '18:00',
        })),
      },
    },
  })

  await db.user.create({
    data: {
      clinicId: clinic.id,
      fullName: ownerName,
      email: ownerEmail,
      phone,
      passwordHash: await argon2.hash(password),
      role: Role.OWNER,
    },
  })

  const now = new Date()
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  await db.subscription.create({
    data: {
      clinicId: clinic.id,
      status: 'ACTIVE',
      planId: plan.id,
      /*
        Narx obuna paytida MUZLATILADI: tarif keyin qimmatlashsa,
        mavjud mijozning hisobi o'z-o'zidan oshib ketmasin.
      */
      pricePerMonth: plan.pricePerMonth,
      subscribedAt: now,
      nextInvoiceAt: nextMonth,
      ownerName,
      ownerEmail,
      ownerPhone: phone,
      city: '',
    },
  })

  console.log(`\nKlinika yaratildi: ${name}`)
  console.log(`  tarif  ${plan.name}`)
  console.log(`  egasi  ${ownerEmail}`)
  if (generated) {
    console.log(`  parol  ${password}`)
    console.log('\n  Parol BOSHQA KO‘RSATILMAYDI. Hozir saqlab qo‘ying.')
  }
  console.log('\n  Registrator va shifokorlarni egasi panel orqali qo‘shadi.')
}

/* ================================================================ */

async function main() {
  const command = process.argv[2]

  if (command === 'platform') await bootstrapPlatform()
  else if (command === 'clinic') await bootstrapClinic()
  else {
    console.error('Ishlatish:  npm run bootstrap -- platform')
    console.error('            npm run bootstrap -- clinic')
    console.error('\nKerakli muhit o‘zgaruvchilari skript tepasidagi izohda.')
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
