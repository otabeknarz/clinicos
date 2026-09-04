# ClinicOS — serverga joylashtirish

Ikki yo'l bor. Hozir ishlatilayotgani — **Coolify**.

- [Coolify orqali](#coolify-orqali) — amaldagi joylashtirish
- [Qo'lda, Ubuntu ustiga](#qolda-ubuntu-ustiga) — Coolify siz

---

## Coolify orqali

Loyihada uchta resurs bor (`ClinicOS` → `production`):

| Resurs | Nima | Manzil |
|---|---|---|
| `clinicos-postgres` | PostgreSQL 17 | ichki, tashqariga ochilmagan |
| `clinicos-api` | NestJS, Dockerfile | `api.clinic-os.uz` |
| `clinicos-frontend` | React → Nginx, Dockerfile | `clinic-os.uz` |

Ikkala ilova ham shu repodan yig'iladi:

```
build pack        Dockerfile
base directory    /clinicos-api  yoki  /clinicos-frontend
branch            main
```

### Muhit o'zgaruvchilari

`clinicos-api` — hammasi **runtime**, build-time emas (aks holda
`JWT_SECRET` image tarixiga tushib qolardi):

```
DATABASE_URL     Coolify bergan ichki manzil (postgres://…@<db-uuid>:5432/clinicos)
JWT_SECRET       openssl rand -base64 48
JWT_EXPIRES_IN   12h
PORT             3000
CORS_ORIGIN      https://clinic-os.uz
```

`clinicos-frontend` — **build-time bo'lishi SHART**:

```
VITE_API_URL     https://api.clinic-os.uz
```

Vite uni yig'ish paytida fayllarga kiritadi. Runtime qilib
qo'yilsa, ilova demo rejimda yig'iladi va serverga bitta ham
so'rov ketmaydi. Dockerfile buni ushlaydi va build'ni to'xtatadi.

### Yangilash

```bash
git push origin main
```

Keyin Coolify'da ikkala ilovani Deploy qiling (yoki webhook
qo'ying). Migratsiya avtomatik: `docker-entrypoint.sh` har ishga
tushishda `prisma migrate deploy` bajaradi.

### Yangi klinika qo'shish

Endpoint yo'q — bu ataylab, chunki klinika yaratish tarif va
obuna bilan bog'liq. Coolify → `clinicos-api` → Terminal:

```bash
CLINIC_NAME="Shifo Med" \
CLINIC_PHONE="+998 71 200 00 00" \
CLINIC_ADDRESS="Toshkent, ..." \
OWNER_EMAIL=owner@shifomed.uz \
OWNER_NAME="Ism Familiya" \
PLAN=STANDARD \
npm run bootstrap -- clinic
```

Parol berilmasa skript o'zi yasab, bir marta ekranga chiqaradi.
Registrator va shifokorlarni klinika egasi panel orqali qo'shadi.

Terminal ochilmasa, xuddi shu buyruqni Scheduled Task sifatida
`* * * * *` bilan qo'yib, bir marta ishlagach o'chirib tashlang.

> **`npm run db:seed` NI SERVERDA ISHLATMANG.** U bazani AVVAL
> TOZALAYDI. Demo ma'lumot uchun to'g'ri, ishlayotgan klinikada —
> falokat.

---

## Qo'lda, Ubuntu ustiga

### 0. Nima kerak

- Ubuntu server, `sudo` huquqi bilan
- Ikkala domen serverning IP siga qaratilgan (A yozuvi)
- Node 20+ va PostgreSQL 17

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql-17 nginx git
```

`postgresql-17` topilmasa, PostgreSQL rasmiy omborini qo'shing —
Ubuntu ombori odatda eskiroq versiyani beradi.

---

### 1. Baza

```bash
sudo -u postgres psql
```

```sql
CREATE USER clinicos WITH PASSWORD 'BU_YERGA_KUCHLI_PAROL';
CREATE DATABASE clinicos OWNER clinicos;
\q
```

Parolni hozir o'ylab toping va saqlang: `openssl rand -base64 24`.

---

### 2. Kod

```bash
sudo adduser --system --group --home /srv/clinicos clinicos
sudo -u clinicos git clone https://github.com/otabeknarz/clinicos.git /srv/clinicos
```

---

### 3. API

```bash
cd /srv/clinicos/clinicos-api
sudo -u clinicos cp .env.example .env
sudo -u clinicos nano .env
```

`.env` ichi:

```ini
DATABASE_URL="postgresql://clinicos:BU_YERGA_KUCHLI_PAROL@localhost:5432/clinicos?schema=public"

# openssl rand -base64 48
JWT_SECRET="..."
JWT_EXPIRES_IN="12h"

PORT=3000

# FAQAT haqiqiy domen. localhost qatorlarini o'chiring.
CORS_ORIGIN="https://clinic-os.uz"
```

> `JWT_SECRET` ni albatta almashtiring. `.env.example` dagi qiymat —
> `dev-only-change-me`. U qolsa, tokenni istalgan odam yasay oladi.

Yig'ish:

```bash
cd /srv/clinicos/clinicos-api
sudo -u clinicos npm ci
sudo -u clinicos npx prisma migrate deploy
sudo -u clinicos npm run build
```

> `npm ci` — to'liq, `--omit=dev` siz. Yig'ish uchun `@nestjs/cli`,
> boshlang'ich yozuvlar uchun `ts-node` kerak, ikkalasi ham devDependencies da.

> **`npm run db:seed` NI ISHLATMANG.** U bazani AVVAL TOZALAYDI va
> demo ma'lumot yozadi. Ishlab chiqarishda quyidagi qadam ishlatiladi.

### Boshlang'ich yozuvlar

Toza bazada birorta hisob yo'q. Platforma egasini yarating:

```bash
sudo -u clinicos env \
  ADMIN_EMAIL=admin@clinic-os.uz \
  ADMIN_NAME="Ism Familiya" \
  ADMIN_PHONE="+998 90 000 00 00" \
  npm run bootstrap -- platform
```

Parol ekranga chiqadi va **boshqa ko'rsatilmaydi** — hoziroq saqlang.

Har bir yangi klinika uchun:

```bash
sudo -u clinicos env \
  CLINIC_NAME="Shifo Med" \
  CLINIC_PHONE="+998 71 200 00 00" \
  CLINIC_ADDRESS="Toshkent, ..." \
  OWNER_EMAIL=owner@shifomed.uz \
  OWNER_NAME="Ism Familiya" \
  PLAN=STANDARD \
  npm run bootstrap -- clinic
```

Registrator va shifokorlarni klinika egasi panel orqali qo'shadi.

Skript hech narsani o'chirmaydi va qayta ishga tushirilsa zarar qilmaydi.

### Xizmat

```bash
sudo cp /srv/clinicos/deploy/systemd/clinicos-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clinicos-api
systemctl status clinicos-api
```

---

### 4. Interfeys

```bash
cd /srv/clinicos/clinicos-frontend
sudo -u clinicos sh -c 'echo VITE_API_URL=https://api.clinic-os.uz > .env'
sudo -u clinicos npm ci
sudo -u clinicos npm run build

sudo mkdir -p /var/www/clinicos
sudo cp -r dist/. /var/www/clinicos/
sudo chown -R www-data:www-data /var/www/clinicos
```

> `VITE_API_URL` **yig'ish paytida** fayllarga kiritiladi. Keyin
> o'zgartirsangiz, `npm run build` ni qaytadan bajarish kerak.
>
> Manzil berilmasa ilova demo rejimda ishlaydi — serverga bitta ham
> so'rov ketmaydi va hech kim buni darrov sezmaydi. Yig'ishdan oldin
> `.env` borligini tekshiring.

---

### 5. Nginx va SSL

```bash
sudo cp /srv/clinicos/deploy/nginx/clinicos.conf /etc/nginx/sites-available/clinicos
sudo nano /etc/nginx/sites-available/clinicos      # domenni almashtiring
sudo ln -s /etc/nginx/sites-available/clinicos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d clinic-os.uz -d www.clinic-os.uz -d api.clinic-os.uz
```

---

### 6. Tekshirish

```bash
curl -i https://api.clinic-os.uz/patients          # 401 kutiladi
curl -i https://clinic-os.uz/patients              # 200 va HTML (SPA)
```

Ikkinchisi 404 bersa — `try_files` ishlamayapti.

Brauzerda kiring, keyin **F5 bosing**: ichkarida qolishi kerak.
Kirish sahifasiga tushib qolsa, `VITE_API_URL` yoki `CORS_ORIGIN`
noto'g'ri.

---

### Yangilash

```bash
cd /srv/clinicos
sudo -u clinicos git pull

cd clinicos-api
sudo -u clinicos npm ci
sudo -u clinicos npx prisma migrate deploy
sudo -u clinicos npm run build
sudo systemctl restart clinicos-api

cd ../clinicos-frontend
sudo -u clinicos npm ci
sudo -u clinicos npm run build
sudo cp -r dist/. /var/www/clinicos/
```

---

### Hali qilinmagan — ishga tushirishdan oldin

**Zaxira nusxa.** Hozir yo'q. Haqiqiy bemor ma'lumoti kirishidan
oldin sozlanishi shart. Eng oddiy variant:

```bash
sudo -u postgres sh -c 'pg_dump clinicos | gzip > /var/backups/clinicos-$(date +%F).sql.gz'
```

Buni `cron` ga qo'ying, saqlash muddatini belgilang va **tiklashni
sinab ko'ring**. Sinalmagan zaxira — zaxira emas.

**Row Level Security.** Dastur darajasidagi klinika filtri bor va
sinovdan o'tgan, lekin bazada ikkinchi qatlam yo'q. Namuna:
`clinicos-frontend/docs/DATABASE.md`, 1-bo'lim.

**Kirish urinishlarini cheklash.** `/auth/login` da chegara yo'q —
parolni cheksiz sinab ko'rish mumkin. Nginx darajasida
`limit_req` bilan qo'yish eng oson yo'li.
