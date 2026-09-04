# ClinicOS

Xususiy klinikalar uchun boshqaruv tizimi. **Faqat frontend** — backend
alohida yoziladi, ilova esa u tayyor bo'lgunicha demo ma'lumot bilan
to'liq ishlaydi.

Til: interfeys o'zbekcha, rus va ingliz tillariga almashtiriladi.

---

## Tez boshlash

```bash
npm install
npm run dev
```

Vite manzilni terminalda chiqaradi (odatda `http://localhost:5173`).
Backend **kerak emas** — ilova demo rejimda ishga tushadi.

Kirish sahifasida to'rtta demo hisob bir bosishda tanlanadi:

| Rol | Email | Parol |
|---|---|---|
| Platforma egasi | `admin@clinicos.uz` | `demo1234` |
| Klinika egasi | `owner@shifomed.uz` | `demo1234` |
| Registrator | `reception@shifomed.uz` | `demo1234` |
| Shifokor | `aziz.karimov@shifomed.uz` | `demo1234` |

Har bir rol boshqa bo'limlarni ko'radi — ro'yxat `src/lib/permissions.ts` da.

---

## Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `npm run dev` | Ishlab chiqish serveri |
| `npm run build` | Tiplarni tekshiradi va `dist/` ga yig'adi |
| `npm run preview` | Yig'ilgan versiyani ko'rish |
| `npm run typecheck` | Faqat tip tekshiruvi |
| `npm run lint` | Oxlint |
| `npm run check` | Uchalasi ketma-ket — yuklashdan oldin shu |
| `npm run docs:api` | `docs/API.md` ni qayta yaratadi (Python kerak) |

Talab: Node 20+ (ishlab chiqilgani — Node 24).

---

## Backendni ulash

Bitta qadam:

```bash
cp .env.example .env
```

`.env` ichida manzilni yozing:

```
VITE_API_URL=https://api.clinicos.uz
```

Tamom. `src/api/client.ts` dagi `USE_MOCK` avtomatik `false` bo'ladi va
har bir funksiya demo ma'lumot o'rniga haqiqiy so'rov yuboradi. Boshqa
hech narsani o'zgartirish kerak emas.

**Server nima qilishi kerakligi — `docs/API.md`** (134 ta endpoint,
so'rov/javob shakli, ruxsatlar bilan).

---

## Papkalar

```
src/
  api/          Backend bilan YAGONA ulanish nuqtasi. Boshqa joyda fetch yo'q.
  types/        Frontend↔backend shartnomasi (models.ts)
  mock/         Demo ma'lumot generatori — backend ulanganda ishlatilmaydi
  pages/        Sahifalar, marshrutlar bo'yicha
  components/   Qayta ishlatiladigan qismlar (ui/, layout/, modals/)
  lib/          Yordamchilar: format, ruxsatlar, hooklar
  i18n/         Tarjimalar — har bir til alohida faylda
  store/        Sessiya va mavzu konteksti
```

Muhim qoida: **`src/api/` dan tashqarida `fetch` yo'q.** Shu tufayli
backend ulanganda tegiladigan joy bitta.

---

## Hujjatlar

| Fayl | Kim uchun |
|---|---|
| `docs/API.md` | Backend dasturchisi — endpointlar shartnomasi |
| `docs/DATABASE.md` | Backend dasturchisi — jadvallar va bog'lanishlar |
| `docs/BUSINESS-BRIEF.md` | Biznes konteksti va strategiya |
| `src/types/models.ts` | So'rov/javob JSON tuzilishi |
| `src/lib/permissions.ts` | Rollar va ularning ruxsatlari |

---

## Bilib qo'yish kerak

**Ruxsatlar frontendda himoya emas.** `can()` faqat tugmani ko'rsatadi
yoki yashiradi. So'rovni brauzer konsolidan ham yuborsa bo'ladi —
shuning uchun server har bir so'rovda rolni **mustaqil** tekshirishi
shart.

**Klinika ajratish.** Frontend so'rovga `clinicId` qo'shmaydi; server
uni tokendan oladi. Bu qoida buzilsa, bir klinika boshqasining
bemorlarini ko'radi.

**To'lov yozuvi o'zgarmaydi.** Kiritilgan to'lovni tahrirlash yoki
o'chirish yo'q — xato bo'lsa qaytarish yozuvi qo'shiladi. Firibgarlikka
qarshi butun mantiq shunga tayanadi: shifokor tashrifni yozadi,
registrator pulni yozadi, tizim ikkalasini solishtiradi.

**Demo ma'lumot brauzerda saqlanadi** (`localStorage`, kalit
`clinicos.mock.v1`). Toza holatdan boshlash uchun uni o'chiring yoki
brauzer ma'lumotlarini tozalang.

---

## Yig'ish va joylashtirish

```bash
npm run check
```

Natija — `dist/` papkasida statik fayllar. Uni istalgan statik hosting
xizmatiga (Nginx, Vercel, Netlify, S3) qo'yish mumkin.

Bitta shart: bu **SPA**, ya'ni server topilmagan yo'llarni
`index.html` ga qaytarishi kerak. Aks holda sahifani yangilaganda 404
chiqadi. Nginx uchun:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
