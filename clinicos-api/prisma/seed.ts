import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Role } from '@prisma/client'
import * as argon2 from 'argon2'
import { termTotal } from '../src/common/billing'
import { CLINIC_MODULES } from '../src/common/modules'

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
  /*
    Apteka — birinchi: sotuv qatori partiyaga `RESTRICT` bilan
    bog'langan, klinika o'chirilganda kaskad tartibi kafolatlanmaydi.
  */
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.purchaseItem.deleteMany()
  await db.medicineBatch.deleteMany()
  await db.purchase.deleteMany()
  await db.supplier.deleteMany()
  await db.medicine.deleteMany()
  await db.prescription.deleteMany()
  await db.pharmacyShift.deleteMany()
  await db.pharmacyStaff.deleteMany()

  await db.impersonationLog.deleteMany()
  await db.tenantInvoice.deleteMany()
  await db.subscription.deleteMany()
  await db.platformMember.deleteMany()
  await db.plan.deleteMany()
  await db.billingTerm.deleteMany()

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

  /*
    To'lov statsionar yotqizishiga ham bog'langan bo'lishi mumkin,
    shuning uchun to'lovlar YOTQIZISHDAN OLDIN o'chiriladi. Teskari
    tartibda baza tashqi kalit xatosini beradi va seed to'xtaydi.
  */
  await db.feedback.deleteMany()
  await db.followUp.deleteMany()
  await db.payment.deleteMany()

  await db.admission.deleteMany()
  await db.bed.deleteMany()
  await db.room.deleteMany()

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

  /*
    APTEKA — klinikalardan ALOHIDA mijoz. Klinikalardan KEYIN
    yaratiladi: ajratish testi birinchi ikkita yozuvni klinika deb oladi.
  */
  await seedPharmacy(hash)

  /* ---------------- Platforma qatlami ---------------- */

  const plans = await Promise.all([
    db.plan.create({
      data: {
        tier: 'STARTER',
        name: 'Boshlang‘ich',
        basePrice: 3_600_000,
        limitDoctors: 3,
        limitStaff: 10,
        features: ['cashcontrol', 'attendance', 'chat', 'calendar'],
        supportLevel: 'queue',
      },
    }),
    db.plan.create({
      data: {
        tier: 'STANDARD',
        name: 'Standart',
        basePrice: 7_500_000,
        limitDoctors: 10,
        limitStaff: 40,
        features: [
          'cashcontrol',
          'attendance',
          'chat',
          'calendar',
          'ward',
          'analytics',
          'feedback',
          'debts',
        ],
        supportLevel: 'fast',
      },
    }),
    db.plan.create({
      data: {
        tier: 'PREMIUM',
        name: 'Premium',
        basePrice: 13_500_000,
        // -1 = cheksiz
        limitDoctors: -1,
        limitStaff: -1,
        features: [...CLINIC_MODULES],
        supportLevel: 'manager',
      },
    }),
  ])

  /*
    To'lov muddatlari va chegirmalari.

    Chegirma MUDDATGA biriktirilgan, tarifga emas: "6 oy — 10%"
    barcha tariflarga bir xil qo'llanadi.
  */
  await db.billingTerm.createMany({
    data: [
      { months: 3, discountPct: 0 },
      { months: 6, discountPct: 10 },
      { months: 12, discountPct: 20 },
    ],
  })

  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  for (const [index, tenant] of [a, b].entries()) {
    const plan = plans[index === 0 ? 1 : 0]

    /* Birinchisi 6 oyga (10% chegirma bilan), ikkinchisi 3 oyga */
    const termMonths = index === 0 ? 6 : 3
    const discountPct = index === 0 ? 10 : 0

    const sub = await db.subscription.create({
      data: {
        clinicId: tenant.id,
        status: 'ACTIVE',
        planId: plan.id,
        // Narx obuna paytida MUZLATILADI — tarif qimmatlashsa
        // mavjud mijozning hisobi o'z-o'zidan oshib ketmasin
        termPrice: termTotal(plan.basePrice, termMonths, discountPct),
        termMonths,
        discountPct,
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
        amount: sub.termPrice,
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

/* ------------------------------------------------------------------ */
/* Apteka                                                              */
/* ------------------------------------------------------------------ */

/** Mahalliy sana (`offset` kun) — `@db.Date` ustuni uchun */
function dayOnly(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const pad = (n: number) => String(n).padStart(2, '0')
  return new Date(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`)
}

/** Kun ichidagi vaqt (`offset` kun oldin, soat:daqiqa) */
function at(offset: number, hour: number, minute: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/**
 * Demo apteka.
 *
 * Loginlar frontenddagi demo hisoblar bilan BIR XIL
 * (`apteka@clinic-os.uz`, `apteka.rahbar@clinic-os.uz`) — kirish
 * sahifasidagi tugmalar haqiqiy server bilan ham ishlasin.
 *
 * Tasodif QAT'IY urug' bilan: har seed bir xil ma'lumot beradi,
 * xato qayta tiklanadigan bo'lsin.
 */
async function seedPharmacy(hash: string) {
  let state = 20260911
  const rand = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]

  const clinic = await db.clinic.create({
    data: {
      kind: 'PHARMACY',
      name: 'Sog‘lom dorixonasi',
      phone: '+998 71 250 30 30',
      address: 'Chilonzor tumani, Bunyodkor ko‘chasi 12',
      city: 'Toshkent',
    },
  })
  const clinicId = clinic.id

  const people = [
    { fullName: 'Gulnora Yusupova', email: 'apteka.rahbar@clinic-os.uz', role: Role.PHARMACY_OWNER, start: '09:00', end: '18:00', receive: true, salary: 7_000_000 },
    { fullName: 'Dilshod Raximov', email: 'apteka@clinic-os.uz', role: Role.PHARMACIST, start: '08:00', end: '15:00', receive: true, salary: 4_500_000 },
    { fullName: 'Ozoda Qodirova', email: 'apteka2@clinic-os.uz', role: Role.PHARMACIST, start: '15:00', end: '21:00', receive: false, salary: 4_200_000 },
  ]

  const staff = []
  for (const [i, p] of people.entries()) {
    const user = await db.user.create({
      data: {
        clinicId,
        fullName: p.fullName,
        email: p.email,
        phone: `+998 90 555 00 0${i + 1}`,
        passwordHash: hash,
        role: p.role,
        extraPermissions: p.role === Role.PHARMACIST && p.receive ? ['pharmacy.receive'] : [],
      },
    })
    staff.push(
      await db.pharmacyStaff.create({
        data: {
          clinicId,
          fullName: p.fullName,
          phone: user.phone,
          login: p.email,
          role: p.role,
          salary: p.salary,
          workdays: [1, 2, 3, 4, 5, 6],
          shiftStart: p.start,
          shiftEnd: p.end,
          hiredAt: dayOnly(-420 + i * 60),
          canReceive: p.receive,
          userId: user.id,
        },
      }),
    )
  }
  const [owner, dilshod, ozoda] = staff

  const supplier = await db.supplier.create({
    data: { clinicId, name: 'Grand Pharm Trade', phone: '+998 71 150 40 40', inn: '305112233' },
  })

  const catalog: [string, 'TABLET' | 'CAPSULE' | 'SYRUP' | 'DROPS' | 'OINTMENT', string, number, boolean, number, number][] = [
    // nomi, shakli, ishlab chiqaruvchi, sotuv narxi, retseptli, qoldiq, muddatigacha kun
    ['Paratsetamol 500 mg', 'TABLET', 'Nika Pharm', 3_500, false, 120, 420],
    ['Amoksitsillin 500 mg', 'CAPSULE', 'Jurabek Laboratories', 18_000, true, 45, 300],
    ['Ibuprofen 400 mg', 'TABLET', 'Radiks', 9_000, false, 80, 510],
    ['No-shpa 40 mg', 'TABLET', 'Sanofi', 24_000, false, 8, 260],
    ['Sitramon', 'TABLET', 'Nika Pharm', 4_000, false, 60, 45],
    ['Nurofen sirop', 'SYRUP', 'Reckitt', 38_000, false, 22, 190],
    ['Otipaks tomchi', 'DROPS', 'Biocodex', 52_000, false, 15, 70],
    ['Vishnevskiy malhami', 'OINTMENT', 'Tula Pharm', 12_000, false, 30, 600],
  ]

  const purchase = await db.purchase.create({
    data: {
      clinicId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      invoiceNumber: 'GP-2026/0917',
      receivedAt: dayOnly(-20),
      total: 0,
      payment: 'PARTIAL',
      paidAmount: 0,
      dueDate: dayOnly(10),
      receivedById: dilshod.id,
      receivedByName: dilshod.fullName,
      note: 'Oylik buyurtma',
    },
  })

  const medicines = []
  let purchaseTotal = 0
  for (const [name, form, maker, price, rx, qty, expiresIn] of catalog) {
    const buyPrice = Math.round((price * 0.72) / 100) * 100
    const medicine = await db.medicine.create({
      data: {
        clinicId,
        name,
        form,
        manufacturer: maker,
        country: 'O‘zbekiston',
        barcode: `47800${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`,
        prescriptionOnly: rx,
        sellPrice: price,
      },
    })
    const batch = await db.medicineBatch.create({
      data: {
        clinicId,
        medicineId: medicine.id,
        code: `B${String(Math.floor(rand() * 1e5)).padStart(5, '0')}`,
        expiresAt: dayOnly(expiresIn),
        quantity: qty,
        buyPrice,
        supplierId: supplier.id,
        purchaseId: purchase.id,
        receivedAt: dayOnly(-20),
      },
    })
    await db.purchaseItem.create({
      data: {
        clinicId,
        purchaseId: purchase.id,
        medicineId: medicine.id,
        medicineName: name,
        batchCode: batch.code,
        expiresAt: batch.expiresAt,
        quantity: qty + 40,
        buyPrice,
        sellPrice: price,
      },
    })
    purchaseTotal += buyPrice * (qty + 40)
    medicines.push({ medicine, batch })
  }
  await db.purchase.update({
    where: { id: purchase.id },
    data: { total: purchaseTotal, paidAmount: Math.round(purchaseTotal / 2) },
  })

  /* Muddati o'tgan, lekin javonda qolib ketgan partiya — nazorat buni ushlashi kerak */
  await db.medicineBatch.create({
    data: {
      clinicId,
      medicineId: medicines[4].medicine.id,
      code: 'B00417',
      expiresAt: dayOnly(-12),
      quantity: 6,
      buyPrice: 2_900,
      supplierId: supplier.id,
      receivedAt: dayOnly(-400),
    },
  })

  /* Oxirgi 10 kun savdosi — bugun ham */
  for (let day = -9; day <= 0; day++) {
    const count = day === 0 ? 3 : 4 + Math.floor(rand() * 4)
    for (let n = 0; n < count; n++) {
      const seller = n % 2 === 0 ? dilshod : ozoda
      const lines = [pick(medicines), pick(medicines)].filter(
        (line, index, all) => all.findIndex((x) => x.batch.id === line.batch.id) === index,
      )
      const items = lines.map(({ medicine, batch }) => ({
        clinicId,
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchId: batch.id,
        quantity: 1 + Math.floor(rand() * 2),
        price: medicine.sellPrice,
        buyPrice: batch.buyPrice,
      }))
      const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
      await db.sale.create({
        data: {
          clinicId,
          soldAt: day === 0 ? at(0, 8, 15 + n * 5) : at(day, seller === dilshod ? 10 : 17, 10 + n * 7),
          total,
          discount: 0,
          method: rand() < 0.7 ? 'CASH' : 'CARD',
          soldById: seller.id,
          soldByName: seller.fullName,
          items: { create: items },
        },
      })
    }

    /* Kechagi va undan oldingi kunlar — smena yopilgan */
    if (day < 0) {
      const difference = day === -3 ? -8_000 : day === -6 ? 2_000 : 0
      await db.pharmacyShift.create({
        data: {
          clinicId,
          sellerId: ozoda.id,
          sellerName: ozoda.fullName,
          date: dayOnly(day),
          periodStart: at(day, 0, 0),
          expectedCash: 150_000,
          countedCash: 150_000 + difference,
          difference,
          cardTotal: 60_000,
          receipts: 5,
          note: difference < 0 ? 'Qaytim xatosi' : '',
          flagged: difference < -5_000,
          closedAt: at(day, 21, 5),
        },
      })
    }
  }

  const rxPatients = ['Zarina Tursunova', 'Ulug‘bek Ergashev', 'Farrux Yusupov', 'Sevara Aliyeva']
  for (const [i, patientName] of rxPatients.entries()) {
    await db.prescription.create({
      data: {
        clinicId,
        patientName,
        doctorName: 'Jasur Ibragimov',
        items: [
          { medicineName: 'Amoksitsillin 500 mg', dosage: '1 kapsuladan kuniga 2 mahal, 7 kun', quantity: 2 },
          { medicineName: 'Paratsetamol 500 mg', dosage: 'Harorat 38° dan oshsa, 1 tabletka', quantity: 1 },
        ],
        status: i === 3 ? 'DISPENSED' : 'PENDING',
        dispensedAt: i === 3 ? at(-2, 11, 0) : null,
        dispensedById: i === 3 ? dilshod.id : null,
        createdAt: at(-i, 9, 30),
      },
    })
  }

  console.log(`  ${clinic.name} (apteka): 3 xodim, ${medicines.length} dori, 10 kunlik savdo`)
  console.log(`    apteka rahbari  ${owner.login}`)
  console.log(`    farmatsevt      ${dilshod.login}, ${ozoda.login}`)
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
