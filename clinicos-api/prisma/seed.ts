import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Role } from '@prisma/client'
import * as argon2 from 'argon2'

/**
 * Boshlang'ich ma'lumot.
 *
 * IKKI KLINIKA ATAYLAB yaratiladi. Bitta klinika bilan ajratishni
 * sinab bo'lmaydi: filtr umuman ishlamasa ham hamma narsa
 * to'g'ridek ko'rinadi. Ikkinchi klinika — bu tekshiruvning
 * o'lchov asbobi.
 *
 * Ishga tushirish:  npm run db:seed
 */

/**
 * Ismdan email yasash: "Aziz Karimov" -> "aziz.karimov"
 *
 * Frontenddagi demo hisoblar ro'yxati shifokorni AYNAN shunday
 * kutadi (`aziz.karimov@shifomed.uz`). Nomlar farq qilsa, kirish
 * sahifasidagi "Shifokor" tugmasi ishlamaydi.
 */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/\s+/g, '.')
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const PASSWORD = 'demo1234'

async function main() {
  console.log('Tozalanmoqda…')

  /*
    Tartib MUHIM: bola jadvallar avval o'chiriladi.

    Ko'p jadval `User` ga bog'langan (davomatni kim belgilagani,
    smenani kim yopgani, bonusni kim bergani). Foydalanuvchini
    ulardan oldin o'chirsak, baza tashqi kalit xatosini beradi.
  */
  await db.impersonationLog.deleteMany()
  await db.tenantInvoice.deleteMany()
  await db.subscription.deleteMany()
  await db.platformMember.deleteMany()
  await db.plan.deleteMany()

  await db.penaltyWaiver.deleteMany()
  await db.penalty.deleteMany()
  await db.penaltyRule.deleteMany()
  await db.bonus.deleteMany()
  await db.bonusRule.deleteMany()
  await db.attendance.deleteMany()
  await db.shiftClosure.deleteMany()

  await db.chatMessageRead.deleteMany()
  await db.chatMessage.deleteMany()
  await db.chatGroupMember.deleteMany()
  await db.chatGroup.deleteMany()

  await db.admission.deleteMany()
  await db.bed.deleteMany()
  await db.room.deleteMany()

  await db.feedback.deleteMany()
  await db.followUp.deleteMany()
  await db.payment.deleteMany()
  await db.visit.deleteMany()
  await db.appointment.deleteMany()
  await db.patient.deleteMany()

  await db.serviceLoyaltyTier.deleteMany()
  await db.service.deleteMany()

  await db.auditLog.deleteMany()
  await db.notification.deleteMany()

  // Xodim foydalanuvchiga bog'langan — u avval ketadi
  await db.staff.deleteMany()
  await db.session.deleteMany()
  await db.user.deleteMany()
  await db.doctor.deleteMany()
  await db.workingHour.deleteMany()
  await db.clinic.deleteMany()

  const hash = await argon2.hash(PASSWORD)

  const a = await seedClinic({
    name: 'Shifo Med',
    phone: '+998 71 200 10 10',
    address: 'Toshkent, Chilonzor 12',
    emailDomain: 'shifomed.uz',
    doctorName: 'Aziz Karimov',
    patients: ['Zilola Nazarova', 'Behruz Yusupov', 'Malika Tosheva'],
    hash,
  })

  const b = await seedClinic({
    name: 'Salomat Klinika',
    phone: '+998 71 300 20 20',
    address: 'Samarqand, Registon 4',
    emailDomain: 'salomat.uz',
    doctorName: 'Dilnoza Rahimova',
    patients: ['Otabek Sobirov', 'Nigora Ergasheva'],
    hash,
  })

  /* ---------------- Platforma qatlami ---------------- */

  const plans = await Promise.all([
    db.plan.create({
      data: {
        tier: 'STARTER',
        name: 'Boshlang‘ich',
        pricePerMonth: 1_200_000,
        limitDoctors: 3,
        limitStaff: 10,
        features: ['analytics'],
      },
    }),
    db.plan.create({
      data: {
        tier: 'STANDARD',
        name: 'Standart',
        pricePerMonth: 2_500_000,
        limitDoctors: 10,
        limitStaff: 40,
        features: ['analytics', 'staff', 'cashControl', 'chat'],
      },
    }),
    db.plan.create({
      data: {
        tier: 'PREMIUM',
        name: 'Premium',
        pricePerMonth: 4_500_000,
        // -1 = cheksiz
        limitDoctors: -1,
        limitStaff: -1,
        features: ['analytics', 'staff', 'cashControl', 'chat', 'ward', 'api'],
      },
    }),
  ])

  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  for (const [index, tenant] of [a, b].entries()) {
    const plan = plans[index === 0 ? 1 : 0]

    const sub = await db.subscription.create({
      data: {
        clinicId: tenant.id,
        status: 'ACTIVE',
        planId: plan.id,
        // Narx obuna paytida MUZLATILADI — tarif qimmatlashsa
        // mavjud mijozning hisobi o'z-o'zidan oshib ketmasin
        pricePerMonth: plan.pricePerMonth,
        subscribedAt: new Date('2025-06-15'),
        trialEndsAt: new Date('2025-06-14'),
        nextInvoiceAt: nextMonth,
        ownerName: tenant.ownerName,
        ownerEmail: 'owner@' + tenant.domain,
        ownerPhone: '+998 90 000 00 00',
        city: tenant.city,
      },
    })

    await db.tenantInvoice.create({
      data: {
        subscriptionId: sub.id,
        period: today.toISOString().slice(0, 7),
        planName: plan.name,
        amount: plan.pricePerMonth,
        status: index === 0 ? 'PAID' : 'PENDING',
        issuedAt: today,
        dueAt: nextMonth,
        paidAt: index === 0 ? today : null,
      },
    })
  }

  /*
    Platforma egasi.

    U ham `User`, lekin roli SUPERADMIN va ruxsatlari butunlay
    boshqa: klinika ichidagi ishga tegishi yo'q, faqat
    klinikalarni boshqaradi.
  */
  const superUser = await db.user.create({
    data: {
      clinicId: a.id,
      fullName: 'Anvar Ahmadjonov',
      email: 'admin@clinicos.uz',
      phone: '+998 97 853 83 14',
      passwordHash: hash,
      role: Role.SUPERADMIN,
    },
  })

  await db.platformMember.create({
    data: {
      userId: superUser.id,
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

  console.log('')
  console.log('  Platforma: ' + plans.length + ' tarif, 2 obuna')
  console.log('    platforma egasi  admin@clinicos.uz')

  console.log('\nTayyor. Kirish uchun (parol hamma hisobda: ' + PASSWORD + ')')
  for (const c of [a, b]) {
    console.log(`\n  ${c.name}`)
    console.log(`    egasi        owner@${c.domain}`)
    console.log(`    registrator  reception@${c.domain}`)
    console.log(`    shifokor     ${c.doctorLogin}`)
  }
}

async function seedClinic(input: {
  name: string
  phone: string
  address: string
  emailDomain: string
  doctorName: string
  patients: string[]
  hash: string
}) {
  const clinic = await db.clinic.create({
    data: {
      name: input.name,
      phone: input.phone,
      address: input.address,
      workingHours: {
        create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          open: '09:00',
          close: '18:00',
        })),
      },
    },
  })

  const doctor = await db.doctor.create({
    data: {
      clinicId: clinic.id,
      fullName: input.doctorName,
      specialty: 'therapist',
      phone: input.phone,
      email: `${slug(input.doctorName)}@${input.emailDomain}`,
      consultationFee: 150_000,
      workdays: [1, 2, 3, 4, 5],
      shiftStart: '09:00',
      shiftEnd: '18:00',
      hiredAt: new Date('2024-01-15'),
    },
  })

  await db.user.createMany({
    data: [
      {
        clinicId: clinic.id,
        fullName: 'Egasi ' + input.name,
        email: `owner@${input.emailDomain}`,
        phone: input.phone,
        passwordHash: input.hash,
        role: Role.OWNER,
      },
      {
        clinicId: clinic.id,
        fullName: 'Registrator ' + input.name,
        email: `reception@${input.emailDomain}`,
        phone: input.phone,
        passwordHash: input.hash,
        role: Role.RECEPTIONIST,
      },
    ],
  })

  await db.user.create({
    data: {
      clinicId: clinic.id,
      fullName: input.doctorName,
      email: `${slug(input.doctorName)}@${input.emailDomain}`,
      phone: input.phone,
      passwordHash: input.hash,
      role: Role.DOCTOR,
      doctorId: doctor.id,
    },
  })

  /*
    HAR BIR foydalanuvchiga xodim yozuvi.

    Davomat, oylik, bonus va jarima — hammasi `Staff` ga bog'langan.
    Foydalanuvchi bor, xodim yozuvi yo'q bo'lsa, o'sha odam
    tizimda ishlaydi-yu, oyligi hisoblanmaydi.
  */
  const users = await db.user.findMany({ where: { clinicId: clinic.id } })
  for (const user of users) {
    const isDoctor = user.role === Role.DOCTOR
    await db.staff.create({
      data: {
        clinicId: clinic.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        position: isDoctor ? 'DOCTOR' : user.role === Role.OWNER ? 'MANAGER' : 'RECEPTIONIST',
        positionTitle: isDoctor ? 'Shifokor' : user.role === Role.OWNER ? 'Direktor' : 'Registrator',
        workdays: [1, 2, 3, 4, 5],
        shiftStart: '09:00',
        shiftEnd: '18:00',
        payType: isDoctor ? 'SALARY_PERCENT' : 'SALARY',
        percentRate: isDoctor ? 30 : 0,
        salary: isDoctor ? 6_000_000 : user.role === Role.OWNER ? 12_000_000 : 4_500_000,
        hiredAt: new Date('2024-02-01'),
        hasSystemAccess: true,
        userId: user.id,
        doctorId: isDoctor ? doctor.id : null,
      },
    })
  }

  const service = await db.service.create({
    data: {
      clinicId: clinic.id,
      name: 'Terapevt qabuli',
      category: 'consultation',
      price: 150_000,
      durationMinutes: 30,
    },
  })

  for (const [i, fullName] of input.patients.entries()) {
    await db.patient.create({
      data: {
        clinicId: clinic.id,
        fullName,
        // Telefon klinika ICHIDA noyob — ikki klinikada bir xil
        // raqam bo'lishi mumkin va bu to'g'ri
        phone: `+998 90 000 00 ${String(i + 1).padStart(2, '0')}`,
        birthDate: new Date('1990-05-20'),
        gender: i % 2 === 0 ? 'FEMALE' : 'MALE',
        primaryDoctorId: doctor.id,
      },
    })
  }

  console.log(
    `  ${input.name}: ${input.patients.length} bemor, 3 foydalanuvchi va xodim, 1 xizmat`,
  )

  return {
    id: clinic.id,
    name: input.name,
    domain: input.emailDomain,
    serviceId: service.id,
    ownerName: 'Egasi ' + input.name,
    doctorLogin: `${slug(input.doctorName)}@${input.emailDomain}`,
    city: input.address.split(',')[0].trim(),
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
