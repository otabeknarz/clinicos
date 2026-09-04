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
| `npm run db:seed` | Bazani tozalab, demo ma'lumot yozadi |
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
