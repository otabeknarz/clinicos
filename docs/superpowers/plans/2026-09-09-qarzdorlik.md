# Qarzdorlik — amalga oshirish rejasi

> Loyiha: `docs/superpowers/specs/2026-09-09-qarzdorlik-design.md`

**Maqsad:** kim qancha qarzdorligini ko'rsatish, qarzni panelda va alohida
sahifada chiqarish, umidsiz qarzni yozuv qoldirib kechirish.

**Yondashuv:** qarz saqlanmaydi — narx minus to'langan summa sifatida
hisoblanadi. Yangi jadval faqat bitta: kechirish yozuvi. Ish statsionar
hisobini bitta joyga chiqarishdan boshlanadi, chunki qarz ro'yxati
ham, to'lov chegarasi ham o'sha hisobga tayanadi.

**Texnologiya:** NestJS 11, Prisma 7.10.0, React 19, Tailwind 4.

## Umumiy cheklovlar

- Izohlar, xabarlar, commit matnlari — **o'zbekcha**.
- `where: { clinicId }` qo'lda yozilmaydi — qatlam o'zi qo'yadi.
- Servisdan xom Prisma qatori qaytmaydi; enum `toApi`/`toDb` orqali.
- Yangi ruxsat ikkala ro'yxatga qo'shiladi, aks holda `check:permissions` yiqiladi.
- Demo qatlam (`src/mock/`) ham yangilanadi.
- Loyihada birlik testlari yo'q — tekshiruv `npm run check` va
  `scripts/test-crud.ts`. Shuning uchun "avval yiqiladigan test" qadami
  `test:crud` ga tekshiruv qo'shish ko'rinishida bo'ladi.

---

### Vazifa 1: Statsionar qoldig'ini bitta joyga chiqarish

Xatti-harakat o'zgarmaydi — faqat hisob ko'chadi. Alohida vazifa,
chunki uni mustaqil tekshirish mumkin va keyingi hamma narsa shunga
tayanadi.

**Fayllar:**
- O'zgartirish: `clinicos-api/src/common/ward-revenue.ts`
- O'zgartirish: `clinicos-api/src/payments/payments.service.ts` (`wardPreview`)

**Interfeys (keyingi vazifalar shuni chaqiradi):**

```ts
export interface WardBalanceInput {
  admittedAt: Date
  expectedDischargeAt: Date | null
  dischargedAt: Date | null
  status: string
  dailyRate: number
  payments: { amount: number; status: string }[]
}

export function wardBalance(a: WardBalanceInput): {
  cap: number       // jami hisob
  paid: number      // to'langan
  remaining: number // qolgan (manfiy bo'lmaydi)
}
```

- [ ] `ward-revenue.ts` ga `wardBalance()` va `inclusiveDays()` ko'chiriladi
      (`inclusiveDays` hozir `payments.service.ts` da). Izohda: chegara
      REJA va HAQIQAT dan kattarog'i — rejalashtirilgan bemordan oldindan
      to'liq summani olish mumkin bo'lishi kerak, rejadan uzoq yotgandan
      esa haqiqiy summani.
- [ ] `wardPreview` shu funksiyani chaqiradi va faqat tekshiruvni
      (`remaining <= 0`, `amount > remaining`) o'zida qoldiradi.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 2: Kechirish jadvali

**Fayllar:**
- O'zgartirish: `clinicos-api/prisma/schema.prisma`
- Yaratish: `clinicos-api/prisma/migrations/<vaqt>_qarzni_kechirish/migration.sql`
- O'zgartirish: `clinicos-api/src/prisma/tenant-models.ts` (generatsiya orqali)

```prisma
model DebtWaiver {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  /// Ikkalasidan bittasi to'ladi
  appointmentId String? @unique @map("appointment_id")
  admissionId   String? @unique @map("admission_id")

  note String @default("")

  createdById String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at")

  clinic      Clinic       @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  createdBy   User         @relation("DebtWaiverCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  appointment Appointment? @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  admission   Admission?   @relation(fields: [admissionId], references: [id], onDelete: Cascade)

  @@index([clinicId])
  @@map("debt_waivers")
}
```

`Clinic`, `User`, `Appointment`, `Admission` ga teskari bog'lanish
qo'shiladi (`debtWaiver` / `debtWaivers`).

- [ ] Sxema o'zgartiriladi
- [ ] `npx prisma migrate dev --name qarzni_kechirish`
- [ ] **`npm run gen:tenant-models`** — bu qadam tashlab ketilmasin.
      `DebtWaiver` da `clinicId` bor, ya'ni u `TENANT_MODELS` ga tushishi
      SHART; tushmasa jadval klinika filtrisiz qoladi va bir klinika
      boshqasining kechirishlarini ko'radi.
      Skript `python3` talab qiladi. U bo'lmasa: `tenant-models.ts` dagi
      `TENANT_MODELS` ga alifbo tartibida `'DebtWaiver',` qo'shiladi
      (`'ChatMessage'` bilan `'Doctor'` orasiga) va **`npm run test:isolation`
      bilan tasdiqlanadi** — bu tekshiruv aynan shu xato uchun yozilgan.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 3: `debts.waive` ruxsati

**Fayllar:**
- O'zgartirish: `clinicos-api/src/common/permissions.ts`
- O'zgartirish: `clinicos-frontend/src/types/models.ts` (`Permission` union)
- O'zgartirish: `clinicos-frontend/src/lib/permissions.ts`

- [ ] `Permission` unioniga `'debts.waive'` (uch joyda ham)
- [ ] `OWNER_PERMISSIONS` ga qo'shiladi. `RECEPTIONIST_PERMISSIONS` ga
      **qo'shilmaydi** — izoh bilan: pulni oladigan odam qarzni ham yopa
      olsa, pulni o'ziga olib "kechirdim" deb yozib qo'yishi mumkin.
      `payments.refund` registratorda yo'qligi bilan bir xil sabab.
- [ ] `IMPERSONATION_PERMISSIONS` ga qo'shilmaydi (u faqat ko'rish uchun)
- [ ] `npm run check:permissions`
- [ ] Commit

### Vazifa 4: `GET /debts`

**Fayllar:**
- Yaratish: `clinicos-api/src/debts/debts.controller.ts`
- Yaratish: `clinicos-api/src/debts/debts.service.ts`
- Yaratish: `clinicos-api/src/debts/debts.dto.ts`
- Yaratish: `clinicos-api/src/debts/debts.module.ts`
- O'zgartirish: `clinicos-api/src/app.module.ts`

**Javob shakli (frontend shunga tayanadi):**

```ts
{
  visits: {
    appointmentId: string
    patientId: string
    patientName: string
    patientPhone: string
    doctorName: string
    serviceName: string
    completedAt: string   // ISO
    daysOverdue: number   // yakunlanganidan beri
    total: number
    paid: number
    remaining: number
  }[]
  ward: {
    admissionId: string
    patientId: string
    patientName: string
    patientPhone: string
    roomNumber: string
    admittedAt: string
    daysOverdue: number
    total: number
    paid: number
    remaining: number
  }[]
  totals: { visits: number; ward: number; all: number }
}
```

- [ ] Ko'rik qarzi: `status: 'COMPLETED'`, `paymentStatus: { not: 'PAID' }`,
      `debtWaiver: null`. Narxni shifokor belgilaydigan xizmatda
      `visit.price` bo'sh bo'lsa qator **chiqmaydi** — summa aytilmagan,
      demak hech kim qarzdor emas.
- [ ] To'langan summalar bitta `groupBy` bilan olinadi (har qabulga
      alohida so'rov yubormaslik uchun — `reception.service.ts` dagi kabi).
- [ ] Statsionar qarzi: `status` `ACTIVE` yoki `DISCHARGED`,
      `debtWaiver: null`, qoldiq `wardBalance()` dan, `remaining > 0`.
- [ ] Tartib: eng eskisi tepada. `take: 200`.
- [ ] Controller: `@Get('debts')`, `@RequirePermission('payments.view')`.
      Frontenddagi `// GET /debts` izohi bilan aynan mos bo'lsin —
      `check:endpoints` shuni solishtiradi.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 5: `POST /debts/waive`

**Fayllar:**
- O'zgartirish: `debts.controller.ts`, `debts.service.ts`, `debts.dto.ts`

- [ ] DTO: `appointmentId?: string`, `admissionId?: string`, `note: string`
      (`@MaxLength(500)`). Ikkalasidan **aynan bittasi** kelishi kerak,
      aks holda 400 — `payments.service.create` dagi
      `if (!dto.serviceId === !dto.admissionId)` bilan bir xil shakl.
- [ ] Yozuv allaqachon kechirilgan bo'lsa 409.
- [ ] Qabul/yotqizish topilmasa 404 (boshqa klinikaniki ham "topilmadi").
- [ ] `@RequirePermission('debts.waive')` va `@Audit('waive', 'debt')`.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 6: Bildirishnoma kechirilganini hisobga olsin

**Fayllar:**
- O'zgartirish: `clinicos-api/src/notifications/notifications.service.ts`

- [ ] `pending_payments` sanog'iga `debtWaiver: null` qo'shiladi. Aks holda
      kechirilgan qarz ro'yxatdan tushadi-yu, bildirishnomada qolib
      ketadi — va u hech qachon o'chmaydi.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 7: Registratura paneli — butun qarz

**Fayllar:**
- O'zgartirish: `clinicos-api/src/reception/reception.service.ts`

- [ ] `attention.unpaid` endi bugungi qabullardan emas, **alohida
      so'rovdan** to'ladi: hamma to'lanmagan yakunlangan qabul,
      kechirilmagani, eng eskisi tepada, `take: 5`.
- [ ] Javobga `attention.unpaid.total` qo'shiladi — nechtasi borligi
      (5 tadan ko'p bo'lsa interfeys "Hammasi" deydi).
- [ ] **Kunlik hisoblar tegilmaydi**: "bugun 47 qabul", navbat, kassa —
      hammasi bugungi so'rovdan. Buni izohda yozib qo'yish kerak, aks
      holda keyingi kishi ikkalasini bitta so'rovga birlashtirib
      yuboradi va kunlik raqamlar buziladi.
- [ ] `prepaidUnpaid` bugungi bo'lib qoladi — u navbat haqidagi
      ogohlantirish, qarz haqidagi emas.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 8: Frontend shartnomasi, API va demo qatlam

**Fayllar:**
- O'zgartirish: `clinicos-frontend/src/types/models.ts`
- Yaratish: `clinicos-frontend/src/api/debts.ts`
- O'zgartirish: `clinicos-frontend/src/mock/db.ts`, `clinicos-frontend/src/mock/seed.ts`

- [ ] `models.ts`: `VisitDebt`, `WardDebt`, `DebtList`, `DebtWaiver`;
      `ReceptionSummary.attention.unpaid.total`
- [ ] `api/debts.ts`: `// GET /debts` → `listDebts()`,
      `// POST /debts/waive` → `waiveDebt(input)`. Ikkalasi ham `USE_MOCK`
      bo'yicha shoxlanadi.
- [ ] Demo qatlamda ham xuddi shu mantiq: qoldiq to'lovlardan hisoblanadi,
      kechirilgani chiqmaydi. Seedga bir nechta qisman to'langan qabul
      qo'shiladi (kechagi va undan oldingi), aks holda demo rejimda
      ro'yxat bo'sh ko'rinadi va yangi sahifani umuman ko'rib bo'lmaydi.
- [ ] `npm run check` (frontend)
- [ ] Commit

### Vazifa 9: Qarzdorlar sahifasi

**Fayllar:**
- Yaratish: `clinicos-frontend/src/pages/Debts.tsx`
- O'zgartirish: `clinicos-frontend/src/App.tsx` (lazy import + `<Route path="debts">` `<Guard permission="payments.view">`)
- O'zgartirish: `clinicos-frontend/src/components/layout/navigation.ts` (`nav.group.finance` guruhiga, `/payments` dan keyin)
- O'zgartirish: `clinicos-frontend/src/i18n/{uz,ru,en}.ts`

- [ ] Ikkita bo'lim: ko'rik qarzi va statsionar qarzi, har biri
      `DataTable` bilan. Tepada umumiy summa.
- [ ] Har qatorda "To'lov olish" — `PaymentFormModal` ni preset bilan
      ochadi (`appointmentId` bilan), ya'ni to'lov qabulga bog'lanadi.
- [ ] Egasiga "Kechirish" tugmasi (`can('debts.waive')`), sabab so'raydigan
      oyna bilan. Registratorga ko'rinmaydi.
- [ ] Uchta tilga ham kalitlar.
- [ ] `npm run check` (frontend)
- [ ] Commit

### Vazifa 10: Paneldagi ro'yxat va havola

**Fayllar:**
- O'zgartirish: `clinicos-frontend/src/pages/Reception.tsx`

- [ ] Yoyilgan ro'yxatda "necha kundan beri" ko'rsatiladi.
- [ ] `unpaid.total > 5` bo'lsa ro'yxat ostida "Hammasi (N)" havolasi
      `/debts` ga.
- [ ] `npm run check` (frontend)
- [ ] Commit

### Vazifa 11: Tekshiruv va hujjat

**Fayllar:**
- O'zgartirish: `clinicos-api/scripts/test-crud.ts`
- O'zgartirish: `clinicos-frontend/docs/API.md` (generatsiya)

- [ ] `test:crud` ga qo'shiladi:
      - qisman to'lov → qabul `partial`, `GET /debts` da qoldiq to'g'ri;
      - kechagi qarz ro'yxatda chiqishi;
      - qoldiq to'langach ikkala joydan yo'qolishi;
      - egasi kechirsa — `/debts` dan ham, bildirishnoma sonidan ham tushishi;
      - registrator kechirmoqchi bo'lsa **403**;
      - statsionar qoldig'i to'lov chegarasi bilan bir xil chiqishi.
- [ ] `npm run docs:api` (python3 talab qiladi)
- [ ] To'liq tekshiruv: ikkala loyihada `npm run check`, keyin baza bilan
      `npm run test:isolation`, `npm run test:crud`, `npm run smoke`.
- [ ] Commit

---

## Deploydan oldin

Bu ish oldingi commit ustiga quriladi va u hali serverga chiqmagan.
Ikkala migratsiya (`shifokor_belgilaydigan_narx` va `qarzni_kechirish`)
birinchi deployda birdan qo'llanadi. Ularni **baza bilan** bir marta
sinab ko'rish kerak: `npm run db:up`, `npx prisma migrate dev`,
`npm run db:seed`, keyin `test:isolation` va `test:crud`.

`test:isolation` bu safar ayniqsa muhim — yangi jadval qo'shildi.
