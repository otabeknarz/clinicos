import 'dotenv/config'

/**
 * CRUD SINOVI — yaratish, o'qish, tahrirlash, o'chirish.
 *
 * `smoke` dan farqi: u faqat GET marshrutlarini bosib, 500 qidiradi.
 * Bu yerda esa YOZISH amallari sinaladi va har biri o'sha amalga
 * HAQLI rol nomidan bajariladi.
 *
 * ENG MUHIM QISMI — qisman tahrir. Interfeys faqat o'zgargan
 * maydonni yuboradi, shuning uchun har bir `PATCH` bitta maydon
 * bilan sinaladi va qolgan maydonlar o'zgarmaganini tekshiramiz.
 * Ilgari aynan shu ishlamasdi: yettita endpoint yaratish DTO'sini
 * qayta ishlatib, har qanday qisman tahrirni 400 bilan rad etardi.
 *
 * Ishga tushirish (server ishlab turishi va baza seed qilingan bo'lishi kerak):
 *   npm run test:crud
 */

const BASE = process.env.CRUD_URL ?? 'http://localhost:3000'
const PASSWORD = 'demo1234'

const ACCOUNTS = {
  owner: 'owner@shifomed.uz',
  reception: 'reception@shifomed.uz',
  doctor: 'aziz.karimov@shifomed.uz',
  admin: 'admin@clinicos.uz',
}

const tokens: Record<string, string> = {}
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

function short_(data: unknown): string {
  return short(data)
}

function short(data: unknown): string {
  return JSON.stringify(data)?.slice(0, 110) ?? ''
}

/** Ro'yxat javobi `{items}` yoki oddiy massiv bo'lishi mumkin */
function items(data: any): any[] {
  return Array.isArray(data) ? data : (data?.items ?? [])
}

async function login() {
  for (const [name, email] of Object.entries(ACCOUNTS)) {
    const { status, data } = await call('POST', '/auth/login', undefined, {
      email,
      password: PASSWORD,
    })
    if (status < 300 && data?.token) tokens[name] = data.token
    else {
      console.error(`Kira olmadi ${name}: ${status} ${short(data)}`)
      process.exit(1)
    }
  }
}

const today = new Date().toISOString().slice(0, 10)

/*
  Sinov ma'lumoti HAR SAFAR noyob bo'lishi kerak: telefon va email
  bazada takrorlanmaydi, shuning uchun skriptni ikkinchi marta
  ishga tushirish 409 bilan tugardi. Seed'siz ham qayta ishlatsa
  bo'lsin.
*/
const RUN = String(Date.now()).slice(-7)

async function main() {
  await login()
  const { owner, reception, doctor } = tokens

  /* ---------------- Bemor ---------------- */
  console.log('\nBemor (registrator)')
  const created = await call('POST', '/patients', reception, {
    fullName: `CRUD Sinov ${RUN}`,
    phone: `+99890${RUN}`,
    birthDate: '1990-01-01',
    gender: 'male',
  })
  check('bemor yaratildi', created.status < 300, short(created.data))
  const patientId: string | undefined = created.data?.id

  if (patientId) {
    const patched = await call('PATCH', `/patients/${patientId}`, reception, {
      notes: 'faqat izoh',
    })
    check('qisman tahrir (faqat izoh)', patched.status === 200, short(patched.data))
    check(
      '  ism o‘zgarmadi',
      patched.data?.fullName === `CRUD Sinov ${RUN}`,
      `ism: ${patched.data?.fullName}`,
    )
  }

  /* ---------------- Xizmat ---------------- */
  console.log('\nXizmat (egasi)')
  const svc = await call('POST', '/services', owner, {
    name: 'CRUD xizmat',
    category: 'consultation',
    price: 100_000,
    durationMinutes: 30,
  })
  check('xizmat yaratildi', svc.status < 300, short(svc.data))
  const serviceId: string | undefined = svc.data?.id

  if (serviceId) {
    await call('PATCH', `/services/${serviceId}`, owner, { status: 'archived' })
    const only = await call('PATCH', `/services/${serviceId}`, owner, { price: 222_000 })
    check('qisman tahrir (faqat narx)', only.status === 200, short(only.data))
    check(
      '  arxiv holati saqlandi',
      only.data?.status === 'archived',
      `holat: ${only.data?.status}`,
    )
    check('  narx o‘zgardi', only.data?.price === 222_000, `narx: ${only.data?.price}`)
    await call('PATCH', `/services/${serviceId}`, owner, { status: 'active' })
  }

  /* ---------------- Shifokor ---------------- */
  console.log('\nShifokor (egasi)')
  const doc = await call('POST', '/doctors', owner, {
    fullName: 'CRUD Shifokor',
    specialty: 'therapist',
    phone: `+99891${RUN}`,
    email: `crud.${RUN}@shifomed.uz`,
    consultationFee: 150_000,
    workdays: [1, 2, 3],
    shiftStart: '09:00',
    shiftEnd: '17:00',
  })
  check('shifokor yaratildi', doc.status < 300, short(doc.data))
  const doctorId: string | undefined = doc.data?.id

  if (doctorId) {
    await call('PATCH', `/doctors/${doctorId}`, owner, { status: 'on_leave' })
    const only = await call('PATCH', `/doctors/${doctorId}`, owner, {
      consultationFee: 175_000,
    })
    check('qisman tahrir (faqat narx)', only.status === 200, short(only.data))
    check(
      '  ta’til holati saqlandi',
      only.data?.status === 'on_leave',
      `holat: ${only.data?.status}`,
    )
    await call('PATCH', `/doctors/${doctorId}`, owner, { status: 'active' })
  }

  /* ---------------- Xodim ---------------- */
  console.log('\nXodim (egasi)')
  const staff = await call('POST', '/staff', owner, {
    fullName: 'CRUD Xodim',
    phone: `+99892${RUN}`,
    position: 'nurse',
    positionTitle: 'Hamshira',
    workdays: [1, 2, 3],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    payType: 'salary',
    hiredAt: today,
  })
  check('xodim yaratildi', staff.status < 300, short(staff.data))
  const staffId: string | undefined = staff.data?.id

  if (staffId) {
    await call('PATCH', `/staff/${staffId}`, owner, { salary: 5_000_000 })
    const only = await call('PATCH', `/staff/${staffId}`, owner, {
      positionTitle: 'Katta hamshira',
    })
    check('qisman tahrir (faqat lavozim)', only.status === 200, short(only.data))
    check(
      '  maosh o‘chib ketmadi',
      only.data?.salary === 5_000_000,
      `maosh: ${only.data?.salary}`,
    )
  }

  /* ---------------- Palata ---------------- */
  console.log('\nPalata (egasi)')
  const room = await call('POST', '/ward/rooms', owner, {
    number: `C${RUN.slice(-4)}`,
    floor: 2,
    category: 'standard',
    dailyRate: 300_000,
    bedCount: 2,
  })
  check('palata yaratildi', room.status < 300, short(room.data))
  const roomId: string | undefined = room.data?.id

  if (roomId) {
    const only = await call('PATCH', `/ward/rooms/${roomId}`, owner, { dailyRate: 350_000 })
    check('qisman tahrir (faqat narx)', only.status === 200, short(only.data))
    check(
      '  qavat o‘zgarmadi',
      only.data?.floor === 2,
      `qavat: ${only.data?.floor}`,
    )
  }

  /* ---------------- Qabul va tashrif ---------------- */
  console.log('\nQabul va tashrif')
  let appointmentId: string | undefined
  if (patientId && serviceId) {
    /* Tashrifni SHU shifokor yozadi, shuning uchun qabul ham unga */
    const me = await call('GET', '/auth/me', doctor)
    const ownDoctorId = me.data?.user?.doctorId
    const starts = new Date(Date.now() + 86_400_000).toISOString()

    const appt = await call('POST', '/appointments', reception, {
      patientId,
      doctorId: ownDoctorId,
      serviceId,
      startsAt: starts,
    })
    check('qabul yaratildi', appt.status < 300, short(appt.data))
    appointmentId = appt.data?.id

    if (appointmentId) {
      const only = await call('PATCH', `/appointments/${appointmentId}`, reception, {
        notes: 'izoh',
      })
      check('qabul qisman tahrir', only.status === 200, short(only.data))

      const visit = await call('POST', '/visits', doctor, {
        appointmentId,
        complaint: 'bosh og‘rig‘i',
        diagnosis: 'migren',
        treatment: 'dam olish',
      })
      check('tashrif yozildi (shifokor)', visit.status < 300, short(visit.data))
    }
  }

  /* ---------------- To'lov ---------------- */
  console.log('\nTo‘lov (registrator)')
  if (patientId && serviceId && doctorId) {
    const pay = await call('POST', '/payments', reception, {
      patientId,
      doctorId,
      serviceId,
      appointmentId: appointmentId ?? null,
      amount: 100_000,
      method: 'cash',
    })
    check('to‘lov yozildi', pay.status < 300, short(pay.data))
    /*
      QAYTARISH — FAQAT EGASIDA.

      Registratorda `payments.refund` ATAYLAB yo'q: pulni olgan
      odam uni o'zi qaytarib, naqd kamomadni yopib qo'yishi mumkin
      bo'lardi. Shuning uchun ikkala tomon ham sinaladi.
    */
    const paymentId: string | undefined = pay.data?.id
    if (paymentId) {
      const byReception = await call('POST', `/payments/${paymentId}/refund`, reception, {
        reason: 'sinov',
      })
      check(
        'registrator qaytara olmaydi',
        byReception.status === 403,
        `${byReception.status}`,
      )

      const byOwner = await call('POST', `/payments/${paymentId}/refund`, owner, {
        reason: 'sinov qaytarish',
      })
      check('egasi qaytardi', byOwner.status < 300, short(byOwner.data))
    }
  }

  /* ---------------- Profil ---------------- */
  console.log('\nProfil')
  for (const [role, token] of Object.entries(tokens)) {
    const r = await call('PATCH', '/profile', token, { phone: '+998900000001' })
    check(`profil tahriri (${role})`, r.status === 200, short(r.data))
  }

  /* ---------------- Parol ---------------- */
  console.log('\nParol almashtirish (shifokor)')
  {
    /*
      Shifokor tanlandi: uning tokeni keyingi sinovlarda
      ishlatilmaydi, ya'ni bekor qilinishi boshqasiga xalal
      bermaydi. Oxirida parol qaytariladi.
    */
    const before = (
      await call('POST', '/auth/login', undefined, {
        email: ACCOUNTS.doctor,
        password: PASSWORD,
      })
    ).data.token

    const wrong = await call('POST', '/auth/password', before, {
      currentPassword: 'notogri',
      newPassword: 'YangiParol123',
    })
    check('joriy parol noto‘g‘ri bo‘lsa rad etiladi', wrong.status === 400, `${wrong.status}`)

    const same = await call('POST', '/auth/password', before, {
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    })
    check('eski parolni qayta qo‘yib bo‘lmaydi', same.status === 400, `${same.status}`)

    const short = await call('POST', '/auth/password', before, {
      currentPassword: PASSWORD,
      newPassword: 'qisqa',
    })
    check('qisqa parol rad etiladi', short.status === 400, `${short.status}`)

    const changed = await call('POST', '/auth/password', before, {
      currentPassword: PASSWORD,
      newPassword: 'VaqtinchalikParol9',
    })
    check('parol almashtirildi', changed.status < 300, short_(changed.data))
    check('  yangi sessiya qaytdi', Boolean(changed.data?.token))

    const withNew = await call('GET', '/patients', changed.data?.token)
    check('  yangi token ishlaydi', withNew.status === 200, `${withNew.status}`)

    const withOld = await call('GET', '/patients', before)
    check('  ESKI token yaroqsiz', withOld.status === 401, `${withOld.status}`)

    const oldLogin = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.doctor,
      password: PASSWORD,
    })
    check('  eski parol bilan kirib bo‘lmaydi', oldLogin.status === 401, `${oldLogin.status}`)

    /* Keyingi ishga tushirishlar uchun parolni qaytaramiz */
    await call('POST', '/auth/password', changed.data?.token, {
      currentPassword: 'VaqtinchalikParol9',
      newPassword: PASSWORD,
    })
    const restored = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.doctor,
      password: PASSWORD,
    })
    check('  parol qaytarildi', restored.status < 300, `${restored.status}`)
  }

  /* ---------------- Klinikani to'xtatish ---------------- */
  console.log('\nKlinikani to‘xtatish (platforma)')
  const tenants = await call('GET', '/platform/tenants', tokens.admin)
  const shifo = items(tenants.data).find((t: any) => String(t.name).includes('Shifo'))
  if (shifo) {
    const freshToken = (
      await call('POST', '/auth/login', undefined, {
        email: ACCOUNTS.owner,
        password: PASSWORD,
      })
    ).data.token

    await call('POST', `/platform/tenants/${shifo.id}/suspend`, tokens.admin, {
      reason: 'CRUD sinovi',
    })

    const relogin = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.owner,
      password: PASSWORD,
    })
    check('to‘xtatilgach kirish yopildi', relogin.status === 401, `${relogin.status}`)

    const withOld = await call('GET', '/patients', freshToken)
    check('to‘xtatilgach eski token yaroqsiz', withOld.status === 401, `${withOld.status}`)

    const platform = await call('GET', '/platform/tenants', tokens.admin)
    check('platforma admini ta’sirlanmadi', platform.status === 200, `${platform.status}`)

    await call('POST', `/platform/tenants/${shifo.id}/activate`, tokens.admin)
    const back = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.owner,
      password: PASSWORD,
    })
    check('faollashtirgach kirish tiklandi', back.status < 300, `${back.status}`)
  }

  /* ---------------- Egasining parolini tiklash ---------------- */
  console.log('\nEgasining parolini tiklash (platforma)')
  {
    /*
      SALOMAT klinikasi tanlandi: qolgan sinovlar Shifo Med
      hisoblari bilan ishlaydi, ya'ni ularga xalal bermaymiz.
      Oxirida parol qaytariladi.
    */
    const salomat = items(
      (await call('GET', '/platform/tenants', tokens.admin)).data,
    ).find((x: any) => String(x.name).includes('Salomat'))

    if (salomat) {
      const beforeToken = (
        await call('POST', '/auth/login', undefined, {
          email: 'owner@salomat.uz',
          password: PASSWORD,
        })
      ).data?.token

      const reset = await call(
        'POST',
        `/platform/tenants/${salomat.id}/reset-owner-password`,
        tokens.admin,
      )
      check('parol tiklandi', reset.status < 300, short(reset.data))
      check('  vaqtinchalik parol qaytdi', Boolean(reset.data?.password))

      const oldToken = await call('GET', '/patients', beforeToken)
      check('  egasining eski tokeni yaroqsiz', oldToken.status === 401, `${oldToken.status}`)

      const oldPw = await call('POST', '/auth/login', undefined, {
        email: 'owner@salomat.uz',
        password: PASSWORD,
      })
      check('  eski parol ishlamaydi', oldPw.status === 401, `${oldPw.status}`)

      const newPw = await call('POST', '/auth/login', undefined, {
        email: 'owner@salomat.uz',
        password: reset.data?.password,
      })
      check('  yangi parol bilan kirdi', newPw.status < 300, `${newPw.status}`)
      check(
        '  almashtirish so‘raladi',
        newPw.data?.user?.mustChangePassword === true,
        `${newPw.data?.user?.mustChangePassword}`,
      )

      /* Keyingi ishga tushirishlar uchun qaytaramiz */
      await call('POST', '/auth/password', newPw.data?.token, {
        currentPassword: reset.data?.password,
        newPassword: PASSWORD,
      })
      const back = await call('POST', '/auth/login', undefined, {
        email: 'owner@salomat.uz',
        password: PASSWORD,
      })
      check('  parol qaytarildi', back.status < 300, `${back.status}`)
    }
  }

  console.log(`\n${passed} ta o‘tdi, ${failed} ta xato`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
