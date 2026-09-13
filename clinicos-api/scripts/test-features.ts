import 'dotenv/config'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { AuthService } from '../src/auth/auth.service'
import { RemindersService } from '../src/notices/reminders.service'
import { PatientController } from '../src/patient/patient.controller'
import { PrismaService } from '../src/prisma/prisma.service'
import { TelegramController } from '../src/telegram/telegram.controller'
import { TelegramService } from '../src/telegram/telegram.service'

/**
 * YANGI FUNKSIYALAR SINOVI — birinchi klinikaga o'rnatishdan oldin.
 *
 * `test:crud` klassik yozish yo'llarini sinaydi. Bu yerda esa yangi
 * oqimlar, ular orasidagi bog'lanish bilan:
 *
 *   1. Telefon bilan ro'yxatdan o'tish — Telegram tasdig'i, 14 kunlik
 *      sinov, sotuv so'rovi, raqam mos kelmasa rad.
 *   2. Sinov sharti JONLI — yopiq bo'lim marshruti 403, obuna faol
 *      bo'lgach ochiladi.
 *   3. Cheklov — asosiy bo'lim ham yopiladi va qaytib ochiladi.
 *   4. Onlayn retsept — narx, monopoliyaga qarshi aylanma, taklifdan
 *      tashqari apteka rad, apteka o'ziga kelganini ko'radi.
 *   5. Yuz tasdig'i — o'zi o'tadi, boshqa odam o'tmaydi.
 *   6. Bot — eslatma 3 kun oldin "Qabul qildim" tugmasi bilan,
 *      tugma qabulni tasdiqlaydi, "Tanishib chiqdim" xabarni yopadi.
 *   7. Apteka o'zi ro'yxatdan o'tadi — PHARMACY turi, sinov, apteka paneli.
 *
 * TELEGRAM CHAQIRILMAYDI: xizmatning yuborish metodlari shu yerda
 * almashtiriladi va nima yuborilgani yozib olinadi.
 *
 * FAQAT MAHALLIY BAZADA. Sinov klinika, apteka va qabul yaratadi —
 * productionda zaxira nusxa yo'q, shuning uchun manzil tekshiriladi.
 *
 * Ishga tushirish (seed qilingan mahalliy baza kerak; server sinovning
 * o'zida ko'tariladi):
 *   npm run test:features
 */

const DB_URL = process.env.DATABASE_URL ?? ''
if (!/localhost|127\.0\.0\.1/.test(DB_URL)) {
  console.error('To‘xtatildi: bu sinov faqat MAHALLIY bazada ishlaydi.')
  process.exit(1)
}

/* Server shu jarayonning o'zida ko'tariladi (pastda) — bazaga bitta ulanish */
let BASE = ''
const PASSWORD = 'demo1234'
const RUN = Date.now().toString().slice(-7)

process.env.TELEGRAM_WEBHOOK_SECRET = 'mahalliy-sinov-kaliti'
process.env.PATIENT_WEBHOOK_SECRET = 'mahalliy-bemor-kaliti'

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

function short(value: unknown): string {
  return JSON.stringify(value)?.slice(0, 160) ?? ''
}

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

async function login(email: string, password = PASSWORD) {
  const res = await call('POST', '/auth/login', undefined, { email, password })
  return res.data as { token?: string; permissions?: string[]; restrictions?: any[]; trial?: any }
}

async function main() {
  /*
    HTTP SERVER SHU JARAYONDA. Mahalliy baza (PGlite) bitta ulanishga
    ega: alohida server va sinov jarayoni birga ishlasa, ulanish
    "kutilmaganda uzildi" bilan yiqiladi. Bitta jarayonda esa
    xizmatlar ham, HTTP ham bitta hovuzdan foydalanadi.
  */
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  /* `main.ts` dagi bilan bir xil — DTO tozalash va o'girish sinovda ham ishlasin */
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
  await app.listen(0)
  const address = app.getHttpServer().address()
  BASE = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 3000}`
  const prisma = app.get(PrismaService).acrossAllClinics()
  const telegram = app.get(TelegramService)
  const auth = app.get(AuthService)

  /* --- Telegram almashtiriladi: nima yuborilgani yozib olinadi --- */
  const sent: { to: string; text: string; markup: any; bot: string }[] = []
  const closed: { chatId: string; note: string; bot: string }[] = []
  ;(telegram as any).username = async () => 'clinicos_test_bot'
  ;(telegram as any).send = async (to: string, text: string, markup?: unknown, bot = 'staff') => {
    sent.push({ to, text, markup, bot })
  }
  ;(telegram as any).closeMessage = async (_id: string, chatId: string, _m: number, note: string, bot = 'staff') => {
    closed.push({ chatId, note, bot })
  }

  const tg = app.get(TelegramController)
  const patientTg = app.get(PatientController)

  const admin = (await login('admin@clinicos.uz')).token!

  /* ================================================================ */
  console.log('\n1. Telefon bilan ro‘yxatdan o‘tish')
  /* ================================================================ */
  const localDigits = `90${RUN}`
  const phone = `+998 ${localDigits.slice(0, 2)} ${localDigits.slice(2, 5)} ${localDigits.slice(5, 7)} ${localDigits.slice(7, 9)}`
  const telegramId = `77${RUN}`

  const started = await auth.startRegistration({
    clinicName: `Sinov Stom ${RUN}`,
    fullName: 'Sinov Egasi',
    phone: `+998${localDigits}`,
    position: 'owner',
    direction: 'dental',
    city: 'Toshkent shahri',
    staffCount: '1-5',
    password: 'sinov-parol-123',
  } as any)
  check('havola qaytdi', started.url.includes('start=reg'), started.url)
  check('raqam bir ko‘rinishga keltirildi', started.phone === phone, started.phone)

  const before = await prisma.clinic.count({ where: { name: `Sinov Stom ${RUN}` } })
  check('tasdiqlanmaguncha klinika yaratilmadi', before === 0)

  const status0 = auth.registrationStatus(started.code)
  check('holat: kutilmoqda', status0.status === 'waiting')

  /* Bot: /start reg... */
  await tg.webhook(
    { message: { chat: { id: Number(telegramId) }, from: { id: Number(telegramId) }, text: `/start ${started.code}` } },
    'mahalliy-sinov-kaliti',
  )
  check('bot raqamni ulashishni so‘radi', sent.some((m) => m.markup?.keyboard?.[0]?.[0]?.request_contact))

  /* Boshqa odamning kontakti (user_id mos emas) — o'tmaydi */
  await tg.webhook(
    {
      message: {
        chat: { id: Number(telegramId) },
        from: { id: Number(telegramId) },
        contact: { phone_number: `998${localDigits}`, user_id: 123 },
      },
    },
    'mahalliy-sinov-kaliti',
  )
  check('birovning kontakti bilan tasdiqlanmadi', auth.registrationStatus(started.code).status === 'waiting')

  /* Boshqa raqam — rad */
  await tg.webhook(
    {
      message: {
        chat: { id: Number(telegramId) },
        from: { id: Number(telegramId) },
        contact: { phone_number: '998911112233', user_id: Number(telegramId) },
      },
    },
    'mahalliy-sinov-kaliti',
  )
  check('mos kelmagan raqam rad etildi', sent.some((m) => m.text.includes('mos kelmadi')))

  /* To'g'ri raqam */
  await tg.webhook(
    {
      message: {
        chat: { id: Number(telegramId) },
        from: { id: Number(telegramId) },
        contact: { phone_number: `998${localDigits}`, user_id: Number(telegramId) },
      },
    },
    'mahalliy-sinov-kaliti',
  )

  const ready = auth.registrationStatus(started.code)
  check('tasdiqlangach sessiya tayyor', ready.status === 'ready' && Boolean(ready.session?.token))
  check('sessiya bir martalik', auth.registrationStatus(started.code).status === 'expired')

  const clinic = await prisma.clinic.findFirst({
    where: { name: `Sinov Stom ${RUN}` },
    include: { subscription: true },
  })
  check('klinika ochildi', Boolean(clinic))
  check('yo‘nalish yozildi', clinic?.direction === 'dental', clinic?.direction)
  check('sinov bo‘limlari NUSXALANMADI', !clinic?.disabledModules.includes('revenue'), short(clinic?.disabledModules))
  check('obuna TRIAL', clinic?.subscription?.status === 'TRIAL')
  const days = clinic?.subscription?.trialEndsAt
    ? Math.round((clinic.subscription.trialEndsAt.getTime() - Date.now()) / 86_400_000)
    : -1
  check('sinov ~14 kun', days >= 13 && days <= 15, String(days))

  const owner = await prisma.user.findFirst({ where: { clinicId: clinic?.id, role: 'OWNER' } })
  check('egasi Telegramga ulangan', owner?.telegramUserId === telegramId)
  const lead = await prisma.lead.findFirst({ where: { createdClinicId: clinic?.id } })
  check('sotuv so‘rovi tushdi', lead?.position === 'owner' && lead?.staffCount === '1-5' && lead?.city === 'Toshkent shahri')

  /* Band raqam bilan qayta — rad */
  let takenRejected = false
  try {
    await auth.startRegistration({
      clinicName: 'Takror',
      fullName: 'Takror Odam',
      phone: `+998${localDigits}`,
      position: 'owner',
      direction: 'general',
      password: 'sinov-parol-123',
    } as any)
  } catch {
    takenRejected = true
  }
  check('band raqam bilan ikkinchi hisob ochilmadi', takenRejected)

  /* ================================================================ */
  console.log('\n2. Sinov sharti jonli')
  /* ================================================================ */
  const trialLogin = await login(phone, 'sinov-parol-123')
  check('telefon bilan kirildi', Boolean(trialLogin.token), short(trialLogin))
  check('sinov tasmasi uchun kun soni bor', (trialLogin.trial?.daysLeft ?? 0) >= 13, short(trialLogin.trial))
  const trialReasons = (trialLogin.restrictions ?? []).filter((r: any) => r.reason === 'trial').map((r: any) => r.module)
  check('sinovda tushum yopiq', trialReasons.includes('revenue'), short(trialReasons))
  check('sinovda tushum ruxsati kesildi', !(trialLogin.permissions ?? []).includes('revenue.view'))
  const revenueBlocked = await call('GET', '/reports/revenue', trialLogin.token)
  check('yopiq bo‘lim marshruti 403', revenueBlocked.status === 403, String(revenueBlocked.status))

  const policy = await call('POST', '/platform/trial', admin, {
    direction: 'dental',
    days: 14,
    disabledModules: ['revenue', 'analytics', 'cashcontrol', 'ward', 'debts'],
  })
  check('admin stomatologiya shartini o‘zgartirdi', policy.status < 300, short(policy.data))
  const afterPolicy = await login(phone, 'sinov-parol-123')
  check('yangi shart OCHILIB BO‘LGAN klinikaga ham tushdi', (afterPolicy.restrictions ?? []).some((r: any) => r.module === 'debts'))
  const debtsBlocked = await call('GET', '/debts', afterPolicy.token)
  check('qarzdorlar yopildi (403)', debtsBlocked.status === 403, String(debtsBlocked.status))

  await prisma.subscription.update({ where: { clinicId: clinic!.id }, data: { status: 'ACTIVE' } })
  await call('POST', '/platform/trial', admin, {
    direction: 'dental',
    days: 14,
    disabledModules: ['revenue', 'analytics', 'cashcontrol', 'ward'],
  })
  const paid = await login(phone, 'sinov-parol-123')
  check('to‘lagach sinov qulflari yo‘qoldi', !(paid.restrictions ?? []).some((r: any) => r.reason === 'trial'), short(paid.restrictions))
  check('to‘lagach tushum ochildi', (paid.permissions ?? []).includes('revenue.view'))

  /* ================================================================ */
  console.log('\n3. Cheklov (asosiy bo‘lim ham)')
  /* ================================================================ */
  const shifo = await prisma.clinic.findFirst({ where: { users: { some: { email: 'owner@shifomed.uz' } } } })
  const restr = await call('POST', '/platform/access', admin, {
    module: 'patients',
    reason: 'maintenance',
    clinicId: shifo!.id,
  })
  check('bemorlar bo‘limi yopildi', restr.status < 300, short(restr.data))
  const ownerLocked = await login('owner@shifomed.uz')
  check('egasida sabab ko‘rinadi', (ownerLocked.restrictions ?? []).some((r: any) => r.module === 'patients' && r.reason === 'maintenance'))
  const patientsBlocked = await call('GET', '/patients', ownerLocked.token)
  check('bemorlar marshruti 403', patientsBlocked.status === 403, String(patientsBlocked.status))

  const list = await call('GET', '/platform/access', admin)
  const rule = (list.data?.items ?? []).find((r: any) => r.module === 'patients' && r.clinicId === shifo!.id)
  await call('DELETE', `/platform/access/${rule?.id}`, admin)
  const ownerOpen = await login('owner@shifomed.uz')
  const patientsOpen = await call('GET', '/patients', ownerOpen.token)
  check('cheklov olib tashlangach ochildi', patientsOpen.status === 200, String(patientsOpen.status))

  /* ================================================================ */
  console.log('\n4. Onlayn retsept')
  /* ================================================================ */
  /* Aylanma ko'rinishi uchun kamida 5 apteka kerak (3 taklif + 2 chetlatilgan) */
  const existingPharmacies = await prisma.clinic.count({ where: { kind: 'PHARMACY', isActive: true, deletedAt: null } })
  for (let i = existingPharmacies; i < 5; i++) {
    const ph = await prisma.clinic.create({
      data: { name: `Sinov Apteka ${RUN}-${i}`, phone: '', address: 'Toshkent', kind: 'PHARMACY' },
    })
    await prisma.medicine.create({
      data: { clinicId: ph.id, name: 'Paratsetamol', sellPrice: 5000 + i * 500 },
    })
  }

  const doctorToken = (await login('aziz.karimov@shifomed.uz')).token!
  const items = [{ name: 'Paratsetamol', qty: 2, note: 'kuniga 2 mahal' }]

  const offers = await call('POST', '/prescriptions/offers', doctorToken, { items })
  check('aptekalar taklif qilindi', Array.isArray(offers.data) && offers.data.length === 3, short(offers.data))
  check('narx oldindan hisoblangan', offers.data?.some((o: any) => o.total > 0), short(offers.data?.map((o: any) => o.total)))

  const outside = await prisma.clinic.findFirst({
    where: { kind: 'PHARMACY', id: { notIn: offers.data.map((o: any) => o.pharmacyId) } },
  })
  if (outside) {
    const bad = await call('POST', '/prescriptions', doctorToken, {
      items,
      pharmacyId: outside.id,
      offeredIds: offers.data.map((o: any) => o.pharmacyId),
    })
    check('taklifdan tashqari apteka rad etildi', bad.status === 400, String(bad.status))
  }

  const chosen = offers.data[0]
  const created = await call('POST', '/prescriptions', doctorToken, {
    items,
    pharmacyId: chosen.pharmacyId,
    offeredIds: offers.data.map((o: any) => o.pharmacyId),
    patientName: 'Sinov Bemor',
  })
  check('retsept yuborildi', created.status < 300 && /^[A-Z0-9]{6}$/.test(created.data?.code ?? ''), short(created.data))
  check('narx muzlatildi', created.data?.estimatedTotal === chosen.total, `${created.data?.estimatedTotal} / ${chosen.total}`)

  /* Aylanma: keyingi ikkita taklifda oxirgi apteka chiqmasligi kerak */
  const second = await call('POST', '/prescriptions/offers', doctorToken, { items })
  check('oxirgi yuborilgan apteka keyingi ro‘yxatda yo‘q', !second.data.some((o: any) => o.pharmacyId === chosen.pharmacyId), short(second.data.map((o: any) => o.name)))

  const mine = await call('GET', '/prescriptions', doctorToken)
  check('klinika o‘z retseptini ko‘radi', (mine.data ?? []).some((r: any) => r.id === created.data.id))

  const otherClinic = (await login('owner@salomat.uz')).token!
  const foreign = await call('GET', '/prescriptions', otherClinic)
  check('boshqa klinika ko‘rmaydi', !(foreign.data ?? []).some((r: any) => r.id === created.data.id))

  const cancelForeign = await call('POST', `/prescriptions/${created.data.id}/cancel`, otherClinic)
  check('boshqa klinika bekor qila olmaydi', cancelForeign.status === 404, String(cancelForeign.status))

  /* ================================================================ */
  console.log('\n5. Yuz tasdig‘i')
  /* ================================================================ */
  const reception = (await login('reception@shifomed.uz')).token!
  const staff = await call('GET', '/staff', (await login('owner@shifomed.uz')).token)
  const [first, second2] = (staff.data ?? []).filter((s: any) => s.status === 'active')
  const faceA = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1)
  const faceB = Array.from({ length: 128 }, (_, i) => Math.cos(i * 3) * 0.1)

  const enrollA = await call('POST', '/attendance/face', reception, { staffId: first.id, descriptors: [faceA] })
  check('registrator yuzni ro‘yxatdan o‘tkazdi', enrollA.status < 300, short(enrollA.data))
  await call('POST', '/attendance/face', reception, { staffId: second2.id, descriptors: [faceB] })

  const okVerify = await call('POST', '/attendance/face/verify', reception, { staffId: first.id, descriptor: faceA })
  check('o‘zining yuzi bilan tasdiqlandi', okVerify.status < 300 && okVerify.data?.staffId === first.id, short(okVerify.data))

  const wrongVerify = await call('POST', '/attendance/face/verify', reception, { staffId: second2.id, descriptor: faceA })
  check('boshqa odamning yuzi bilan o‘tmadi', wrongVerify.status === 404, short(wrongVerify.data))

  /* ================================================================ */
  console.log('\n6. Bot eslatmalari va tugmalar')
  /* ================================================================ */
  const patient = await prisma.patient.findFirst({ where: { clinicId: shifo!.id } })
  const patientTelegram = `66${RUN}`
  await prisma.patient.update({ where: { id: patient!.id }, data: { telegramUserId: patientTelegram } })

  const doctor = await prisma.doctor.findFirst({ where: { clinicId: shifo!.id } })
  const service = await prisma.service.findFirst({ where: { clinicId: shifo!.id } })
  const inThreeDays = new Date()
  inThreeDays.setDate(inThreeDays.getDate() + 3)
  inThreeDays.setHours(11, 0, 0, 0)

  const appointment = await prisma.appointment.create({
    data: {
      clinicId: shifo!.id,
      patientId: patient!.id,
      doctorId: doctor!.id,
      serviceId: service!.id,
      startsAt: inThreeDays,
      durationMinutes: 30,
      status: 'SCHEDULED',
      createdById: owner!.id,
    } as any,
  })

  sent.length = 0
  await (app.get(RemindersService) as any).send(3, 'REMINDER')
  const reminder = sent.find((m) => m.to === patientTelegram)
  check('3 kun oldin eslatma yuborildi', Boolean(reminder), `${sent.length} ta xabar`)
  check('eslatma bemor botidan', reminder?.bot === 'patient')
  check('"Qabul qildim" tugmasi bor', reminder?.markup?.inline_keyboard?.[0]?.[0]?.callback_data === `appt:${appointment.id}`)

  sent.length = 0
  await (app.get(RemindersService) as any).send(3, 'REMINDER')
  check('eslatma takrorlanmadi', !sent.some((m) => m.to === patientTelegram))

  /* Boshqa Telegram hisobi bosa — tasdiqlanmaydi */
  await patientTg.webhook(
    { callback_query: { id: 'q1', data: `appt:${appointment.id}`, message: { message_id: 5, chat: { id: 999 } } } },
    'mahalliy-bemor-kaliti',
  )
  const notConfirmed = await prisma.appointment.findUnique({ where: { id: appointment.id } })
  check('birovning tugmasi qabulni tasdiqlamadi', notConfirmed?.status === 'SCHEDULED')

  await patientTg.webhook(
    { callback_query: { id: 'q2', data: `appt:${appointment.id}`, message: { message_id: 6, chat: { id: Number(patientTelegram) } } } },
    'mahalliy-bemor-kaliti',
  )
  const confirmed = await prisma.appointment.findUnique({ where: { id: appointment.id } })
  check('"Qabul qildim" qabulni tasdiqladi', confirmed?.status === 'CONFIRMED', confirmed?.status)
  check('xabar yopildi', closed.some((c) => c.bot === 'patient' && c.note.includes('tasdiqlandi')))

  closed.length = 0
  await tg.webhook(
    { callback_query: { id: 'q3', data: 'ack', message: { message_id: 7, chat: { id: 555 } } } },
    'mahalliy-sinov-kaliti',
  )
  check('"Tanishib chiqdim" xodim xabarini yopdi', closed.some((c) => c.bot === 'staff'))

  closed.length = 0
  await tg.webhook(
    { callback_query: { id: 'q4', data: 'ack', message: { message_id: 8, chat: { id: 555 } } } },
    'noto‘g‘ri-kalit',
  )
  check('maxfiy kalitsiz webhook e’tiborsiz qoldi', closed.length === 0)

  /* ================================================================ */
  console.log('\n7. Apteka o‘zi ro‘yxatdan o‘tadi')
  /* ================================================================ */
  const pharmacyDigits = `93${RUN}`
  const pharmacyTg = `78${RUN}`
  const pharmacyStart = await auth.startRegistration({
    clinicName: `Sinov Dorixona ${RUN}`,
    fullName: 'Apteka Egasi',
    phone: `+998${pharmacyDigits}`,
    position: 'pharmacist',
    direction: 'pharmacy',
    city: 'Toshkent shahri',
    password: 'sinov-parol-123',
  } as any)
  await tg.webhook(
    { message: { chat: { id: Number(pharmacyTg) }, from: { id: Number(pharmacyTg) }, text: `/start ${pharmacyStart.code}` } },
    'mahalliy-sinov-kaliti',
  )
  await tg.webhook(
    {
      message: {
        chat: { id: Number(pharmacyTg) },
        from: { id: Number(pharmacyTg) },
        contact: { phone_number: `998${pharmacyDigits}`, user_id: Number(pharmacyTg) },
      },
    },
    'mahalliy-sinov-kaliti',
  )
  const pharmacyReady = auth.registrationStatus(pharmacyStart.code)
  check('apteka: sessiya tayyor', pharmacyReady.status === 'ready', short(pharmacyReady.status))

  const pharmacy = await prisma.clinic.findFirst({
    where: { name: `Sinov Dorixona ${RUN}` },
    include: { subscription: true },
  })
  check('apteka turi PHARMACY', pharmacy?.kind === 'PHARMACY', pharmacy?.kind)
  check('apteka sinov obunasi', pharmacy?.subscription?.status === 'TRIAL')
  const pharmacyStaff = await prisma.pharmacyStaff.findFirst({ where: { clinicId: pharmacy?.id } })
  check('apteka egasi xodim sifatida ochildi', pharmacyStaff?.role === 'PHARMACY_OWNER' && Boolean(pharmacyStaff?.userId))

  const pharmacyLogin = (await call('POST', '/auth/login', undefined, {
    email: `+998${pharmacyDigits}`,
    password: 'sinov-parol-123',
  })).data as any
  check('apteka egasi telefon bilan kirdi', Boolean(pharmacyLogin?.token), short(pharmacyLogin))
  check('rol pharmacy_owner', pharmacyLogin?.user?.role === 'pharmacy_owner', pharmacyLogin?.user?.role)
  check('apteka sinov tasmasi', (pharmacyLogin?.trial?.daysLeft ?? 0) >= 13)
  const pharmacyTrial = (pharmacyLogin?.restrictions ?? []).map((r: any) => r.module)
  check('apteka sinovida tahlil yopiq', pharmacyTrial.includes('pharmacyanalytics'), short(pharmacyTrial))
  const pharmacyStaffList = await call('GET', '/pharmacy/staff', pharmacyLogin?.token)
  check('apteka xodimlar ro‘yxati ochiladi', pharmacyStaffList.status === 200, String(pharmacyStaffList.status))
  const pharmacyAnalytics = await call('GET', '/pharmacy/analytics', pharmacyLogin?.token)
  check('apteka tahlili sinovda 403', pharmacyAnalytics.status === 403, String(pharmacyAnalytics.status))

  const tenants = await call('GET', '/platform/tenants', admin)
  const tenantNames = JSON.stringify(tenants.data)
  check('apteka klinikalar ro‘yxatiga aralashmadi', !tenantNames.includes(`Sinov Dorixona ${RUN}`))

  await app.close()
  console.log(`\n${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
