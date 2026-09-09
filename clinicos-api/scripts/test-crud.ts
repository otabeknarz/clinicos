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

/*
  Sana MAHALLIY vaqtda hisoblanadi.

  `toISOString()` UTC beradi. Server esa kun chegarasini
  `setHours(0,0,0,0)` bilan, ya'ni O'Z mintaqasida oladi.
  UTC+5 da kechqurun 19:00 dan keyin ikkalasi bir kunga
  farq qiladi va sinov "3 kun" o'rniga "2 kun" ko'radi.
*/
function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const today = localDate()

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

  /* ---------------- Shifokor xodim ---------------- */
  /*
    Klinikada shifokor FAQAT Xodimlar bo'limidan qo'shiladi.
    Shu paytda `Doctor` yozuvi ham ochilishi shart — bo'lmasa
    registrator qabulga shifokor biriktira olmaydi va
    "Shifokorlar" ro'yxati bo'sh qolaveradi.
  */
  console.log('\nShifokor xodim (egasi)')
  const docStaff = await call('POST', '/staff', owner, {
    fullName: 'CRUD Shifokor Xodim',
    phone: `+99893${RUN}`,
    email: `crud.docstaff.${RUN}@shifomed.uz`,
    position: 'doctor',
    positionTitle: 'Shifokor',
    specialty: 'cardiologist',
    consultationFee: 150_000,
    workdays: [1, 2, 3],
    shiftStart: '09:00',
    shiftEnd: '17:00',
    payType: 'percent',
    percentRate: 30,
    hiredAt: today,
    hasSystemAccess: true,
    role: 'doctor',
    login: `crud.docstaff.${RUN}@shifomed.uz`,
    password: 'crud-doctor-1234',
  })
  check('shifokor xodim yaratildi', docStaff.status < 300, short(docStaff.data))
  const docStaffId: string | undefined = docStaff.data?.id
  const linkedDoctorId: string | undefined = docStaff.data?.doctorId

  check('  shifokor yozuvi bog‘landi', Boolean(linkedDoctorId), `doctorId: ${linkedDoctorId}`)

  if (linkedDoctorId) {
    const inList = await call('GET', '/doctors?fields=short', reception)
    const found = (inList.data ?? []).find(
      (d: { id: string }) => d.id === linkedDoctorId,
    )
    check('  registrator ro‘yxatida ko‘rinadi', Boolean(found), short(inList.data))
    check('  mutaxassislik ko‘chdi', found?.specialty === 'cardiologist', short(found))

    const full = await call('GET', `/doctors/${linkedDoctorId}`, owner)
    check(
      '  qabul narxi ko‘chdi',
      full.data?.consultationFee === 150_000,
      `narx: ${full.data?.consultationFee}`,
    )
  }

  if (docStaffId) {
    const renamed = await call('PATCH', `/staff/${docStaffId}`, owner, {
      fullName: 'CRUD Shifokor Yangi',
    })
    check('  ism tahriri o‘tdi', renamed.status === 200, short(renamed.data))

    const one = await call('GET', `/doctors/${linkedDoctorId}`, owner)
    check(
      '  shifokor yozuvida ham yangilandi',
      one.data?.fullName === 'CRUD Shifokor Yangi',
      `ism: ${one.data?.fullName}`,
    )

    // Lavozim o'zgarsa yozuv o'chmaydi, faqat ro'yxatdan chiqadi
    await call('PATCH', `/staff/${docStaffId}`, owner, { position: 'nurse' })
    const after = await call('GET', '/doctors?fields=short', reception)
    check(
      '  hamshiraga o‘tgach ro‘yxatdan chiqdi',
      !(after.data ?? []).some((d: { id: string }) => d.id === linkedDoctorId),
      short(after.data),
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

  /* ---------------- Statsionar ---------------- */
  console.log('\nStatsionar — yotqizish va hisob')
  if (patientId && doctorId && roomId) {
    const board = await call(
      'GET',
      `/ward/board?from=${today}&to=${today}`,
      owner,
    )
    const beds: string[] = (board.data?.rows ?? [])
      .filter((r: any) => r.room?.id === roomId)
      .map((r: any) => r.bed.id)

    check('palatada ikkita joy bor', beds.length >= 2, `${beds.length} ta`)
    if (beds.length >= 2) {
      const plus2 = localDate(2)

      /* --- Hozir yotqizish, oldindan to'lov bilan --- */
      const now = await call('POST', '/ward/admissions', reception, {
        patientId,
        doctorId,
        bedId: beds[0],
        expectedDischargeAt: plus2,
        prepayment: { amount: 350_000, method: 'cash' },
      })
      check('hozir yotqizildi', now.status < 300, short(now.data))
      check('  holat active', now.data?.status === 'active', `${now.data?.status}`)
      check(
        '  reja: 3 kun × 350 000 = 1 050 000',
        now.data?.plannedDays === 3 && now.data?.plannedTotal === 1_050_000,
        `${now.data?.plannedDays} kun / ${now.data?.plannedTotal}`,
      )
      check('  oldindan to‘lov yozildi', now.data?.paid === 350_000, `${now.data?.paid}`)

      /* --- Rejalashtirish: joy bugundan band bo'lmaydi --- */
      const from = new Date(Date.now() + 30 * 86_400_000).toISOString()
      const to = localDate(32)
      const planned = await call('POST', '/ward/admissions', reception, {
        patientId,
        doctorId,
        bedId: beds[1],
        admittedAt: from,
        expectedDischargeAt: to,
      })
      check('rejalashtirildi', planned.status < 300, short(planned.data))
      check('  holat planned', planned.data?.status === 'planned', `${planned.data?.status}`)
      check('  yotgan kun 0', planned.data?.daysStayed === 0, `${planned.data?.daysStayed}`)

      /* --- O'sha joy, kesishuvchi kunlar --- */
      const clash = await call('POST', '/ward/admissions', reception, {
        patientId,
        doctorId,
        bedId: beds[1],
        admittedAt: from,
        expectedDischargeAt: to,
      })
      check('kesishuvchi kunda joy band', clash.status === 409, `${clash.status}`)

      /* --- Egasi pul yoza olmaydi --- */
      const byOwner = await call('POST', '/ward/admissions', owner, {
        patientId,
        doctorId,
        bedId: beds[1],
        admittedAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        prepayment: { amount: 1000, method: 'cash' },
      })
      check(
        'egasi oldindan to‘lov kirita olmaydi',
        byOwner.status === 400,
        `${byOwner.status}`,
      )

      /* --- Check-in --- */
      const checkedIn = await call(
        'POST',
        `/ward/admissions/${planned.data?.id}/check-in`,
        reception,
      )
      check('rejadagi bemor yotqizildi', checkedIn.status < 300, short(checkedIn.data))
      check('  holat active', checkedIn.data?.status === 'active', `${checkedIn.data?.status}`)

      /* --- Statsionar to'lovi katalog xizmatisiz --- */
      const wardPay = await call('POST', '/payments', reception, {
        patientId,
        doctorId,
        admissionId: now.data?.id,
        amount: 100_000,
        method: 'cash',
      })
      check('statsionar to‘lovi yozildi', wardPay.status < 300, short(wardPay.data))

      const tooMuch = await call('POST', '/payments', reception, {
        patientId,
        doctorId,
        admissionId: now.data?.id,
        amount: 900_000_000,
        method: 'cash',
      })
      check('chegaradan oshiq to‘lov rad etildi', tooMuch.status === 400, `${tooMuch.status}`)

      const neither = await call('POST', '/payments', reception, {
        patientId,
        doctorId,
        amount: 1000,
        method: 'cash',
      })
      check('xizmatsiz va yotqizishsiz to‘lov rad etildi', neither.status === 400, `${neither.status}`)

      /* --- Chiqarish va yakuniy hisob --- */
      const out = await call(
        'POST',
        `/ward/admissions/${now.data?.id}/discharge`,
        reception,
      )
      check('bemor chiqarildi', out.status < 300, short(out.data))
      check(
        '  hisob: 1 kun × 350 000, to‘langan 450 000 → balans −100 000',
        out.data?.accrued === 350_000 && out.data?.paid === 450_000 && out.data?.balance === -100_000,
        `hisoblangan ${out.data?.accrued} / to‘langan ${out.data?.paid} / balans ${out.data?.balance}`,
      )
    }
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

  /* ---------------- To'lov ogohlantirishi ---------------- */
  /*
    Registrator panelidagi "N ta to'lov olinmagan" yozuvi to'lov
    yozilgach YO'QOLISHI kerak. Ilgari ogohlantirish faqat sonni
    bilardi, tugma esa bo'sh forma ochardi: yozilgan to'lov hech
    qaysi qabulga bog'lanmas, `appointment.paymentStatus`
    o'zgarmas va yozuv o'sha joyda turaverardi.
  */
  console.log('\nTo‘lov ogohlantirishi (registrator paneli)')
  if (patientId && serviceId) {
    const me = await call('GET', '/auth/me', doctor)
    const ownDoctorId = me.data?.user?.doctorId

    // BUGUNGI qabul — panel faqat bugungi kunni ko'rsatadi
    const soon = new Date(Date.now() + 60_000).toISOString()
    const todayAppt = await call('POST', '/appointments', reception, {
      patientId,
      doctorId: ownDoctorId,
      serviceId,
      startsAt: soon,
    })
    const todayApptId: string | undefined = todayAppt.data?.id
    check('bugungi qabul yaratildi', todayAppt.status < 300, short(todayAppt.data))

    if (todayApptId) {
      await call('POST', '/visits', doctor, {
        appointmentId: todayApptId,
        complaint: 'tekshiruv',
        diagnosis: 'sog‘lom',
        treatment: 'kuzatuv',
      })

      const before = await call('GET', '/reception/summary', reception)
      const listed = (before.data?.attention?.unpaid?.items ?? []).find(
        (i: { appointmentId: string }) => i.appointmentId === todayApptId,
      )
      check('to‘lanmaganlar ro‘yxatida chiqdi', Boolean(listed), short(before.data?.attention?.unpaid))
      check(
        '  qabul ma’lumoti ham keldi',
        listed?.patientId === patientId && Boolean(listed?.serviceId),
        short(listed),
      )

      if (listed) {
        /* Ogohlantirish tugmasi aynan shu ma'lumot bilan forma ochadi */
        const pay = await call('POST', '/payments', reception, {
          patientId: listed.patientId,
          doctorId: listed.doctorId,
          serviceId: listed.serviceId,
          appointmentId: listed.appointmentId,
          amount: listed.price,
          method: 'cash',
        })
        check('  to‘lov yozildi', pay.status < 300, short(pay.data))

        const after = await call('GET', '/reception/summary', reception)
        const still = (after.data?.attention?.unpaid?.items ?? []).some(
          (i: { appointmentId: string }) => i.appointmentId === todayApptId,
        )
        check('  ogohlantirishdan YO‘QOLDI', !still, short(after.data?.attention?.unpaid))

        /*
          ILDIZI: ogohlantirish `appointment.paymentStatus` ga qarab
          chiqadi va uni FAQAT `appointmentId` bilan kelgan to'lov
          o'zgartiradi. Bog'lanmagan to'lov kassaga tushib, qabulni
          "to'lanmagan" holida qoldirardi. Panel orqali yo'l endi
          to'g'ri, lekin buni tekshiradigan sinov yo'q edi.
        */
        const appt = await call('GET', `/appointments/${todayApptId}`, reception)
        check(
          '  qabul “to‘landi” bo‘ldi',
          appt.data?.paymentStatus === 'paid',
          `holat: ${appt.data?.paymentStatus}`,
        )
      }
    }
  }

  /* ---------------- Narxni shifokor belgilaydigan xizmat ---------------- */
  /*
    Egasi oraliq beradi, shifokor ko'rikda summani yozadi, registrator
    o'shani oladi. Chegara katalogdan emas, KO'RIKDAN keladi — shuning
    uchun bunday to'lov qabulga bog'lanmasa qabul qilinmasligi kerak.
  */
  console.log('\nNarxni shifokor belgilaydigan xizmat')
  if (patientId) {
    const me = await call('GET', '/auth/me', doctor)
    const ownDoctorId = me.data?.user?.doctorId

    const dsService = await call('POST', '/services', owner, {
      name: `CRUD shifokor narxi ${RUN}`,
      category: 'surgery',
      price: 1,
      priceMode: 'doctor_set',
      minPrice: 500_000,
      maxPrice: 1_500_000,
      durationMinutes: 60,
    })
    check('xizmat yaratildi', dsService.status < 300, short(dsService.data))
    check(
      '  oldindan to‘lash o‘chirildi',
      dsService.data?.paymentTiming === 'postpaid',
      `to‘lov vaqti: ${dsService.data?.paymentTiming}`,
    )
    /* Katalog narxi eng kam qiymatga tenglashadi — `price` hech qachon bo'sh qolmaydi */
    check(
      '  katalog narxi eng kam qiymatga tenglandi',
      dsService.data?.price === 500_000,
      `narx: ${dsService.data?.price}`,
    )

    const noRange = await call('POST', '/services', owner, {
      name: `CRUD oraliqsiz ${RUN}`,
      category: 'surgery',
      price: 100_000,
      priceMode: 'doctor_set',
      durationMinutes: 60,
    })
    check('oraliqsiz xizmat RAD ETILDI', noRange.status === 400, short(noRange.data))

    const dsServiceId: string | undefined = dsService.data?.id

    if (dsServiceId && ownDoctorId) {
      const appt = await call('POST', '/appointments', reception, {
        patientId,
        doctorId: ownDoctorId,
        serviceId: dsServiceId,
        startsAt: new Date(Date.now() + 120_000).toISOString(),
      })
      const dsApptId: string | undefined = appt.data?.id
      check('qabul yaratildi', appt.status < 300, short(appt.data))

      if (dsApptId) {
        const noPrice = await call('POST', '/visits', doctor, {
          appointmentId: dsApptId,
          diagnosis: 'summasiz',
        })
        check('summasiz ko‘rik RAD ETILDI', noPrice.status === 400, short(noPrice.data))

        const tooHigh = await call('POST', '/visits', doctor, {
          appointmentId: dsApptId,
          diagnosis: 'oraliqdan tashqari',
          price: 5_000_000,
        })
        check('oraliqdan tashqari summa RAD ETILDI', tooHigh.status === 400, short(tooHigh.data))

        const visit = await call('POST', '/visits', doctor, {
          appointmentId: dsApptId,
          diagnosis: 'jarrohlik',
          treatment: 'kuzatuv',
          price: 900_000,
        })
        check('shifokor summani belgiladi', visit.status < 300, short(visit.data))

        const unlinked = await call('POST', '/payments', reception, {
          patientId,
          doctorId: ownDoctorId,
          serviceId: dsServiceId,
          amount: 900_000,
          method: 'cash',
        })
        check('bog‘lanmagan to‘lov RAD ETILDI', unlinked.status === 400, short(unlinked.data))

        const overPay = await call('POST', '/payments', reception, {
          patientId,
          doctorId: ownDoctorId,
          serviceId: dsServiceId,
          appointmentId: dsApptId,
          amount: 1_200_000,
          method: 'cash',
        })
        check(
          'shifokor summasidan ortiq to‘lov RAD ETILDI',
          overPay.status === 400,
          short(overPay.data),
        )

        const paid = await call('POST', '/payments', reception, {
          patientId,
          doctorId: ownDoctorId,
          serviceId: dsServiceId,
          appointmentId: dsApptId,
          amount: 900_000,
          method: 'cash',
        })
        check('shifokor belgilagan summa olindi', paid.status < 300, short(paid.data))

        const dsAppt = await call('GET', `/appointments/${dsApptId}`, reception)
        check(
          '  qabul “to‘landi” bo‘ldi',
          dsAppt.data?.paymentStatus === 'paid',
          `holat: ${dsAppt.data?.paymentStatus}`,
        )
      }
    }
  }

  /* ---------------- Qarzdorlik ---------------- */
  /*
    Qarz SAQLANMAYDI — narx minus to'langan summa. Shuning uchun
    qisman to'lov qarzni o'zi kamaytiradi, to'liq to'lov esa uni
    ro'yxatdan o'zi olib tashlaydi.
  */
  console.log('\nQarzdorlik')
  if (patientId && serviceId) {
    const me = await call('GET', '/auth/me', doctor)
    const ownDoctorId = me.data?.user?.doctorId

    const appt = await call('POST', '/appointments', reception, {
      patientId,
      doctorId: ownDoctorId,
      serviceId,
      startsAt: new Date(Date.now() + 180_000).toISOString(),
    })
    const debtApptId: string | undefined = appt.data?.id
    check('qabul yaratildi', appt.status < 300, short(appt.data))

    if (debtApptId) {
      await call('POST', '/visits', doctor, {
        appointmentId: debtApptId,
        diagnosis: 'qarz sinovi',
      })

      // Xizmat narxi 222 000 — yarmini to'laymiz
      const part = await call('POST', '/payments', reception, {
        patientId,
        doctorId: ownDoctorId,
        serviceId,
        appointmentId: debtApptId,
        amount: 111_000,
        method: 'cash',
      })
      check('qisman to‘lov yozildi', part.status < 300, short(part.data))

      const partial = await call('GET', `/appointments/${debtApptId}`, reception)
      check(
        '  qabul “qisman” bo‘ldi',
        partial.data?.paymentStatus === 'partial',
        `holat: ${partial.data?.paymentStatus}`,
      )

      const debts = await call('GET', '/debts', reception)
      check('qarz ro‘yxati ochildi', debts.status === 200, short(debts.data))
      const listed = (debts.data?.visits ?? []).find(
        (d: { appointmentId: string }) => d.appointmentId === debtApptId,
      )
      check('  ro‘yxatda chiqdi', Boolean(listed), short(debts.data?.totals))
      check(
        '  qolgan summa to‘g‘ri',
        listed?.remaining === 111_000,
        `qolgan: ${listed?.remaining}, to‘langan: ${listed?.paid}`,
      )

      /*
        Kechirish FAQAT egasida. Pulni oladigan odam qarzni ham yopa
        olsa, pulni o'ziga olib "kechirdim" deb yozib qo'yishi mumkin.
      */
      const byReception = await call('POST', '/debts/waive', reception, {
        appointmentId: debtApptId,
        note: 'registrator urinishi',
      })
      check('registrator kechira OLMADI', byReception.status === 403, short(byReception.data))

      const byOwner = await call('POST', '/debts/waive', owner, {
        appointmentId: debtApptId,
        note: 'bemor topilmadi',
      })
      check('egasi kechirdi', byOwner.status < 300, short(byOwner.data))

      const twice = await call('POST', '/debts/waive', owner, {
        appointmentId: debtApptId,
        note: 'ikkinchi marta',
      })
      check('  ikkinchi marta kechirib bo‘lmadi', twice.status === 409, short(twice.data))

      const after = await call('GET', '/debts', reception)
      const stillListed = (after.data?.visits ?? []).some(
        (d: { appointmentId: string }) => d.appointmentId === debtApptId,
      )
      check('  ro‘yxatdan YO‘QOLDI', !stillListed, short(after.data?.totals))

      /*
        Kechirilgan qarz bildirishnomada ham sanalmasligi kerak —
        aks holda u hech qachon o'chmasdi.
      */
      const notifications = await call('GET', '/notifications', reception)
      const pending = (notifications.data ?? []).find(
        (n: { kind: string }) => n.kind === 'pending_payments',
      )
      const summary = await call('GET', '/reception/summary', reception)
      check(
        '  bildirishnoma soni panel bilan mos',
        (pending?.count ?? 0) === (summary.data?.attention?.unpaid?.count ?? 0),
        `bildirishnoma: ${pending?.count}, panel: ${summary.data?.attention?.unpaid?.count}`,
      )
    }
  }

  /* ---------------- Klinika bo'limlari ---------------- */
  /*
    O'chirilgan bo'lim ruxsat yo'qligi bilan bir xil narsa emas:
    egasida `ward.manage` bor, lekin stomatologiyada statsionar yo'q.
    Shuning uchun tekshiruv IKKITA joyda bo'lishi kerak — sessiyadagi
    ruxsatlar ro'yxatida va qorovulda.
  */
  console.log('\nKlinika bo‘limlari (platforma)')
  const ownerSession = await call('POST', '/auth/login', undefined, {
    email: ACCOUNTS.owner,
    password: PASSWORD,
  })
  const mainClinicId: string | undefined = ownerSession.data?.user?.clinicId
  check('klinika id topildi', Boolean(mainClinicId))
  check(
    'boshida statsionar ruxsati bor',
    (ownerSession.data?.permissions ?? []).includes('ward.view'),
  )

  if (mainClinicId) {
    const off = await call('PATCH', `/platform/tenants/${mainClinicId}/modules`, tokens.admin, {
      disabledModules: ['ward'],
    })
    check('bo‘lim o‘chirildi', off.status === 200, short(off.data))
    check(
      '  javobda qaytdi',
      (off.data?.disabledModules ?? []).includes('ward'),
      short(off.data?.disabledModules),
    )

    const after = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.owner,
      password: PASSWORD,
    })
    check(
      '  sessiyada ruxsat YO‘Q',
      !(after.data?.permissions ?? []).includes('ward.view'),
    )
    check(
      '  qolgan ruxsatlar joyida',
      (after.data?.permissions ?? []).includes('patients.view'),
    )

    const blocked = await call('GET', '/ward/rooms', after.data?.token)
    check('  endpoint 403 qaytardi', blocked.status === 403, short(blocked.data))

    const open = await call('GET', '/patients?page=1', after.data?.token)
    check('  boshqa bo‘lim ochiq', open.status === 200, short(open.data))

    /* Boshqa klinikaga ta'sir qilmasligi kerak */
    const otherClinic = await call('POST', '/auth/login', undefined, {
      email: 'owner@salomat.uz',
      password: PASSWORD,
    })
    check(
      '  boshqa klinika tegilmadi',
      (otherClinic.data?.permissions ?? []).includes('ward.view'),
    )

    /* Qaytarib qo'yamiz — keyingi ishga tushirish toza boshlansin */
    const on = await call('PATCH', `/platform/tenants/${mainClinicId}/modules`, tokens.admin, {
      disabledModules: [],
    })
    check('bo‘lim qaytarildi', on.status === 200, short(on.data))

    const restored = await call('POST', '/auth/login', undefined, {
      email: ACCOUNTS.owner,
      password: PASSWORD,
    })
    const reopened = await call('GET', '/ward/rooms', restored.data?.token)
    check('  endpoint yana ochiq', reopened.status === 200, short(reopened.data))
  }

  /* ---------------- Egasining o'z sahifalari ---------------- */
  /*
    "Mening profilim" va "Mening ish jadvalim" xodim yozuviga
    tayanadi. Yangi klinikada egasiga u ochilmasdi va ikkala
    sahifa ham 404 bilan qulardi.
  */
  console.log('\nEgasining o‘z sahifalari')
  const ownerProfile = await call('GET', '/me/profile', owner)
  check('egasining profili ochildi', ownerProfile.status === 200, short(ownerProfile.data))
  const month = today.slice(0, 7)
  const ownerSchedule = await call('GET', `/me/schedule?month=${month}`, owner)
  check('egasining ish jadvali ochildi', ownerSchedule.status === 200, short(ownerSchedule.data))

  /* ---------------- Davomat jadvali ---------------- */
  console.log('\nDavomat jadvali')
  const board = await call('GET', `/attendance?from=${today}&to=${today}`, owner)
  check('butun klinika davomati keldi', board.status === 200, short(board.data))
  check(
    '  yozuvlar xodimga bog‘langan',
    Array.isArray(board.data) &&
      board.data.every((r: { staffId?: string }) => typeof r.staffId === 'string'),
    short(board.data),
  )

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
  check('Shifo Med klinikasi topildi', Boolean(shifo), 'seed ishlaganmi?')
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

    /*
      Ma'lumot yo'q bo'lsa JIM O'TKAZIB YUBORMAYMIZ.

      Ilgari shunday edi va bu yashirin muammoga aylandi: seed
      sinib qolganda sinov 11 ta tekshiruvni sakrab o'tib,
      baribir "0 ta xato" deb yozardi. Yetishmayotgan ma'lumot
      ham xato.
    */
    check('Salomat klinikasi topildi', Boolean(salomat), 'seed ishlaganmi?')

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
