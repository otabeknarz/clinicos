# Ko'rikdan keyingi to'lov — loyiha

**Sana:** 2026-09-08
**Holat:** kelishilgan

Ikkita ish bitta hujjatda, chunki ikkalasi ham bitta joyga tegadi:
ko'rik tugagandan keyin registrator qancha pul olishi va bu pul
qaysi qabulga yozilishi.

- **A qism** — nosozlik: to'lov olinsa ham ogohlantirish yo'qolmaydi.
- **B qism** — yangi imkoniyat: narxni shifokor belgilaydigan xizmatlar.

---

## A qism — to'lov qabulga bog'lanmayapti

### Nima bo'lyapti

Registrator ko'rikdan keyingi to'lovni oladi. Pul kassada ko'rinadi,
lekin "to'lanmagan qabul" ogohlantirishi joyida turaveradi.

### Sabab

Zanjir uchta bo'g'indan iborat:

1. `notifications.service.ts` "to'lanmagan" ni shunday sanaydi:
   `status = COMPLETED` va `paymentStatus != PAID` bo'lgan qabullar.
2. `appointment.paymentStatus` ni butun backendda bitta joy yozadi —
   `payments.service.ts` dagi `create()`, va u **`if (dto.appointmentId)`**
   shartining ichida.
3. `Payments.tsx` esa `PaymentFormModal` ni `preset` siz ochadi. Forma
   `appointmentId: null` yuboradi → pul `payments` jadvaliga tushadi
   (kassa ko'radi), qabul `UNPAID` bo'lib qoladi → ogohlantirish turaveradi.

Ustiga-ustak ogohlantirishning o'z havolasi `/payments` edi — ya'ni u
registratorni aynan o'zini o'chira olmaydigan sahifaga olib borardi.

Registratura panelidagi navbat qatoridan olingan to'lov to'g'ri ishlaydi
(u `appointmentId` ni uzatadi). Shuning uchun nosozlik "ba'zan bor,
ba'zan yo'q" bo'lib tuyulgan.

### Yechim

**1. Havola rolga qarab.** `/reception` degan yo'l yo'q — registratura
paneli registratorning bosh sahifasi (`/`). Egasi esa to'lov umuman
yarata olmaydi (`payments.create` unda ataylab yo'q), unga `/payments`
to'g'ri. Shuning uchun:

```
href = permissions.includes('payments.create') ? '/' : '/payments'
```

**2. Kartochka ro'yxat ochadi.** `Reception.tsx` dagi
`onPay(attention.unpaid.items[0] ?? null)` — bitta emas, hamma
to'lanmagan qabullar ro'yxatini ko'rsatadi: bemor, xizmat, qolgan summa
va har qatorda o'z "To'lov olish" tugmasi. Backend o'zgarmaydi —
`attention.unpaid.items` allaqachon keladi.

**3. Formada ogohlantirish.** `PaymentFormModal` preset siz ochilganda
va tanlangan bemorda to'lanmagan yakunlangan qabul bo'lsa, forma
eslatma ko'rsatadi va panelga havola beradi. Tugmaning o'zi qoladi —
navbatsiz kelgan bemor va statsionar to'lovlari uchun kerak.

`payments.service.ts` ga tegilmaydi: u to'g'ri ishlayapti, unga
`appointmentId` yetib bormagan edi.

---

## B qism — narxni shifokor belgilaydigan xizmatlar

### Nima uchun

Ba'zi xizmatlarning narxi ko'rikdan oldin ma'lum emas (jarrohlik,
murakkab davolash). Bunday xizmatga katalogda bitta raqam yozib
qo'yish yolg'on — haqiqiy summani shifokor ko'rikda aniqlaydi.

### Kim nima qiladi

| Kim | Qayerda | Nima |
|---|---|---|
| Egasi | `ServiceFormModal` | Xizmat qo'shayotganda "narxni shifokor belgilaydi" ni yoqadi va oraliq beradi. **Boshqa hech qayerda unga tegishli ish yo'q.** |
| Shifokor | `VisitFormModal` | Ko'rikni yakunlashda summani kiritadi. Majburiy. |
| Registrator | Registratura paneli | Shifokor belgilagan summani ko'radi va o'shani oladi. |

Bu loyihaning ikkinchi qoidasiga (vazifalar bo'linishi) mos: summani
belgilaydigan odam bilan pulni oladigan odam boshqa-boshqa.

### Baza

```prisma
enum ServicePriceMode {
  FIXED
  DOCTOR_SET
}

model Service {
  priceMode ServicePriceMode @default(FIXED) @map("price_mode")
  minPrice  Int?             @map("min_price")
  maxPrice  Int?             @map("max_price")
}

model Visit {
  /// Shifokor belgilagan summa. DOCTOR_SET xizmatlarda to'ldiriladi.
  ///
  /// NEGA VISIT DA: bu shifokorning qarori, uning yozuvida turishi
  /// kerak. Oraliq keyin o'zgarsa ham bu summa o'zgarmaydi —
  /// statsionar hisobidagi bilan bir xil mantiq.
  price Int?
}
```

`Service.price` majburiy bo'lib qolaveradi; `DOCTOR_SET` da unga
`minPrice` yoziladi. Sabab: `price` ni o'qiydigan eski joylar (prognoz,
hisobotlar) hech qachon `null` ko'rmasin. Haqiqiy pul baribir
`payments` dan hisoblanadi, shuning uchun bu raqam hisobotni
buzmaydi.

Tekshiruvlar: `minPrice <= maxPrice`, ikkalasi ham `DOCTOR_SET` da
majburiy va `FIXED` da bo'lmasligi kerak.

### To'lov chegarasi

Hozir `payments.service.ts` dagi `catalogPreview` chegarani katalog
narxidan oladi — registrator bemordan ko'p olib, tizimga kam yozib
qo'ymasin uchun. `DOCTOR_SET` da chegaraning manbasi o'zgaradi,
qoidaning o'zi emas:

- `appointmentId` **majburiy** — bog'lanmagan to'lov qabul qilinmaydi,
  chunki summa qaysi ko'rikdan kelishini bilish kerak.
- Chegara `Visit.price` dan olinadi.
- Shifokor summani belgilamagan bo'lsa — 400, "shifokor summani
  belgilamagan".
- `basePrice = Visit.price`, `discountPct = 0`.

**Sodiqlik chegirmasi `DOCTOR_SET` ga qo'llanmaydi.** Shifokor summani
belgilaganda holatni allaqachon hisobga oladi; ustiga chegirma
qo'yilsa ikki marta hisoblangan bo'lardi. `priceFor` bunday
xizmatlarga `discountPct: 0` qaytaradi.

### Ko'rik yakunlanishi

`POST /visits` DTO siga `price?: number` qo'shiladi. Servis tekshiradi:

- qabulning xizmati `DOCTOR_SET` bo'lsa — `price` majburiy va
  `minPrice <= price <= maxPrice`;
- `FIXED` bo'lsa — `price` yuborilmasligi kerak.

Oraliqdan tashqarisi serverda rad etiladi, frontenddagi tekshiruvga
ishonilmaydi.

### PREPAID bilan mos kelmasligi

`DOCTOR_SET` xizmat `PREPAID` bo'la olmaydi: ko'rikdan oldin summa
ma'lum emas, ya'ni oldindan to'lash mumkin emas. Formada "narxni
shifokor belgilaydi" yoqilganda to'lov vaqti avtomatik `POSTPAID` ga
o'tadi va bloklanadi; server ham shu juftlikni rad etadi.

### Interfeys

| Fayl | O'zgarish |
|---|---|
| `ServiceFormModal` | Belgilash + `minPrice`/`maxPrice` maydonlari; `PREPAID` bloklanadi |
| `VisitFormModal` | "To'lov summasi" maydoni — faqat `DOCTOR_SET` da, oraliq ko'rsatkich bilan |
| Registratura paneli | To'lanmagan ro'yxatida "Shifokor belgiladi: N so'm" |
| `PaymentFormModal` | Summa shifokorning raqamidan to'ldiriladi |

`GET /services/:id/price` ga ixtiyoriy `appointmentId` parametri
qo'shiladi — `DOCTOR_SET` da narx aynan shu qabulning ko'rigidan
keladi.

### Tegiladigan qolgan joylar

- `reception.service.ts` dagi `owed()` — `a.service.price` o'rniga
  `DOCTOR_SET` da shifokorning summasi.
- `models.ts` — shartnoma turlari.
- `src/mock/` — demo qatlam. Aks holda demo rejim buziladi va
  nosozlik faqat haqiqiy backendda ko'rinadi.
- `npm run docs:api` — `API.md` qayta yaratiladi.
- Migratsiya nomi o'zbekcha, mavjud uslubda.

---

## Tekshirish

| Nima | Qanday |
|---|---|
| A qism | Yakunlangan qabulga registratura panelidan to'lov olinadi → ogohlantirish yo'qoladi. Payments sahifasidan olinsa → eslatma chiqadi. |
| B qism | `DOCTOR_SET` xizmat yaratiladi, shifokor summa kiritadi, registrator oladi. Oraliqdan tashqari summa 400 qaytarishi kerak. |
| Chegara | Shifokor 500 000 belgilagan bo'lsa, `POST /payments` 600 000 ni rad etsin. |
| Bog'lanmagan to'lov | `DOCTOR_SET` xizmatga `appointmentId` siz to'lov 400 qaytarsin. |
| Umumiy | `npm run check`, `npm run test:isolation`, `npm run test:crud`, `npm run smoke` — to'rt rol bilan. |

Ko'rikdan keyingi to'lov oqimi `test:crud` ga qo'shiladi: to'lov
olingandan keyin `appointment.paymentStatus` `PAID` bo'lishi
tekshiriladi. Aynan shu tekshiruv bo'lmagani uchun A qismdagi
nosozlik sezilmay qolgan edi.
