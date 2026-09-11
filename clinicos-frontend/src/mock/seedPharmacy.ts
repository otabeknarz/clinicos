import type { Random } from './random'
import type {
  Batch,
  Medicine,
  MedicineForm,
  Prescription,
  PharmacyShift,
  PharmacyStaff,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  Supplier,
} from '@/types/pharmacy'

/**
 * APTEKA UCHUN DEMO MA'LUMOTI.
 *
 * Dorilar ro'yxati O'ZBEKISTON aptekasidan olingan: bu yerda
 * haqiqatan sotiladigan nomlar, qadoqlar va narxlar. Umumiy
 * "Dori A, Dori B" bilan to'ldirilsa, ekran haqiqiy ishga
 * o'xshamas va narx, muddat, qadoq kabi narsalar to'g'rimi-yo'qmi
 * — bilib bo'lmasdi.
 */

interface Item {
  name: string
  form: MedicineForm
  price: number
  rx?: boolean
  unit?: string
  /**
   * Tibbiy buyum, dori EMAS.
   *
   * Bint, shpris, niqob — ular sotiladi, lekin RETSEPTGA
   * yozilmaydi. Ajratilmasa, demo retseptda "Bint steril —
   * kuniga 1 paketdan suvda eritib ichiladi" degan yozuv
   * chiqadi va ekran farmatsevtning ko'ziga darrov soxta
   * bo'lib ko'rinadi.
   */
  supply?: boolean
}

const CATALOG: Item[] = [
  { name: 'Paratsetamol 500 mg', form: 'tablet', price: 4500 },
  { name: 'Analgin 500 mg', form: 'tablet', price: 3800 },
  { name: 'Aspirin Cardio 100 mg', form: 'tablet', price: 21000 },
  { name: 'Ibuprofen 400 mg', form: 'tablet', price: 12000 },
  { name: 'Nurofen Forte', form: 'tablet', price: 38000 },
  { name: 'Sitramon', form: 'tablet', price: 3200 },
  { name: 'No-shpa 40 mg', form: 'tablet', price: 26000 },
  { name: 'Drotaverin 40 mg', form: 'tablet', price: 7500 },
  { name: 'Amoksitsillin 500 mg', form: 'capsule', price: 18000, rx: true },
  { name: 'Azitromitsin 500 mg', form: 'tablet', price: 34000, rx: true },
  { name: 'Tseftriakson 1 g', form: 'ampoule', price: 12500, rx: true, unit: 'flakon' },
  { name: 'Siprofloksatsin 500 mg', form: 'tablet', price: 22000, rx: true },
  { name: 'Metronidazol 250 mg', form: 'tablet', price: 6500, rx: true },
  { name: 'Suprastin 25 mg', form: 'tablet', price: 24000 },
  { name: 'Loratadin 10 mg', form: 'tablet', price: 9500 },
  { name: 'Sesan sirop', form: 'syrup', price: 32000, unit: 'flakon' },
  { name: 'Omeprazol 20 mg', form: 'capsule', price: 15000 },
  { name: 'Mezim Forte', form: 'tablet', price: 42000 },
  { name: 'Festal', form: 'tablet', price: 38000 },
  { name: 'Aktivlangan komir', form: 'tablet', price: 2500 },
  { name: 'Smekta', form: 'other', price: 8500, unit: 'paket' },
  { name: 'Regidron', form: 'other', price: 7000, unit: 'paket' },
  { name: 'Ambroksol sirop', form: 'syrup', price: 19000, unit: 'flakon' },
  { name: 'ACC 200 mg', form: 'other', price: 36000, unit: 'paket' },
  { name: 'Lazolvan', form: 'syrup', price: 54000, unit: 'flakon' },
  { name: 'Nazivin tomchi', form: 'drops', price: 28000, unit: 'flakon' },
  { name: 'Otipaks tomchi', form: 'drops', price: 46000, unit: 'flakon' },
  { name: 'Albusid koz tomchisi', form: 'drops', price: 11000, unit: 'flakon' },
  { name: 'Ingalipt sprey', form: 'spray', price: 17000, unit: 'flakon' },
  { name: 'Geksoral sprey', form: 'spray', price: 49000, unit: 'flakon' },
  { name: 'Levomekol malham', form: 'ointment', price: 21000, unit: 'tuba' },
  { name: 'Vishnevskiy malhami', form: 'ointment', price: 9000, unit: 'tuba' },
  { name: 'Diklofenak gel', form: 'ointment', price: 26000, unit: 'tuba' },
  { name: 'Yod eritmasi', form: 'other', price: 5500, unit: 'flakon' },
  { name: 'Brilliant yashili', form: 'other', price: 4800, unit: 'flakon' },
  { name: 'Perekis vodoroda 3%', form: 'other', price: 4200, unit: 'flakon' , supply: true },
  { name: 'Spirt 70%', form: 'other', price: 8000, unit: 'flakon' , supply: true },
  { name: 'Bint steril 5 m', form: 'other', price: 3500, unit: 'dona' , supply: true },
  { name: 'Paxta 100 g', form: 'other', price: 6000, unit: 'paket' , supply: true },
  { name: 'Leykoplastir', form: 'other', price: 2800, unit: 'dona' , supply: true },
  { name: 'Shpris 5 ml', form: 'other', price: 1500, unit: 'dona' , supply: true },
  { name: 'Shpris 10 ml', form: 'other', price: 2000, unit: 'dona' , supply: true },
  { name: 'Tibbiy niqob', form: 'other', price: 1200, unit: 'dona' , supply: true },
  { name: 'Qolqop steril', form: 'other', price: 2500, unit: 'juft' , supply: true },
  { name: 'Vitamin C 500 mg', form: 'tablet', price: 13000 },
  { name: 'Askorbin kislotasi', form: 'tablet', price: 3000 },
  { name: 'Magne B6', form: 'tablet', price: 78000 },
  { name: 'Ferrum Lek sirop', form: 'syrup', price: 92000, unit: 'flakon' },
  { name: 'Kalsiy D3 Nikomed', form: 'tablet', price: 86000 },
  { name: 'Enalapril 10 mg', form: 'tablet', price: 8500, rx: true },
  { name: 'Amlodipin 5 mg', form: 'tablet', price: 11000, rx: true },
  { name: 'Bisoprolol 5 mg', form: 'tablet', price: 16000, rx: true },
  { name: 'Kaptopril 25 mg', form: 'tablet', price: 6800, rx: true },
  { name: 'Metformin 850 mg', form: 'tablet', price: 24000, rx: true },
  { name: 'Glibenklamid 5 mg', form: 'tablet', price: 14000, rx: true },
  { name: 'Deksametazon', form: 'ampoule', price: 4500, rx: true, unit: 'ampula' },
  { name: 'Lidokain 2%', form: 'ampoule', price: 3200, rx: true, unit: 'ampula' },
  { name: 'Natriy xlorid 0,9% 200 ml', form: 'other', price: 9500, unit: 'flakon' },
  { name: 'Glyukoza 5% 200 ml', form: 'other', price: 10500, unit: 'flakon' },
  { name: 'Validol', form: 'tablet', price: 3600 },
]

const MAKERS: readonly (readonly [string, string])[] = [
  ['Jurabek Laboratories', 'Ozbekiston'],
  ['Nika Pharm', 'Ozbekiston'],
  ['Merrymed Farm', 'Ozbekiston'],
  ['Remedy Group', 'Ozbekiston'],
  ['Dori-Darmon', 'Ozbekiston'],
  ['Gedeon Richter', 'Vengriya'],
  ['KRKA', 'Sloveniya'],
  ['Berlin-Chemie', 'Germaniya'],
  ['Sanofi', 'Fransiya'],
  ['Farmstandart', 'Rossiya'],
]

const SUPPLIER_NAMES = [
  'Dori-Darmon AJ',
  'Farm Trade Servis',
  'Med Optima Distribution',
  'Uzpharma Logistics',
  'Nihol Farm',
  'Shifo Invest',
]

/**
 * Qabul tartibi SHAKLGA QARAB tanlanadi.
 *
 * Tasodifiy tanlansa, "ko'z tomchisi" yoniga "1 tabletkadan"
 * deb yozilib qolardi — demo ekran farmatsevtning ko'ziga
 * darrov soxta bo'lib ko'rinardi.
 */
const DOSAGE_BY_FORM: Record<MedicineForm, string[]> = {
  tablet: [
    '1 tabletkadan kuniga 3 mahal, 5 kun',
    '1 tabletkadan kuniga 2 mahal, ovqatdan keyin',
    '1 tabletkadan kuniga 1 mahal, kechqurun, 10 kun',
  ],
  capsule: [
    '1 kapsuladan kuniga 2 mahal, 7 kun',
    '1 kapsuladan kuniga 1 mahal, ertalab, ovqatdan oldin',
  ],
  syrup: [
    'Kuniga 3 mahal, 1 choy qoshiqdan',
    'Kuniga 2 mahal, 5 ml dan, 7 kun',
  ],
  ampoule: [
    'Kuniga 1 mahal, mushak orasiga, 5 kun',
    'Kuniga 2 mahal, tomir orqali, shifokor nazorati ostida',
  ],
  ointment: [
    'Kuniga 2 mahal, teriga yupqa qilib surtiladi',
    'Kuniga 3 mahal, bog‘lam ostiga qo‘yiladi',
  ],
  drops: [
    'Kuniga 3 mahal, 2 tomchidan',
    'Kuniga 2 mahal, har ikkala ko‘zga 1 tomchidan',
  ],
  spray: [
    'Kuniga 3 mahal, 1 purkashdan',
    'Ovqatdan keyin, kuniga 2 mahal purkaladi',
  ],
  other: [
    'Kuniga 1 paketdan, suvda eritib ichiladi',
    'Zarurat bo‘lganda ishlatiladi',
  ],
}

/** `2026-09-11` korinishida */
function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function shift(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export interface PharmacySeed {
  medicines: Medicine[]
  batches: Batch[]
  suppliers: Supplier[]
  sales: Sale[]
  prescriptions: Prescription[]
  shifts: PharmacyShift[]
  staff: PharmacyStaff[]
  purchases: Purchase[]
}

export function generatePharmacy(
  r: Random,
  clinicId: string,
  patients: { id: string; fullName: string }[],
  doctors: { fullName: string }[],
  /** Birinchi sotuvchining ismi — demo hisobi bilan bir xil bo'lsin */
  sellerName: string,
): PharmacySeed {
  /*
    UCHTA XODIM: ikki sotuvchi va bir rahbar.

    Bittasi bilan ham ishlardi, lekin o'shanda xodimlar
    bo'limidagi taqqoslash ma'nosiz bo'lardi: kimning savdosi
    yuqori, kimda kassa tez-tez kam chiqadi — bularning hammasi
    faqat bir nechta odam bo'lganda ko'rinadi.
  */
  const staff: PharmacyStaff[] = [
    {
      id: 'pst_1',
      clinicId,
      fullName: sellerName,
      phone: `+9989${r.int(10, 99)}${r.int(100000, 999999)}`,
      login: 'apteka@clinic-os.uz',
      role: 'pharmacist',
      salary: 4_500_000,
      workdays: [1, 2, 3, 4, 5],
      shiftStart: '08:00',
      shiftEnd: '15:00',
      status: 'active',
      hiredAt: isoDate(shift(-r.int(200, 700))),
      /* Tajribali sotuvchi tovarni ham qabul qiladi */
      canReceive: true,
    },
    {
      id: 'pst_2',
      clinicId,
      fullName: 'Ozoda Qodirova',
      phone: `+9989${r.int(10, 99)}${r.int(100000, 999999)}`,
      login: 'apteka2@clinic-os.uz',
      role: 'pharmacist',
      salary: 4_200_000,
      workdays: [2, 3, 4, 5, 6],
      /* Ikkinchi smena — birinchisidan keyin boshlanadi */
      shiftStart: '15:00',
      shiftEnd: '21:00',
      status: 'active',
      hiredAt: isoDate(shift(-r.int(60, 300))),
      canReceive: false,
    },
    {
      id: 'pst_3',
      clinicId,
      fullName: 'Gulnora Yusupova',
      phone: `+9989${r.int(10, 99)}${r.int(100000, 999999)}`,
      login: 'apteka.rahbar@clinic-os.uz',
      role: 'pharmacy_owner',
      salary: 7_000_000,
      workdays: [1, 2, 3, 4, 5],
      shiftStart: '09:00',
      shiftEnd: '18:00',
      status: 'active',
      hiredAt: isoDate(shift(-r.int(300, 800))),
      /* Rahbarda doim bor */
      canReceive: true,
    },
  ]

  const sellers = staff.filter((person) => person.role === 'pharmacist')

  const suppliers: Supplier[] = SUPPLIER_NAMES.map((name, i) => ({
    id: `sup_${i + 1}`,
    clinicId,
    name,
    phone: `+9987${r.int(10, 99)}${r.int(100000, 999999)}`,
    inn: String(r.int(200000000, 399999999)),
    note: '',
  }))

  const medicines: Medicine[] = CATALOG.map((item, i) => {
    const [manufacturer, country] = r.pick(MAKERS)
    return {
      id: `med_${i + 1}`,
      clinicId,
      name: item.name,
      form: item.form,
      manufacturer,
      country,
      barcode: `478${r.int(1000000000, 9999999999)}`,
      unit:
        item.unit ?? (item.form === 'tablet' || item.form === 'capsule' ? 'quti' : 'dona'),
      prescriptionOnly: Boolean(item.rx),
      sellPrice: item.price,
      status: 'active',
      createdAt: shift(-r.int(60, 400)).toISOString(),
    }
  })

  /*
    HAR BIR DORIDA BIR NECHTA PARTIYA.

    Ataylab turli holatlar yaratiladi: muddati yaqin qolganlari,
    tugab qolganlari va butunlay tugaganlari. Hammasi "yetarli"
    bolsa, zaxira ekrani hech qachon sinalmasdi.
  */
  const batches: Batch[] = []
  let batchSeq = 0

  for (const medicine of medicines) {
    const state = r.weighted<'normal' | 'low' | 'expiring' | 'empty'>([
      ['normal', 62],
      ['low', 16],
      ['expiring', 14],
      ['empty', 8],
    ])
    if (state === 'empty') continue

    const count = state === 'normal' ? r.int(1, 3) : 1

    for (let i = 0; i < count; i++) {
      batchSeq++
      const expiryDays = state === 'expiring' ? r.int(5, 80) : r.int(150, 900)
      const quantity = state === 'low' ? r.int(1, 6) : r.int(12, 180)

      batches.push({
        id: `bat_${batchSeq}`,
        clinicId,
        medicineId: medicine.id,
        code: `P-${r.int(10000, 99999)}`,
        expiresAt: isoDate(shift(expiryDays)),
        quantity,
        /* Ustama odatda 20-45% */
        buyPrice: Math.round(medicine.sellPrice / (1 + r.int(20, 45) / 100)),
        supplierId: r.pick(suppliers).id,
        receivedAt: isoDate(shift(-r.int(5, 180))),
      })
    }
  }

  const inStock = batches.filter((b) => b.quantity > 0)

  /* ---------------- Sotuvlar ---------------- */

  const sales: Sale[] = []
  let saleSeq = 1000

  for (let day = 60; day >= 0; day--) {
    const date = shift(-day)
    const weekend = date.getDay() === 0
    const count = weekend ? r.int(2, 8) : r.int(6, 22)

    for (let i = 0; i < count; i++) {
      const lines = r.int(1, 4)
      const items: SaleItem[] = []

      for (let k = 0; k < lines; k++) {
        const batch = r.pick(inStock)
        const medicine = medicines.find((m) => m.id === batch.medicineId)
        if (!medicine) continue
        items.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          batchId: batch.id,
          quantity: r.int(1, 3),
          price: medicine.sellPrice,
          buyPrice: batch.buyPrice,
        })
      }
      if (items.length === 0) continue

      const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
      /* Chegirma kam uchraydi va kichik boladi */
      const discount = r.chance(0.12)
        ? Math.round((total * r.int(3, 10)) / 100 / 100) * 100
        : 0

      const at = new Date(date)
      at.setHours(r.int(9, 19), r.int(0, 59), 0, 0)

      /*
        Kun bo'yicha sotuvchi: bir kunda bitta odam ishlaydi.
        Har chekka boshqa odam yozilsa, smena hisobi ma'nosiz
        bo'lardi — kassani kim topshirishi noma'lum qolardi.
      */
      const seller = sellers[day % sellers.length]

      saleSeq++
      sales.push({
        id: `sale_${saleSeq}`,
        clinicId,
        number: `A-${saleSeq}`,
        soldAt: at.toISOString(),
        items,
        total,
        discount,
        method: r.weighted<'cash' | 'card' | 'transfer'>([
          ['cash', 58],
          ['card', 38],
          ['transfer', 4],
        ]),
        /* Har beshinchi xarid klinikaning oz bemoriga tegishli */
        patientId: r.chance(0.2) && patients.length ? r.pick(patients).id : null,
        prescriptionId: null,
        soldById: seller.id,
        soldByName: seller.fullName,
      })
    }
  }

  /* ---------------- Retseptlar ---------------- */

  const supplyNames = new Set(
    CATALOG.filter((item) => item.supply).map((item) => item.name),
  )
  const prescribable = medicines.filter((one) => !supplyNames.has(one.name))

  const prescriptions: Prescription[] = []

  for (let i = 0; i < 18; i++) {
    const patient = r.pick(patients)
    const created = shift(-r.int(0, 20))
    created.setHours(r.int(9, 17), r.int(0, 59), 0, 0)

    /* Retseptga faqat DORI yoziladi, tibbiy buyum emas */
    const picked = r.sample(prescribable, r.int(1, 3))

    prescriptions.push({
      id: `rx_${i + 1}`,
      clinicId,
      patientId: patient.id,
      patientName: patient.fullName,
      doctorName: r.pick(doctors).fullName,
      createdAt: created.toISOString(),
      items: picked.map((medicine) => ({
        medicineName: medicine.name,
        dosage: r.pick(DOSAGE_BY_FORM[medicine.form]),
        quantity: r.int(1, 2),
      })),
      status: r.weighted<'pending' | 'dispensed' | 'expired'>([
        ['pending', 45],
        ['dispensed', 45],
        ['expired', 10],
      ]),
      note: '',
    })
  }

  /* ---------------- Smenalar ---------------- */

  /*
    Har kun uchun bitta yopilish. Naqd summa SOTUVLARDAN
    hisoblanadi — ikkalasi bir-biriga mos kelmasa, kassa
    nazorati hisoboti soxta signal berardi.

    Farq ko'pincha nol: aptekada kun oxirida hamma narsa
    to'g'ri chiqadi. Ba'zan kichik kamomad bo'ladi (qaytim
    xatosi), kamdan-kam ortiqcha. Hammasi noldan farq qilsa,
    hisobot "har kuni muammo" degan taassurot berardi va uni
    hech kim jiddiy qabul qilmasdi.
  */
  const shifts: PharmacyShift[] = []
  const byDate = new Map<string, Sale[]>()

  for (const sale of sales) {
    const day = sale.soldAt.slice(0, 10)
    byDate.set(day, [...(byDate.get(day) ?? []), sale])
  }

  let shiftSeq = 0
  for (const [date, daySales] of byDate) {
    /* Bugungi smena hali yopilmagan */
    if (date === isoDate(new Date())) continue

    shiftSeq++
    const cash = daySales
      .filter((s) => s.method === 'cash')
      .reduce((sum, s) => sum + s.total - s.discount, 0)
    const card = daySales
      .filter((s) => s.method !== 'cash')
      .reduce((sum, s) => sum + s.total - s.discount, 0)

    const difference = r.weighted<number>([
      [0, 74],
      [-r.int(1, 6) * 1000, 18],
      [r.int(1, 3) * 1000, 8],
    ])

    const closed = new Date(`${date}T20:${String(r.int(10, 55)).padStart(2, '0')}:00`)

    const shiftSeller =
      sellers.find((person) => person.id === daySales[0]?.soldById) ?? sellers[0]

    shifts.push({
      id: `psh_${shiftSeq}`,
      clinicId,
      sellerId: shiftSeller.id,
      sellerName: shiftSeller.fullName,
      date,
      expectedCash: cash,
      countedCash: cash + difference,
      difference,
      cardTotal: card,
      receipts: daySales.length,
      note: difference < 0 ? 'Qaytim xatosi bo‘lgan' : '',
      /* Kassa keyingi kun ishlaydigan odamga topshiriladi */
      handedToId: sellers.find((one) => one.id !== shiftSeller.id)?.id ?? null,
      handedToName: sellers.find((one) => one.id !== shiftSeller.id)?.fullName ?? '',
      /*
        Katta kamomadda sotuvchi ogohlantirishni ko'rgan va
        baribir davom etgan. Kichigida esa ogohlantirish
        chiqmaydi ham — 3 000 so'm qaytim xatosi bo'lishi
        mumkin va har safar rahbarni chaqirishning ma'nosi yo'q.
      */
      flagged: difference <= -4000,
      closedAt: closed.toISOString(),
    })
  }

  /* ---------------- Kirimlar ---------------- */

  /*
    Mavjud partiyalardan teskari yo'l bilan yig'iladi: har bir
    partiya qachondir kirim bilan kelgan. Alohida tasodifiy
    kirim yaratilsa, kirim hujjati bilan javondagi tovar
    bir-biriga mos kelmasdi.
  */
  const purchases: Purchase[] = []
  const byReceipt = new Map<string, Batch[]>()

  for (const batch of batches) {
    const key = `${batch.receivedAt}|${batch.supplierId ?? ''}`
    byReceipt.set(key, [...(byReceipt.get(key) ?? []), batch])
  }

  let purchaseSeq = 0
  for (const [key, group] of byReceipt) {
    const [receivedAt, supplierId] = key.split('|')
    const supplier = suppliers.find((one) => one.id === supplierId)

    const items: PurchaseItem[] = group.map((batch) => {
      const medicine = medicines.find((one) => one.id === batch.medicineId)
      return {
        medicineId: batch.medicineId,
        medicineName: medicine?.name ?? '',
        batchCode: batch.code,
        expiresAt: batch.expiresAt,
        /* Kirimda kelgan miqdor — qolganidan ko'p bo'lishi tabiiy */
        quantity: batch.quantity + r.int(0, 40),
        buyPrice: batch.buyPrice,
        sellPrice: medicine?.sellPrice ?? 0,
      }
    })

    const total = items.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0)

    /*
      Ta'minotchiga to'lov: ko'pchiligi nasiya keladi va oyning
      oxirida yopiladi. Hammasi "to'langan" bo'lsa, qarzdorlik
      ekrani doim bo'sh turardi va uni sinab ko'rib bo'lmasdi.
    */
    const payment = r.weighted<'paid' | 'partial' | 'credit'>([
      ['paid', 45],
      ['credit', 40],
      ['partial', 15],
    ])

    const receiver = r.pick(staff.filter((one) => one.canReceive))

    purchaseSeq++
    purchases.push({
      id: `pur_${purchaseSeq}`,
      clinicId,
      supplierId: supplierId || null,
      supplierName: supplier?.name ?? '',
      invoiceNumber: `H-${r.int(10000, 99999)}`,
      receivedAt,
      items,
      total,
      payment,
      paidAmount:
        payment === 'paid' ? total : payment === 'partial' ? Math.round(total / 2) : 0,
      dueDate: payment === 'paid' ? null : isoDate(shift(r.int(-20, 30))),
      documents: [],
      receivedById: receiver.id,
      receivedByName: receiver.fullName,
      note: '',
      createdAt: new Date(`${receivedAt}T10:00:00`).toISOString(),
    })
  }

  purchases.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  shifts.sort((a, b) => b.date.localeCompare(a.date))
  prescriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  sales.sort((a, b) => b.soldAt.localeCompare(a.soldAt))

  return { medicines, batches, suppliers, sales, prescriptions, shifts, staff, purchases }
}
