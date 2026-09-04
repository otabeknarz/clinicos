# ClinicOS — dasturchiga topshiriq

Ikkita loyiha. Ular alohida ishlaydi va alohida yuklanadi.

```
clinicos-frontend/   Interfeys (React + TypeScript + Vite)
clinicos-api/        Server (NestJS + PostgreSQL + Prisma)
```

Har birining ichida o'z `README.md` si bor — ishga tushirish,
buyruqlar va qoidalar o'sha yerda yozilgan. Avval shularni o'qing.

---

## Qayerdan boshlash

**1. Serverni ko'taring** (`clinicos-api/README.md`).
PostgreSQL kerak, qolganini `npm run db:seed` qiladi.

**2. Frontendni ko'taring** (`clinicos-frontend/README.md`).
Uning `.env` iga server manzilini yozing:

```
VITE_API_URL=http://localhost:3000
```

Manzil berilmasa frontend demo rejimda ishlaydi — bemorlar ham,
to'lovlar ham brauzerda generatsiya qilinadi va serverga bitta
ham so'rov ketmaydi.

**3. Kirib ko'ring.** Demo hisoblar `clinicos-api/README.md` da.
Ikkita klinika ataylab yaratilgan — bittasi bilan klinikalarning
ajratilganini sinab bo'lmaydi.

---

## Hujjatlar

| Fayl | Nima |
|---|---|
| `clinicos-frontend/docs/API.md` | 134 endpointning shartnomasi |
| `clinicos-frontend/docs/DATABASE.md` | Jadvallar, bog'lanishlar, qarorlar sabablari |
| `clinicos-frontend/src/types/models.ts` | So'rov/javob JSON tuzilishi |
| `clinicos-api/src/common/permissions.ts` | Rollar va ruxsatlar |

---

## Tekshiruv skriptlari

Backend ichida. Kod o'zgartirgandan keyin ishlatib turing:

```bash
npm run check              # tiplar + ruxsatlar + endpointlar + build
npm run test:isolation     # klinikalar ajratilganini sinaydi
npm run smoke              # hamma endpointni har bir rol nomidan bosadi
```

`test:isolation` eng muhimi. U buzilsa — bir klinika boshqasining
bemorlarini ko'radi, ya'ni mahsulotning ma'nosi qolmaydi.

---

## Uch qoida

Kodga o'rnatilgan, lekin yangi kod yozganda ham yodda tuting.
Batafsil sabablari `clinicos-api/README.md` da.

**1. Klinika filtri qatlamda.** `clinicId` faqat tokendan olinadi,
so'rovdan hech qachon. Yangi jadval qo'shsangiz uni
`src/prisma/tenant-models.ts` ro'yxatiga ham qo'shing.

**2. Vazifalar bo'linadi.** Shifokor tashrifni yozadi, registrator
pulni yozadi, egasi solishtiradi. Ruxsat qo'shishdan oldin
"bu odam endi o'zini o'zi tekshira oladimi?" deb so'rang.

**3. Pul yozuvi o'zgarmaydi.** To'lovni tahrirlash yoki o'chirish
endpointi yo'q va bo'lmasligi kerak. Xato bo'lsa qaytarish
yoziladi.

---

## Hali qilinmagan

Bular ataylab qoldirilgan. Ishga tushirishdan oldin kerak:

- **Row Level Security** bazada (`DATABASE.md`, 1-bo'lim)
- **Zaxira nusxa** — haqiqiy bemor ma'lumoti kirishidan oldin
- **AuditLog to'ldirish** — tibbiy yozuvni kim ochgani
- **Bemor fikri havolasini ochish** — so'rov chastotasi cheklovi
  bilan birga, aks holda telefon raqamlarini sinab bemorlar
  bazasini aniqlab olish mumkin
- **Jarima qoidalarini avtomatik qo'llash** — fon vazifasi

Har birining sababi `clinicos-api/README.md` oxirida yozilgan.

---

## Nima yuborilmadi

- `node_modules` — `npm install` bilan tiklanadi
- `.env` — parollar. O'rniga `.env.example` bor, nusxalab
  to'ldiring
- `dist` — yig'ilgan fayllar, `npm run build` qayta yaratadi
