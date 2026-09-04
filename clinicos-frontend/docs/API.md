# ClinicOS — Backend shartnomasi

**134 ta endpoint.**

Bu hujjat **avtomatik generatsiya qilinadi**, manba — `src/api/` papkasi.
Frontend backendga faqat o'sha papka orqali murojaat qiladi; boshqa
hech qayerda `fetch` yo'q. Kodni o'zgartirgach qayta yarating:

```bash
npm run docs:api
```

---

## Umumiy qoidalar

**Manzil.** Frontend `.env` dagi `VITE_API_URL` ga so'rov yuboradi.
U berilmasa ilova demo (mock) rejimda ishlaydi va serverga umuman
murojaat qilmaydi — shuning uchun backendsiz ham to'liq ko'rish mumkin.

**Autentifikatsiya.** Har bir so'rovda `Authorization: Bearer <token>`.
So'rovlar `credentials: 'include'` bilan ketadi, ya'ni HttpOnly cookie
ishlatsangiz ham bo'ladi — u holda token brauzerda umuman saqlanmaydi
va bu xavfsizroq variant.

**Javob formati.** Barchasi JSON. Ro'yxatlar sahifalangan:

```json
{ "items": [], "total": 620, "page": 1, "pageSize": 20 }
```

**Xatolik.** HTTP holat kodi va tana:

```json
{ "message": "Telefon band", "errors": { "phone": "Bu raqam ro'yxatda bor" } }
```

`errors` ichidagi maydonlar formada tegishli katak ostida ko'rsatiladi.
`204 No Content` — javob tanasi yo'q degani.

---

## To'rtta qoida: buzilsa tizim ishlamaydi

**1. Klinika ajratish.** Frontend so'rovga `clinicId` **qo'shmaydi**.
Server uni **tokendan** oladi va HAR BIR so'rovni shu klinika bo'yicha
filtrlaydi. Bu eng muhim qoida: buzilsa, bir klinika boshqasining
bemorlarini ko'radi.

**2. Ruxsatlar serverda tekshiriladi.** Frontenddagi tekshiruvlar faqat
interfeys uchun — tugmani ko'rsatish yoki yashirish. **Ular himoya
emas**: so'rovni brauzer konsolidan ham yuborsa bo'ladi. Server har bir
so'rovda rolni mustaqil tekshirishi shart. Rollar va ruxsatlar ro'yxati:
`src/lib/permissions.ts`.

**3. Shifokor ko'lami.** Rol `doctor` bo'lsa, server javobni faqat o'sha
shifokorga tegishli yozuvlar bilan cheklaydi. Frontend buni
`scopeDoctorId` orqali taqlid qiladi, lekin haqiqiy cheklov serverda
bo'lishi kerak.

**4. To'lov yozuvi o'zgarmaydi.** Kiritilgan to'lovni tahrirlash yoki
o'chirish endpointi **yo'q, va bo'lmasligi kerak**. Xato bo'lsa —
qaytarish (refund) yozuvi qo'shiladi. Butun firibgarlikka qarshi mantiq
shunga tayanadi: shifokor tashrifni yozadi, registrator pulni yozadi,
tizim ikkalasini solishtiradi. Yozuvni o'chirib bo'ladigan bo'lsa,
solishtirishning ma'nosi qolmaydi.

---

## Yana nima o'qish kerak

| Nima | Qayerda |
|---|---|
| Jadvallar va bog'lanishlar | `docs/DATABASE.md` |
| So'rov/javob JSON tuzilishi (tiplar) | `src/types/models.ts` |
| Rollar va ruxsatlar | `src/lib/permissions.ts` |
| HTTP qatlami, token, xatolik | `src/api/client.ts` |

Quyidagi ro'yxatdagi TypeScript imzolari `src/types/models.ts` dagi
tiplarga ishora qiladi — javob JSON'i aynan o'sha shaklda bo'lishi kerak.

---

## Kirish va sessiya

`src/api/auth.ts`

> Autentifikatsiya.
> 
> XAVFSIZLIK ESLATMASI (dasturchiga):
>  - Parol serverda `bcrypt`/`argon2` bilan xeshlanadi. Frontend parolni
>    faqat HTTPS orqali yuboradi va hech qaerda saqlamaydi.
>  - Eng yaxshi variant — sessiyani HttpOnly + Secure + SameSite cookie'da
>    saqlash. Bu holda token JS uchun ko'rinmaydi (XSS o'g'irlay olmaydi).
>  - Token localStorage'da saqlanmasin. Hozir mock rejimda faqat
>    foydalanuvchi id'si saqlanadi, token yo'q.

### `POST /auth/login`

{ user, clinic, permissions, token }

```ts
login(input: LoginInput): Promise<Session>
```

### `POST /auth/logout`

```ts
logout(): Promise<void>
```

### `GET /auth/me`

Sahifa yangilanganda sessiyani tiklash

```ts
me(userId?: string): Promise<Session | null>
```

### `PATCH /profile`

```ts
updateProfile(userId: ID, input: ProfileInput): Promise<User>
```

### `GET /users`

Sozlamalardagi foydalanuvchilar ro'yxati

```ts
listUsers(): Promise<User[]>
```

## Klinika sozlamalari

`src/api/clinic.ts`

> Klinika profili va sozlamalari.

### `GET /clinic`

```ts
getClinic(): Promise<Clinic | null>
```

### `PATCH /clinic`

Faqat `settings.manage` ruxsati bilan

```ts
updateClinic(patch: Partial<ClinicInput>): Promise<Clinic>
```

## Bemorlar

`src/api/patients.ts`

> Bemorlar.
> 
> MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa TIBBIY
> ma'lumot. Serverda:
>   - har bir so'rov klinika bo'yicha filtrlanadi;
>   - shifokor faqat o'ziga biriktirilgan yoki qabul qilgan bemorlarni
>     ko'radi (`scopeDoctorId` mantiqi server tomonda takrorlanadi);
>   - tibbiy yozuvni o'qish AuditLog'ga yoziladi.

### `GET /patients?search=&filter=&page=&pageSize=`

Bemorlar.

MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa TIBBIY
ma'lumot. Serverda:
  - har bir so'rov klinika bo'yicha filtrlanadi;
  - shifokor faqat o'ziga biriktirilgan yoki qabul qilgan bemorlarni
    ko'radi (`scopeDoctorId` mantiqi server tomonda takrorlanadi);
  - tibbiy yozuvni o'qish AuditLog'ga yoziladi.


import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type {
AppointmentExpanded,
FollowUp,
ID,
Paginated,
Patient,
PatientStats,
PatientWithStats,
PaymentExpanded,
VisitExpanded,
} from '@/types/models'

export type PatientFilter = 'all' | 'new' | 'returning' | 'active' | 'inactive'

export interface PatientListQuery {
search?: string
filter?: PatientFilter
page?: number
pageSize?: number
}

------------------------------------------------------------------
Ro'yxat
------------------------------------------------------------------

```ts
listPatients(query: PatientListQuery = {}): Promise<Paginated<PatientWithStats>>
```

### `GET /patients/:id`

Bemorlar.

MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa TIBBIY
ma'lumot. Serverda:
  - har bir so'rov klinika bo'yicha filtrlanadi;
  - shifokor faqat o'ziga biriktirilgan yoki qabul qilgan bemorlarni
    ko'radi (`scopeDoctorId` mantiqi server tomonda takrorlanadi);
  - tibbiy yozuvni o'qish AuditLog'ga yoziladi.


import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type {
AppointmentExpanded,
FollowUp,
ID,
Paginated,
Patient,
PatientStats,
PatientWithStats,
PaymentExpanded,
VisitExpanded,
} from '@/types/models'

export type PatientFilter = 'all' | 'new' | 'returning' | 'active' | 'inactive'

export interface PatientListQuery {
search?: string
filter?: PatientFilter
page?: number
pageSize?: number
}

------------------------------------------------------------------
Ro'yxat
------------------------------------------------------------------

// GET /patients?search=&filter=&page=&pageSize=
export async function listPatients(
query: PatientListQuery = {},
): Promise<Paginated<PatientWithStats>> {
const { search = '', filter = 'all', page = 1, pageSize = 20 } = query

if (!USE_MOCK) {
return request<Paginated<PatientWithStats>>('GET', '/patients', {
query: { search, filter, page, pageSize },
})
}

const { clinicId, scopeDoctorId } = apiContext()
const db = getDb()

let rows = db.patients.all(clinicId)

// Shifokor faqat o'z bemorlarini ko'radi
if (scopeDoctorId) {
const own = new Set(
db.appointments
.all(clinicId)
.filter((a) => a.doctorId === scopeDoctorId)
.map((a) => a.patientId),
)
rows = rows.filter((p) => own.has(p.id) || p.primaryDoctorId === scopeDoctorId)
}

if (search) {
rows = rows.filter(
(p) => matches(p.fullName, search) || matches(p.phone.replace(/\s/g, ''), search.replace(/\s/g, '')),
)
}

// Statistikani HAR BIR bemor uchun alohida hisoblash 600+ bemorda
// millionlab amalga olib keladi. Shuning uchun indekslarni bir marta
// quramiz va keyin har bir bemorga tayyor qiymatni biriktiramiz.
const index = buildStatsIndex(clinicId)
const withStats = rows.map((p) => ({ ...p, stats: statsFromIndex(p.id, index) }))

const filtered = withStats.filter((p) => {
switch (filter) {
case 'new':
return p.stats.visitCount <= 1
case 'returning':
return p.stats.isReturning
case 'active':
return p.status === 'active'
case 'inactive':
return p.status === 'inactive'
default:
return true
}
})

// Eng oxirgi tashrifi yangilari tepada
filtered.sort((a, b) => (b.stats.lastVisitAt ?? '').localeCompare(a.stats.lastVisitAt ?? ''))

return delay(paginate(filtered, page, pageSize))
}

------------------------------------------------------------------
Bitta bemor
------------------------------------------------------------------

```ts
getPatient(id: ID): Promise<PatientWithStats | null>
```

### `POST /patients`

```ts
createPatient(input: CreatePatientInput): Promise<Patient>
```

### `PATCH /patients/:id`

```ts
updatePatient(id: ID, patch: Partial<CreatePatientInput>): Promise<Patient>
```

### `DELETE /patients/:id`

```ts
deletePatient(id: ID): Promise<void>
```

### `GET /patients/:id/visits`

TIBBIY MA'LUMOT, `visits.view` talab qiladi

Bemorlar.

MAXFIYLIK: bemor yozuvi shaxsiy ma'lumot, tashrif yozuvi esa TIBBIY
ma'lumot. Serverda:
  - har bir so'rov klinika bo'yicha filtrlanadi;
  - shifokor faqat o'ziga biriktirilgan yoki qabul qilgan bemorlarni
    ko'radi (`scopeDoctorId` mantiqi server tomonda takrorlanadi);
  - tibbiy yozuvni o'qish AuditLog'ga yoziladi.


import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type {
AppointmentExpanded,
FollowUp,
ID,
Paginated,
Patient,
PatientStats,
PatientWithStats,
PaymentExpanded,
VisitExpanded,
} from '@/types/models'

export type PatientFilter = 'all' | 'new' | 'returning' | 'active' | 'inactive'

export interface PatientListQuery {
search?: string
filter?: PatientFilter
page?: number
pageSize?: number
}

------------------------------------------------------------------
Ro'yxat
------------------------------------------------------------------

// GET /patients?search=&filter=&page=&pageSize=
export async function listPatients(
query: PatientListQuery = {},
): Promise<Paginated<PatientWithStats>> {
const { search = '', filter = 'all', page = 1, pageSize = 20 } = query

if (!USE_MOCK) {
return request<Paginated<PatientWithStats>>('GET', '/patients', {
query: { search, filter, page, pageSize },
})
}

const { clinicId, scopeDoctorId } = apiContext()
const db = getDb()

let rows = db.patients.all(clinicId)

// Shifokor faqat o'z bemorlarini ko'radi
if (scopeDoctorId) {
const own = new Set(
db.appointments
.all(clinicId)
.filter((a) => a.doctorId === scopeDoctorId)
.map((a) => a.patientId),
)
rows = rows.filter((p) => own.has(p.id) || p.primaryDoctorId === scopeDoctorId)
}

if (search) {
rows = rows.filter(
(p) => matches(p.fullName, search) || matches(p.phone.replace(/\s/g, ''), search.replace(/\s/g, '')),
)
}

// Statistikani HAR BIR bemor uchun alohida hisoblash 600+ bemorda
// millionlab amalga olib keladi. Shuning uchun indekslarni bir marta
// quramiz va keyin har bir bemorga tayyor qiymatni biriktiramiz.
const index = buildStatsIndex(clinicId)
const withStats = rows.map((p) => ({ ...p, stats: statsFromIndex(p.id, index) }))

const filtered = withStats.filter((p) => {
switch (filter) {
case 'new':
return p.stats.visitCount <= 1
case 'returning':
return p.stats.isReturning
case 'active':
return p.status === 'active'
case 'inactive':
return p.status === 'inactive'
default:
return true
}
})

// Eng oxirgi tashrifi yangilari tepada
filtered.sort((a, b) => (b.stats.lastVisitAt ?? '').localeCompare(a.stats.lastVisitAt ?? ''))

return delay(paginate(filtered, page, pageSize))
}

------------------------------------------------------------------
Bitta bemor
------------------------------------------------------------------

// GET /patients/:id
export async function getPatient(id: ID): Promise<PatientWithStats | null> {
if (!USE_MOCK) return request<PatientWithStats>('GET', `/patients/${id}`)

const { clinicId } = apiContext()
const patient = getDb().patients.find(id, clinicId)
if (!patient) return delay(null)
return delay(attachStats(patient, clinicId))
}

export interface CreatePatientInput {
fullName: string
phone: string
birthDate: string
gender: 'male' | 'female'
address: string
notes: string
primaryDoctorId: ID | null
}

// POST /patients
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
if (!USE_MOCK) return request<Patient>('POST', '/patients', { body: input })

const { clinicId } = apiContext()
const db = getDb()

const patient: Patient = {
id: db.patients.nextId('pat'),
clinicId,
fullName: input.fullName.trim(),
phone: input.phone.trim(),
birthDate: input.birthDate,
gender: input.gender,
address: input.address.trim(),
notes: input.notes.trim(),
status: 'active',
primaryDoctorId: input.primaryDoctorId,
createdAt: new Date().toISOString(),
}

db.patients.insert(patient)
return delay(patient, 320)
}

// PATCH /patients/:id
export async function updatePatient(id: ID, patch: Partial<CreatePatientInput>): Promise<Patient> {
if (!USE_MOCK) return request<Patient>('PATCH', `/patients/${id}`, { body: patch })

const { clinicId } = apiContext()
const updated = getDb().patients.update(id, patch as Partial<Patient>, clinicId)
if (!updated) throw new Error('Bemor topilmadi')
return delay(updated, 280)
}

// DELETE /patients/:id
export async function deletePatient(id: ID): Promise<void> {
if (!USE_MOCK) {
await request<void>('DELETE', `/patients/${id}`)
return
}
const { clinicId } = apiContext()
getDb().patients.remove(id, clinicId)
await delay(null, 260)
}

------------------------------------------------------------------
Bemor profili tablari
------------------------------------------------------------------

```ts
getPatientVisits(id: ID): Promise<VisitExpanded[]>
```

### `GET /patients/:id/appointments`

```ts
getPatientAppointments(id: ID): Promise<AppointmentExpanded[]>
```

### `GET /patients/:id/payments`

```ts
getPatientPayments(id: ID): Promise<PaymentExpanded[]>
```

### `GET /patients/:id/follow-ups`

```ts
getPatientFollowUps(id: ID): Promise<FollowUp[]>
```

## Qabullar

`src/api/appointments.ts`

> Qabullar.
> 
> Registratura ish oqimining markazi:
>   yaratish → tasdiqlash → kelgan (check-in) → yakunlash → to'lov
> 
> Holat o'zgarishi serverda tekshirilishi kerak: masalan `completed`
> holatidan `scheduled`ga qaytish mumkin emas.

### `GET /appointments?from=&to=&doctorId=&status=&search=&page=`

ISO sana-vaqt yoki sana
from?: string
to?: string
doctorId?: ID | 'all'
status?: AppointmentStatus | 'all'
search?: string
page?: number
pageSize?: number
}

------------------------------------------------------------------

```ts
listAppointments(query: AppointmentQuery = {}): Promise<Paginated<AppointmentExpanded>>
```

### `GET /appointments?from=&to=&doctorId=`

Kalendar uchun — sahifalashsiz, bir kunlik yoki haftalik oraliq

```ts
listAppointmentsRange(from: Date, to: Date, doctorId: ID | 'all' = 'all'): Promise<AppointmentExpanded[]>
```

### `GET /appointments/today`

Bugungi jadval — bosh sahifadagi o'ng ustun

```ts
listTodayAppointments(): Promise<AppointmentExpanded[]>
```

### `GET /appointments/:id`

```ts
getAppointment(id: ID): Promise<AppointmentExpanded | null>
```

### `POST /appointments`

```ts
createAppointment(input: AppointmentInput): Promise<Appointment>
```

### `PATCH /appointments/:id`

```ts
updateAppointment(id: ID, patch: Partial<AppointmentInput>): Promise<Appointment>
```

### `POST /appointments/:id/status  { status, reason? }`

Holatni o'zgartirish — registratura eng ko'p ishlatadigan amal.
Bir bosishda: tasdiqlash, kelgan deb belgilash, yakunlash.

```ts
setAppointmentStatus(id: ID, status: AppointmentStatus, reason?: string): Promise<Appointment>
```

### `DELETE /appointments/:id`

```ts
deleteAppointment(id: ID): Promise<void>
```

### `GET /appointments/load?from=&to=`

Kalendarning "yuklama" ko'rinishi uchun ma'lumot.

Egasi qabul yozmaydi — unga kerak bo'lgani boshqa manzara: qaysi
shifokor to'la band, qayerda bo'sh soat qolyapti. Bo'sh soat —
yo'qotilgan daromad, shuning uchun bu eng foydali kesim.

```ts
getDoctorLoad(from: Date, to: Date): Promise<DoctorLoad>
```

## Tashriflar va tashxis

`src/api/visits.ts`

> Tashriflar (shifokor yozuvi) va takroriy tashrif tavsiyalari.
> 
> MAXFIY TIBBIY MA'LUMOT.
> 
> Serverda tekshirilishi shart:
>   - `visits.create` ruxsati bor;
>   - yozuvni yaratayotgan shifokor AYNAN shu qabulning shifokori;
>   - o'qish va yozish AuditLog'ga (`view_medical`, `create`) tushadi.
> 
> MVP doirasi: bu to'liq elektron tibbiy karta EMAS. Faqat shikoyat,
> tashxis, davolash va izoh maydonlari.

### `POST /visits`

```ts
createVisit(input: VisitInput): Promise<Visit>
```

### `GET /visits/:id`

```ts
getVisit(id: ID): Promise<Visit | null>
```

### `GET /appointments/:id/visit`

Qabulga biriktirilgan yozuv bormi

```ts
getVisitByAppointment(appointmentId: ID): Promise<Visit | null>
```

### `GET /follow-ups?status=pending&dueBefore=`

```ts
listFollowUpsDue(daysAhead = 7): Promise<FollowUpDue[]>
```

### `PATCH /follow-ups/:id`

```ts
updateFollowUp(id: ID, patch: Partial<FollowUp>): Promise<FollowUp>
```

## Shifokorlar

`src/api/doctors.ts`

> Shifokorlar va ularning ko'rsatkichlari.

### `GET /doctors?search=`

```ts
listDoctors(search = ''): Promise<DoctorWithStats[]>
```

### `GET /doctors?fields=short`

Tanlagichlar (select) uchun yengil ro'yxat

```ts
listDoctorsShort(): Promise<Doctor[]>
```

### `GET /doctors/:id`

```ts
getDoctor(id: ID): Promise<DoctorWithStats | null>
```

### `GET /doctors/:id/appointments?from=&to=`

```ts
getDoctorAppointments(id: ID, from?: string, to?: string): Promise<AppointmentExpanded[]>
```

### `GET /doctors/:id/patients`

```ts
getDoctorPatients(id: ID): Promise<PatientWithStats[]>
```

### `POST /doctors`

```ts
createDoctor(input: DoctorInput): Promise<Doctor>
```

### `PATCH /doctors/:id`

```ts
updateDoctor(id: ID, patch: Partial<DoctorInput>): Promise<Doctor>
```

### `DELETE /doctors/:id`

```ts
deleteDoctor(id: ID): Promise<void>
```

### `GET /doctors/:id/earnings?period=`

Shifokorning bir oylik daromadi: maosh + foiz + bonus.

NEGA KERAK: foizli modelda ishlaydigan shifokor o'z pulini o'zi
hisoblab yura olmaydi — buning uchun u qancha bemor qabul
qilgani va har biridan qancha tushum bo'lgani kerak. Bu ma'lumot
tizimda bor, shuning uchun uni shifokorga ko'rsatish adolatli va
bahsni oldini oladi.

BU KLINIKA DAROMADI EMAS: bu yerda faqat shu shifokorga tegishli
summalar. Klinikaning umumiy tushumi, boshqa shifokorlar, xarajatlar
— hech biri yo'q.

RUXSAT (SERVERDA MAJBURIY): so'rovni faqat shu shifokorning o'zi
yoki `staff.manage` ruxsatiga ega foydalanuvchi yubora oladi.
Frontenddagi tekshiruv — faqat ko'rsatma, himoya emas.

```ts
getDoctorEarnings(doctorId: ID, period: string): Promise<DoctorEarnings | null>
```

## Xizmatlar va narxlar

`src/api/services.ts`

> Xizmatlar katalogi.

### `GET /services?search=&category=&status=`

```ts
listServices(search = '', category = 'all', status: 'all' | 'active' | 'archived' = 'all'): Promise<Service[]>
```

### `POST /services`

```ts
createService(input: ServiceInput): Promise<Service>
```

### `PATCH /services/:id`

```ts
updateService(id: ID, patch: Partial<ServiceInput>): Promise<Service>
```

### `DELETE /services/:id`

```ts
deleteService(id: ID): Promise<void>
```

### `GET /services/:id/price?patientId=`

Aniq bemorga aniq xizmat qancha turishini hisoblaydi.

Sodiqlik chegirmasi bemorning SHU XIZMATDAN necha marta
foydalanganiga qarab qo'llanadi. Masalan "5 tashrifdan keyin 15%"
degani: 6-martadan boshlab arzon.

SERVERDA: chegirmani mijoz hisoblamasligi kerak. To'lov yaratilganda
server narxni qaytadan hisoblab, mijoz yuborgan summani tekshirishi
shart — aks holda registrator summani o'zgartirib yuborishi mumkin.

```ts
resolvePriceForPatient(serviceId: ID, patientId: ID | null): Promise<PricePreview | null>
```

## To'lovlar

`src/api/payments.ts`

> To'lovlar va daromad hisobotlari.
> 
> RUXSAT: `payments.view` — registratura ham ko'radi (kunlik kassa).
> `revenue.view` — faqat egasi (yoki egasi ruxsat bergan xodim).
> Bu ikki ruxsat ATAYLAB ajratilgan: registrator kunlik to'lovlarni
> kiritadi, lekin klinikaning umumiy moliyaviy hisobotini ko'rmaydi.

### `GET /payments?search=&method=&status=&from=&to=&page=`

Bugungi tushum — registratorga ham ko'rinadi
today: number

DASTURCHIGA: haftalik va oylik summa faqat `revenue.view` ruxsati
bor foydalanuvchiga yuborilsin. Interfeysda ular yashirilgan,
lekin YASHIRISH HIMOYA EMAS — so'rovni brauzerdan ham yuborsa
bo'ladi. Ruxsat yo'q bo'lsa bu maydonlar javobga umuman
qo'shilmasin (null yoki yo'q bo'lsin).

week: number
month: number
}

------------------------------------------------------------------

```ts
listPayments(query: PaymentQuery = {}): Promise<Paginated<PaymentExpanded>>
```

### `GET /payments/summary`

Bugungi / haftalik / oylik daromad

```ts
getPaymentSummary(): Promise<PaymentSummary>
```

### `POST /payments`

```ts
createPayment(input: PaymentInput): Promise<Payment>
```

### `POST /payments/:id/refund`

```ts
refundPayment(id: ID): Promise<Payment>
```

### `GET /reports/revenue?from=&to=`

Bugungi tushum — registratorga ham ko'rinadi
today: number

DASTURCHIGA: haftalik va oylik summa faqat `revenue.view` ruxsati
bor foydalanuvchiga yuborilsin. Interfeysda ular yashirilgan,
lekin YASHIRISH HIMOYA EMAS — so'rovni brauzerdan ham yuborsa
bo'ladi. Ruxsat yo'q bo'lsa bu maydonlar javobga umuman
qo'shilmasin (null yoki yo'q bo'lsin).

week: number
month: number
}

------------------------------------------------------------------

// GET /payments?search=&method=&status=&from=&to=&page=
export async function listPayments(
query: PaymentQuery = {},
): Promise<Paginated<PaymentExpanded>> {
const { page = 1, pageSize = 20 } = query

if (!USE_MOCK) {
return request<Paginated<PaymentExpanded>>('GET', '/payments', {
query: { ...query, page, pageSize },
})
}

const rows = expandPayments()
.filter((p) => !query.method || query.method === 'all' || p.method === query.method)
.filter((p) => !query.status || query.status === 'all' || p.status === query.status)
.filter((p) => !query.from || p.paidAt >= query.from)
.filter((p) => !query.to || p.paidAt <= query.to)
.filter(
(p) =>
!query.search ||
matches(p.patient.fullName, query.search) ||
matches(p.doctor.fullName, query.search),
)

rows.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
return delay(paginate(rows, page, pageSize))
}

// GET /payments/summary  →  bugungi / haftalik / oylik daromad
export async function getPaymentSummary(): Promise<PaymentSummary> {
if (!USE_MOCK) return request<PaymentSummary>('GET', '/payments/summary')

const { clinicId } = apiContext()
const paid = getDb()
.payments.all(clinicId)
.filter((p) => p.status === 'paid')

const now = new Date()
const dayStart = startOfDay(now).getTime()
const weekStart = startOfWeek(now).getTime()
// Oyning boshida "shu oy" bir kunni bildiradi — shuning uchun
// uchinchi ko'rsatkich aylanma 30 kunlik oyna.
const monthStart = startOfDay(addDays(now, -29)).getTime()

const sum = (since: number) =>
paid
.filter((p) => new Date(p.paidAt).getTime() >= since)
.reduce((total, p) => total + p.amount, 0)

return delay({ today: sum(dayStart), week: sum(weekStart), month: sum(monthStart) })
}

export interface PaymentInput {
patientId: ID
doctorId: ID
serviceId: ID
appointmentId: ID | null
amount: number
method: PaymentMethod
status: PaymentStatus
notes: string
}

// POST /payments
export async function createPayment(input: PaymentInput): Promise<Payment> {
if (!USE_MOCK) return request<Payment>('POST', '/payments', { body: input })

const { clinicId } = apiContext()
const db = getDb()
const now = new Date().toISOString()

const payment: Payment = {
id: db.payments.nextId('pay'),
clinicId,
paidAt: now,
createdBy: 'usr_reception_1',
createdAt: now,
...input,
}

db.payments.insert(payment)

// To'lov kiritilsa — bog'liq qabulning to'lov holati ham yangilanadi
if (input.appointmentId && input.status === 'paid') {
db.appointments.update(input.appointmentId, { paymentStatus: 'paid' }, clinicId)
}

return delay(payment, 300)
}

// POST /payments/:id/refund
export async function refundPayment(id: ID): Promise<Payment> {
if (!USE_MOCK) return request<Payment>('POST', `/payments/${id}/refund`)

const updated = getDb().payments.update(id, { status: 'refunded' }, apiContext().clinicId)
if (!updated) throw new Error("To'lov topilmadi")
return delay(updated, 260)
}

------------------------------------------------------------------
Daromad hisoboti
------------------------------------------------------------------

```ts
getRevenueReport(range: DateRange): Promise<RevenueReport>
```

## Kassa nazorati

`src/api/cashControl.ts`

> ============================================================
>  KASSA NAZORATI
> ============================================================
> 
> Muammo: kassada naqd pul aylanadi. Administrator pulni olib, to'lovni
> yozmasligi yoki kamroq yozishi mumkin.
> 
> Yechim — vazifalarni ajratish:
> 
>   SHIFOKOR   xizmat ko'rsatilganini qayd qiladi (tashrif yozuvi)
>   ADMIN      pulni qayd qiladi (to'lov yozuvi)
> 
> Ikki yozuvni turli odam kiritadi, demak ularni solishtirish mumkin:
> 
>   Yakunlangan tashriflar summasi − Kassaga tushgan pul = FARQ
> 
> Bu hisobotni FAQAT egasi ko'radi (`cashcontrol.view`).
> 
> Qo'shimcha nazorat nuqtalari:
>   - to'lov yozuvi o'chirilmaydi/tahrirlanmaydi (faqat qaytarish yoziladi)
>   - chegirmalar alohida ko'rinadi
>   - bemor "kelgan" deb belgilangandan keyin bekor qilingan qabullar
>   - smena yopishdagi kamomadlar (xodim nomi bilan)
> 
> SERVERDA: bu endpointlar `cashcontrol.view` talab qiladi va
> administrator roliga HECH QACHON ochilmaydi.

### `GET /cash-control?from=&to=`

```ts
getCashControlReport(range: DateRange): Promise<CashControlReport>
```

### `GET /shifts/current`

Bugungi kutilayotgan naqd summa

Kun oxirida administrator kassadagi jismoniy naqd pulni sanaydi va
kiritadi. Tizim o'zidagi summa bilan solishtiradi.

Farq bo'lsa — u yo'qolmaydi, xodim nomi bilan qayd etiladi va egasining
hisobotiga tushadi. Halol xodim uchun bu bir daqiqalik ish, lekin
pulni olib qolish imkonini yopadi.

```ts
getExpectedCashToday(userId: ID): Promise<UZS>
```

### `POST /shifts/close`

```ts
closeShift(input: ShiftCloseInput): Promise<ShiftClosure>
```

## Statsionar

`src/api/ward.ts`

> Statsionar (yotoq xona).
> 
> Tuzilma: xona → koyka → yotqizish.
> 
> RUXSAT:
>   `ward.view`   — ko'rish (egasi, administratsiya, shifokor)
>   `ward.manage` — yotqizish/chiqarish, xona va koyka boshqaruvi
> 
> Shifokor faqat o'z bemorlarini ko'radi (`scopeDoctorId`).

### `GET /ward/rooms`

Statsionar (yotoq xona).

Tuzilma: xona → koyka → yotqizish.

RUXSAT:
  `ward.view`   — ko'rish (egasi, administratsiya, shifokor)
  `ward.manage` — yotqizish/chiqarish, xona va koyka boshqaruvi

Shifokor faqat o'z bemorlarini ko'radi (`scopeDoctorId`).


import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { pick } from './patients'
import { getDb } from '@/mock/db'
import {
addDays,
eachDay,
endOfDay,
fromISODate,
startOfDay,
toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
Admission,
AdmissionExpanded,
BedBoard,
BedBoardRow,
BedBoardSpan,
DateRange,
ID,
Metric,
Room,
RoomCategory,
SeriesPoint,
WardStats,
} from '@/types/models'

------------------------------------------------------------------
Xonalar va koykalar
------------------------------------------------------------------

```ts
listRooms(): Promise<Room[]>
```

### `POST /ward/rooms`

```ts
createRoom(input: RoomInput): Promise<Room>
```

### `PATCH /ward/rooms/:id`

```ts
updateRoom(id: ID, patch: Partial<RoomInput>): Promise<Room>
```

### `GET /ward/admissions?status=&search=`

```ts
listAdmissions(query: AdmissionQuery = {}): Promise<AdmissionExpanded[]>
```

### `POST /ward/admissions`

```ts
admitPatient(input: AdmissionInput): Promise<Admission>
```

### `POST /ward/admissions/:id/discharge`

```ts
dischargePatient(id: ID): Promise<Admission>
```

### `GET /ward/board?from=&to=`

Koyka × kun jadvali.

Har bir qator — bitta koyka, har bir ustun — bitta kun. Band davrlar
uzluksiz blok sifatida ko'rsatiladi, shuning uchun bir qarashda
"qaysi koyka qachon bo'shaydi" ko'rinadi.

```ts
getBedBoard(from: Date, to: Date): Promise<BedBoard>
```

### `GET /ward/stats?from=&to=`

Koyka × kun jadvali.

Har bir qator — bitta koyka, har bir ustun — bitta kun. Band davrlar
uzluksiz blok sifatida ko'rsatiladi, shuning uchun bir qarashda
"qaysi koyka qachon bo'shaydi" ko'rinadi.

// GET /ward/board?from=&to=
export async function getBedBoard(from: Date, to: Date): Promise<BedBoard> {
if (!USE_MOCK) {
return request<BedBoard>('GET', '/ward/board', {
query: { from: toISODate(from), to: toISODate(to) },
})
}

const { clinicId, scopeDoctorId } = apiContext()
const db = getDb()

const days = eachDay(from, to)
const dayKeys = days.map(toISODate)
const rangeStart = startOfDay(from).getTime()
const rangeEnd = endOfDay(to).getTime()

const rooms = new Map(db.rooms.all(clinicId).map((r) => [r.id, r]))
const patients = new Map(db.patients.all(clinicId).map((p) => [p.id, p]))
const doctors = new Map(db.doctors.all(clinicId).map((d) => [d.id, d]))

const admissions = db.admissions
.all(clinicId)
.filter((a) => !scopeDoctorId || a.doctorId === scopeDoctorId)

const rows: BedBoardRow[] = db.beds
.all(clinicId)
.map((bed) => {
const room = rooms.get(bed.roomId)
const spans: BedBoardSpan[] = []

for (const admission of admissions) {
if (admission.bedId !== bed.id) continue

const start = new Date(admission.admittedAt).getTime()
const end = admission.dischargedAt
? new Date(admission.dischargedAt).getTime()
: admission.expectedDischargeAt
? endOfDay(fromISODate(admission.expectedDischargeAt)).getTime()
: rangeEnd

// Oraliqqa umuman tushmasa — o'tkazib yuboramiz
if (end < rangeStart || start > rangeEnd) continue

const startKey = toISODate(new Date(Math.max(start, rangeStart)))
const endKey = toISODate(new Date(Math.min(end, rangeEnd)))

const fromIndex = dayKeys.indexOf(startKey)
const toIndex = dayKeys.indexOf(endKey)
if (fromIndex === -1 || toIndex === -1) continue

spans.push({
admissionId: admission.id,
patientId: admission.patientId,
patientName: patients.get(admission.patientId)?.fullName ?? '—',
doctorName: doctors.get(admission.doctorId)?.fullName ?? '—',
status: admission.status,
fromIndex,
toIndex,
continuesBefore: start < rangeStart,
continuesAfter: end > rangeEnd,
})
}

spans.sort((a, b) => a.fromIndex - b.fromIndex)

return {
bed: pick(bed, ['id', 'label', 'status'])!,
room: room
? pick(room, ['id', 'number', 'category'])!
: { id: bed.roomId, number: '—', category: 'general' as RoomCategory },
spans,
}
})
.sort((a, b) => a.bed.label.localeCompare(b.bed.label))

return delay({ days: dayKeys, rows }, 160)
}

------------------------------------------------------------------
Ko'rsatkichlar
------------------------------------------------------------------

```ts
getWardStats(range: DateRange): Promise<WardStats>
```

## Xodimlar

`src/api/staff.ts`

> Xodimlar — klinikaning butun shtati.
> 
> Shifokordan farrosh va qorovulgacha hammasi shu yerda. Ko'pchiligiga
> tizimga kirish kerak emas — ular kadr yozuvi sifatida turadi.
> 
> RUXSAT: `staff.view` / `staff.manage` — faqat egasi.
> 
> MUHIM: tizimga kirish huquqini va parolni FAQAT egasi bera oladi.
> Bu yagona joy — boshqa hech qayerdan foydalanuvchi yaratilmaydi.
> Serverda ham shu tekshiruv takrorlanishi shart.

### `GET /staff?search=&position=&status=`

Faqat tizimga kira oladiganlar
withAccess?: boolean
}

------------------------------------------------------------------
Ro'yxat
------------------------------------------------------------------

```ts
listStaff(query: StaffQuery = {}): Promise<StaffWithPerformance[]>
```

### `GET /staff/:id`

```ts
getStaff(id: ID): Promise<StaffWithPerformance | null>
```

### `POST /staff`

```ts
createStaff(input: StaffInput): Promise<Staff>
```

### `PATCH /staff/:id`

```ts
updateStaff(id: ID, patch: Partial<StaffInput>): Promise<Staff>
```

### `DELETE /staff/:id`

```ts
deleteStaff(id: ID): Promise<void>
```

### `POST /staff/:id/password  { password, mustChangePassword }`

Parolni qayta belgilash.

Alohida endpoint: bu oddiy tahrirlash emas, xavfsizlik o'zgarishi.
Serverda audit yozuvi qoldirilishi va xodimga xabar yuborilishi kerak.
Egasi MAVJUD parolni ko'ra olmaydi — faqat yangisini belgilay oladi.

```ts
resetStaffPassword(id: ID, _password: string, mustChangePassword: boolean): Promise<Staff>
```

### `GET /staff/:id/schedule?month=`

Xodimning bir oylik ish jadvali.

NEGA KERAK: ish kunlarini klinika egasi belgilaydi, lekin xodim
ularni bilishi kerak. Og'zaki aytish o'rniga xodim o'z profilida
kalendarni ochib ko'radi — nizolar shu bilan kamayadi.

O'tgan kunlarga davomat natijasi ham qo'shiladi, shuning uchun
xodim o'z intizomini ham shu yerda ko'radi.

```ts
getWorkSchedule(staffId: ID, month: string): Promise<WorkSchedule | null>
```

### `GET /me/profile`

Kirgan xodimning o'z kartasi — ko'rsatkichlari bilan.

NEGA KERAK: xodim o'zi haqidagi bahoni ko'rishi kerak. Reyting
tizim tomonidan avtomatik hisoblanadi; agar u yopiq bo'lsa, xodim
uchun bu "boshliq shunday deb o'ylaydi" bo'lib qoladi. Ochiq
bo'lsa — tuzatish mumkin bo'lgan aniq ko'rsatkichga aylanadi.

DASTURCHIGA: haqiqiy backendda bu `GET /me/profile` bo'ladi va
xodim token orqali aniqlanadi. Mock rejimda bog'lanish email
bo'yicha topiladi, chunki `User` da `staffId` maydoni yo'q.

```ts
getMyStaffProfile(email: string): Promise<StaffWithPerformance | null>
```

### `GET /doctors/:id/schedule?month=`

Shifokorning ish jadvali.

Shifokor ham shtatda turadi — xodim kartasi `doctorId` orqali
bog'langan. Davomat va intizom shu karta bo'yicha yuritiladi,
shuning uchun jadval ham o'sha manbadan olinadi.

AGAR XODIM KARTASI BO'LMASA: shifokorning o'z yozuvidagi ish
kunlaridan jadval yig'iladi. Davomat bo'lmaydi (uni belgilashga
karta kerak), lekin ish kunlari baribir ko'rinadi — shifokor
"qaysi kuni ishlayman" degan savolga javob olishi kerak.

```ts
getDoctorWorkSchedule(doctorId: ID, month: string): Promise<WorkSchedule | null>
```

### `GET /me/schedule?month=`

Kirgan foydalanuvchining o'z jadvali.

DASTURCHIGA: haqiqiy backendda bu `GET /me/schedule` bo'ladi va
xodim token orqali aniqlanadi. Mock rejimda bog'lanish email
bo'yicha topiladi, chunki `User` da `staffId` maydoni yo'q.

```ts
getMyWorkSchedule(email: string, month: string): Promise<WorkSchedule | null>
```

## Davomat

`src/api/attendance.ts`

> Davomat.
> 
> NEGA KERAK: farrosh, qorovul, haydovchi kabi xodimlarda tizimda
> boshqa hech qanday o'lchanadigan ko'rsatkich yo'q. Davomat ularning
> reytingini avtomatik hisoblash uchun yagona ishonchli manba.
> 
> RUXSAT:
>   `attendance.view`   — ko'rish (egasi, administratsiya)
>   `attendance.manage` — belgilash va tuzatish

### `GET /attendance?staffId=&from=&to=`

Smena boshlanishiga nisbatan kechikish, daqiqada.

TUNGI SMENA: qorovul kabi xodimlarda smena yarim tundan o'tadi
(20:00—08:00). Bunday smenada 00:30 da kelish — kechikish, lekin
oddiy ayirish manfiy son beradi. Shuning uchun smena tunligini
`shiftEnd` orqali aniqlab, kelish vaqtini ertasi kunga suramiz.

export function lateMinutesFrom(
shiftStart: string,
arrivedAt: string,
shiftEnd?: string,
): number {
const toMinutes = (value: string) => {
const [h, m] = value.split(':').map(Number)
return h * 60 + m
}

const start = toMinutes(shiftStart)
let arrival = toMinutes(arrivedAt)

const overnight = shiftEnd ? toMinutes(shiftEnd) <= start : false
if (overnight && arrival < start) arrival += 24 * 60

return Math.max(0, arrival - start)
}

------------------------------------------------------------------
O'qish
------------------------------------------------------------------

```ts
listAttendance(staffId: ID, from: string, to: string): Promise<AttendanceDay[]>
```

### `GET /attendance/summary?staffId=&period=`

Davomat xulosasi.

`disciplineScore` — 0-100 ball:
  - kelmagan kun har biri jiddiy pasaytiradi,
  - kechikish har 10 daqiqasi uchun 1 ball,
  - sababli kelmaslik (ta'til, kasallik) jazolanmaydi.

```ts
getAttendanceSummary(staffId: ID, days = 30): Promise<AttendanceSummary>
```

### `GET /attendance/daily?date=`

Bir kunning davomati — barcha faol xodimlar bo'yicha.

Registratura har kuni shu ro'yxatni ochib, kim kelgan-kelmaganini
belgilaydi. Shuning uchun bu yerda xodimning MAOSHI yoki foizi yo'q:
davomat belgilash uchun ular kerak emas, ko'rsatilsa esa ortiqcha
moliyaviy ma'lumot tarqaladi.

```ts
getDailyAttendance(date: string): Promise<DailyAttendance>
```

### `POST /attendance`

Kunlik davomatni belgilash.

Bir xodimga bir kunda bitta yozuv bo'ladi — mavjudi yangilanadi.

```ts
markAttendance(input: AttendanceInput): Promise<Attendance>
```

### `GET /attendance/flags?limit=`

Kelish vaqti shubhali yozilgan davomat yozuvlari.

Egasining davomat bo'limida tepada ogohlantirish bo'lib turadi.
Bu ayblov emas — e'tibor talab qiladigan yozuvlar ro'yxati:
ehtimol haqiqiy sabab bor, lekin egasi bundan xabardor bo'lishi kerak.

RUXSAT: faqat `staff.manage` — registratura o'zi belgilagan
yozuvning bayroqlanganini ko'rmaydi.

```ts
listAttendanceFlags(limit = 20): Promise<AttendanceFlag[]>
```

## Bonuslar

`src/api/bonuses.ts`

> Bonuslar.
> 
> Uch xil yo'l bilan beriladi:
> 
>   1. QO'LDA      — egasi summa va sababni o'zi yozadi.
>   2. TAKLIF      — tizim ko'rsatkichlarga qarab kimga qancha berish
>                    mumkinligini taklif qiladi, egasi tasdiqlaydi.
>   3. QOIDA       — egasi bir marta qoida yozadi ("reja 100% dan oshsa —
>                    maoshning 10%i"), tizim uni har oy qo'llaydi.
> 
> RUXSAT: `bonus.manage` — faqat egasi.

### `GET /bonuses?period=&staffId=`

Joriy davr: "2026-09"
export function currentPeriod(): string {
const now = new Date()
return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

------------------------------------------------------------------
Bonuslar
------------------------------------------------------------------

```ts
listBonuses(period?: string, staffId?: ID): Promise<Bonus[]>
```

### `POST /bonuses`

```ts
createBonus(input: BonusInput): Promise<Bonus>
```

### `POST /bonuses/:id/pay`

```ts
payBonus(id: ID): Promise<Bonus>
```

### `DELETE /bonuses/:id`

```ts
deleteBonus(id: ID): Promise<void>
```

### `GET /bonus-rules`

Joriy davr: "2026-09"
export function currentPeriod(): string {
const now = new Date()
return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

------------------------------------------------------------------
Bonuslar
------------------------------------------------------------------

// GET /bonuses?period=&staffId=
export async function listBonuses(period?: string, staffId?: ID): Promise<Bonus[]> {
if (!USE_MOCK) return request<Bonus[]>('GET', '/bonuses', { query: { period, staffId } })

const rows = getDb()
.bonuses.all(apiContext().clinicId)
.filter((b) => !period || b.period === period)
.filter((b) => !staffId || b.staffId === staffId)
.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

return delay(rows)
}

export interface BonusInput {
staffId: ID
staffName: string
period: string
amount: UZS
reason: string
source: Bonus['source']
ruleId: ID | null
}

// POST /bonuses
export async function createBonus(input: BonusInput): Promise<Bonus> {
if (!USE_MOCK) return request<Bonus>('POST', '/bonuses', { body: input })

const { clinicId } = apiContext()
const db = getDb()

const bonus: Bonus = {
id: db.bonuses.nextId('bns'),
clinicId,
status: 'planned',
createdBy: 'usr_owner',
createdAt: new Date().toISOString(),
paidAt: null,
...input,
}

db.bonuses.insert(bonus)
return delay(bonus, 300)
}

// POST /bonuses/:id/pay
export async function payBonus(id: ID): Promise<Bonus> {
if (!USE_MOCK) return request<Bonus>('POST', `/bonuses/${id}/pay`)

const updated = getDb().bonuses.update(
id,
{ status: 'paid', paidAt: new Date().toISOString() },
apiContext().clinicId,
)
if (!updated) throw new Error('Bonus topilmadi')
return delay(updated, 260)
}

// DELETE /bonuses/:id
export async function deleteBonus(id: ID): Promise<void> {
if (!USE_MOCK) {
await request<void>('DELETE', `/bonuses/${id}`)
return
}
getDb().bonuses.remove(id, apiContext().clinicId)
await delay(null, 220)
}

------------------------------------------------------------------
Qoidalar
------------------------------------------------------------------

```ts
listBonusRules(): Promise<BonusRule[]>
```

### `POST /bonus-rules`

```ts
createBonusRule(input: BonusRuleInput): Promise<BonusRule>
```

### `PATCH /bonus-rules/:id`

```ts
updateBonusRule(id: ID, patch: Partial<BonusRuleInput>): Promise<BonusRule>
```

### `DELETE /bonus-rules/:id`

```ts
deleteBonusRule(id: ID): Promise<void>
```

### `GET /bonuses/suggestions?period=`

Tizim taklif qiladigan bonuslar.

Faol qoidalar har bir xodimga qo'llanadi. Shart bajarilsa — summa
hisoblanadi. Egasi ro'yxatni ko'rib, kerakligini tasdiqlaydi yoki
summani o'zgartiradi. Avtomatik to'lov YO'Q — oxirgi qaror egasida.

```ts
getBonusSuggestions(period: string): Promise<BonusSuggestion[]>
```

## Jarimalar

`src/api/penalties.ts`

> Jarimalar.
> 
> G'OYA: klinika egasi qoida yozadi ("kechikkan kunga 50 000 so'm"),
> tizim esa uni avtomatik qo'llaydi. Xodim jarimani o'z profilida
> ko'radi va nima uchun berilganini aniq biladi.
> 
> NEGA AVTOMATIK: qo'lda yoziladigan jarima har doim shaxsiy
> munosabatga aylanadi — kimdir kechirilib, kimdir kechirilmaydi.
> Qoida hamma uchun bir xil ishlasa, bahs qoidaning o'zi haqida
> bo'ladi, odam haqida emas.
> 
> NEGA FAQAT O'LCHANADIGAN SABABLAR: jarima asosi tizim
> tekshiradigan ma'lumotdan kelib chiqadi (davomat, kassa yopilishi).
> "Yomon ishladi" kabi sub'ektiv sabab yo'q — aks holda tizim
> kayfiyatni rasmiylashtirgan bo'lardi.
> 
> RUXSAT:
>   `staff.manage`  — qoidalarni yozish, jarimani kechirish
>   xodimning o'zi  — faqat O'Z jarimalarini ko'rish

### `GET /penalty-rules`

Jarimalar.

G'OYA: klinika egasi qoida yozadi ("kechikkan kunga 50 000 so'm"),
tizim esa uni avtomatik qo'llaydi. Xodim jarimani o'z profilida
ko'radi va nima uchun berilganini aniq biladi.

NEGA AVTOMATIK: qo'lda yoziladigan jarima har doim shaxsiy
munosabatga aylanadi — kimdir kechirilib, kimdir kechirilmaydi.
Qoida hamma uchun bir xil ishlasa, bahs qoidaning o'zi haqida
bo'ladi, odam haqida emas.

NEGA FAQAT O'LCHANADIGAN SABABLAR: jarima asosi tizim
tekshiradigan ma'lumotdan kelib chiqadi (davomat, kassa yopilishi).
"Yomon ishladi" kabi sub'ektiv sabab yo'q — aks holda tizim
kayfiyatni rasmiylashtirgan bo'lardi.

RUXSAT:
  `staff.manage`  — qoidalarni yozish, jarimani kechirish
  xodimning o'zi  — faqat O'Z jarimalarini ko'rish


import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { toISODate } from '@/lib/dates'
import type {
ID,
Penalty,
PenaltyRule,
PenaltySummary,
Staff,
UZS,
} from '@/types/models'

------------------------------------------------------------------
Qoidalar
------------------------------------------------------------------

```ts
listPenaltyRules(): Promise<PenaltyRule[]>
```

### `POST /penalty-rules`

```ts
createPenaltyRule(input: PenaltyRuleInput): Promise<PenaltyRule>
```

### `PATCH /penalty-rules/:id`

```ts
updatePenaltyRule(id: ID, patch: Partial<PenaltyRuleInput>): Promise<PenaltyRule>
```

### `DELETE /penalty-rules/:id`

```ts
deletePenaltyRule(id: ID): Promise<void>
```

### `GET /penalties?period=`

```ts
listPenalties(period: string): Promise<Penalty[]>
```

### `GET /me/penalties?period=`

Xodimning o'z jarimalari.

DASTURCHIGA: server bu so'rovda xodimni TOKENDAN aniqlashi shart.
`staffId` ni mijozdan qabul qilib, uni tekshirmaslik — boshqa
xodimning jarimalarini o'qish imkonini beradi.

```ts
getMyPenalties(staffId: ID, period: string): Promise<PenaltySummary>
```

### `POST /penalties/:id/waive`

Jarimani kechirish.

Egasi faqat KECHIRA oladi — summani qo'lda oshirish yoki yangi
jarima yozish imkoni yo'q. Aks holda "avtomatik qoida" degani
ma'nosini yo'qotardi: har qanday summa qo'lda qo'yilishi mumkin
bo'lsa, qoida shunchaki bezak bo'lib qoladi.

```ts
waivePenalty(penaltyId: ID, note: string): Promise<void>
```

### `DELETE /penalties/:id/waive`

```ts
unwaivePenalty(penaltyId: ID): Promise<void>
```

## Bemor fikri

`src/api/feedback.ts`

> Bemor fikrlari.
> 
> ISHLASH TARTIBI: bemor telefon raqamini kiritadi -> tizim uni bazadan
> topadi va oxirgi tashriflarini ko'rsatadi -> bemor tashrifni tanlab
> baho va izoh qoldiradi.
> 
> XAVFSIZLIK (dasturchiga):
>   - `/feedback/lookup` endpointi RATE LIMIT ostida bo'lishi shart.
>     Aks holda raqamlarni birma-bir sinab, klinika bemorlari bazasini
>     yig'ib olish mumkin.
>   - Javobda faqat "topildi/topilmadi", bemor ismi va O'SHA bemorning
>     tashriflari qaytadi. Boshqa hech narsa.
>   - Ishonchliroq variant: raqamga bir martalik SMS kod yuborish.
>     MVP'da bu yo'q, chunki SMS - doimiy xarajat.
> 
> SHIFOKORGA: fikr anonim ko'rsatiladi. Shifokor kim yozganini bilsa,
> bemor rostini yozmaydi.

### `POST /feedback/lookup  { phone }`

Bemor fikrlari.

ISHLASH TARTIBI: bemor telefon raqamini kiritadi -> tizim uni bazadan
topadi va oxirgi tashriflarini ko'rsatadi -> bemor tashrifni tanlab
baho va izoh qoldiradi.

XAVFSIZLIK (dasturchiga):
  - `/feedback/lookup` endpointi RATE LIMIT ostida bo'lishi shart.
    Aks holda raqamlarni birma-bir sinab, klinika bemorlari bazasini
    yig'ib olish mumkin.
  - Javobda faqat "topildi/topilmadi", bemor ismi va O'SHA bemorning
    tashriflari qaytadi. Boshqa hech narsa.
  - Ishonchliroq variant: raqamga bir martalik SMS kod yuborish.
    MVP'da bu yo'q, chunki SMS - doimiy xarajat.

SHIFOKORGA: fikr anonim ko'rsatiladi. Shifokor kim yozganini bilsa,
bemor rostini yozmaydi.


import { apiContext, delay, matches, paginate, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import { addDays, startOfDay } from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
Feedback,
FeedbackLookup,
FeedbackStats,
FeedbackStatus,
ID,
Paginated,
SeriesPoint,
} from '@/types/models'

------------------------------------------------------------------
Telefon bo'yicha qidiruv
------------------------------------------------------------------

```ts
lookupByPhone(phone: string): Promise<FeedbackLookup>
```

### `GET /feedback?search=&rating=&doctorId=&status=&page=`

```ts
listFeedback(query: FeedbackQuery = {}): Promise<Paginated<Feedback>>
```

### `POST /feedback`

```ts
createFeedback(input: FeedbackInput): Promise<Feedback>
```

### `POST /feedback/:id/reply  { text }`

```ts
replyToFeedback(id: ID, text: string): Promise<Feedback>
```

### `PATCH /feedback/:id  { status }`

```ts
setFeedbackStatus(id: ID, status: FeedbackStatus): Promise<Feedback>
```

### `GET /feedback/stats?days=`

Anonim fikrni shifokorga ko'rsatishdan oldin ismni yashiramiz.

DIQQAT: haqiqiy backendda bu SERVERDA qilinishi shart. Bu yerda
yashirish faqat interfeys uchun — agar ism javobda kelsa, uni
brauzerdan ko'rish mumkin.

function maskIfNeeded(feedback: Feedback, viewerIsDoctor: boolean): Feedback {
if (!viewerIsDoctor || !feedback.isAnonymous) return feedback
return { ...feedback, patientName: '', phone: '', patientId: null }
}

export interface FeedbackInput {
phone: string
patientId: ID | null
patientName: string
doctorId: ID | null
appointmentId: ID | null
rating: number
scores: Feedback['scores']
text: string
isAnonymous: boolean
}

// POST /feedback
export async function createFeedback(input: FeedbackInput): Promise<Feedback> {
if (!USE_MOCK) return request<Feedback>('POST', '/feedback', { body: input })

const { clinicId } = apiContext()
const db = getDb()

const now = new Date()


Shifokorga ochilish vaqti — 1 dan 14 kungacha tasodifiy.

Bu anonimlikning texnik asosi: fikr darhol ko'rinsa, shifokor
o'sha kuni kimni qabul qilganini eslab, yozgan odamni topadi.
Bir necha kunlik noaniq kechikish bu bog'lanishni uzadi.

DASTURCHIGA: serverda ham SHU maydon bo'yicha filtrlash SHART.
Frontend faqat ko'rsatmaydi — API javobida kelgan fikrni
yashirish himoya emas.

const revealHours = 24 + Math.floor(Math.random() * 13 * 24)

const feedback: Feedback = {
id: db.feedback.nextId('fbk'),
clinicId,
status: 'new',
reply: '',
repliedAt: null,
createdAt: now.toISOString(),
revealAt: new Date(now.getTime() + revealHours * 3_600_000).toISOString(),
...input,
}

db.feedback.insert(feedback)
return delay(feedback, 350)
}

// POST /feedback/:id/reply  { text }
export async function replyToFeedback(id: ID, text: string): Promise<Feedback> {
if (!USE_MOCK) {
return request<Feedback>('POST', `/feedback/${id}/reply`, { body: { text } })
}

const updated = getDb().feedback.update(
id,
{ reply: text, repliedAt: new Date().toISOString(), status: 'reviewed' },
apiContext().clinicId,
)
if (!updated) throw new Error('Izoh topilmadi')
return delay(updated, 280)
}

// PATCH /feedback/:id  { status }
export async function setFeedbackStatus(
id: ID,
status: FeedbackStatus,
): Promise<Feedback> {
if (!USE_MOCK) return request<Feedback>('PATCH', `/feedback/${id}`, { body: { status } })

const updated = getDb().feedback.update(id, { status }, apiContext().clinicId)
if (!updated) throw new Error('Izoh topilmadi')
return delay(updated, 220)
}

------------------------------------------------------------------
Statistika
------------------------------------------------------------------

```ts
getFeedbackStats(days = 90): Promise<FeedbackStats>
```

### `GET /me/feedback?days=`

Shifokorga YAQINDA ochilgan fikrlar.

Bosh sahifadagi karta uchun: shifokor tizimga kirganida "sizga
yangi fikr keldi" degan xabarni ko'radi. Fikr qachon kelgani
oldindan bilinmaydi — aynan shu tasodifiylik anonimlikni
saqlaydi.

RUXSAT: `feedback.view` + shifokor doirasi. Server javobda
bemor ma'lumotini QAYTARMASLIGI shart.

```ts
listRecentFeedbackForDoctor(days = 7): Promise<Feedback[]>
```

## Ichki chat

`src/api/chat.ts`

> ============================================================
>  XODIMLAR CHATI
> ============================================================
> 
> DASTURCHIGA — REALTIME HAQIDA:
> 
> Bu yerdagi funksiyalar oddiy HTTP so'rovlar sifatida yozilgan, chunki
> mock rejimda realtime kerak emas. Haqiqiy tizimda esa yangi xabar
> DARHOL yetib borishi kerak.
> 
> Tavsiya etilgan yechim — WebSocket:
> 
>   1. Mijoz kirgach `wss://api.clinicos.uz/chat` ga ulanadi va
>      tokenni yuboradi.
>   2. Server foydalanuvchi a'zo bo'lgan guruhlarga obuna qiladi.
>   3. Yangi xabar kelganda server uni barcha ulangan a'zolarga yuboradi:
>        { type: 'message', payload: ChatMessage }
>   4. `sendMessage` HTTP orqali ketaveradi (ishonchliroq), javob esa
>      WebSocket orqali hammaga tarqaladi.
> 
> Agar WebSocket qo'yish qiyin bo'lsa, boshlang'ich variant sifatida
> har 3-5 soniyada `getMessages(groupId, since)` so'rovi ham ishlaydi —
> kichik klinikada bu yetarli.
> 
> MAXFIYLIK: server har bir so'rovda foydalanuvchi SHU guruh a'zosi
> ekanini tekshirishi shart. A'zo bo'lmagan guruh xabarlari hech qachon
> qaytmasligi kerak.

### `GET /chat/groups`

============================================================
 XODIMLAR CHATI
============================================================

DASTURCHIGA — REALTIME HAQIDA:

Bu yerdagi funksiyalar oddiy HTTP so'rovlar sifatida yozilgan, chunki
mock rejimda realtime kerak emas. Haqiqiy tizimda esa yangi xabar
DARHOL yetib borishi kerak.

Tavsiya etilgan yechim — WebSocket:

  1. Mijoz kirgach `wss://api.clinicos.uz/chat` ga ulanadi va
     tokenni yuboradi.
  2. Server foydalanuvchi a'zo bo'lgan guruhlarga obuna qiladi.
  3. Yangi xabar kelganda server uni barcha ulangan a'zolarga yuboradi:
       { type: 'message', payload: ChatMessage }
  4. `sendMessage` HTTP orqali ketaveradi (ishonchliroq), javob esa
     WebSocket orqali hammaga tarqaladi.

Agar WebSocket qo'yish qiyin bo'lsa, boshlang'ich variant sifatida
har 3-5 soniyada `getMessages(groupId, since)` so'rovi ham ishlaydi —
kichik klinikada bu yetarli.

MAXFIYLIK: server har bir so'rovda foydalanuvchi SHU guruh a'zosi
ekanini tekshirishi shart. A'zo bo'lmagan guruh xabarlari hech qachon
qaytmasligi kerak.


import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ChatGroup, ChatGroupSummary, ChatMessage, ID } from '@/types/models'

------------------------------------------------------------------
Suhbatlar
------------------------------------------------------------------

```ts
listChatGroups(userId: ID, search = ''): Promise<ChatGroupSummary[]>
```

### `GET /chat/groups/:id/messages?since=`

============================================================
 XODIMLAR CHATI
============================================================

DASTURCHIGA — REALTIME HAQIDA:

Bu yerdagi funksiyalar oddiy HTTP so'rovlar sifatida yozilgan, chunki
mock rejimda realtime kerak emas. Haqiqiy tizimda esa yangi xabar
DARHOL yetib borishi kerak.

Tavsiya etilgan yechim — WebSocket:

  1. Mijoz kirgach `wss://api.clinicos.uz/chat` ga ulanadi va
     tokenni yuboradi.
  2. Server foydalanuvchi a'zo bo'lgan guruhlarga obuna qiladi.
  3. Yangi xabar kelganda server uni barcha ulangan a'zolarga yuboradi:
       { type: 'message', payload: ChatMessage }
  4. `sendMessage` HTTP orqali ketaveradi (ishonchliroq), javob esa
     WebSocket orqali hammaga tarqaladi.

Agar WebSocket qo'yish qiyin bo'lsa, boshlang'ich variant sifatida
har 3-5 soniyada `getMessages(groupId, since)` so'rovi ham ishlaydi —
kichik klinikada bu yetarli.

MAXFIYLIK: server har bir so'rovda foydalanuvchi SHU guruh a'zosi
ekanini tekshirishi shart. A'zo bo'lmagan guruh xabarlari hech qachon
qaytmasligi kerak.


import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ChatGroup, ChatGroupSummary, ChatMessage, ID } from '@/types/models'

------------------------------------------------------------------
Suhbatlar
------------------------------------------------------------------

// GET /chat/groups
export async function listChatGroups(
userId: ID,
search = '',
): Promise<ChatGroupSummary[]> {
if (!USE_MOCK) {
return request<ChatGroupSummary[]>('GET', '/chat/groups', { query: { search } })
}

const { clinicId } = apiContext()
const db = getDb()

const users = new Map(db.users.all(clinicId).map((u) => [u.id, u]))
const allMessages = db.chatMessages.all(clinicId)

const rows = db.chatGroups
.all(clinicId)
// Foydalanuvchi faqat o'zi a'zo bo'lgan suhbatlarni ko'radi
.filter((group) => group.memberIds.includes(userId))
.filter((group) => matches(group.name, search))
.map((group) => {
const groupMessages = allMessages
.filter((m) => m.groupId === group.id)
.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const last = groupMessages[groupMessages.length - 1]

return {
...group,
lastMessage: last
? {
text: last.text,
authorName: last.authorName,
createdAt: last.createdAt,
isSystem: last.isSystem,
}
: null,
unreadCount: groupMessages.filter(
(m) => m.authorId !== userId && !m.readBy.includes(userId),
).length,
memberNames: group.memberIds
.map((id) => users.get(id)?.fullName ?? '')
.filter(Boolean),
}
})

// Oxirgi yozishmalar tepada
rows.sort((a, b) =>
(b.lastMessage?.createdAt ?? b.createdAt).localeCompare(
a.lastMessage?.createdAt ?? a.createdAt,
),
)

return delay(rows, 140)
}

------------------------------------------------------------------
Xabarlar
------------------------------------------------------------------

```ts
getMessages(groupId: ID, since?: string): Promise<ChatMessage[]>
```

### `POST /chat/groups/:id/messages`

```ts
sendMessage(input: SendMessageInput): Promise<ChatMessage>
```

### `POST /chat/groups/:id/read`

Xabarlarni o'qilgan deb belgilash.

Serverda bu alohida endpoint bo'lishi kerak — har bir xabarni
alohida yangilash o'rniga bitta so'rovda butun guruh belgilanadi.

```ts
markGroupRead(groupId: ID, userId: ID): Promise<void>
```

### `POST /chat/groups`

```ts
createChatGroup(input: ChatGroupInput, createdBy: ID): Promise<ChatGroup>
```

## Registratura paneli

`src/api/reception.ts`

> Registratura paneli.
> 
> Bitta so'rovda kun davomida kerak bo'ladigan hamma narsa qaytadi:
> navbat, bugungi hisob, e'tibor talab qiladigan ishlar va kassa.
> 
> NEGA BITTA SO'ROV: registratura paneli har 30-60 soniyada yangilanib
> turadi. Beshta alohida so'rov o'rniga bitta so'rov serverga ham,
> tarmoqqa ham yengilroq.
> 
> RUXSAT: `dashboard.view` + `appointments.view`.

### `GET /reception/summary`

```ts
getReceptionSummary(userId: string): Promise<ReceptionSummary>
```

## Tahlil

`src/api/analytics.ts`

> Bosh sahifa ko'rsatkichlari va analitika.
> 
> RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
> rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
> `analytics.view` — faqat egasi.
> 
> Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
> har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
> yoki materialized view ishlatish tavsiya etiladi.

### `GET /dashboard/summary`

Bosh sahifa ko'rsatkichlari va analitika.

RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
`analytics.view` — faqat egasi.

Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
yoki materialized view ishlatish tavsiya etiladi.


import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import {
addDays,
eachDay,
endOfDay,
fromISODate,
startOfDay,
startOfWeek,
toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
AnalyticsReport,
Appointment,
ClinicPerformance,
DashboardSummary,
DateRange,
Metric,
Payment,
RevenueBreakdownItem,
SeriesPoint,
} from '@/types/models'

export type RevenuePeriod = 'today' | 'week' | 'month'

------------------------------------------------------------------
Bosh sahifa KPI
------------------------------------------------------------------

```ts
getDashboardSummary(): Promise<DashboardSummary>
```

### `GET /dashboard/revenue?period=today|week|month`

Bosh sahifa ko'rsatkichlari va analitika.

RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
`analytics.view` — faqat egasi.

Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
yoki materialized view ishlatish tavsiya etiladi.


import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import {
addDays,
eachDay,
endOfDay,
fromISODate,
startOfDay,
startOfWeek,
toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
AnalyticsReport,
Appointment,
ClinicPerformance,
DashboardSummary,
DateRange,
Metric,
Payment,
RevenueBreakdownItem,
SeriesPoint,
} from '@/types/models'

export type RevenuePeriod = 'today' | 'week' | 'month'

------------------------------------------------------------------
Bosh sahifa KPI
------------------------------------------------------------------

// GET /dashboard/summary
export async function getDashboardSummary(): Promise<DashboardSummary> {
if (!USE_MOCK) return request<DashboardSummary>('GET', '/dashboard/summary')

const { appointments, payments, patients } = scopedData()
const now = new Date()

const todayStart = startOfDay(now).getTime()
const todayEnd = endOfDay(now).getTime()

// Kecha bilan solishtirganda TO'LIQ kunni emas, kechagi SHU VAQTGACHA
// bo'lgan qismini olamiz. Aks holda ertalab soat 10 da har bir
// ko'rsatkich qizil bo'lib chiqadi — bu noto'g'ri xulosa beradi.
const yStart = startOfDay(addDays(now, -1)).getTime()
const yEnd = yStart + (now.getTime() - todayStart)

const inWindow = (iso: string, from: number, to: number) => {
const t = new Date(iso).getTime()
return t >= from && t <= to
}

const todayAppts = appointments.filter((a) => inWindow(a.startsAt, todayStart, todayEnd))
const yAppts = appointments.filter((a) => inWindow(a.startsAt, yStart, yEnd))

const seenToday = todayAppts.filter((a) => a.status === 'completed')
const seenYesterday = yAppts.filter((a) => a.status === 'completed')

const revToday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, todayStart, todayEnd))
.reduce((sum, p) => sum + p.amount, 0)
const revYesterday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, yStart, yEnd))
.reduce((sum, p) => sum + p.amount, 0)

// Yangi bemor — bugun ro'yxatdan o'tgan
const newToday = patients.filter((p) => inWindow(p.createdAt, todayStart, todayEnd)).length
const newYesterday = patients.filter((p) => inWindow(p.createdAt, yStart, yEnd)).length

// Qaytgan — bugun kelganlar ichida avval ham tashrifi bo'lganlar
const priorPatients = new Set(
appointments
.filter((a) => a.status === 'completed' && new Date(a.startsAt).getTime() < todayStart)
.map((a) => a.patientId),
)
const returningToday = seenToday.filter((a) => priorPatients.has(a.patientId)).length
const returningYesterday = seenYesterday.filter((a) => priorPatients.has(a.patientId)).length

const noShowToday = todayAppts.filter((a) => a.status === 'no_show').length
const noShowYesterday = yAppts.filter((a) => a.status === 'no_show').length

const remaining = todayAppts.filter(
(a) => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'checked_in',
).length

return delay({
patientsToday: metric(seenToday.length, seenYesterday.length),
revenueToday: metric(revToday, revYesterday),
appointmentsToday: metric(todayAppts.length, yAppts.length),
appointmentsRemaining: remaining,
newPatients: metric(newToday, newYesterday),
returningPatients: metric(returningToday, returningYesterday),
noShows: metric(noShowToday, noShowYesterday),
})
}

------------------------------------------------------------------
Daromad grafigi (bosh sahifa)
------------------------------------------------------------------

```ts
getRevenueSeries(period: RevenuePeriod): Promise<SeriesPoint[]>
```

### `GET /dashboard/performance`

Bosh sahifa ko'rsatkichlari va analitika.

RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
`analytics.view` — faqat egasi.

Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
yoki materialized view ishlatish tavsiya etiladi.


import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import {
addDays,
eachDay,
endOfDay,
fromISODate,
startOfDay,
startOfWeek,
toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
AnalyticsReport,
Appointment,
ClinicPerformance,
DashboardSummary,
DateRange,
Metric,
Payment,
RevenueBreakdownItem,
SeriesPoint,
} from '@/types/models'

export type RevenuePeriod = 'today' | 'week' | 'month'

------------------------------------------------------------------
Bosh sahifa KPI
------------------------------------------------------------------

// GET /dashboard/summary
export async function getDashboardSummary(): Promise<DashboardSummary> {
if (!USE_MOCK) return request<DashboardSummary>('GET', '/dashboard/summary')

const { appointments, payments, patients } = scopedData()
const now = new Date()

const todayStart = startOfDay(now).getTime()
const todayEnd = endOfDay(now).getTime()

// Kecha bilan solishtirganda TO'LIQ kunni emas, kechagi SHU VAQTGACHA
// bo'lgan qismini olamiz. Aks holda ertalab soat 10 da har bir
// ko'rsatkich qizil bo'lib chiqadi — bu noto'g'ri xulosa beradi.
const yStart = startOfDay(addDays(now, -1)).getTime()
const yEnd = yStart + (now.getTime() - todayStart)

const inWindow = (iso: string, from: number, to: number) => {
const t = new Date(iso).getTime()
return t >= from && t <= to
}

const todayAppts = appointments.filter((a) => inWindow(a.startsAt, todayStart, todayEnd))
const yAppts = appointments.filter((a) => inWindow(a.startsAt, yStart, yEnd))

const seenToday = todayAppts.filter((a) => a.status === 'completed')
const seenYesterday = yAppts.filter((a) => a.status === 'completed')

const revToday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, todayStart, todayEnd))
.reduce((sum, p) => sum + p.amount, 0)
const revYesterday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, yStart, yEnd))
.reduce((sum, p) => sum + p.amount, 0)

// Yangi bemor — bugun ro'yxatdan o'tgan
const newToday = patients.filter((p) => inWindow(p.createdAt, todayStart, todayEnd)).length
const newYesterday = patients.filter((p) => inWindow(p.createdAt, yStart, yEnd)).length

// Qaytgan — bugun kelganlar ichida avval ham tashrifi bo'lganlar
const priorPatients = new Set(
appointments
.filter((a) => a.status === 'completed' && new Date(a.startsAt).getTime() < todayStart)
.map((a) => a.patientId),
)
const returningToday = seenToday.filter((a) => priorPatients.has(a.patientId)).length
const returningYesterday = seenYesterday.filter((a) => priorPatients.has(a.patientId)).length

const noShowToday = todayAppts.filter((a) => a.status === 'no_show').length
const noShowYesterday = yAppts.filter((a) => a.status === 'no_show').length

const remaining = todayAppts.filter(
(a) => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'checked_in',
).length

return delay({
patientsToday: metric(seenToday.length, seenYesterday.length),
revenueToday: metric(revToday, revYesterday),
appointmentsToday: metric(todayAppts.length, yAppts.length),
appointmentsRemaining: remaining,
newPatients: metric(newToday, newYesterday),
returningPatients: metric(returningToday, returningYesterday),
noShows: metric(noShowToday, noShowYesterday),
})
}

------------------------------------------------------------------
Daromad grafigi (bosh sahifa)
------------------------------------------------------------------

// GET /dashboard/revenue?period=today|week|month
export async function getRevenueSeries(period: RevenuePeriod): Promise<SeriesPoint[]> {
if (!USE_MOCK) {
return request<SeriesPoint[]>('GET', '/dashboard/revenue', { query: { period } })
}

const { payments } = scopedData()
const paid = payments.filter((p) => p.status === 'paid')
const now = new Date()

if (period === 'today') {
// Soatlar bo'yicha, klinika ish vaqti
const points: SeriesPoint[] = []
for (let hour = 8; hour <= 19; hour++) {
const value = paid
.filter((p) => {
const d = new Date(p.paidAt)
return startOfDay(d).getTime() === startOfDay(now).getTime() && d.getHours() === hour
})
.reduce((sum, p) => sum + p.amount, 0)
points.push({ label: `${String(hour).padStart(2, '0')}:00`, value })
}
return delay(points, 140)
}

const days = period === 'week' ? 7 : 30
const points = eachDay(addDays(now, -(days - 1)), now).map((day) => ({
label: dateCompact(day),
value: paid
.filter((p) => toISODate(new Date(p.paidAt)) === toISODate(day))
.reduce((sum, p) => sum + p.amount, 0),
}))

return delay(points, 140)
}

------------------------------------------------------------------
Klinika ko'rsatkichlari
------------------------------------------------------------------

```ts
getClinicPerformance(): Promise<ClinicPerformance>
```

### `GET /reports/analytics?from=&to=`

Bosh sahifa ko'rsatkichlari va analitika.

RUXSAT: `dashboard.view` hammada bor, lekin QAYTARILADIGAN ma'lumot
rolga qarab farq qiladi — shifokor faqat o'z raqamlarini ko'radi.
`analytics.view` — faqat egasi.

Haqiqiy backendda bu hisoblar SQL agregatlari bo'ladi. Katta klinikada
har so'rovda qayta hisoblamaslik uchun kunlik yig'ma jadval (rollup)
yoki materialized view ishlatish tavsiya etiladi.


import { apiContext, delay, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import {
addDays,
eachDay,
endOfDay,
fromISODate,
startOfDay,
startOfWeek,
toISODate,
} from '@/lib/dates'
import { dateCompact } from '@/lib/format'
import type {
AnalyticsReport,
Appointment,
ClinicPerformance,
DashboardSummary,
DateRange,
Metric,
Payment,
RevenueBreakdownItem,
SeriesPoint,
} from '@/types/models'

export type RevenuePeriod = 'today' | 'week' | 'month'

------------------------------------------------------------------
Bosh sahifa KPI
------------------------------------------------------------------

// GET /dashboard/summary
export async function getDashboardSummary(): Promise<DashboardSummary> {
if (!USE_MOCK) return request<DashboardSummary>('GET', '/dashboard/summary')

const { appointments, payments, patients } = scopedData()
const now = new Date()

const todayStart = startOfDay(now).getTime()
const todayEnd = endOfDay(now).getTime()

// Kecha bilan solishtirganda TO'LIQ kunni emas, kechagi SHU VAQTGACHA
// bo'lgan qismini olamiz. Aks holda ertalab soat 10 da har bir
// ko'rsatkich qizil bo'lib chiqadi — bu noto'g'ri xulosa beradi.
const yStart = startOfDay(addDays(now, -1)).getTime()
const yEnd = yStart + (now.getTime() - todayStart)

const inWindow = (iso: string, from: number, to: number) => {
const t = new Date(iso).getTime()
return t >= from && t <= to
}

const todayAppts = appointments.filter((a) => inWindow(a.startsAt, todayStart, todayEnd))
const yAppts = appointments.filter((a) => inWindow(a.startsAt, yStart, yEnd))

const seenToday = todayAppts.filter((a) => a.status === 'completed')
const seenYesterday = yAppts.filter((a) => a.status === 'completed')

const revToday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, todayStart, todayEnd))
.reduce((sum, p) => sum + p.amount, 0)
const revYesterday = payments
.filter((p) => p.status === 'paid' && inWindow(p.paidAt, yStart, yEnd))
.reduce((sum, p) => sum + p.amount, 0)

// Yangi bemor — bugun ro'yxatdan o'tgan
const newToday = patients.filter((p) => inWindow(p.createdAt, todayStart, todayEnd)).length
const newYesterday = patients.filter((p) => inWindow(p.createdAt, yStart, yEnd)).length

// Qaytgan — bugun kelganlar ichida avval ham tashrifi bo'lganlar
const priorPatients = new Set(
appointments
.filter((a) => a.status === 'completed' && new Date(a.startsAt).getTime() < todayStart)
.map((a) => a.patientId),
)
const returningToday = seenToday.filter((a) => priorPatients.has(a.patientId)).length
const returningYesterday = seenYesterday.filter((a) => priorPatients.has(a.patientId)).length

const noShowToday = todayAppts.filter((a) => a.status === 'no_show').length
const noShowYesterday = yAppts.filter((a) => a.status === 'no_show').length

const remaining = todayAppts.filter(
(a) => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'checked_in',
).length

return delay({
patientsToday: metric(seenToday.length, seenYesterday.length),
revenueToday: metric(revToday, revYesterday),
appointmentsToday: metric(todayAppts.length, yAppts.length),
appointmentsRemaining: remaining,
newPatients: metric(newToday, newYesterday),
returningPatients: metric(returningToday, returningYesterday),
noShows: metric(noShowToday, noShowYesterday),
})
}

------------------------------------------------------------------
Daromad grafigi (bosh sahifa)
------------------------------------------------------------------

// GET /dashboard/revenue?period=today|week|month
export async function getRevenueSeries(period: RevenuePeriod): Promise<SeriesPoint[]> {
if (!USE_MOCK) {
return request<SeriesPoint[]>('GET', '/dashboard/revenue', { query: { period } })
}

const { payments } = scopedData()
const paid = payments.filter((p) => p.status === 'paid')
const now = new Date()

if (period === 'today') {
// Soatlar bo'yicha, klinika ish vaqti
const points: SeriesPoint[] = []
for (let hour = 8; hour <= 19; hour++) {
const value = paid
.filter((p) => {
const d = new Date(p.paidAt)
return startOfDay(d).getTime() === startOfDay(now).getTime() && d.getHours() === hour
})
.reduce((sum, p) => sum + p.amount, 0)
points.push({ label: `${String(hour).padStart(2, '0')}:00`, value })
}
return delay(points, 140)
}

const days = period === 'week' ? 7 : 30
const points = eachDay(addDays(now, -(days - 1)), now).map((day) => ({
label: dateCompact(day),
value: paid
.filter((p) => toISODate(new Date(p.paidAt)) === toISODate(day))
.reduce((sum, p) => sum + p.amount, 0),
}))

return delay(points, 140)
}

------------------------------------------------------------------
Klinika ko'rsatkichlari
------------------------------------------------------------------

// GET /dashboard/performance
export async function getClinicPerformance(): Promise<ClinicPerformance> {
if (!USE_MOCK) return request<ClinicPerformance>('GET', '/dashboard/performance')

const { appointments, payments } = scopedData()
const monthStart = startOfDay(addDays(new Date(), -29)).getTime()

const monthly = appointments.filter((a) => new Date(a.startsAt).getTime() >= monthStart)
const completed = monthly.filter((a) => a.status === 'completed')
const noShow = monthly.filter((a) => a.status === 'no_show')

const revenue = payments
.filter((p) => p.status === 'paid' && new Date(p.paidAt).getTime() >= monthStart)
.reduce((sum, p) => sum + p.amount, 0)

const patientIds = completed.map((a) => a.patientId)
const uniquePatients = new Set(patientIds).size
const returning = patientIds.length - uniquePatients

const averageCheck = completed.length ? Math.round(revenue / completed.length) : 0

return delay({
patients: uniquePatients,
revenue,
appointments: monthly.length,
averageCheck,
returningRate: patientIds.length ? (returning / patientIds.length) * 100 : 0,
noShowRate: monthly.length ? (noShow.length / monthly.length) * 100 : 0,
// Maqsadlar — demo uchun statik. Haqiqiy tizimda egasi sozlamalarda belgilaydi.
targets: {
patients: 900,
revenue: 320_000_000,
appointments: 1200,
averageCheck: 200_000,
returningRate: 45,
noShowRate: 5,
},
})
}

------------------------------------------------------------------
To'liq analitika hisoboti
------------------------------------------------------------------

```ts
getAnalyticsReport(range: DateRange): Promise<AnalyticsReport>
```

## Prognoz

`src/api/forecast.ts`

> ============================================================
>  MOLIYAVIY PROGNOZ
> ============================================================
> 
> Savol: "Keyingi 3 / 6 / 12 oyda klinika qancha ishlaydi va zarar
> xavfi bormi?"
> 
> USUL: eng kichik kvadratlar usuli bilan chiziqli tendensiya + oylik
> mavsumiylik koeffitsienti. Bu murakkab model emas, lekin klinika
> uchun yetarli va — muhimi — TUSHUNARLI. Egasi raqam qayerdan
> chiqqanini tushunishi kerak.
> 
> OCHIQ AYTAMIZ: bu bashorat, kafolat emas. Yangi raqobatchi, epidemiya
> yoki narx o'zgarishi prognozni buzadi. Shuning uchun interfeysda
> ishonch oralig'i va "taxminiy" belgisi doim ko'rsatiladi.

### `GET /forecast?horizon=3|6|12`

```ts
getForecast(horizon: ForecastHorizon): Promise<Forecast>
```

### `GET /reports/monthly`

Davrni n oyga surish
function shiftPeriod(period: string, months: number): string {
const [year, month] = period.split('-').map(Number)
const date = new Date(year, month - 1 + months, 1)
return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function emptyForecast(horizon: ForecastHorizon): Forecast {
return {
horizon,
basedOnMonths: 0,
revenue: [],
expenses: [],
profit: [],
totals: { revenue: 0, expenses: 0, profit: 0 },
growthRate: 0,
confidence: 0,
risk: 'ok',
warnings: [
{ key: 'forecast.warn.notEnoughData', vars: {}, severity: 'warn' },
],
firstLossPeriod: null,
breakEvenGap: 0,
}
}

------------------------------------------------------------------
Oylik tarix
------------------------------------------------------------------

```ts
getMonthlyStats(): Promise<MonthlyStat[]>
```

## Bildirishnomalar

`src/api/notifications.ts`

> Bildirishnomalar.
> 
> MVP'da ular hech qayerda saqlanmaydi — mavjud ma'lumotdan hisoblanadi:
> bugungi qabullar, tasdiqlanmaganlar, kutilayotgan to'lovlar, takroriy
> tashrif muddati kelganlar.
> 
> Keyingi bosqichda haqiqiy `notifications` jadvali va o'qilgan holati
> qo'shiladi — shuning uchun model allaqachon `readAt` maydoniga ega.

### `GET /notifications`

```ts
listNotifications(): Promise<AppNotification[]>
```

## Qidiruv

`src/api/search.ts`

> Global qidiruv (yuqori paneldagi maydon).
> 
> Haqiqiy backendda bu bitta endpoint bo'lishi kerak — to'rt jadvalga
> alohida so'rov yubormang. Katta bazada `pg_trgm` indeksi yoki
> to'liq matnli qidiruv (tsvector) tavsiya etiladi.

### `GET /search?q=`

```ts
globalSearch(query: string): Promise<SearchHit[]>
```

## Platforma paneli (super-admin)

`src/api/platform.ts`

> Platforma paneli — ClinicOS ning o'z boshqaruvi.
> 
> Bu API klinika ichidagi API'lardan BUTUNLAY ajratilgan: u
> klinikalar, tariflar va obunalar ustida ishlaydi. Bemor, tashrif,
> to'lov kabi tibbiy va moliyaviy ma'lumotga umuman tegmaydi.
> 
> NEGA MULTI-TENANCY FILTRI YO'Q: bu yerdagi so'rovlar ataylab
> BARCHA klinikalarni qamraydi. Shuning uchun `allAcrossTenants()`
> va `updateAcrossTenants()` ishlatiladi — klinika ma'lumotida
> bu metodlar HECH QACHON chaqirilmaydi.
> 
> RUXSAT (SERVERDA MAJBURIY):
>   `platform.view`        — ko'rish
>   `platform.manage`      — tarif, holat o'zgartirish
>   `platform.impersonate` — klinika paneliga kirish
> 
> Bu ruxsatlar klinika rollariga HECH QACHON berilmaydi. Server
> har bir so'rovda foydalanuvchi rolini tekshirishi shart —
> frontenddagi menyu yashirish himoya emas.

### `GET /platform/tenants?search=&status=&planId=&page=`

```ts
listTenants(query: TenantQuery = {}): Promise<Paginated<Tenant>>
```

### `GET /platform/tenants/:id`

```ts
getTenant(id: ID): Promise<Tenant | null>
```

### `POST /platform/tenants/:id/suspend`

Klinikaning kirishini to'xtatish.

MA'LUMOT O'CHIRILMAYDI. To'xtatilgan klinika tizimga kira olmaydi,
lekin bemorlari, tashriflari, hisobotlari joyida qoladi — to'lov
tiklansa, ish o'sha joydan davom etadi.

Sabab MAJBURIY: klinika egasi nima uchun yopilganini bilishi kerak.

```ts
suspendTenant(id: ID, reason: string): Promise<Tenant>
```

### `POST /platform/tenants/:id/activate`

```ts
activateTenant(id: ID): Promise<Tenant>
```

### `POST /platform/tenants/:id/plan`

Tarifni o'zgartirish.

Yangi narx keyingi hisobdan boshlab qo'llanadi — joriy oy uchun
chiqarilgan hisob o'zgarmaydi. Aks holda mijoz allaqachon
ko'rgan summa o'zgarib qolardi.

```ts
changeTenantPlan(id: ID, planId: ID): Promise<Tenant>
```

### `GET /platform/plans`

Tarifni o'zgartirish.

Yangi narx keyingi hisobdan boshlab qo'llanadi — joriy oy uchun
chiqarilgan hisob o'zgarmaydi. Aks holda mijoz allaqachon
ko'rgan summa o'zgarib qolardi.

// POST /platform/tenants/:id/plan
export async function changeTenantPlan(id: ID, planId: ID): Promise<Tenant> {
if (!USE_MOCK) {
return request<Tenant>('POST', `/platform/tenants/${id}/plan`, { body: { planId } })
}

const db = getDb()
const plan = db.plans.allAcrossTenants().find((p) => p.id === planId)
if (!plan) throw new Error('Tarif topilmadi')

const updated = db.tenants.updateAcrossTenants(id, {
planId: plan.id,
planName: plan.name,
pricePerMonth: plan.pricePerMonth,
})
if (!updated) throw new Error('Klinika topilmadi')
return delay(updated, 300)
}

------------------------------------------------------------------
Tariflar
------------------------------------------------------------------

```ts
listPlans(): Promise<Plan[]>
```

### `PATCH /platform/plans/:id`

```ts
updatePlan(id: ID, patch: Partial<PlanInput>): Promise<Plan>
```

### `GET /platform/invoices?tenantId=&status=&page=`

```ts
listInvoices(query: InvoiceQuery = {}): Promise<Paginated<TenantInvoice>>
```

### `POST /platform/invoices/:id/paid`

Hisobni to'langan deb belgilash.

DASTURCHIGA: haqiqiy tizimda buni to'lov tizimi (Payme, Click)
webhook orqali qiladi. Qo'lda belgilash faqat bank o'tkazmasi
kabi holatlar uchun qoladi.

```ts
markInvoicePaid(id: ID): Promise<TenantInvoice>
```

### `GET /platform/impersonations`

Hisobni to'langan deb belgilash.

DASTURCHIGA: haqiqiy tizimda buni to'lov tizimi (Payme, Click)
webhook orqali qiladi. Qo'lda belgilash faqat bank o'tkazmasi
kabi holatlar uchun qoladi.

// POST /platform/invoices/:id/paid
export async function markInvoicePaid(id: ID): Promise<TenantInvoice> {
if (!USE_MOCK) return request<TenantInvoice>('POST', `/platform/invoices/${id}/paid`)

const db = getDb()
const invoice = db.tenantInvoices.updateAcrossTenants(id, {
status: 'paid',
paidAt: new Date().toISOString(),
})
if (!invoice) throw new Error('Hisob topilmadi')

// Qarzdor klinika to'lasa, holati ham tiklanadi
const tenant = db.tenants.allAcrossTenants().find((t) => t.id === invoice.tenantId)
if (tenant?.status === 'past_due') {
db.tenants.updateAcrossTenants(tenant.id, {
status: 'active',
nextInvoiceAt: toISODate(addDays(new Date(), 30)),
})
}

return delay(invoice, 280)
}

------------------------------------------------------------------
Klinika paneliga kirish
------------------------------------------------------------------

```ts
listImpersonations(limit = 20, tenantId?: ID): Promise<ImpersonationLog[]>
```

### `POST /platform/tenants/:id/impersonate`

Klinika paneliga yordam uchun kirish.

Sabab MAJBURIY va yozuv o'chirilmaydi. Bu imkoniyat kuchli:
platforma egasi klinikaning butun panelini ko'radi. Yozuvsiz
bunday kirish ishonchni buzadi, shuning uchun har bir kirish
qayd etiladi va klinika egasiga ko'rinadi.

DASTURCHIGA: serverda kirish MUDDATLI token bilan berilishi
kerak (masalan 30 daqiqa), va o'sha sessiyada yozish amallari
cheklanishi maqsadga muvofiq.

```ts
startImpersonation(tenantId: ID, adminName: string, reason: string): Promise<ImpersonationLog>
```

### `GET /platform/stats`

```ts
getPlatformStats(): Promise<PlatformStats>
```

### `GET /platform/data`

Platformada to'plangan bozor ma'lumoti.

MANBA: hamma klinikalarning JAMLANGAN ko'rsatkichlari. Hech qanday
bemor yozuvi bu yerga kirmaydi — faqat yig'indi va ulushlar.

DASTURCHIGA: haqiqiy tizimda buni har kecha bir marta hisoblab,
alohida jadvalga yozish kerak. Har so'rovda butun bazani sanash
o'nlab klinika bo'lganda ham og'ir bo'ladi.

```ts
getPlatformData(): Promise<PlatformDataStats>
```

### `GET /platform/doctors?tenantId=&search=&page=`

Shifokorlar ro'yxati — klinikalar kesimida.

NEGA KONTAKT BILAN: klinikalar tarmog'ini qurishda shifokorlar
bilan bevosita ishlash kerak bo'ladi. Bu klinikaning XODIMI
haqidagi ish ma'lumoti — bemor ma'lumoti emas.

```ts
listTenantDoctors(query: DoctorQuery = {}): Promise<Paginated<TenantDoctor>>
```

### `GET /platform/patients?tenantId=&search=&page=`

Bemorlar ro'yxati — klinikalar kesimida.

TIBBIY MA'LUMOT YO'Q: tashxis, davolash, tashrif yozuvi bu yerga
chiqmaydi. Ko'rinadigan narsa — kim, qachon, necha marta, qancha.

MAQSAD: klinikaning halol ishlayotganini tekshirish (masalan
tashrif ko'p, tushum kam) va xizmat sifatini baholash (qaytib
kelganlar ulushi). Buning uchun tashxis kerak emas.

DASTURCHIGA: bu eng nozik so'rov. Serverda u ALOHIDA ruxsat talab
qilishi, har bir chaqiruv audit jurnaliga yozilishi va javob
sahifalanishi kerak. Butun bazani bir so'rovda berish — xavf.

```ts
listTenantPatients(query: PatientQuery = {}): Promise<Paginated<TenantPatient>>
```

### `GET /platform/team`

Eng kam to'lagan summa
minSpent?: number
sort?: 'recent' | 'visits' | 'spent'
page?: number
pageSize?: number
}

export async function listTenantPatients(
query: PatientQuery = {},
): Promise<Paginated<TenantPatient>> {
const { page = 1, pageSize = 20 } = query

if (!USE_MOCK) {
return request<Paginated<TenantPatient>>('GET', '/platform/patients', {
query: {
tenantId: query.tenantId,
search: query.search,
city: query.city,
condition: query.condition,
ageGroup: query.ageGroup,
minVisits: query.minVisits,
minSpent: query.minSpent,
sort: query.sort,
page,
pageSize,
},
})
}

const needle = (query.search ?? '').trim().toLowerCase()
const group = AGE_GROUPS.find((g) => g.key === query.ageGroup)

const rows = getDb()
.tenantPatients.allAcrossTenants()
.filter((p) => !query.tenantId || p.tenantId === query.tenantId)
.filter((p) => !query.city || p.city === query.city)
.filter((p) => !query.condition || p.condition === query.condition)
.filter((p) => !group || (p.age >= group.min && p.age <= group.max))
.filter((p) => !query.minVisits || p.visitCount >= query.minVisits)
.filter((p) => !query.minSpent || p.totalSpent >= query.minSpent)
.filter(
(p) =>
!needle ||
p.fullName.toLowerCase().includes(needle) ||
p.tenantName.toLowerCase().includes(needle) ||
p.phone.includes(needle),
)
.sort((a, b) => {
if (query.sort === 'visits') return b.visitCount - a.visitCount
if (query.sort === 'spent') return b.totalSpent - a.totalSpent
return (b.lastVisitAt ?? '').localeCompare(a.lastVisitAt ?? '')
})

const start = (page - 1) * pageSize

return delay(
{ items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize },
220,
)
}

------------------------------------------------------------------
Platforma jamoasi
------------------------------------------------------------------

```ts
listTeam(): Promise<PlatformMember[]>
```

### `POST /platform/team`

```ts
createMember(input: MemberInput): Promise<PlatformMember>
```

### `PATCH /platform/team/:id`

Xodimni tahrirlash — ruxsatlar ham shu yerda o'zgaradi.

DASTURCHIGA: ruxsat o'zgarishi audit jurnaliga yozilishi kerak.
"Kim kimga bemorlar ro'yxatini ochgan" degan savolga javob
bo'lishi shart.

```ts
updateMember(id: ID, patch: Partial<MemberInput>): Promise<PlatformMember>
```

### `DELETE /platform/team/:id`

```ts
deleteMember(id: ID): Promise<void>
```

### `GET /platform/analytics`

```ts
getPlatformAnalytics(): Promise<PlatformAnalytics>
```

### `GET /platform/search?q=&scope=`

Klinikalar, shifokorlar va bemorlar bo'yicha yagona qidiruv.

NEGA TURKUM BILAN: "Karimov" deb qidirsangiz, ham shifokor, ham
bemor chiqadi. Qaysi biri kerakligini oldindan aytish — natijani
o'nlab qatordan tozalab o'tirishdan tez.

Har bir turkumdan cheklangan soni olinadi: qidiruv oynasi javob
berish uchun, ro'yxatni almashtirish uchun emas. To'liq ro'yxat
"Ro'yxatlar" bo'limida, u yerda filtrlar ham bor.

```ts
platformSearch(query: string, scope: PlatformSearchScope = 'all'): Promise<PlatformSearchHit[]>
```
