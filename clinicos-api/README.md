# ClinicOS API

Xususiy klinikalar uchun boshqaruv tizimining backendi.
NestJS + PostgreSQL + Prisma.

Frontend alohida loyihada: `../clinicos-frontend`.

---

## Tez boshlash

Kerak: Node 20+ va PostgreSQL 17.

```bash
npm install
cp .env.example .env     # kerak bo'lsa DATABASE_URL ni to'g'rilang
npx prisma migrate dev   # 35 ta jadval yaratadi
npm run db:seed          # ikkita klinika + demo ma'lumot
npm run dev
```

Server `http://localhost:3000` da ko'tariladi.

Demo hisoblar (parol hamma joyda `demo1234`):

| Rol | Email |
|---|---|
| Platforma egasi | `admin@clinicos.uz` |
| Klinika egasi | `owner@shifomed.uz` |
| Registrator | `reception@shifomed.uz` |
| Shifokor | `aziz.karimov@shifomed.uz` |

Ikkinchi klinika: `@salomat.uz` bilan xuddi shunday uchta hisob.
**Ikkita klinika ataylab** — bittasi bilan ajratishni sinab bo'lmaydi.

---

## Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `npm run dev` | Ishlab chiqish serveri (o'zgarishda qayta yuklanadi) |
| `npm run build` | `dist/` ga yig'adi |
| `npm run typecheck` | Faqat tip tekshiruvi |
| `npm run db:seed` | **Bazani TOZALAB**, demo ma'lumot yozadi |
| `npm run bootstrap` | Ishlab chiqarish uchun boshlang'ich yozuvlar (hech narsa o'chirmaydi) |
| `npm run test:isolation` | **Klinika ajratish sinovi** — eng muhimi |
| `npm run smoke` | Barcha endpointni har bir rol nomidan bosib chiqadi |
| `npm run check:permissions` | Ruxsat nomlari frontend bilan mos keladimi |
| `npm run check:endpoints` | Frontend kutgan endpointlar bormi |
| `npm run check` | Hammasi ketma-ket — yuklashdan oldin shu |

---

## Uchta qoida

Bu qoidalar buzilsa tizim ishlamaydi. Ular kodga o'rnatilgan, lekin
yangi kod yozganda ham yodda tutish kerak.

### 1. Klinika filtri qatlamda, so'rovda emas

`src/prisma/tenant.extension.ts` har bir so'rovga `clinicId` ni
o'zi qo'shadi. Uni qo'lda yozish shart emas va yozmaslik kerak.

`clinicId` **faqat tokendan** olinadi. So'rov tanasida kelgan
`clinicId` e'tiborga olinmaydi — filtr uni bosib yozadi.

Yangi jadval qo'shsangiz, uni `src/prisma/tenant-models.ts` dagi
ro'yxatga ham qo'shing. Unutilsa — o'sha jadval filtrsiz qoladi.

Tekshirish: `npm run test:isolation`

### 2. Vazifalar bo'linadi

Shifokor tashrifni yozadi, registrator pulni yozadi, egasi
ikkalasini solishtiradi. Shuning uchun:

- Egada `visits.create` va `payments.create` **yo'q**
- Registratorda `visits.create` **yo'q**
- Registratorda `cashcontrol.view` **yo'q** — u o'z ishining
  tekshiruvini ko'rmaydi

Bu tasodif emas. Ruxsat qo'shishdan oldin "bu odam endi o'zini
o'zi tekshira oladimi?" deb so'rang.

### 3. Pul yozuvi o'zgarmaydi

To'lovni tahrirlash yoki o'chirish endpointi **yo'q va bo'lmasligi
kerak**. Xato bo'lsa — qaytarish yoziladi, eskisi qoladi.

Xuddi shunday: solingan jarima o'chirilmaydi (kechiriladi),
davomat yozuvi kim belgilagani bilan qoladi, klinika paneliga
kirish yozuvi kirishdan **oldin** yaratiladi.

---

## Papkalar

```
prisma/
  schema.prisma      35 ta jadval
  seed.ts            Demo ma'lumot

src/
  prisma/
    tenant.extension.ts   ENG MUHIM FAYL — majburiy klinika filtri
    tenant-models.ts      Qaysi jadval klinikaga tegishli
  common/
    permissions.ts        Rollar va ruxsatlar (frontend bilan mos)
    request-context.ts    Joriy foydalanuvchi (AsyncLocalStorage)
    guards/               Token va ruxsat qorovullari
    audit.service.ts      Audit jurnaliga yozish
    audit.interceptor.ts  `@Audit(...)` dekoratori
    api-enum.ts           Baza ↔ interfeys enum o'girgichi
  <modul>/
    *.controller.ts       Marshrutlar va ruxsatlar
    *.service.ts          Mantiq
    *.dto.ts              Kiruvchi ma'lumot tekshiruvi

scripts/                  Tekshiruv skriptlari
```

---

## Bilib qo'yish kerak

**Enum harflari.** Bazada `CHECKED_IN`, interfeysda `checked_in`.
O'girish `src/common/api-enum.ts` da, chegara — servis qatlamida.
Prisma yozuvini to'g'ridan-to'g'ri qaytarmang: sxemaga yangi
ustun qo'shilsa (masalan parol xeshi), u avtomatik tashqariga
chiqib ketardi.

**Prisma 7.** Ulanish manzili sxemada emas, `prisma.config.ts` da.
Mijoz drayver adapteri bilan ishlaydi (`@prisma/adapter-pg`).
`latest` tegi hozir release candidate'ga qo'yilgan — **7.10.0 da
qoling**.

**`incremental` o'chirilgan.** U yoqilganda `tsc --noEmit` build
ma'lumotini "qurilgan" deb belgilab qo'yardi va `nest build`
fayllarni chiqarmasdi. Sababi `tsconfig.json` da yozilgan.

**Ruxsatlar ikki joyda.** Frontendda ham ro'yxat bor, lekin u
faqat tugmani ko'rsatish uchun. Haqiqiy cheklov shu yerda.
Ikkalasi ajralib ketmasligi uchun `npm run check:permissions`.

DIQQAT: u faqat ruxsat NOMLARINI solishtiradi, rol → ruxsat
taqsimotini emas. Ya'ni "shifokorda `doctors.view` yo'q, lekin
uning sahifasi shu endpointga uradi" turidagi nomuvofiqlikni
u ushlamaydi — bunday narsa faqat ilovani rol nomidan bosib
ko'rganda chiqadi.

**Klinika paneliga kirish.** Platforma egasi kirganda tokenga
`impersonationId` yoziladi, muddati 30 daqiqa, ruxsatlari esa
`IMPERSONATION_PERMISSIONS` — faqat ko'rish. Chiqish alohida
kontrollerda (`impersonation.controller.ts`), chunki kirgan
odamda `platform.*` ruxsatlari bo'lmaydi.

---

## Frontend bilan ulash

Frontend loyihasining `.env` iga shu qatorni yozing:

```
VITE_API_URL=http://localhost:3000
```

Backendning `.env` idagi `CORS_ORIGIN` frontend qaysi portda
ko'tarilganiga mos bo'lishi kerak. Vite 5173 band bo'lsa keyingi
portga o'tadi — shuning uchun uchtasi ochiq qo'yilgan.

Ikkalasi ulanib ishlashi to'liq sinaldi: to'rt rol, 52 marshrut,
va interfeys formalari orqali bemor qo'shish hamda to'lov qabul
qilish.

---

## Hali qilinmagan

Bular ataylab qoldirilgan va ishlab chiqishga chiqishdan oldin
kerak bo'ladi:

- **Row Level Security** — `docs/DATABASE.md` (frontend loyihasida)
  1-bo'limga qarang. Dastur filtri bor, baza darajasidagi ikkinchi
  qatlam hali yo'q.
- **Audit jurnali qisman** — tibbiy yozuv ochilishi va tizimga
  kirish yoziladi (`src/common/audit.service.ts`). Jurnalni
  KO'RISH uchun interfeys hali yo'q: hozircha faqat bazadan
  o'qiladi (`audit_logs` jadvali).
- **Bemor fikri havolasi yopiq** — SMS orqali yuboriladigan
  sahifa uchun `POST /feedback` va `/feedback/lookup` ochilishi
  kerak. Ochishdan **oldin** so'rov chastotasini cheklang, aks
  holda telefon raqamlarini birma-bir sinab, klinikaning bemorlar
  bazasini aniqlab olish mumkin.
- **Jarima qoidalarini qo'llash** — qoidalar saqlanadi, lekin
  ularni davomatga qarab avtomatik qo'llaydigan fon vazifasi
  hali yo'q.
- **Zaxira nusxa** — haqiqiy bemor ma'lumoti kirishidan oldin
  sozlanishi shart.

---

## Fayl saqlash (S3 / MinIO)

Avatar, klinika logosi va kelajakda hujjatlar S3 mos xotirada
saqlanadi. **Bucket yopiq**: fayl to'g'ridan-to'g'ri o'qilmaydi.

Bazada havola emas, **kalit** yotadi:

```
clinics/<clinicId>/<tur>/<uuid>.<kengaytma>
```

`clinicId` faqat tokendan olinadi — klinika ajratish fayllarga
ham tarqaydi. O'qishda `SignedUrlInterceptor` kalitni 15 daqiqalik
imzolangan havolaga o'giradi, ya'ni frontend shartnomasi
(`avatarUrl: string`) o'zgarmaydi.

Yuklash ikki qadam:

```
POST /uploads/avatars   (multipart)  →  { key }
PATCH /profile          { avatarUrl: key }
```

Fayl turi **magic baytdan** aniqlanadi — mijozning `Content-Type`
iga ishonilmaydi. SVG ataylab qabul qilinmaydi.

`.env` da `S3_*` bo'sh qoldirilsa yuklash o'chiq bo'ladi va
`POST /uploads` 503 qaytaradi; qolgan hamma narsa ishlayveradi.

---

## Parol

Har bir foydalanuvchi o'z parolini almashtiradi:

```
POST /auth/password   { currentPassword, newPassword }
```

**Joriy parol majburiy.** Token borligi "bu o'sha odam" degani
emas — qarovsiz qolgan ochiq sessiya yonidan o'tgan odam hisobni
o'zlashtirib ololmasin.

Almashtirilgach **eski tokenlar darhol yaroqsiz** bo'ladi.
Tokenda `pwd` belgisi bor va u bazadagi `passwordChangedAt` bilan
solishtiriladi. Vaqt bo'yicha emas, aniq taqqoslash: `iat` butun
soniyalarda va parol almashtirilgan soniyada berilgan eski token
o'tib ketardi (buni `test:crud` ushladi).

Javobda **yangi sessiya** qaytadi — aks holda almashtirgan odam
o'zi chiqib qolardi.

Egasi xodim parolini qayta belgilaydi:

```
POST /staff/:id/password   { password, mustChangePassword }
```

Bu ham xodimning eski sessiyalarini uzadi. `mustChangePassword`
ilgari qabul qilinardi, lekin hech qayerga yozilmasdi — sxemada
bunday ustun yo'q edi.

**Parolni tiklash (unutgan bo'lsa) yo'q** — buning uchun pochta
xizmati kerak. Klinika egasi parolini unutsa, hozircha faqat
bazadan tiklash mumkin.

---

## Klinika boshqaruvi

Platforma admini uchun:

| Endpoint | Nima |
|---|---|
| `POST /platform/tenants` | Klinika + egasi + obuna, bitta tranzaksiyada |
| `PATCH /platform/tenants/:id` | Nom, telefon, manzil, shahar |
| `POST /platform/tenants/:id/suspend` | Vaqtincha to'xtatish |
| `POST /platform/tenants/:id/archive` | Arxivlash (`CANCELLED`) |
| `POST /platform/tenants/:id/activate` | Qaytarish |

**`DELETE` yo'q va bo'lmasligi kerak.** Tibbiy yozuvni o'chirish
odatda qonun bilan taqiqlanadi. Arxivlangan klinikaning ma'lumoti
joyida qoladi, faqat kirish yopiladi.

To'xtatilgan yoki arxivlangan klinika xodimi **kira olmaydi va
qo'lidagi eski token ham darhol yaroqsiz bo'ladi** — tekshiruv
`common/clinic-access.ts` da, kirishda ham, har bir so'rovda ham.
