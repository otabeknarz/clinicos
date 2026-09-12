import type { Permission } from '../common/permissions'
import type { DebtsService } from '../debts/debts.service'
import type { PrismaService } from '../prisma/prisma.service'
import { clock, day, label, yesNo } from './export.labels'

/**
 * EKSPORT BO'LIMLARI RO'YXATI.
 *
 * Har bir bo'lim: qaysi ruxsat talab qilinadi, qanday ustunlar
 * chiqadi va ma'lumot qayerdan olinadi. Sahifalash YO'Q — fayl
 * butun ma'lumotni oladi, chunki Excel'da ishlaydigan odam
 * "20 tadan" emas, hammasini kutadi.
 *
 * GOOGLE SHEETS HAVOLASI (`sheet`) HAMMASIGA BERILMAYDI. Havola —
 * parolsiz ochiladigan manzil: uni bilgan har kim ma'lumotni
 * ko'radi. Shuning uchun u faqat moliya va boshqaruv ro'yxatlariga
 * beriladi. Bemorlar bazasi, tashriflar va statsionar — faqat fayl
 * qilib yuklanadi: tashxis va shikoyat havolada yurmaydi.
 */

export type TenantDb = ReturnType<PrismaService['forCurrentClinic']>
export type GlobalDb = ReturnType<PrismaService['acrossAllClinics']>

export interface ExportRange {
  from?: Date
  to?: Date
}

export interface ExportContext {
  /** Klinika filtri qo'llangan mijoz */
  db: TenantDb
  /** Platforma bo'limlari uchun — filtrsiz */
  all: GlobalDb
  /** Qarzdorlik HISOBLANADI, saqlanmaydi: formulani takrorlamaymiz */
  debts: DebtsService
  range: ExportRange
}

export interface ExportDataset {
  key: string
  permission: Permission
  /** Platforma bo'limi — butun tarmoq ma'lumoti */
  platform?: boolean
  /** Google Sheets havolasi berilishi mumkinmi */
  sheet: boolean
  /** Fayl nomi asosi — sana o'zi qo'shiladi */
  file: string
  headers: string[]
  rows(ctx: ExportContext): Promise<(string | number)[][]>
}

/** Sana oralig'i berilmasa — hammasi */
function between(range: ExportRange) {
  if (!range.from && !range.to) return undefined
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  }
}

/** ISO satrdan sana qismi — qarzdorlik xizmati satr qaytaradi */
function isoDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

export const DATASETS: ExportDataset[] = [
  /* ---------------- Klinika ---------------- */
  {
    key: 'patients',
    permission: 'patients.view',
    sheet: false,
    file: 'bemorlar',
    headers: [
      'Ism',
      'Telefon',
      'Tug‘ilgan sana',
      'Jinsi',
      'Manzil',
      'Holat',
      'Biriktirilgan shifokor',
      'Ro‘yxatga olingan',
    ],
    async rows({ db, range }) {
      const rows = await db.patient.findMany({
        where: { createdAt: between(range) },
        include: { primaryDoctor: { select: { fullName: true } } },
        orderBy: { fullName: 'asc' },
      })
      return rows.map((p) => [
        p.fullName,
        p.phone,
        day(p.birthDate),
        label(p.gender),
        p.address,
        label(p.status),
        p.primaryDoctor?.fullName ?? '',
        day(p.createdAt),
      ])
    },
  },
  {
    key: 'appointments',
    permission: 'appointments.view',
    sheet: true,
    file: 'qabullar',
    headers: [
      'Sana',
      'Vaqt',
      'Bemor',
      'Telefon',
      'Shifokor',
      'Xizmat',
      'Davomiylik (daqiqa)',
      'Holat',
      'To‘lov holati',
      'Izoh',
    ],
    async rows({ db, range }) {
      const rows = await db.appointment.findMany({
        where: { startsAt: between(range) },
        include: {
          patient: { select: { fullName: true, phone: true } },
          doctor: { select: { fullName: true } },
          service: { select: { name: true } },
        },
        orderBy: { startsAt: 'desc' },
      })
      return rows.map((a) => [
        day(a.startsAt),
        clock(a.startsAt),
        a.patient.fullName,
        a.patient.phone,
        a.doctor.fullName,
        a.service.name,
        a.durationMinutes,
        label(a.status),
        label(a.paymentStatus),
        a.notes,
      ])
    },
  },
  {
    key: 'visits',
    permission: 'visits.view',
    sheet: false,
    file: 'tashriflar',
    headers: ['Sana', 'Bemor', 'Shifokor', 'Shikoyat', 'Tashxis', 'Davolash', 'Narx', 'Izoh'],
    async rows({ db, range }) {
      const rows = await db.visit.findMany({
        where: { visitedAt: between(range) },
        include: {
          patient: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
        orderBy: { visitedAt: 'desc' },
      })
      return rows.map((v) => [
        day(v.visitedAt),
        v.patient.fullName,
        v.doctor.fullName,
        v.complaint,
        v.diagnosis,
        v.treatment,
        v.price ?? '',
        v.notes,
      ])
    },
  },
  {
    /*
      BUXGALTER UCHUN. Ustunlar ataylab shunday: katalog narxi,
      chegirma va HAQIQATDA olingan summa yonma-yon turadi — aks
      holda "nega 90 000 olingan" degan savolga fayl javob bermaydi.
    */
    key: 'payments',
    permission: 'payments.view',
    sheet: true,
    file: 'tolovlar',
    headers: [
      'Sana',
      'Vaqt',
      'Bemor',
      'Telefon',
      'Shifokor',
      'Xizmat',
      'Katalog narxi',
      'Chegirma %',
      'Olingan summa',
      'To‘lov turi',
      'Holat',
      'Izoh',
    ],
    async rows({ db, range }) {
      const rows = await db.payment.findMany({
        where: { paidAt: between(range) },
        include: {
          patient: { select: { fullName: true, phone: true } },
          doctor: { select: { fullName: true } },
          service: { select: { name: true } },
        },
        orderBy: { paidAt: 'desc' },
      })
      return rows.map((p) => [
        day(p.paidAt),
        clock(p.paidAt),
        p.patient.fullName,
        p.patient.phone,
        p.doctor.fullName,
        p.service?.name ?? 'Statsionar',
        p.basePrice,
        p.discountPct,
        p.amount,
        label(p.method),
        label(p.status),
        p.notes,
      ])
    },
  },
  {
    key: 'debts',
    permission: 'debts.view',
    sheet: true,
    file: 'qarzdorlik',
    headers: [
      'Turi',
      'Bemor',
      'Telefon',
      'Tafsilot',
      'Sana',
      'Kechikkan kun',
      'Jami',
      'To‘langan',
      'Qoldiq',
    ],
    async rows({ debts }) {
      const data = await debts.list()
      return [
        ...data.visits.map((d) => [
          'Qabul',
          d.patientName,
          d.patientPhone,
          d.serviceName,
          isoDay(d.completedAt),
          d.daysOverdue,
          d.total,
          d.paid,
          d.remaining,
        ]),
        ...data.ward.map((d) => [
          'Statsionar',
          d.patientName,
          d.patientPhone,
          `Palata ${d.roomNumber}`,
          isoDay(d.admittedAt),
          d.daysOverdue,
          d.total,
          d.paid,
          d.remaining,
        ]),
      ]
    },
  },
  {
    key: 'services',
    permission: 'services.view',
    sheet: true,
    file: 'xizmatlar',
    headers: [
      'Nomi',
      'Turkum',
      'Narx',
      'Davomiylik (daqiqa)',
      'To‘lov tartibi',
      'Narx turi',
      'Eng kam',
      'Eng ko‘p',
      'Holat',
    ],
    async rows({ db }) {
      const rows = await db.service.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      })
      return rows.map((s) => [
        s.name,
        s.category,
        s.price,
        s.durationMinutes,
        label(s.paymentTiming),
        label(s.priceMode),
        s.minPrice ?? '',
        s.maxPrice ?? '',
        label(s.status),
      ])
    },
  },
  {
    key: 'staff',
    permission: 'staff.view',
    sheet: true,
    file: 'xodimlar',
    headers: [
      'Ism',
      'Lavozim',
      'Bo‘lim',
      'Telefon',
      'Email',
      'Ish kunlari',
      'Ish vaqti',
      'Stavka %',
      'To‘lov turi',
      'Oylik',
      'Foiz %',
      'Ishga olingan',
      'Holat',
      'Tizimga kirish',
    ],
    async rows({ db }) {
      const rows = await db.staff.findMany({ orderBy: { fullName: 'asc' } })
      const WEEK = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
      return rows.map((s) => [
        s.fullName,
        s.positionTitle || label(s.position),
        s.department,
        s.phone,
        s.email,
        s.workdays.map((d) => WEEK[d] ?? String(d)).join(' '),
        `${s.shiftStart}–${s.shiftEnd}`,
        s.workRate,
        label(s.payType),
        s.salary,
        s.percentRate,
        day(s.hiredAt),
        label(s.status),
        yesNo(s.hasSystemAccess),
      ])
    },
  },
  {
    key: 'attendance',
    permission: 'attendance.view',
    sheet: true,
    file: 'davomat',
    headers: [
      'Sana',
      'Xodim',
      'Holat',
      'Kelgan vaqt',
      'Kechikish (daqiqa)',
      'Ishlagan (daqiqa)',
    ],
    async rows({ db, range }) {
      const rows = await db.attendance.findMany({
        where: { date: between(range) },
        include: { staff: { select: { fullName: true } } },
        orderBy: [{ date: 'desc' }],
      })
      return rows.map((a) => [
        day(a.date),
        a.staff.fullName,
        label(a.status),
        a.arrivedAt ?? '',
        a.lateMinutes,
        a.workedMinutes,
      ])
    },
  },
  {
    key: 'feedback',
    permission: 'feedback.view',
    sheet: true,
    file: 'izohlar',
    headers: ['Sana', 'Baho', 'Shifokor', 'Matn', 'Holat', 'Anonim', 'Javob'],
    async rows({ db, range }) {
      const rows = await db.feedback.findMany({
        where: { createdAt: between(range) },
        include: { doctor: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return rows.map((f) => [
        day(f.createdAt),
        f.rating,
        f.doctor?.fullName ?? '',
        f.text,
        label(f.status),
        yesNo(f.isAnonymous),
        f.reply,
      ])
    },
  },
  {
    key: 'admissions',
    permission: 'ward.view',
    sheet: false,
    file: 'statsionar',
    headers: [
      'Bemor',
      'Telefon',
      'Shifokor',
      'Palata',
      'Yotqizilgan',
      'Chiqarilgan',
      'Holat',
      'Kunlik narx',
      'Tashxis',
    ],
    async rows({ db, range }) {
      const rows = await db.admission.findMany({
        where: { admittedAt: between(range) },
        include: {
          patient: { select: { fullName: true, phone: true } },
          doctor: { select: { fullName: true } },
          room: { select: { number: true } },
        },
        orderBy: { admittedAt: 'desc' },
      })
      return rows.map((a) => [
        a.patient.fullName,
        a.patient.phone,
        a.doctor.fullName,
        a.room.number,
        day(a.admittedAt),
        day(a.dischargedAt),
        label(a.status),
        a.dailyRate,
        a.diagnosis,
      ])
    },
  },

  /* ---------------- Apteka ---------------- */
  {
    key: 'pharmacy-medicines',
    permission: 'pharmacy.view',
    sheet: true,
    file: 'dorilar',
    headers: [
      'Nomi',
      'Shakli',
      'Ishlab chiqaruvchi',
      'Mamlakat',
      'Shtrix-kod',
      'O‘lchov',
      'Retsept bilan',
      'Sotuv narxi',
      'Holat',
    ],
    async rows({ db }) {
      const rows = await db.medicine.findMany({ orderBy: { name: 'asc' } })
      return rows.map((m) => [
        m.name,
        label(m.form),
        m.manufacturer,
        m.country,
        m.barcode,
        m.unit,
        yesNo(m.prescriptionOnly),
        m.sellPrice,
        label(m.status),
      ])
    },
  },
  {
    key: 'pharmacy-stock',
    permission: 'pharmacy.view',
    sheet: true,
    file: 'zaxira',
    headers: [
      'Dori',
      'Partiya',
      'Muddati',
      'Miqdori',
      'Tannarx',
      'Ta’minotchi',
      'Qabul sanasi',
    ],
    async rows({ db }) {
      const rows = await db.medicineBatch.findMany({
        include: {
          medicine: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        orderBy: [{ expiresAt: 'asc' }],
      })
      return rows.map((b) => [
        b.medicine.name,
        b.code,
        day(b.expiresAt),
        b.quantity,
        b.buyPrice,
        b.supplier?.name ?? '',
        day(b.receivedAt),
      ])
    },
  },
  {
    key: 'pharmacy-sales',
    permission: 'pharmacy.view',
    sheet: true,
    file: 'apteka-savdo',
    headers: ['Sana', 'Vaqt', 'Chek', 'Summa', 'Chegirma', 'To‘lov turi', 'Sotuvchi'],
    async rows({ db, range }) {
      const rows = await db.sale.findMany({
        where: { soldAt: between(range) },
        orderBy: { soldAt: 'desc' },
      })
      return rows.map((s) => [
        day(s.soldAt),
        clock(s.soldAt),
        s.number,
        s.total,
        s.discount,
        label(s.method),
        s.soldByName,
      ])
    },
  },
  {
    key: 'pharmacy-purchases',
    permission: 'pharmacy.receive',
    sheet: true,
    file: 'apteka-kirim',
    headers: [
      'Sana',
      'Ta’minotchi',
      'Hujjat raqami',
      'Jami',
      'To‘lov',
      'To‘langan',
      'Muddat',
      'Qabul qildi',
      'Izoh',
    ],
    async rows({ db, range }) {
      const rows = await db.purchase.findMany({
        where: { receivedAt: between(range) },
        orderBy: { receivedAt: 'desc' },
      })
      return rows.map((p) => [
        day(p.receivedAt),
        p.supplierName,
        p.invoiceNumber,
        p.total,
        label(p.payment),
        p.paidAmount,
        day(p.dueDate),
        p.receivedByName,
        p.note,
      ])
    },
  },
  {
    key: 'pharmacy-suppliers',
    permission: 'pharmacy.view',
    sheet: true,
    file: 'taminotchilar',
    headers: ['Nomi', 'Telefon', 'INN', 'Izoh'],
    async rows({ db }) {
      const rows = await db.supplier.findMany({ orderBy: { name: 'asc' } })
      return rows.map((s) => [s.name, s.phone, s.inn, s.note])
    },
  },
  {
    key: 'pharmacy-shifts',
    permission: 'pharmacy.cashcontrol',
    sheet: true,
    file: 'apteka-smenalar',
    headers: [
      'Sana',
      'Sotuvchi',
      'Cheklar',
      'Karta',
      'Kutilgan naqd',
      'Sanalgan naqd',
      'Farq',
      'Belgilangan',
      'Topshirildi',
      'Izoh',
    ],
    async rows({ db, range }) {
      const rows = await db.pharmacyShift.findMany({
        where: { date: between(range) },
        orderBy: { date: 'desc' },
      })
      return rows.map((s) => [
        day(s.date),
        s.sellerName,
        s.receipts,
        s.cardTotal,
        s.expectedCash,
        s.countedCash,
        s.difference,
        yesNo(s.flagged),
        s.handedToName,
        s.note,
      ])
    },
  },

  /* ---------------- Platforma ---------------- */
  {
    key: 'platform-clinics',
    permission: 'platform.view',
    platform: true,
    sheet: true,
    file: 'klinikalar',
    headers: [
      'Klinika',
      'Shahar',
      'Telefon',
      'Manzil',
      'Egasi',
      'Egasining emaili',
      'Tarif',
      'Obuna holati',
      'Muddat (oy)',
      'Muddat narxi',
      'Keyingi hisob',
      'Ochilgan',
    ],
    async rows({ all }) {
      const rows = await all.clinic.findMany({
        where: { kind: 'CLINIC', deletedAt: null },
        include: { subscription: { include: { plan: { select: { name: true } } } } },
        orderBy: { name: 'asc' },
      })
      return rows.map((c) => [
        c.name,
        c.city,
        c.phone,
        c.address,
        c.subscription?.ownerName ?? '',
        c.subscription?.ownerEmail ?? '',
        c.subscription?.plan.name ?? '',
        label(c.subscription?.status),
        c.subscription?.termMonths ?? '',
        c.subscription?.termPrice ?? '',
        day(c.subscription?.nextInvoiceAt),
        day(c.createdAt),
      ])
    },
  },
  {
    key: 'platform-pharmacies',
    permission: 'platform.view',
    platform: true,
    sheet: true,
    file: 'aptekalar',
    headers: ['Apteka', 'Shahar', 'Telefon', 'Manzil', 'Holat', 'Ochilgan'],
    async rows({ all }) {
      const rows = await all.clinic.findMany({
        where: { kind: 'PHARMACY', deletedAt: null },
        orderBy: { name: 'asc' },
      })
      return rows.map((p) => [
        p.name,
        p.city,
        p.phone,
        p.address,
        p.isActive ? 'Faol' : 'To‘xtatilgan',
        day(p.createdAt),
      ])
    },
  },
  {
    key: 'platform-invoices',
    permission: 'platform.view',
    platform: true,
    sheet: true,
    file: 'hisoblar',
    headers: [
      'Davr',
      'Klinika',
      'Tarif',
      'Summa',
      'Holat',
      'Berilgan',
      'Muddat',
      'To‘langan',
    ],
    async rows({ all, range }) {
      const rows = await all.tenantInvoice.findMany({
        where: { issuedAt: between(range) },
        include: { subscription: { include: { clinic: { select: { name: true } } } } },
        orderBy: { issuedAt: 'desc' },
      })
      return rows.map((i) => [
        i.period,
        i.subscription.clinic.name,
        i.planName,
        i.amount,
        label(i.status),
        day(i.issuedAt),
        day(i.dueAt),
        day(i.paidAt),
      ])
    },
  },
]

export function findDataset(key: string): ExportDataset | undefined {
  return DATASETS.find((dataset) => dataset.key === key)
}
