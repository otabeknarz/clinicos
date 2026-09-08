# Ko'rikdan keyingi to'lov — amalga oshirish rejasi

> Loyiha: `docs/superpowers/specs/2026-09-08-korikdan-keyingi-tolov-design.md`

**Maqsad:** (A) to'lov qabulga bog'lanmagani uchun ogohlantirish yo'qolmasligini
tuzatish; (B) narxini shifokor belgilaydigan xizmatlarni qo'shish.

**Yondashuv:** A qism faqat interfeys va bitta havola — baza tegilmaydi.
B qism migratsiyadan boshlanadi, keyin backend zanjiri (xizmat → tashrif →
to'lov → registratura), oxirida interfeys va demo qatlam.

**Texnologiya:** NestJS 11, Prisma 7.10.0, React 19, Tailwind 4.

## Umumiy cheklovlar

- Izohlar, xabarlar va commit matnlari — **o'zbekcha**.
- Har PATCH DTO si juft bo'lishi kerak (`npm run check:dto`); yangi maydon
  `ServiceInputDto` ga qo'shilsa, `UpdateServiceDto` ga ham qo'shiladi.
- Servisdan xom Prisma qatori qaytmaydi; enum `toApi`/`toDb` orqali.
- `where: { clinicId }` qo'lda yozilmaydi — qatlam o'zi qo'yadi.
- Demo qatlam (`src/mock/`) ham yangilanadi, aks holda demo rejim buziladi.
- Har vazifadan keyin commit.

---

## A qism

### Vazifa 1: Bildirishnoma havolasi rolga qarab

**Fayllar:** `clinicos-api/src/notifications/notifications.service.ts`

`/reception` degan yo'l yo'q — registratura paneli registratorning bosh
sahifasi. Egasi esa to'lov yarata olmaydi (`payments.create` unda yo'q).

- [ ] `add('pending_payments', unpaid, …)` chaqiruvidagi `'/payments'`
      o'rniga: `permissions.includes('payments.create') ? '/' : '/payments'`.
      Sababi izohda yozilsin.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 2: Registratura panelida to'lanmaganlar ro'yxati

**Fayllar:** `clinicos-frontend/src/pages/Reception.tsx` (`AttentionRow`, ~355-400)

Hozir `onPay(attention.unpaid.items[0] ?? null)` — faqat birinchisi.

- [ ] Kartochka bosilganda ro'yxat ochilsin (`useState` bilan yoyiladigan
      qism): har qatorda bemor ismi, xizmat nomi, qolgan summa va
      "To'lov olish" tugmasi → `onPay(item)`.
- [ ] Xuddi shu narsa `prepaidUnpaid` uchun ham.
- [ ] Ro'yxat bo'sh bo'lsa kartochka umuman chiqmaydi (hozirgi xatti-harakat).
- [ ] `npm run check`
- [ ] Commit

### Vazifa 3: To'lov formasida ogohlantirish

**Fayllar:** `clinicos-frontend/src/components/modals/PaymentFormModal.tsx`

Ma'lumot manbai tayyor: `GET /patients/:id/appointments`
(`appointments.view` — registratorda bor), javobda `paymentStatus` bor.

- [ ] `preset` **bo'lmaganda** va bemor tanlanganda shu ro'yxat olinadi.
- [ ] `status === 'completed' && paymentStatus !== 'paid'` topilsa — sariq
      eslatma: to'lanmagan ko'rik borligi va uni registratura panelidan
      olish kerakligi. Havola bosh sahifaga.
- [ ] Tugma bloklanmaydi: navbatsiz bemor va statsionar to'lovlari qoladi.
- [ ] `npm run check`
- [ ] Commit

---

## B qism

### Vazifa 4: Baza

**Fayllar:** `clinicos-api/prisma/schema.prisma`, yangi migratsiya

- [ ] `enum ServicePriceMode { FIXED DOCTOR_SET }`
- [ ] `Service`: `priceMode` (`@default(FIXED)`), `minPrice Int?`, `maxPrice Int?`
- [ ] `Visit`: `price Int?` — shifokor belgilagan summa, izohi bilan
      (nega Visit da: shifokorning qarori, oraliq keyin o'zgarsa ham muzlaydi)
- [ ] `npx prisma migrate dev --name shifokor_belgilaydigan_narx`
- [ ] `npm run gen:tenant-models` — yangi model yo'q, lekin farq borligini
      tekshirish uchun; farq chiqmasa fayl o'zgarmaydi
- [ ] `npm run check`
- [ ] Commit

### Vazifa 5: Xizmat — egasining yagona ekrani

**Fayllar:** `services.dto.ts`, `services.service.ts`, `services.controller.ts`

- [ ] `ServiceInputDto`: `priceMode: 'fixed' | 'doctor_set' = 'fixed'`,
      `minPrice?: number`, `maxPrice?: number` (`@IsInt` `@Min(1)`).
- [ ] `UpdateServiceDto` ga xuddi shu uchtasi, sukut qiymatsiz.
- [ ] `ServicesService.create`/`update`: `doctor_set` da `minPrice` va
      `maxPrice` majburiy, `minPrice <= maxPrice`, `paymentTiming` majburan
      `POSTPAID` (oldindan noma'lum summani oldindan to'lab bo'lmaydi);
      `fixed` da ikkalasi `null` ga tushadi. `price` ga `minPrice` yoziladi.
      Qoidabuzarlikda `BadRequestException`, xabari o'zbekcha.
- [ ] `toApiService` ga uchta maydon qo'shiladi.
- [ ] `priceFor`: `DOCTOR_SET` da chegirma qo'llanmaydi (`discountPct: 0`) va
      narx `Visit.price` dan keladi — buning uchun ixtiyoriy `appointmentId`
      argumenti. Ko'rik hali yozilmagan bo'lsa `price: null`.
- [ ] `PriceQueryDto` ga `appointmentId?: string`; controller uzatadi.
- [ ] `npm run check` (`check:dto` ham shu yerda tekshiradi)
- [ ] Commit

### Vazifa 6: Ko'rik — shifokor summani kiritadi

**Fayllar:** `visits.dto.ts`, `visits.service.ts`

- [ ] `VisitInputDto` ga `price?: number` (`@IsInt` `@Min(1)`).
- [ ] `VisitsService.create`: qabulni o'qiyotganda `serviceId` va
      `service: { select: { priceMode, minPrice, maxPrice } }` ham olinsin.
- [ ] `DOCTOR_SET` bo'lsa: `price` majburiy va oraliq ichida bo'lishi shart,
      aks holda `BadRequestException`. `FIXED` bo'lsa `price` yuborilsa —
      rad etiladi (jimgina tashlab yuborilmaydi).
- [ ] `tx.visit.create` ga `price` qo'shiladi; `toApiVisit` ham qaytaradi.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 7: To'lov chegarasi

**Fayllar:** `payments.service.ts` (`catalogPreview`)

- [ ] `catalogPreview` ga `appointmentId` uzatiladi.
- [ ] Xizmat `DOCTOR_SET` bo'lsa: `appointmentId` majburiy; qabulning ko'rigi
      topilib `visit.price` chegara bo'ladi; ko'rik yo'q yoki `price` bo'sh
      bo'lsa — "shifokor summani belgilamagan" (400).
- [ ] `basePrice = visit.price`, `discountPct = 0`.
- [ ] `FIXED` yo'li hozirgidek qoladi.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 8: Registratura ko'radigan summa

**Fayllar:** `reception.service.ts`

- [ ] `appointment.findMany` ga `service.priceMode` va qabulning
      `visit: { select: { price: true } }` qo'shiladi.
- [ ] `toQueueItem.price` va `owed()`: `DOCTOR_SET` da `service.price`
      o'rniga `visit.price`; ko'rik hali yozilmagan bo'lsa `0`.
- [ ] Javobga `priceSetByDoctor: boolean` qo'shiladi — interfeys "Shifokor
      belgiladi" deb ko'rsatishi uchun.
- [ ] `npm run check`
- [ ] Commit

### Vazifa 9: Shartnoma turlari, API va demo qatlam

**Fayllar:** `types/models.ts`, `api/services.ts`, `api/visits.ts`,
`mock/db.ts`, `mock/seed.ts`

- [ ] `models.ts`: `ServicePriceMode`, `Service` ga uchta maydon, `Visit.price`,
      `ReceptionQueueItem.priceSetByDoctor`, `PricePreview.price` `| null`.
- [ ] `resolveServicePrice`: `DOCTOR_SET` da chegirma qo'llanmaydi.
- [ ] `ServiceInput` va `VisitInput` ga yangi maydonlar.
- [ ] `resolvePriceForPatient` ga uchinchi argument `appointmentId`.
- [ ] Demo qatlamda ham xuddi shu mantiq; seedga bitta `doctor_set` xizmat
      qo'shiladi, aks holda demo rejimda yangi yo'lni umuman ko'rib bo'lmaydi.
- [ ] `npm run check` (frontend)
- [ ] Commit

### Vazifa 10: Interfeys

**Fayllar:** `ServiceFormModal.tsx`, `VisitFormModal.tsx`, `Reception.tsx`,
`PaymentFormModal.tsx`

- [ ] `ServiceFormModal`: "Narxni shifokor belgilaydi" belgilash; yoqilganda
      narx maydoni o'rniga "eng kam"/"eng ko'p" chiqadi va to'lov vaqti
      `postpaid` ga qulflanadi (sababi yozilgan izoh bilan).
- [ ] `VisitFormModal`: xizmat `doctor_set` bo'lsa "To'lov summasi" maydoni
      majburiy, yonida oraliq ko'rsatilgan; bo'lmasa maydon umuman yo'q.
- [ ] `Reception.tsx`: to'lanmaganlar ro'yxatida `priceSetByDoctor` bo'lsa
      "Shifokor belgiladi" belgisi.
- [ ] `PaymentFormModal`: `resolvePriceForPatient` ga `appointmentId` uzatiladi,
      summa shifokorning raqamidan to'ladi.
- [ ] `npm run check` (frontend)
- [ ] Commit

### Vazifa 11: Tekshiruv va hujjat

**Fayllar:** `scripts/test-crud.ts`, `docs/API.md`

- [ ] `test:crud` ga: yakunlangan qabulga `appointmentId` bilan to'lov
      yuborilgach `appointment.paymentStatus === 'paid'` bo'lishi. Aynan shu
      tekshiruv yo'q edi — A qismdagi nosozlik shuning uchun sezilmagan.
- [ ] `test:crud` ga: `doctor_set` xizmatga oraliqdan tashqari summa 400
      qaytarishi va `appointmentId` siz to'lov 400 qaytarishi.
- [ ] `npm run docs:api`
- [ ] To'liq tekshiruv: ikkala loyihada `npm run check`, keyin baza bilan
      `npm run test:isolation`, `npm run test:crud`, `npm run smoke`.
- [ ] Commit

---

## Deploy

Kod tayyor bo'lgach: `main` ga push. Coolify da avtomatik deploy
ishlamayotgani aniqlangan (push dan keyin faol deploy paydo bo'lmadi),
shuning uchun `clinicos-api` va `clinicos-frontend` qo'lda ishga tushiriladi.
Migratsiya konteyner boshlanishida `prisma migrate deploy` bilan o'zi
qo'llanadi. **Backend oldin, frontend keyin** — aks holda yangi interfeys
eski API ga murojaat qiladi.
