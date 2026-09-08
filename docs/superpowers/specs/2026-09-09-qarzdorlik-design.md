# Qarzdorlik — loyiha

**Sana:** 2026-09-09
**Holat:** kelishilgan

Ba'zi xizmatlar bir marta to'lanmaydi. Stomatologiyada summa katta va
bemor uni 2-3 ga bo'lib to'laydi. Tizim buni ko'rsatishi kerak: kim
qancha qarzdor va qachondan beri.

---

## Nima allaqachon ishlaydi

Qisman to'lov mexanizmi bor: `Appointment.paymentStatus` da `PARTIAL`
holati, to'lovlar yig'ilib boradi va katalog narxidan kam summa qabul
qilinadi (`payments.service.ts`). Bemor 500 mingdan 200 mingini
to'lasa, tizim buni to'g'ri yozadi.

**Yetishmayotgani — qarzni ko'rish.** "Kim qancha qarzdor" degan
ro'yxat hech qayerda yo'q.

## Yo'l-yo'lakay tuzatiladigan nuqson

Registratura paneli faqat **bugungi** qabullarni o'qiydi
(`reception.service.ts`, `startsAt` bugungi oraliqda), bildirishnoma
esa **hamma vaqtni** sanaydi (`notifications.service.ts`, sana filtri
yo'q). Ya'ni kechagi qarz bildirishnomada turadi, panelda esa
ko'rinmaydi — va bildirishnoma endi aynan o'sha panelga yo'naltirilgan.
Qarz ro'yxatisiz bu nomuvofiqlik tuzalmaydi.

---

## Qaror: qarz saqlanmaydi, hisoblanadi

Yangi "balans" ustuni yo'q. Qarz = xizmat narxi − to'langan summa.

**Nega:** balans ustuni bo'lsa, u to'lov yozuvlari bilan ertami-kechmi
bir-biriga to'g'ri kelmay qoladi va qaysi biri haqiqat ekani noma'lum
bo'ladi. To'lovlar allaqachon o'zgarmas yozuv — qarz ulardan chiqadi.

## Qarz nima hisoblanadi

**Ko'rik qarzi:** qabul `COMPLETED`, `paymentStatus != PAID`,
kechirilmagan. Bekor qilingan va kelmagan qabullar kirmaydi.

Narxini shifokor belgilaydigan xizmatda shifokor summani hali
belgilamagan bo'lsa — qarz **emas**. Hech kim hech qancha qarzdor
emas, chunki summa aytilmagan. Bunday holat registratura panelida
o'zining "shifokor belgilamagan" ko'rinishi bilan chiqadi.

**Statsionar qarzi:** yotqizish `ACTIVE` yoki `DISCHARGED`, qoldiq
noldan katta, kechirilmagan. `PLANNED` kirmaydi — bemor hali yotmagan.

---

## Ikkita ro'yxat, bitta so'rov

`GET /debts` → `{ visits: [...], ward: [...], totals }`.

Registratura paneli kabi bitta so'rov: sahifa ikkalasini birga
ko'rsatadi va ikkita alohida so'rov klinika internetida sezilarli
kechikish beradi.

Ruxsat — mavjud `payments.view`. Egasida ham, registratorda ham bor;
shifokorda yo'q. Yangi ruxsat kerak emas.

Har qatorda: bemor, telefon, xizmat (yoki palata), umumiy summa,
to'langani, **qolgani**, necha kundan beri. Tartib — eng eskisi tepada.
Sahifada sahifalash bor.

Tugma — "To'lov olish". U to'lov formasini `appointmentId` (yoki
`admissionId`) bilan ochadi, ya'ni to'lov qabulga bog'lanadi va
to'langach qarz ro'yxatdan o'zi yo'qoladi.

## Registratura paneli

"To'lov olinmagan" ro'yxati butun qarzga kengayadi: kechagi ham,
o'tgan haftadagi ham. Eng eskisi tepada, 5 tasi ko'rinadi, ostida
"Hammasi" havolasi Qarzdorlar sahifasiga olib boradi.

**Panelning kunlik raqamlari o'zgarmaydi.** "Bugun 47 qabul", navbat,
kassa — hammasi bugungi bo'lib qoladi. Shuning uchun qarz **alohida
so'rov** bilan olinadi; hozirgi so'rovni kengaytirish kunlik
hisoblarni buzardi.

## Kechirish

Umidsiz qarz ro'yxatda abadiy turmasligi kerak. Shakl — jarima
kechirilishi bilan aynan bir xil:

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
}
```

Qarz **o'chirilmaydi** va `paymentStatus` ham o'zgarmaydi — u haqiqatan
to'lanmagan va hisobot shuni ko'rsatishi kerak. Ro'yxatlar va
bildirishnoma esa kechirilganini chiqarmaydi.

`POST /debts/waive` — yangi ruxsat `debts.waive`, **faqat egasida**.
Registratorda ataylab yo'q: pulni oladigan odam qarzni ham yopa olsa,
pulni o'ziga olib, "kechirdim" deb yozib qo'yishi mumkin. Bu
`payments.refund` ning registratorda yo'qligi bilan bir xil sabab.

Ruxsat ikkala ro'yxatga (backend va frontend) qo'shiladi, aks holda
`npm run check:permissions` yiqiladi.

## Statsionar hisobi bitta joyga chiqariladi

Qoldiq hozir `payments.service.ts` ning ichida, `wardPreview` da
hisoblanadi: `max(reja kunlari, haqiqiy kunlar) × kunlik narx −
to'langan`. U bir vaqtning o'zida yuborilgan summani ham tekshiradi.

Qarz ro'yxatiga xuddi shu hisob kerak, lekin tekshiruvsiz. Ikki marta
yozilsa, biri o'zgarib ikkinchisi eskirib qoladi — pulda bu qimmatga
tushadi.

Shuning uchun hisob `src/common/ward-revenue.ts` ga `wardBalance()`
bo'lib chiqadi (u fayl allaqachon statsionar puli uchun) va ikkala
joy — `wardPreview` ham, qarz ro'yxati ham — o'shani chaqiradi.

## Interfeys

Yangi sahifa `/debts` — "Qarzdorlar". Yon menyuda "Moliya" guruhida,
`payments.view` bilan yopilgan. Ikkita bo'lim: ko'rik qarzi va
statsionar qarzi, har biri o'z ustunlari bilan. Tepada umumiy summa.

Egasiga har qatorda "Kechirish" tugmasi ham chiqadi (sabab yozish
bilan). Registratorga u ko'rinmaydi.

---

## Ataylab qilinmaydi

**Muddat va eslatma yo'q.** Muddat qo'yish o'z-o'zidan rejali
to'lashga olib boradi: "kechikdi" holati, muddat nazorati, fon
vazifasi. Bu alohida ish. Hozir faqat qoldiq kuzatiladi.

---

## Tekshirish

| Nima | Qanday |
|---|---|
| Qisman to'lov | 500 minglik xizmatga 200 ming to'lanadi → qabul `partial`, qarzda 300 ming qoladi |
| Eski qarz | Kechagi to'lanmagan qabul panelda ham, ro'yxatda ham chiqsin |
| To'lab bo'lish | Qoldiq to'langach ikkala joydan ham yo'qolsin |
| Kechirish | Egasi kechirsa — ro'yxatdan ham, bildirishnoma sonidan ham tushsin |
| Ruxsat | Registrator kechirmoqchi bo'lsa 403 |
| Statsionar | Yotgan bemorning qoldig'i `wardPreview` bergan chegara bilan bir xil chiqsin |
| Umumiy | `npm run check` (ikkalasida), `test:isolation`, `test:crud`, `smoke` |

Bular `test:crud` ga qo'shiladi.
