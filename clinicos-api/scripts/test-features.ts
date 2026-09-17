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
 *   8. Kirim-chiqim — yozish, kassaga ta'sir, bekor qilish, ruxsatlar; buxgalter "Xodim" roli bilan.
 *   9. Bemorga "qabulga yozildingiz", kartasi keyin ochilgan bot foydalanuvchisi, egaga kirim-chiqim xabari.
 *  10. Dam olish kunlari — yangi qabul rad, ko'chirish boshqa kunga va shifokorga, band vaqt va bayram.
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
    login: `sinov.stom${RUN}@clinic-os.uz`,
    password: 'sinov-parol-123',
  } as any)
  check('havola qaytdi', started.url.includes('start=reg'), started.url)
  check('login javobda', started.login === `sinov.stom${RUN}@clinic-os.uz`, started.login)

  /* Band login — Telegram qadamidan OLDIN rad */
  let loginTakenRejected = false
  try {
    await auth.startRegistration({
      clinicName: 'Band login',
      fullName: 'Boshqa Odam',
      phone: '+998971234560',
      position: 'owner',
      direction: 'general',
      login: `boshqa.odam${RUN}@clinic-os.uz`,
      password: 'sinov-parol-123',
    } as any)
    const again = await auth.startRegistration({
      clinicName: 'Band login 2',
      fullName: 'Uchinchi Odam',
      phone: '+998971234561',
      position: 'owner',
      direction: 'general',
      login: `sinov.stom${RUN}@clinic-os.uz`,
      password: 'sinov-parol-123',
    } as any)
    void again
  } catch {
    loginTakenRejected = true
  }
  check('kutilayotgan login boshqa raqamga berilmaydi', loginTakenRejected)
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
  check('egasi o‘zi yozgan login bilan', owner?.email === `sinov.stom${RUN}@clinic-os.uz`, owner?.email)
  check('admin panel uchun ownerEmail', clinic?.subscription?.ownerEmail === `sinov.stom${RUN}@clinic-os.uz`, clinic?.subscription?.ownerEmail)
  check('bot loginni yozib yubordi', sent.some((m) => m.text.includes(`sinov.stom${RUN}@clinic-os.uz`)))
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
  const byLogin = await login(`sinov.stom${RUN}@clinic-os.uz`, 'sinov-parol-123')
  check('login bilan ham kirildi', Boolean(byLogin.token), short(byLogin))
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
    login: `sinov.dorixona${RUN}@clinic-os.uz`,
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
  /* Sinov aptekasi o'chiriladi — dorisiz apteka keyingi yurishda retsept takliflariga tushib qolardi */
  if (pharmacy) await prisma.clinic.update({ where: { id: pharmacy.id }, data: { isActive: false } })

  /* ================================================================ */
  console.log('\n8. Kirim-chiqim va xodim roli')
  /* ================================================================ */
  const today = localDay(new Date())
  const range = `from=${today}&to=${today}`
  const financeOwner = (await login('owner@shifomed.uz')).token!

  const financeBefore = (await call('GET', `/finance/summary?${range}`, financeOwner)).data
  check('egasi hisobotni ko‘radi', typeof financeBefore?.net === 'number', short(financeBefore))

  const rent = await call('POST', '/finance/entries', financeOwner, {
    type: 'expense', category: 'rent', amount: 1_000_000, method: 'transfer', counterparty: 'Sinov ijara',
  })
  check('egasi chiqim yozdi', rent.status === 201 && Boolean(rent.data?.createdByName), short(rent.data))

  const financeAfter = (await call('GET', `/finance/summary?${range}`, financeOwner)).data
  check('chiqim hisobotga tushdi', financeAfter?.expense?.total === financeBefore.expense.total + 1_000_000, `${financeAfter?.expense?.total}`)

  const wrongCategory = await call('POST', '/finance/entries', financeOwner, {
    type: 'income', category: 'rent', amount: 5000, method: 'cash',
  })
  check('turi yo‘nalishga mos kelmasa rad', wrongCategory.status === 400, String(wrongCategory.status))

  const future = await call('POST', '/finance/entries', financeOwner, {
    type: 'expense', category: 'other', amount: 5000, method: 'cash', occurredAt: '2099-01-01T10:00:00Z',
  })
  check('kelajakdagi sana rad', future.status === 400, String(future.status))

  const foreignReceipt = await call('POST', '/finance/entries', financeOwner, {
    type: 'expense', category: 'other', amount: 5000, method: 'cash',
    receipts: ['clinics/00000000-0000-0000-0000-000000000000/finance/00000000-0000-0000-0000-000000000000.jpg'],
  })
  check('begona klinika rasmi biriktirilmaydi', foreignReceipt.status === 400, String(foreignReceipt.status))
  const tooMany = await call('POST', '/finance/entries', financeOwner, {
    type: 'expense', category: 'other', amount: 5000, method: 'cash', receipts: Array.from({ length: 11 }, (_, i) => `x${i}`),
  })
  check('10 tadan ortiq rasm rad', tooMany.status === 400, String(tooMany.status))
  check('yozuvda rasmlar ro‘yxati qaytadi', Array.isArray(rent.data?.receipts), short(rent.data?.receipts))

  /* Registrator — standart holatda yo'q, egasi bergach faqat yozadi */
  const receptionUser = await prisma.user.findFirstOrThrow({ where: { email: 'reception@shifomed.uz' } })
  const receptionToken = (await login('reception@shifomed.uz')).token!
  const noAccess = await call('POST', '/finance/entries', receptionToken, {
    type: 'expense', category: 'transport', amount: 30_000, method: 'cash',
  })
  check('registratorda standart ruxsat yo‘q', noAccess.status === 403, String(noAccess.status))

  await prisma.user.update({
    where: { id: receptionUser.id },
    data: { extraPermissions: [...receptionUser.extraPermissions, 'finance.create'] },
  })
  try {
    const cashBefore = (await call('GET', '/shifts/current', receptionToken)).data?.expectedCash
    const taxi = await call('POST', '/finance/entries', receptionToken, {
      type: 'expense', category: 'transport', amount: 30_000, method: 'cash', counterparty: 'Taksi',
    })
    check('ruxsat berilgach registrator yozdi', taxi.status === 201, short(taxi.data))

    const cashAfter = (await call('GET', '/shifts/current', receptionToken)).data?.expectedCash
    check('kassadan naqd chiqim kutilgan naqdni kamaytirdi', cashAfter === cashBefore - 30_000, `${cashBefore} → ${cashAfter}`)

    const mine = await call('GET', `/finance/my-entries?${range}`, receptionToken)
    check('registrator faqat o‘z yozuvini ko‘radi', mine.status === 200 && mine.data.every((e: any) => e.createdById === receptionUser.id) && mine.data.some((e: any) => e.id === taxi.data.id), short(mine.data?.length))
    check('registrator umumiy hisobotni ko‘rmaydi', (await call('GET', `/finance/summary?${range}`, receptionToken)).status === 403)
    check('registrator bekor qila olmaydi', (await call('POST', `/finance/entries/${taxi.data.id}/void`, receptionToken, { reason: 'xato yozildi' })).status === 403)

    const otherOwner = (await login('owner@salomat.uz')).token!
    const foreignVoid = await call('POST', `/finance/entries/${taxi.data.id}/void`, otherOwner, { reason: 'begona klinika' })
    check('boshqa klinika bekor qila olmaydi', foreignVoid.status === 404, String(foreignVoid.status))
    const foreignList = await call('GET', `/finance/entries?${range}`, otherOwner)
    check('boshqa klinika yozuvni ko‘rmaydi', !(foreignList.data ?? []).some((e: any) => e.id === taxi.data.id))

    const noReason = await call('POST', `/finance/entries/${taxi.data.id}/void`, financeOwner, { reason: '' })
    check('sababsiz bekor qilinmaydi', noReason.status === 400, String(noReason.status))
    const voided = await call('POST', `/finance/entries/${taxi.data.id}/void`, financeOwner, { reason: 'Ikki marta yozilgan' })
    check('egasi bekor qildi', voided.status === 201 && Boolean(voided.data?.voidedAt && voided.data?.voidedByName), short(voided.data))
    const again = await call('POST', `/finance/entries/${taxi.data.id}/void`, financeOwner, { reason: 'yana bir bor' })
    check('ikkinchi marta bekor qilinmaydi', again.status === 400, String(again.status))

    const cashVoided = (await call('GET', '/shifts/current', receptionToken)).data?.expectedCash
    check('bekor qilingan chiqim kassaga qaytdi', cashVoided === cashBefore, `${cashVoided}`)
    const listed = (await call('GET', `/finance/entries?${range}`, financeOwner)).data
    check('bekor qilingan yozuv ro‘yxatda qoldi', listed.some((e: any) => e.id === taxi.data.id && e.voidReason === 'Ikki marta yozilgan'))
  } finally {
    await prisma.user.update({ where: { id: receptionUser.id }, data: { extraPermissions: receptionUser.extraPermissions } })
  }

  /* Buxgalter — "Xodim" roli bilan, bemorlarsiz */
  const accountantLogin = `buxgalter${RUN}@clinic-os.uz`
  const accountant = await call('POST', '/staff', financeOwner, {
    fullName: 'Sinov Buxgalter',
    phone: '+998901112233',
    position: 'accountant',
    positionTitle: 'Buxgalter',
    workdays: [1, 2, 3, 4, 5],
    shiftStart: '09:00',
    shiftEnd: '18:00',
    payType: 'salary',
    salary: 4_000_000,
    hiredAt: today,
    hasSystemAccess: true,
    role: 'staff',
    login: accountantLogin,
    password: 'buxgalter-parol-1',
    extraPermissions: ['finance.view', 'finance.create'],
  })
  check('buxgalter "Xodim" roli bilan qo‘shildi', accountant.status === 201, short(accountant.data))

  const guard = await call('POST', '/staff', financeOwner, {
    fullName: 'Sinov Qorovul', phone: '+998901112244', position: 'security', positionTitle: 'Qorovul',
    workdays: [0, 1, 2, 3, 4, 5, 6], shiftStart: '20:00', shiftEnd: '08:00', payType: 'salary', salary: 2_500_000, hiredAt: today,
  })
  check('qorovul tizimga kirishsiz qo‘shildi', guard.status === 201 && !guard.data?.hasSystemAccess, short(guard.data))
  const cook = await call('POST', '/staff', financeOwner, {
    fullName: 'Sinov Oshpaz', phone: '+998901112255', position: 'cook', positionTitle: 'Oshpaz',
    workdays: [1, 2, 3, 4, 5, 6], shiftStart: '08:00', shiftEnd: '16:00', payType: 'salary', salary: 3_000_000, hiredAt: today,
  })
  check('yangi lavozim (oshpaz) qabul qilindi', cook.status === 201 && cook.data?.position === 'cook', short(cook.data))

  const accountantSession = (await call('POST', '/auth/login', undefined, { email: accountantLogin, password: 'buxgalter-parol-1' })).data as any
  check('buxgalter kirdi, roli staff', accountantSession?.user?.role === 'staff', short(accountantSession?.user))
  check('buxgalterda kirim-chiqim ruxsati bor', (accountantSession?.permissions ?? []).includes('finance.view'))
  check('buxgalter hisobotni ko‘radi', (await call('GET', `/finance/summary?${range}`, accountantSession.token)).status === 200)
  check('buxgalter bemorlarni ko‘rmaydi', (await call('GET', '/patients', accountantSession.token)).status === 403)
  check('buxgalter to‘lovlarni ko‘rmaydi', (await call('GET', '/payments', accountantSession.token)).status === 403)
  check('buxgalter bekor qila olmaydi', (await call('POST', `/finance/entries/${rent.data.id}/void`, accountantSession.token, { reason: 'sinov uchun' })).status === 403)

  /* ================================================================ */
  console.log('\n9. Bemorga qabul xabari va egaga kirim-chiqim xabari')
  /* ================================================================ */
  /* Sinovda tokenlar bo'sh — botlar "yoqilgan" deb ko'rsatiladi, yuborish baribir almashtirilgan */
  Object.defineProperty(telegram, 'enabled', { get: () => true, configurable: true })
  Object.defineProperty(telegram, 'patientEnabled', { get: () => true, configurable: true })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

  /* Bemor botda raqamini OLDIN ulashadi — kartasi hali yo'q */
  const botDigits = `99893${RUN}`
  const botTelegram = `55${RUN}`
  await patientTg.webhook(
    { message: { chat: { id: Number(botTelegram) }, from: { id: Number(botTelegram) }, contact: { phone_number: botDigits, user_id: Number(botTelegram) } } },
    'mahalliy-bemor-kaliti',
  )
  const phoneLink = await prisma.telegramPhoneLink.findUnique({ where: { phone: botDigits } })
  check('kartasiz ham raqam eslab qolindi', phoneLink?.telegramUserId === botTelegram, short(phoneLink))

  /* Registrator keyin karta ochadi — u o'zi botga bog'lanadi */
  const newPatient = await call('POST', '/patients', receptionToken, {
    fullName: 'Botdagi Bemor', phone: `+${botDigits}`, birthDate: '1990-05-05', gender: 'female',
  })
  check('karta ochildi', newPatient.status === 201, short(newPatient.data))
  const linkedPatient = await prisma.patient.findUnique({ where: { id: newPatient.data?.id } })
  check('yangi karta botga o‘zi bog‘landi', linkedPatient?.telegramUserId === botTelegram, String(linkedPatient?.telegramUserId))

  const bookDoctor = await prisma.doctor.findFirstOrThrow({ where: { clinicId: receptionUser.clinicId, status: 'ACTIVE' } })
  const bookService = await prisma.service.findFirstOrThrow({ where: { clinicId: receptionUser.clinicId } })
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(18, 40, 0, 0)

  sent.length = 0
  const booked = await call('POST', '/appointments', receptionToken, {
    patientId: newPatient.data.id, doctorId: bookDoctor.id, serviceId: bookService.id, startsAt: tomorrow.toISOString(),
  })
  check('qabul yozildi', booked.status === 201, short(booked.data))
  await settle()
  const bookedMessage = sent.find((m) => m.to === botTelegram)
  check('bemorga "qabulga yozildingiz" bordi', Boolean(bookedMessage?.text.includes('qabulga yozildingiz')), short(sent.map((m) => m.to)))
  check('xabar bemor botidan', bookedMessage?.bot === 'patient')
  check('xabarda "Qabul qildim" tugmasi', bookedMessage?.markup?.inline_keyboard?.[0]?.[0]?.callback_data === `appt:${booked.data?.id}`)
  const bookedNotice = await prisma.patientNotice.findFirst({ where: { appointmentId: booked.data?.id, kind: 'BOOKED' } })
  check('kabinetda ham yozildi', Boolean(bookedNotice))

  sent.length = 0
  await (app.get(RemindersService) as any).send(1, 'REMINDER_SOON')
  check('yarim soatdan keyin "ertaga qabulingiz bor" takrorlanmadi', !sent.some((m) => m.to === botTelegram))

  /* Egaga kirim-chiqim xabari */
  const ownerUser = await prisma.user.findFirstOrThrow({ where: { email: 'owner@shifomed.uz' } })
  const ownerTelegram = `44${RUN}`
  const ownerTelegramBefore = ownerUser.telegramUserId
  await prisma.user.update({ where: { id: ownerUser.id }, data: { telegramUserId: ownerTelegram } })
  await prisma.user.update({ where: { id: receptionUser.id }, data: { extraPermissions: [...receptionUser.extraPermissions, 'finance.create'] } })
  try {
    sent.length = 0
    const purchase = await call('POST', '/finance/entries', receptionToken, {
      type: 'expense', category: 'purchase', amount: 150_000, method: 'cash', counterparty: 'Kanselyariya', note: 'Qog‘oz',
    })
    check('registrator chiqim yozdi', purchase.status === 201, short(purchase.data))
    await settle()
    const alert = sent.find((m) => m.to === ownerTelegram)
    check('egaga botdan chiqim xabari bordi', Boolean(alert?.text.includes('Chiqim') && alert.text.includes('Yozdi:')), short(alert?.text))
    check('xabarda summa va "kassadan"', Boolean(alert?.text.includes('150') && alert.text.includes('kassadan')))
    check('xabarda bo‘limni ochish tugmasi', Boolean(alert?.markup?.inline_keyboard?.[0]?.[0]?.web_app))

    sent.length = 0
    await call('POST', '/finance/entries', financeOwner, { type: 'income', category: 'investment', amount: 1_000_000, method: 'transfer' })
    await settle()
    check('egasining o‘zi yozgani o‘ziga yuborilmadi', !sent.some((m) => m.to === ownerTelegram))
  } finally {
    await prisma.user.update({ where: { id: ownerUser.id }, data: { telegramUserId: ownerTelegramBefore } })
    await prisma.user.update({ where: { id: receptionUser.id }, data: { extraPermissions: receptionUser.extraPermissions } })
  }

  /* ================================================================ */
  console.log('\n10. Dam olish kunlari va qabullarni ko‘chirish')
  /* ================================================================ */
  const dayAt = (offset: number, hour: number, minute: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  const doctorA = bookDoctor
  /* Ikkinchi shifokor — seedda bittagina bo'lishi mumkin */
  const doctorB =
    (await prisma.doctor.findFirst({
      where: { clinicId: receptionUser.clinicId, status: 'ACTIVE', id: { not: doctorA.id } },
    })) ??
    (await prisma.doctor.create({
      data: {
        clinicId: receptionUser.clinicId, fullName: 'Sinov Ikkinchi Shifokor', specialty: 'therapist', phone: '', email: '',
        consultationFee: 0, workdays: [1, 2, 3, 4, 5, 6], shiftStart: '08:00', shiftEnd: '20:00', hiredAt: new Date(),
      },
    }))
  const sickDay = localDay(dayAt(2, 12, 0))
  const nextDay = localDay(dayAt(3, 12, 0))
  const holiday = localDay(dayAt(4, 12, 0))

  const appt = await call('POST', '/appointments', receptionToken, {
    patientId: newPatient.data.id, doctorId: doctorA.id, serviceId: bookService.id, startsAt: dayAt(2, 19, 35).toISOString(),
  })
  check('ko‘chiriladigan qabul yozildi', appt.status === 201, short(appt.data))

  const sick = await call('POST', '/days-off', receptionToken, { from: sickDay, to: sickDay, doctorId: doctorA.id, reason: 'Kasal' })
  check('shifokorga dam olish belgilandi', sick.status === 201 && sick.data?.created === 1, short(sick.data))
  check('ta’sir qilgan qabullar soni qaytdi', (sick.data?.affectedAppointments ?? 0) >= 1, short(sick.data))

  const again = await call('POST', '/days-off', receptionToken, { from: sickDay, to: sickDay, doctorId: doctorA.id })
  check('o‘sha kun qayta yozilmadi', again.data?.created === 0, short(again.data))

  const blocked = await call('POST', '/appointments', receptionToken, {
    patientId: newPatient.data.id, doctorId: doctorA.id, serviceId: bookService.id, startsAt: dayAt(2, 11, 5).toISOString(),
  })
  check('dam olish kuniga yangi qabul yozilmaydi', blocked.status === 400 && String(blocked.data?.message).includes('ishlamaydi'), short(blocked.data))

  const listed = await call('GET', `/days-off?from=${sickDay}&to=${sickDay}`, receptionToken)
  check('dam olish kuni ro‘yxatda', (listed.data ?? []).some((d: any) => d.doctorId === doctorA.id && d.reason === 'Kasal'), short(listed.data))

  check('shifokor dam olish belgilay olmaydi', (await call('POST', '/days-off', doctorToken, { from: sickDay, to: sickDay })).status === 403)

  /* Boshqa shifokorga, o'sha vaqtda */
  sent.length = 0
  const toDoctor = await call('POST', '/appointments/bulk-move', receptionToken, { ids: [appt.data.id], mode: 'doctor', doctorId: doctorB.id })
  check('boshqa shifokorga o‘tkazildi', toDoctor.data?.moved?.[0]?.doctorId === doctorB.id, short(toDoctor.data))
  await settle()
  check('bemorga "qabulingiz o‘zgardi" bordi', sent.some((m) => m.to === botTelegram && m.text.includes('Qabulingiz o‘zgardi')), short(sent.map((m) => m.text.slice(0, 30))))

  /* Tasdiqlab, keyin boshqa kunga — tasdiq bekor bo'ladi */
  await prisma.appointment.update({ where: { id: appt.data.id }, data: { status: 'CONFIRMED' } })
  const toDate = await call('POST', '/appointments/bulk-move', receptionToken, { ids: [appt.data.id], mode: 'date', date: nextDay })
  const movedRow = toDate.data?.moved?.[0]
  check('boshqa kunga ko‘chdi, vaqti saqlandi', Boolean(movedRow) && localDay(new Date(movedRow.startsAt)) === nextDay && new Date(movedRow.startsAt).getHours() === 19 && new Date(movedRow.startsAt).getMinutes() === 35, short(movedRow))
  check('kun o‘zgargach tasdiq qaytadan so‘raladi', movedRow?.status === 'scheduled', movedRow?.status)

  /* Klinika dam oladi — u kunga ko'chmaydi */
  const clinicHoliday = await call('POST', '/days-off', financeOwner, { from: holiday, to: holiday, reason: 'Bayram' })
  check('egasi klinika dam olishini belgiladi', clinicHoliday.status === 201, short(clinicHoliday.data))
  const toHoliday = await call('POST', '/appointments/bulk-move', receptionToken, { ids: [appt.data.id], mode: 'date', date: holiday })
  check('klinika dam oladigan kunga ko‘chmaydi', toHoliday.data?.moved?.length === 0 && String(toHoliday.data?.skipped?.[0]?.reason).includes('klinika dam oladi'), short(toHoliday.data))

  /* Band vaqtga o'tkazilmaydi */
  const rival = await call('POST', '/appointments', receptionToken, {
    patientId: newPatient.data.id, doctorId: doctorA.id, serviceId: bookService.id, startsAt: dayAt(3, 19, 35).toISOString(),
  })
  const clash = await call('POST', '/appointments/bulk-move', receptionToken, { ids: [rival.data?.id], mode: 'doctor', doctorId: doctorB.id })
  check('band vaqtga o‘tkazilmaydi', clash.data?.moved?.length === 0 && String(clash.data?.skipped?.[0]?.reason).includes('band'), short(clash.data))

  /* Dam olish bekor qilinsa — yana yozish mumkin */
  for (const row of [...(listed.data ?? []), ...(clinicHoliday.data?.items ?? [])]) {
    await call('DELETE', `/days-off/${row.id}`, row.doctorId ? receptionToken : financeOwner)
  }
  const reopened = await call('POST', '/appointments', receptionToken, {
    patientId: newPatient.data.id, doctorId: doctorA.id, serviceId: bookService.id, startsAt: dayAt(2, 11, 5).toISOString(),
  })
  check('dam olish o‘chirilgach qabul yoziladi', reopened.status === 201, short(reopened.data))

  await app.close()
  console.log(`\n${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/** Serverning mahalliy kuni — `toISOString` UTC beradi va kechqurun adashadi */
function localDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
