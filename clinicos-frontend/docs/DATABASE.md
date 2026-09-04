# ClinicOS — ma'lumotlar bazasi

Bu hujjat backend dasturchisi uchun. Frontend aynan shu tuzilmani kutadi —
tiplarning kod ko'rinishi [`src/types/models.ts`](../src/types/models.ts)da.

---

## 1. Asosiy qoida: multi-tenancy

Tizim ko'p klinikaga xizmat qiladi. **Har bir jadvalda `clinic_id` bor** va
**har bir so'rov shu ustun bo'yicha filtrlanadi**.

```
Clinic A ──┬── Users        Clinic B ──┬── Users
           ├── Doctors                 ├── Doctors
           ├── Patients                ├── Patients
           ├── Appointments            ├── Appointments
           └── Payments                └── Payments
```

**Uch qat'iy qoida:**

1. `clinic_id` HECH QACHON mijozdan olinmaydi. U faqat sessiyadan (tokendan)
   olinadi. Agar so'rov tanasida `clinicId` kelsa — e'tiborsiz qoldiring.
2. Har bir `SELECT`, `UPDATE`, `DELETE` da `WHERE clinic_id = :session_clinic`
   bo'lishi shart. Buni qo'lda yozishga tayanmang — ORM darajasida majburiy
   qiling (quyida namuna).
3. Bemorlar bazasi **umumiy emas**. Klinika A bemori klinika B da
   ko'rinmaydi, hatto telefon raqami bir xil bo'lsa ham.

### Prisma bilan majburiy filtr

Qo'lda yozilgan `where` ertami-kechmi unutiladi. Prisma kengaytmasi bilan
buni tizim darajasida bog'lang:

```ts
// prisma/tenant.ts
export function forClinic(prisma: PrismaClient, clinicId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model }) {
          // clinic_id yo'q modellar (masalan migratsiya jadvallari) uchun istisno
          if (!TENANT_MODELS.has(model)) return query(args)

          args.where = { ...args.where, clinicId }
          if ('data' in args && args.data && !Array.isArray(args.data)) {
            ;(args.data as Record<string, unknown>).clinicId = clinicId
          }
          return query(args)
        },
      },
    },
  })
}
```

PostgreSQL ishlatilsa, qo'shimcha himoya sifatida **Row Level Security**ni
ham yoqing — dastur kodida xato bo'lsa ham baza o'zi to'sadi:

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON patients
  USING (clinic_id = current_setting('app.clinic_id')::uuid);
```

Har bir so'rov boshida `SET LOCAL app.clinic_id = '...'` qiling.

---

## 2. Sxema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/* ================================================================
   KLINIKA (tenant)
   ================================================================ */

model Clinic {
  id          String   @id @default(uuid())
  name        String
  logoUrl     String?  @map("logo_url")
  phone       String
  address     String
  slotMinutes Int      @default(30) @map("slot_minutes")
  currency    String   @default("UZS")
  timezone    String   @default("Asia/Tashkent")
  isActive    Boolean  @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  workingHours  WorkingHour[]
  users         User[]
  doctors       Doctor[]
  patients      Patient[]
  services      Service[]
  appointments  Appointment[]
  visits        Visit[]
  payments      Payment[]
  followUps     FollowUp[]
  notifications Notification[]
  auditLogs     AuditLog[]

  staff             Staff[]
  attendance        Attendance[]
  bonusRules        BonusRule[]
  bonuses           Bonus[]
  penaltyRules      PenaltyRule[]
  penalties         Penalty[]
  rooms             Room[]
  admissions        Admission[]
  shiftClosures     ShiftClosure[]
  feedback          Feedback[]
  chatGroups        ChatGroup[]
  chatMessages      ChatMessage[]
  subscription      Subscription?
  impersonationLogs ImpersonationLog[]

  @@map("clinics")
}

model WorkingHour {
  id       String  @id @default(uuid())
  clinicId String  @map("clinic_id")
  weekday  Int     // 0 = yakshanba … 6 = shanba
  open     String  // "08:00"
  close    String  // "19:00"
  isClosed Boolean @default(false) @map("is_closed")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@unique([clinicId, weekday])
  @@map("working_hours")
}

/* ================================================================
   FOYDALANUVCHI VA ROL
   ================================================================ */

enum Role {
  /// Platforma egasi — klinika xodimi emas, butun tizimni boshqaradi
  SUPERADMIN
  OWNER
  RECEPTIONIST
  DOCTOR
}

model User {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  fullName     String  @map("full_name")
  email        String
  phone        String
  /// bcrypt yoki argon2id xeshi. Parolning o'zi HECH QAYERDA saqlanmaydi.
  passwordHash String  @map("password_hash")
  role         Role
  avatarUrl    String? @map("avatar_url")
  isActive     Boolean @default(true) @map("is_active")

  /// Rol standartiga QO'SHIMCHA ruxsatlar, masalan ["revenue.view"]
  extraPermissions String[] @default([]) @map("extra_permissions")

  /// Rol = DOCTOR bo'lsa, shifokor profiliga bog'lanish
  doctorId String? @unique @map("doctor_id")
  doctor   Doctor? @relation(fields: [doctorId], references: [id])

  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  clinic       Clinic        @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  sessions     Session[]
  auditLogs    AuditLog[]
  appointments Appointment[] @relation("AppointmentCreatedBy")
  payments     Payment[]     @relation("PaymentCreatedBy")

  staff             Staff?
  platformMember    PlatformMember?
  attendanceMarked  Attendance[]       @relation("AttendanceMarkedBy")
  bonusesCreated    Bonus[]            @relation("BonusCreatedBy")
  waiversCreated    PenaltyWaiver[]    @relation("WaiverCreatedBy")
  admissionsCreated Admission[]        @relation("AdmissionCreatedBy")
  shiftClosures     ShiftClosure[]     @relation("ShiftClosedBy")
  chatGroupsCreated ChatGroup[]        @relation("ChatCreatedBy")
  chatMemberships   ChatGroupMember[]
  messages          ChatMessage[]      @relation("MessageAuthor")
  messageReads      ChatMessageRead[]
  impersonations    ImpersonationLog[] @relation("ImpersonatedBy")

  /// Email butun tizimda emas, KLINIKA ICHIDA noyob
  @@unique([clinicId, email])
  @@index([clinicId, role])
  @@map("users")
}

model Session {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  /// Tokenning O'ZI emas, xeshi saqlanadi
  tokenHash    String   @unique @map("token_hash")
  userAgent    String?  @map("user_agent")
  ipAddress    String?  @map("ip_address")
  expiresAt    DateTime @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

/* ================================================================
   SHIFOKOR
   ================================================================ */

enum DoctorStatus {
  ACTIVE
  ON_LEAVE
  INACTIVE
}

model Doctor {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  fullName        String       @map("full_name")
  /// Kalit sifatida saqlanadi ("therapist"), interfeys uni tarjima qiladi
  specialty       String
  phone           String
  email           String
  avatarUrl       String?      @map("avatar_url")
  consultationFee Int          @map("consultation_fee") // so'mda, butun son
  status          DoctorStatus @default(ACTIVE)

  /// Ish kunlari: [1,2,3,4,5]
  workdays   Int[]
  shiftStart String   @map("shift_start")
  shiftEnd   String   @map("shift_end")
  hiredAt    DateTime @map("hired_at") @db.Date

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic       Clinic        @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  user         User?
  appointments Appointment[]
  visits       Visit[]
  payments     Payment[]
  followUps    FollowUp[]
  patients     Patient[]     @relation("PrimaryDoctor")

  staff      Staff?
  admissions Admission[]
  feedback   Feedback[]

  @@index([clinicId, status])
  @@map("doctors")
}

/* ================================================================
   BEMOR
   ================================================================ */

enum Gender {
  MALE
  FEMALE
}

enum PatientStatus {
  ACTIVE
  INACTIVE
}

model Patient {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  fullName  String        @map("full_name")
  phone     String
  birthDate DateTime      @map("birth_date") @db.Date
  gender    Gender
  address   String        @default("")
  /// Registratura izohi. TIBBIY ma'lumot bu yerga YOZILMAYDI.
  notes     String        @default("")
  status    PatientStatus @default(ACTIVE)

  primaryDoctorId String? @map("primary_doctor_id")
  primaryDoctor   Doctor? @relation("PrimaryDoctor", fields: [primaryDoctorId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic       Clinic        @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  appointments Appointment[]
  visits       Visit[]
  payments     Payment[]
  followUps    FollowUp[]

  admissions Admission[]
  feedback   Feedback[]

  /// Bir klinikada bitta telefon — bitta bemor
  @@unique([clinicId, phone])
  @@index([clinicId, status])
  @@index([clinicId, fullName])
  @@map("patients")
}

/* ================================================================
   XIZMAT
   ================================================================ */

enum ServiceStatus {
  ACTIVE
  ARCHIVED
}

/// To'lov xizmatdan OLDIN olinadimi yoki KEYIN.
/// Registratura paneli shunga qarab ogohlantiradi: oldindan to'lanadigan
/// xizmatga puli olinmagan bemor qizil bilan ajratiladi va unga
/// "Shifokorga" tugmasi ko'rinmaydi.
enum PaymentTiming {
  PREPAID
  POSTPAID
}

model Service {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  name            String
  category        String
  price           Int           // so'mda, butun son
  durationMinutes Int           @map("duration_minutes")
  paymentTiming   PaymentTiming @default(POSTPAID) @map("payment_timing")
  status          ServiceStatus @default(ACTIVE)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic       Clinic               @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  appointments Appointment[]
  payments     Payment[]
  loyaltyTiers ServiceLoyaltyTier[]

  @@index([clinicId, status])
  @@map("services")
}

/// Sodiqlik chegirmasi: "5 tashrifdan keyin 10%".
///
/// Alohida jadval, JSON emas: chegirma pul miqdoriga ta'sir qiladi,
/// ya'ni uni kim va qachon o'zgartirganini keyinchalik tekshirish
/// kerak bo'ladi. JSON ustunda buni qilib bo'lmaydi.
model ServiceLoyaltyTier {
  id        String @id @default(uuid())
  clinicId  String @map("clinic_id")
  serviceId String @map("service_id")

  /// Necha marta olgandan KEYIN chegirma boshlanadi
  afterVisits Int @map("after_visits")
  /// Chegirma foizi, 1-100
  discountPct Int @map("discount_pct")

  createdAt DateTime @default(now()) @map("created_at")

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  /// Bir xizmatda bir xil pog'ona ikki marta bo'lmasin
  @@unique([serviceId, afterVisits])
  @@index([clinicId])
  @@map("service_loyalty_tiers")
}

/* ================================================================
   QABUL
   ================================================================ */

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  CHECKED_IN
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum AppointmentPaymentStatus {
  UNPAID
  PAID
  PARTIAL
}

model Appointment {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  patientId String @map("patient_id")
  doctorId  String @map("doctor_id")
  serviceId String @map("service_id")

  startsAt        DateTime @map("starts_at")
  durationMinutes Int      @map("duration_minutes")

  status        AppointmentStatus        @default(SCHEDULED)
  paymentStatus AppointmentPaymentStatus @default(UNPAID) @map("payment_status")
  notes         String                   @default("")

  checkedInAt  DateTime? @map("checked_in_at")
  completedAt  DateTime? @map("completed_at")
  cancelledAt  DateTime? @map("cancelled_at")
  cancelReason String?   @map("cancel_reason")

  createdById String   @map("created_by")
  createdBy   User     @relation("AppointmentCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  clinic   Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patient  Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor   Doctor    @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  service  Service   @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  visit    Visit?
  payments Payment[]
  followUp FollowUp?

  /// Kalendar va kunlik ro'yxat uchun eng muhim indeks
  @@index([clinicId, startsAt])
  @@index([clinicId, doctorId, startsAt])
  @@index([clinicId, patientId])
  @@index([clinicId, status])
  @@map("appointments")
}

/* ================================================================
   TASHRIF — MAXFIY TIBBIY MA'LUMOT
   ================================================================ */

model Visit {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  appointmentId String @unique @map("appointment_id")
  patientId     String @map("patient_id")
  doctorId      String @map("doctor_id")

  visitedAt DateTime @map("visited_at")
  complaint String   @default("")
  diagnosis String   @default("")
  treatment String   @default("")
  notes     String   @default("")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic      Clinic      @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  patient     Patient     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor      Doctor      @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  followUps   FollowUp[]

  @@index([clinicId, patientId, visitedAt])
  @@map("visits")
}

/* ================================================================
   TAKRORIY TASHRIF
   ================================================================ */

enum FollowUpStatus {
  PENDING
  SCHEDULED
  DONE
  MISSED
}

model FollowUp {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  patientId String  @map("patient_id")
  doctorId  String  @map("doctor_id")
  visitId   String? @map("visit_id")

  recommendedDate DateTime       @map("recommended_date") @db.Date
  reason          String         @default("")
  status          FollowUpStatus @default(PENDING)

  /// Rejalashtirilganda — yaratilgan qabul
  appointmentId String?      @unique @map("appointment_id")
  appointment   Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic  Clinic  @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor  Doctor  @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  visit   Visit?  @relation(fields: [visitId], references: [id], onDelete: SetNull)

  @@index([clinicId, status, recommendedDate])
  @@map("follow_ups")
}

/* ================================================================
   TO'LOV
   ================================================================ */

enum PaymentMethod {
  CASH
  CARD
  TRANSFER
}

enum PaymentStatus {
  PAID
  PENDING
  REFUNDED
}

model Payment {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  patientId     String  @map("patient_id")
  doctorId      String  @map("doctor_id")
  serviceId     String  @map("service_id")
  appointmentId String? @map("appointment_id")

  /// So'mda, BUTUN SON. Pulni hech qachon float'da saqlamang.
  /// Bu — HAQIQATDA olingan summa.
  amount Int

  /// Chegirmasiz narx va qo'llangan chegirma foizi.
  ///
  /// NEGA SAQLANADI: `amount` yolg'iz o'zi "nega 90 000 olindi"
  /// degan savolga javob bermaydi. Xizmat narxi keyin o'zgarishi
  /// mumkin, sodiqlik pog'onasi ham. Ikkalasi to'lov paytida
  /// muzlatib qo'yilmasa, keyinchalik tekshirib bo'lmaydi —
  /// registrator "chegirma qildim" deb farqni olib qolsa,
  /// buni isbotlashning iloji qolmaydi.
  basePrice   Int @map("base_price")
  discountPct Int @default(0) @map("discount_pct")

  method PaymentMethod
  status PaymentStatus @default(PAID)
  paidAt DateTime      @map("paid_at")
  notes  String        @default("")

  createdById String   @map("created_by")
  createdBy   User     @relation("PaymentCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  clinic      Clinic       @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patient     Patient      @relation(fields: [patientId], references: [id], onDelete: Restrict)
  doctor      Doctor       @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  service     Service      @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  appointment Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  @@index([clinicId, paidAt])
  @@index([clinicId, doctorId, paidAt])
  @@index([clinicId, status])
  @@map("payments")
}

/* ================================================================
   BILDIRISHNOMA
   ================================================================ */

model Notification {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  /// Kimga: null bo'lsa — butun klinikaga
  userId String? @map("user_id")

  kind     String
  count    Int      @default(0)
  href     String
  severity String   @default("info")
  readAt   DateTime? @map("read_at")

  createdAt DateTime @default(now()) @map("created_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([clinicId, userId, readAt])
  @@map("notifications")
}

/* ================================================================
   XODIMLAR
   ================================================================ */

enum StaffPosition {
  DOCTOR
  NURSE
  RECEPTIONIST
  MANAGER
  ACCOUNTANT
  LAB_TECH
  PHARMACIST
  CLEANER
  SECURITY
  DRIVER
  OTHER
}

enum StaffStatus {
  ACTIVE
  ON_LEAVE
  FIRED
}

/// Oylik qanday hisoblanadi.
/// SALARY_PERCENT — ikkalasi: qat'iy oylik + tushumdan foiz.
enum PayType {
  SALARY
  PERCENT
  SALARY_PERCENT
}

/// Klinikaning HAR BIR xodimi. Shifokor ham shu yerda bo'ladi
/// (`doctorId` orqali shifokor profiliga bog'lanadi) — davomat,
/// oylik va jarima hammasi uchun bir xil ishlashi kerak.
model Staff {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  fullName String @map("full_name")
  phone    String
  email    String

  position      StaffPosition
  /// Lavozimning erkin yozilishi: "Katta hamshira"
  positionTitle String        @map("position_title")
  department    String        @default("")

  workdays   Int[]
  shiftStart String @map("shift_start")
  shiftEnd   String @map("shift_end")
  /// Stavka: 100 = to'liq, 50 = yarim stavka
  workRate   Int    @default(100) @map("work_rate")

  payType     PayType @default(SALARY) @map("pay_type")
  /// PayType PERCENT yoki SALARY_PERCENT bo'lsa — tushumdan foiz
  percentRate Int     @default(0) @map("percent_rate")
  salary      Int     @default(0)

  hiredAt DateTime    @map("hired_at") @db.Date
  status  StaffStatus @default(ACTIVE)

  /// Tizimga kira oladimi. Kira olsa — `User` yozuvi bo'ladi.
  hasSystemAccess Boolean @default(false) @map("has_system_access")
  userId          String? @unique @map("user_id")
  user            User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  doctorId  String? @unique @map("doctor_id")
  doctor    Doctor? @relation(fields: [doctorId], references: [id], onDelete: SetNull)
  avatarUrl String? @map("avatar_url")
  notes     String  @default("")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic     Clinic       @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  attendance Attendance[]
  bonuses    Bonus[]
  penalties  Penalty[]

  @@index([clinicId, status])
  @@index([clinicId, position])
  @@map("staff")
}

/* ================================================================
   DAVOMAT
   ================================================================ */

enum AttendanceStatus {
  PRESENT
  LATE
  ABSENT
  EXCUSED
  DAY_OFF
}

/// Kunlik davomat. Registrator hamma xodimni belgilaydi.
model Attendance {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  staffId  String @map("staff_id")

  date   DateTime         @db.Date
  status AttendanceStatus

  checkInAt  DateTime? @map("check_in_at")
  checkOutAt DateTime? @map("check_out_at")
  /// "Kechikdi" belgilanganda qo'lda kiritilgan kelish vaqti, "09:20"
  arrivedAt  String?   @map("arrived_at")

  lateMinutes   Int    @default(0) @map("late_minutes")
  workedMinutes Int    @default(0) @map("worked_minutes")
  note          String @default("")

  /// Kim belgiladi va qachon — majburiy, tekshiruv shunga tayanadi
  markedById String   @map("marked_by")
  markedBy   User     @relation("AttendanceMarkedBy", fields: [markedById], references: [id], onDelete: Restrict)
  markedAt   DateTime @default(now()) @map("marked_at")

  /// Vaqt orqaga surib kiritilgan bo'lsa — egaga ogohlantirish chiqadi.
  /// Bu firibgarlikka qarshi nazorat: davomatni keyin "tuzatib" qo'yish
  /// mumkin bo'lsa, kechikish jarimasining ma'nosi qolmaydi.
  flagged    Boolean @default(false)
  flagReason String  @default("") @map("flag_reason")

  createdAt DateTime @default(now()) @map("created_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  staff  Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)

  /// Bir xodimga bir kunda bitta yozuv
  @@unique([staffId, date])
  @@index([clinicId, date])
  @@index([clinicId, flagged])
  @@map("attendance")
}

/* ================================================================
   BONUS
   ================================================================ */

enum BonusRewardType {
  PERCENT_OF_SALARY
  FIXED
}

enum BonusSource {
  MANUAL
  SUGGESTED
  RULE
}

enum BonusStatus {
  PLANNED
  APPROVED
  PAID
}

model BonusRule {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  name           String
  positions      StaffPosition[]
  minPerformance Int             @default(0) @map("min_performance")
  minRating      Int             @default(0) @map("min_rating")

  rewardType  BonusRewardType @map("reward_type")
  rewardValue Int             @map("reward_value")
  isActive    Boolean         @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic  Clinic  @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  bonuses Bonus[]

  @@index([clinicId, isActive])
  @@map("bonus_rules")
}

model Bonus {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  staffId  String @map("staff_id")

  /// "2026-09" — bonus qaysi oyga tegishli
  period String
  amount Int
  reason String      @default("")
  source BonusSource @default(MANUAL)
  status BonusStatus @default(PLANNED)

  ruleId String?    @map("rule_id")
  rule   BonusRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)

  createdById String    @map("created_by")
  createdBy   User      @relation("BonusCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime  @default(now()) @map("created_at")
  paidAt      DateTime? @map("paid_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  staff  Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@index([clinicId, period])
  @@index([clinicId, staffId, period])
  @@map("bonuses")
}

/* ================================================================
   JARIMA
   ================================================================ */

/// Jarima NIMA UCHUN solinadi.
enum PenaltyTrigger {
  LATE
  LATE_MINUTES
  ABSENT
  CASH_SHORTFALL
  BACKDATED_ATTENDANCE
  DISCIPLINE_BELOW
}

enum PenaltyAmountType {
  FIXED
  PERCENT_OF_SHORTFALL
  PERCENT_OF_DAILY_SALARY
}

enum PenaltyStatus {
  APPLIED
  WAIVED
}

/// Jarima QOIDASI — egasi yozadi, tizim qo'llaydi.
///
/// MUHIM: egasi jarimani QO'LDA sola olmaydi, faqat qoida yozadi va
/// solingan jarimani kechira oladi. Aks holda jarima shaxsiy munosabat
/// vositasiga aylanadi va xodimlar tizimga ishonmay qo'yadi.
model PenaltyRule {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  name      String
  trigger   PenaltyTrigger
  /// Chegaraviy qiymat: kechikish daqiqasi, kamomad summasi va h.k.
  threshold Int            @default(0)

  amountType  PenaltyAmountType @map("amount_type")
  amountValue Int               @map("amount_value")
  positions   StaffPosition[]
  isActive    Boolean           @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic    Clinic    @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  penalties Penalty[]

  @@index([clinicId, isActive])
  @@map("penalty_rules")
}

model Penalty {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  staffId  String @map("staff_id")

  period String
  date   DateTime @db.Date

  ruleId String      @map("rule_id")
  rule   PenaltyRule @relation(fields: [ruleId], references: [id], onDelete: Restrict)
  /// Qoida nomi va sababi yozuv paytida MUZLATIB qo'yiladi:
  /// qoida keyin o'zgarsa ham, solingan jarima o'zgarmasligi kerak.
  ruleName String         @map("rule_name")
  trigger  PenaltyTrigger

  amount Int
  reason String        @default("")
  status PenaltyStatus @default(APPLIED)

  createdAt DateTime @default(now()) @map("created_at")

  clinic Clinic         @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  staff  Staff          @relation(fields: [staffId], references: [id], onDelete: Cascade)
  waiver PenaltyWaiver?

  @@index([clinicId, period])
  @@index([clinicId, staffId, period])
  @@map("penalties")
}

/// Jarimani kechirish. Alohida jadval, chunki kechirilgani ham
/// tarixda qolishi kerak — jarimani o'chirib tashlash mumkin emas.
model PenaltyWaiver {
  id        String @id @default(uuid())
  clinicId  String @map("clinic_id")
  penaltyId String @unique @map("penalty_id")

  note String @default("")

  createdById String   @map("created_by")
  createdBy   User     @relation("WaiverCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now()) @map("created_at")

  penalty Penalty @relation(fields: [penaltyId], references: [id], onDelete: Cascade)

  @@index([clinicId])
  @@map("penalty_waivers")
}

/* ================================================================
   STATSIONAR
   ================================================================ */

enum RoomCategory {
  LUXURY
  STANDARD
  GENERAL
}

enum RoomStatus {
  ACTIVE
  MAINTENANCE
}

enum BedStatus {
  FREE
  OCCUPIED
  MAINTENANCE
}

enum AdmissionStatus {
  PLANNED
  ACTIVE
  DISCHARGED
}

model Room {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  number    String
  floor     Int
  category  RoomCategory
  dailyRate Int          @map("daily_rate")
  status    RoomStatus   @default(ACTIVE)
  notes     String       @default("")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  clinic     Clinic      @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  beds       Bed[]
  admissions Admission[]

  @@unique([clinicId, number])
  @@index([clinicId, status])
  @@map("rooms")
}

model Bed {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  roomId   String @map("room_id")

  label  String
  status BedStatus @default(FREE)

  createdAt DateTime @default(now()) @map("created_at")

  room       Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  admissions Admission[]

  @@unique([roomId, label])
  @@index([clinicId, status])
  @@map("beds")
}

model Admission {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  patientId String @map("patient_id")
  doctorId  String @map("doctor_id")
  roomId    String @map("room_id")
  bedId     String @map("bed_id")

  admittedAt          DateTime  @map("admitted_at")
  expectedDischargeAt DateTime? @map("expected_discharge_at") @db.Date
  dischargedAt        DateTime? @map("discharged_at")

  status    AdmissionStatus @default(PLANNED)
  diagnosis String          @default("")
  /// Kunlik narx joylashtirish paytida muzlatiladi — palata narxi
  /// keyin o'zgarsa, yotgan bemorning hisobi o'zgarmasligi kerak.
  dailyRate Int             @map("daily_rate")
  notes     String          @default("")

  createdById String   @map("created_by")
  createdBy   User     @relation("AdmissionCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  clinic  Clinic  @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Restrict)
  doctor  Doctor  @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  room    Room    @relation(fields: [roomId], references: [id], onDelete: Restrict)
  bed     Bed     @relation(fields: [bedId], references: [id], onDelete: Restrict)

  @@index([clinicId, status])
  @@index([clinicId, patientId])
  @@map("admissions")
}

/* ================================================================
   KASSA SMENASI
   ================================================================ */

/// Smena yopilishi. Kutilgan va topshirilgan naqd orasidagi farq
/// egasining hisobotiga tushadi. Farq bo'lsa sabab MAJBURIY va
/// yozuv kim yopgani bilan qoladi.
model ShiftClosure {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  userId   String @map("user_id")

  date DateTime @db.Date

  /// Tizim hisoblagan naqd tushum
  expectedCash Int @map("expected_cash")
  /// Registrator topshirgan summa
  declaredCash Int @map("declared_cash")
  /// declaredCash - expectedCash. Manfiy = kamomad.
  difference   Int

  note     String   @default("")
  closedAt DateTime @default(now()) @map("closed_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  user   User   @relation("ShiftClosedBy", fields: [userId], references: [id], onDelete: Restrict)

  /// Bir kun bir marta yopiladi
  @@unique([clinicId, userId, date])
  @@index([clinicId, date])
  @@map("shift_closures")
}

/* ================================================================
   BEMOR FIKRI
   ================================================================ */

enum FeedbackStatus {
  NEW
  REVIEWED
  ARCHIVED
}

/// Bemor fikri.
///
/// MAXFIYLIK: shifokorga bu fikr ISMSIZ va KECHIKTIRIB yetkaziladi
/// (`revealAt`). Ikkalasi ham kerak — o'sha kuni yetkazilsa, shifokor
/// jadvalidan kim yozganini topib oladi.
model Feedback {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  phone         String
  patientId     String? @map("patient_id")
  doctorId      String? @map("doctor_id")
  appointmentId String? @map("appointment_id")

  rating Int
  /// Bo'lim baholari: doctor, service, cleanliness, waiting (1-5)
  scores Json   @default("{}")
  text   String @default("")

  isAnonymous Boolean  @default(false) @map("is_anonymous")
  /// Shifokorga shu vaqtdan keyin ko'rinadi (1-14 kun kechikish)
  revealAt    DateTime @map("reveal_at")

  status    FeedbackStatus @default(NEW)
  reply     String         @default("")
  repliedAt DateTime?      @map("replied_at")

  createdAt DateTime @default(now()) @map("created_at")

  clinic  Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  patient Patient? @relation(fields: [patientId], references: [id], onDelete: SetNull)
  doctor  Doctor?  @relation(fields: [doctorId], references: [id], onDelete: SetNull)

  @@index([clinicId, status])
  @@index([clinicId, doctorId, revealAt])
  @@map("feedback")
}

/* ================================================================
   ICHKI CHAT
   ================================================================ */

enum ChatKind {
  GROUP
  DIRECT
}

model ChatGroup {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  name        String
  kind        ChatKind @default(GROUP)
  description String   @default("")

  createdById String   @map("created_by")
  createdBy   User     @relation("ChatCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt   DateTime @default(now()) @map("created_at")

  clinic   Clinic            @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  members  ChatGroupMember[]
  messages ChatMessage[]

  @@index([clinicId])
  @@map("chat_groups")
}

/// Guruh a'zoligi alohida jadval: massiv ustunda "shu odam qaysi
/// guruhlarda" degan so'rov indeks bilan ishlamaydi.
model ChatGroupMember {
  groupId String @map("group_id")
  userId  String @map("user_id")

  joinedAt DateTime @default(now()) @map("joined_at")

  group ChatGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([groupId, userId])
  @@index([userId])
  @@map("chat_group_members")
}

model ChatMessage {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  groupId  String @map("group_id")

  authorId String @map("author_id")
  text     String
  /// Tizim xabari (guruh yaratildi, a'zo qo'shildi)
  isSystem Boolean @default(false) @map("is_system")

  createdAt DateTime @default(now()) @map("created_at")

  clinic Clinic            @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  group  ChatGroup         @relation(fields: [groupId], references: [id], onDelete: Cascade)
  author User              @relation("MessageAuthor", fields: [authorId], references: [id], onDelete: Restrict)
  reads  ChatMessageRead[]

  @@index([groupId, createdAt])
  @@map("chat_messages")
}

model ChatMessageRead {
  messageId String   @map("message_id")
  userId    String   @map("user_id")
  readAt    DateTime @default(now()) @map("read_at")

  message ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([messageId, userId])
  @@index([userId])
  @@map("chat_message_reads")
}

/* ================================================================
   PLATFORMA — SaaS QATLAMI
   ================================================================

   MUHIM: bu jadvallar klinikaga TEGISHLI EMAS. Ular butun tizim
   haqida va faqat SUPERADMIN ko'radi. Klinika ichidagi hech qanday
   so'rov bu jadvallarga tegmasligi kerak.
   ================================================================ */

enum PlanTier {
  STARTER
  STANDARD
  PREMIUM
}

enum TenantStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELLED
}

enum InvoiceStatus {
  PAID
  PENDING
  OVERDUE
}

model Plan {
  id   String   @id @default(uuid())
  tier PlanTier @unique
  name String

  pricePerMonth Int @map("price_per_month")
  /// -1 = cheksiz
  limitDoctors  Int @map("limit_doctors")
  limitStaff    Int @map("limit_staff")

  /// ward | analytics | cashControl | staff | chat | api
  features String[] @default([])
  isActive Boolean  @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  subscriptions Subscription[]

  @@map("plans")
}

/// Klinikaning obunasi. `Clinic` dan alohida: klinika — ish
/// ma'lumoti, obuna — biznes ma'lumoti. Ularni aralashtirsak,
/// klinika xodimi o'z obunasini ko'ra oladigan bo'lib qoladi.
model Subscription {
  id       String @id @default(uuid())
  clinicId String @unique @map("clinic_id")

  status TenantStatus @default(TRIAL)
  planId String       @map("plan_id")
  plan   Plan         @relation(fields: [planId], references: [id], onDelete: Restrict)

  /// Narx obuna paytida muzlatiladi — tarif narxi ko'tarilsa,
  /// mavjud mijozning hisobi o'z-o'zidan oshib ketmasligi kerak.
  pricePerMonth Int @map("price_per_month")

  trialEndsAt   DateTime? @map("trial_ends_at") @db.Date
  subscribedAt  DateTime? @map("subscribed_at") @db.Date
  nextInvoiceAt DateTime? @map("next_invoice_at") @db.Date
  suspendReason String    @default("") @map("suspend_reason")

  ownerName  String @map("owner_name")
  ownerEmail String @map("owner_email")
  ownerPhone String @map("owner_phone")
  city       String @default("")

  lastActiveAt DateTime? @map("last_active_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  clinic   Clinic          @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  invoices TenantInvoice[]

  @@index([status])
  @@index([nextInvoiceAt])
  @@map("subscriptions")
}

model TenantInvoice {
  id             String @id @default(uuid())
  subscriptionId String @map("subscription_id")

  /// "2026-09"
  period   String
  planName String        @map("plan_name")
  amount   Int
  status   InvoiceStatus @default(PENDING)

  issuedAt DateTime  @map("issued_at") @db.Date
  dueAt    DateTime  @map("due_at") @db.Date
  paidAt   DateTime? @map("paid_at")

  createdAt DateTime @default(now()) @map("created_at")

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, period])
  @@index([status, dueAt])
  @@map("tenant_invoices")
}

/// Platforma xodimi klinika paneliga kirgani.
///
/// Yozuv kirishdan OLDIN yaratiladi va hech qachon o'chirilmaydi.
/// Teskarisi bo'lsa, qayd etilmagan kirish mumkin bo'lib qoladi.
model ImpersonationLog {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")

  adminId   String @map("admin_id")
  adminName String @map("admin_name")
  reason    String

  startedAt DateTime  @default(now()) @map("started_at")
  endedAt   DateTime? @map("ended_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  admin  User   @relation("ImpersonatedBy", fields: [adminId], references: [id], onDelete: Restrict)

  @@index([clinicId, startedAt])
  @@index([adminId, startedAt])
  @@map("impersonation_logs")
}

/// Platforma jamoasi — sizning xodimlaringiz, klinikaniki emas.
model PlatformMember {
  id     String @id @default(uuid())
  userId String @unique @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  position String @default("")
  /// clinics.view | clinics.manage | billing.view | billing.manage |
  /// data.view | registry.doctors | registry.patients |
  /// clinics.impersonate | team.manage
  permissions String[] @default([])
  isActive    Boolean  @default(true) @map("is_active")

  lastActiveAt DateTime? @map("last_active_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("platform_members")
}

/* ================================================================
   AUDIT JURNALI
   ================================================================ */

model AuditLog {
  id       String @id @default(uuid())
  clinicId String @map("clinic_id")
  userId   String @map("user_id")

  action     String  // login | create | update | delete | view_medical | export
  entityType String  @map("entity_type")
  entityId   String? @map("entity_id")
  meta       Json    @default("{}")
  ipAddress  String? @map("ip_address")
  userAgent  String? @map("user_agent")

  createdAt DateTime @default(now()) @map("created_at")

  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([clinicId, createdAt])
  @@index([clinicId, entityType, entityId])
  @@map("audit_logs")
}
```

---

## 3. Muhim qarorlar va sabablari

### Pul — butun son (Int), so'mda

`amount = 150000` degani 150 000 so'm. Float ishlatilsa, yig'indida
tiyinlar "suzib ketadi" va hisobot noto'g'ri chiqadi. Frontend ham
shunday kutadi (`UZS = number`, butun son).

### Xizmat narxi to'lovda takrorlanadi

`Payment.amount` — `Service.price`ga havola emas, **nusxa**. Sabab: xizmat
narxi ertaga o'zgarsa, o'tgan oyning hisoboti o'zgarib ketmasligi kerak.

### `Visit` — alohida jadval

Tashxis va davolash `Appointment` ichiga yozilmaydi. Sabablari:
- tibbiy ma'lumotga kirish alohida ruxsat bilan boshqariladi;
- audit jurnalida "kim qaysi tibbiy yozuvni o'qidi" ni alohida kuzatish oson;
- kelajakda to'liq elektron karta shu jadval ustiga quriladi.

### `deleted_at` (soft delete)

MVP'da yo'q, lekin tibbiy tizim uchun tavsiya etiladi: bemor yoki tashrif
yozuvini butunlay o'chirish o'rniga `deleted_at` qo'yish. Qo'shsangiz,
tenant filtriga `deletedAt: null` shartini ham qo'shing.

---

## 4. Indekslar

Eng ko'p ishlatiladigan so'rovlar va ular uchun indekslar:

| So'rov | Indeks |
| --- | --- |
| Bugungi qabullar | `appointments (clinic_id, starts_at)` |
| Shifokorning kalendari | `appointments (clinic_id, doctor_id, starts_at)` |
| Bemor tarixi | `appointments (clinic_id, patient_id)` |
| Kunlik kassa | `payments (clinic_id, paid_at)` |
| Shifokor bo'yicha daromad | `payments (clinic_id, doctor_id, paid_at)` |
| Bemor qidiruvi (ism) | `patients (clinic_id, full_name)` + `pg_trgm` |
| Takroriy tashrif ro'yxati | `follow_ups (clinic_id, status, recommended_date)` |

Ism bo'yicha qidiruv uchun PostgreSQL'da trigram indeksi:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX patients_name_trgm
  ON patients USING gin (full_name gin_trgm_ops);
```

---

## 5. Analitika — muhim ogohlantirish

Bosh sahifa va analitika sahifasidagi raqamlar (bemorlar oqimi, daromad
dinamikasi, ushlab qolish) — **agregat so'rovlar**. Klinika kattalashganda
har bir sahifa ochilishida butun `appointments` jadvalini skanerlash
sekinlashadi.

Tavsiya: kunlik yig'ma jadval yarating va uni tunda (yoki har soatda)
to'ldiring:

```prisma
model DailyStat {
  clinicId       String   @map("clinic_id")
  date           DateTime @db.Date
  appointments   Int
  completed      Int
  noShows        Int
  newPatients    Int
  revenue        Int
  transactions   Int

  @@id([clinicId, date])
  @@map("daily_stats")
}
```

Bosh sahifa shundan o'qiydi — so'rov millisekundlarda bajariladi.

---

## 6. Zaxira nusxa (production)

Tibbiy ma'lumot yo'qolishi qabul qilib bo'lmas holat.

- `pg_dump` kuniga kamida bir marta, avtomatik;
- nusxalar **boshqa serverda/regionda** saqlanadi;
- WAL arxivlash yoqilsa, istalgan daqiqaga tiklash mumkin (PITR);
- **tiklashni sinab ko'ring** — sinalmagan zaxira nusxa yo'q bilan barobar;
- nusxalar shifrlanadi, saqlash muddati belgilanadi.

---

## 7. Migratsiyalar

```bash
npx prisma migrate dev --name init      # ishlab chiqishda
npx prisma migrate deploy               # productionda
```

Sxemani qo'lda `db push` bilan o'zgartirmang — har bir o'zgarish
migratsiya fayli sifatida git'da qolishi kerak.
