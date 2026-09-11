import type { ID, ISODate, ISODateTime, UZS } from './models'

/**
 * APTEKA.
 *
 * Klinika ichidagi ALOHIDA biznes: o'z tovari, o'z kassasi, o'z
 * hisoboti. Klinika bilan bog'lanadigan yagona joyi — retsept:
 * shifokor tashrifda dori yozadi, apteka uni beradi.
 *
 * Shakllar `models.ts` da emas, alohida faylda: u fayl allaqachon
 * 2600 qatordan oshgan va apteka unga aloqasi yo'q butun boshqa
 * bo'lim. Aralashtirilsa, ikkalasini ham o'qish qiyinlashardi.
 *
 * PUL BUTUN SONDA, so'mda — klinikaning qolgan qismi bilan bir xil
 * qoida. Kasr son pulda hech qachon ishlatilmaydi.
 */

/** Dorining chiqarilish shakli */
export const MEDICINE_FORMS = [
  'tablet',
  'capsule',
  'syrup',
  'ampoule',
  'ointment',
  'drops',
  'spray',
  'other',
] as const
export type MedicineForm = (typeof MEDICINE_FORMS)[number]

export interface Medicine {
  id: ID
  clinicId: ID
  name: string
  form: MedicineForm
  /** Ishlab chiqaruvchi — bir xil dorining bir nechta varianti bo'ladi */
  manufacturer: string
  country: string
  /** Skanerdan o'qiladigan kod. Bo'sh bo'lishi mumkin. */
  barcode: string
  /** Sotuv birligi: dona, quti, flakon */
  unit: string
  /**
   * Retseptsiz berilmaydimi.
   *
   * Antibiotik va kuchli dorilar shu belgiga ega. Kassa ularni
   * ajratib ko'rsatadi — farmatsevt "bilmadim" deb ayta olmasin.
   */
  prescriptionOnly: boolean
  sellPrice: UZS
  status: 'active' | 'archived'
  createdAt: ISODateTime
}

/**
 * PARTIYA — apteka hisobining asosi.
 *
 * Dori "bor yoki yo'q" emas: har bir partiyaning O'Z muddati va
 * O'Z tannarxi bor. Muddati o'tgan partiya sotilmasligi, tannarx
 * esa foydani hisoblash uchun kerak. Shuning uchun zaxira dori
 * bo'yicha emas, PARTIYA bo'yicha yuritiladi.
 */
export interface Batch {
  id: ID
  clinicId: ID
  medicineId: ID
  /** Partiya raqami — qutida yozilgan bo'ladi */
  code: string
  expiresAt: ISODate
  /** Qolgan miqdor */
  quantity: number
  buyPrice: UZS
  supplierId: ID | null
  receivedAt: ISODate
}

export interface Supplier {
  id: ID
  clinicId: ID
  name: string
  phone: string
  /** Soliq to'lovchi raqami */
  inn: string
  note: string
}

/** Kassada sotilgan bitta qator */
export interface SaleItem {
  medicineId: ID
  medicineName: string
  batchId: ID
  quantity: number
  /** Sotuv paytidagi narx — keyin katalogda o'zgarsa ham bu qoladi */
  price: UZS
  buyPrice: UZS
}

export interface Sale {
  id: ID
  clinicId: ID
  /** Chek raqami — kun boshida qaytadan boshlanmaydi */
  number: string
  soldAt: ISODateTime
  items: SaleItem[]
  total: UZS
  discount: UZS
  method: 'cash' | 'card' | 'transfer'
  /** Klinika bemori bo'lsa — kartochkasiga bog'lanadi */
  patientId: ID | null
  prescriptionId: ID | null
  soldById: ID
  soldByName: string
}

/** Retseptdagi bitta dori */
export interface PrescriptionItem {
  medicineName: string
  /** "1 tabletkadan kuniga 3 mahal, 5 kun" */
  dosage: string
  quantity: number
}

/**
 * RETSEPT — klinikadan aptekaga.
 *
 * Shifokor tashrifda yozadi, apteka ro'yxatda ko'radi. Bu ikki
 * biznesni bir-biriga bog'laydigan yagona nuqta va aynan shuning
 * uchun apteka klinika ichida turibdi.
 */
export interface Prescription {
  id: ID
  clinicId: ID
  patientId: ID
  patientName: string
  doctorName: string
  createdAt: ISODateTime
  items: PrescriptionItem[]
  status: 'pending' | 'dispensed' | 'expired'
  note: string
}

/** Kassadagi savat qatori — hali sotilmagan */
export interface CartLine {
  medicineId: ID
  name: string
  batchId: ID
  expiresAt: ISODate
  price: UZS
  quantity: number
  /** Zaxirada qancha qolgan — undan ortiq sotib bo'lmaydi */
  available: number
  prescriptionOnly: boolean
}

/** Katalog qatori: dori va uning umumiy zaxirasi */
export interface MedicineStock extends Medicine {
  /** Barcha partiyalardagi jami */
  inStock: number
  /** Eng yaqin tugaydigan muddat. `null` — zaxira yo'q. */
  nearestExpiry: ISODate | null
  /** Muddati 90 kundan kam qolgan miqdor */
  expiringSoon: number
}


/* ------------------------------------------------------------------ */
/* Smena va kassa nazorati                                             */
/* ------------------------------------------------------------------ */

/**
 * SMENA YOPILISHI.
 *
 * Kun oxirida sotuvchi kassadagi naqd pulni sanab kiritadi.
 *
 * TIZIM SUMMASI KO'RINIB TURADI va bu ataylab. Avval u
 * yashirilgan edi — "sanash ko'chirishga aylanmasin" degan
 * fikrda. Amalda teskarisi muhimroq bo'lib chiqdi: raqamni
 * ko'rib turgan odam undan KAM yozishga qo'rqadi, chunki farq
 * darhol ko'rinadi. Kam yozsa ogohlantiriladi, baribir davom
 * etsa — yozuv RAHBARGA ketadi va u shu holda belgilanadi.
 */
export interface PharmacyShift {
  id: ID
  clinicId: ID
  sellerId: ID
  sellerName: string
  date: ISODate
  /** Tizim hisoblagan naqd tushum */
  expectedCash: UZS
  /** Sotuvchi sanab kiritgan summa */
  countedCash: UZS
  /** counted − expected. Manfiy = kamomad. */
  difference: UZS
  /** Kartadan tushgan — sanalmaydi, lekin ko'rinib tursin */
  cardTotal: UZS
  receipts: number
  note: string
  /**
   * KASSA KIMGA TOPSHIRILDI.
   *
   * Aptekada kassa odamdan odamga o'tadi va aynan shu payt
   * javobgarlik ham o'tadi. Yozilmasa, ertasi kuni kamomad
   * chiqqanda "men olganimda shunday edi" degan gap boshlanadi
   * va uni tekshirib bo'lmaydi.
   *
   * `null` — kun oxiri, keyingi smena yo'q.
   */
  handedToId: ID | null
  handedToName: string
  /**
   * Sotuvchi ogohlantirishni ko'rib turib, KAM summa kiritdi.
   *
   * Rahbarning kassa nazorati ro'yxatida alohida belgilanadi:
   * tasodifiy kamomad bilan ataylab kiritilganini ajratish
   * kerak. Birinchisi har aptekada bo'ladi, ikkinchisi esa
   * suhbat talab qiladi.
   */
  flagged: boolean
  closedAt: ISODateTime
}

/** Apteka analitikasining bitta kuni */
export interface PharmacyDay {
  date: ISODate
  revenue: UZS
  profit: UZS
  receipts: number
}

/** Eng ko'p sotilgan dori */
export interface TopMedicine {
  medicineId: ID
  name: string
  quantity: number
  revenue: UZS
  profit: UZS
}

export interface PharmacyAnalytics {
  revenue: UZS
  profit: UZS
  receipts: number
  /** O'rtacha chek */
  averageReceipt: UZS
  /** Ustama foizi: foyda / tushum */
  marginPct: number
  byDay: PharmacyDay[]
  byMethod: { method: Sale['method']; total: UZS }[]
  top: TopMedicine[]
  /**
   * HARAKATSIZ TOVAR — davr ichida bir marta ham sotilmagani.
   *
   * Aptekaning eng jim yo'qotishi: pul javonda turibdi, muddati
   * esa ketyapti. Hisobotda alohida ko'rsatilmasa, uni hech kim
   * o'z-o'zidan sezmaydi.
   */
  dead: { medicineId: ID; name: string; quantity: number; value: UZS }[]
}


/* ------------------------------------------------------------------ */
/* Xodimlar                                                            */
/* ------------------------------------------------------------------ */

/**
 * APTEKA XODIMI.
 *
 * Klinikaning `Staff` yozuvidan ALOHIDA: apteka boshqa biznes va
 * uning xodimi klinika kadrlar ro'yxatida turishi shart emas.
 * Aralashtirilsa, klinika egasi o'z xodimlari ro'yxatida
 * farmatsevtni ko'rib, uning oyligini o'zgartira olardi —
 * holbuki apteka unga bo'ysunmaydi.
 */
export interface PharmacyStaff {
  id: ID
  clinicId: ID
  fullName: string
  phone: string
  /** Tizimga kirish uchun */
  login: string
  role: 'pharmacist' | 'pharmacy_owner'
  /** Oylik maosh, so'mda */
  salary: UZS
  /** Ish kunlari: 0 — yakshanba, 6 — shanba */
  workdays: number[]
  /**
   * Ish vaqti, `09:00` ko'rinishida.
   *
   * NEGA KERAK: "hozir kim smenada" degan savolga javob shundan
   * chiqadi. Usiz ikki sotuvchi bir vaqtda kassaga kirib, bir
   * kunning savdosi ikkiga bo'linib ketardi va kassa nazorati
   * kimni tekshirayotganini bilmay qolardi.
   *
   * Tunda tugaydigan smena ham bo'ladi (20:00 — 08:00): oxiri
   * boshidan kichik bo'lsa, u ertangi kunga o'tadi.
   */
  shiftStart: string
  shiftEnd: string
  status: 'active' | 'fired'
  hiredAt: ISODate
  /**
   * KIRIM QABUL QILA OLADIMI.
   *
   * Sotuvchiga alohida biriktiriladi. Sababi oddiy: kichik
   * aptekada tovarni ertalab kim bo'lsa o'sha qabul qiladi,
   * kattasida esa buni faqat bir-ikki odam qiladi va narxni
   * hamma belgilay olmasligi kerak.
   *
   * Rahbarda bu huquq doim bor — u alohida biriktirilmaydi.
   */
  canReceive: boolean
}

/**
 * Xodimning ish natijasi.
 *
 * Kassa farqi ALOHIDA ikki songa bo'lingan: kam va ortiq. Ularni
 * qo'shib bitta songa keltirsak, bir kuni 50 000 kam, boshqasida
 * 50 000 ortiq chiqqan odam "farqsiz" bo'lib ko'rinardi —
 * holbuki ikkala kun ham tekshirishga arziydi.
 */
export interface PharmacyStaffStats {
  staffId: ID
  /** Necha kun smena yopgan */
  daysWorked: number
  receipts: number
  revenue: UZS
  profit: UZS
  /** Xizmat ko'rsatilgan odam soni — cheklar soni bilan bir xil */
  customers: number
  /** Jami kamomad (musbat son) */
  cashShort: UZS
  /** Jami ortiqcha */
  cashOver: UZS
  /** Farq chiqqan kunlar soni */
  gapDays: number
  /** O'rtacha kunlik savdo */
  dailyAverage: UZS
}


/* ------------------------------------------------------------------ */
/* Kirim — tovar bazaga SHU YERDAN tushadi                             */
/* ------------------------------------------------------------------ */

/**
 * Kirimning bitta qatori.
 *
 * PARTIYA AYNAN SHU YERDA TUG'ILADI: muddat, tannarx va miqdor
 * bir joyda kiritiladi. Ularni keyin alohida tahrirlash yo'li
 * ataylab yo'q — tannarx o'zgartirilsa, allaqachon sotilgan
 * tovarning foydasi qayta hisoblanib ketardi.
 */
export interface PurchaseItem {
  medicineId: ID
  medicineName: string
  batchCode: string
  expiresAt: ISODate
  quantity: number
  buyPrice: UZS
  /** Kirim paytida belgilangan sotuv narxi */
  sellPrice: UZS
}

/**
 * Ta'minotchiga to'lov holati.
 *
 * NEGA KERAK: aptekaga tovar ko'pincha NASIYA keladi. Bu yozilmasa,
 * apteka o'zining qancha qarzi borligini umuman bilmaydi — javonda
 * tovar turadi, pul esa qachon to'lanishi kerakligi faqat
 * ta'minotchining daftarida qoladi.
 */
export type PurchasePayment = 'paid' | 'partial' | 'credit'

export interface Purchase {
  id: ID
  clinicId: ID
  supplierId: ID | null
  supplierName: string
  /** Ta'minotchining hujjat raqami */
  invoiceNumber: string
  receivedAt: ISODate
  items: PurchaseItem[]
  /** Jami tannarx */
  total: UZS
  payment: PurchasePayment
  /** To'langan summa. `credit` da 0, `paid` da `total` ga teng. */
  paidAmount: UZS
  /** Nasiya bo'lsa — to'lash muddati */
  dueDate: ISODate | null
  /**
   * HUJJAT RASMLARI — накладная, hisob-faktura, sertifikat.
   *
   * Tortishuvda yagona dalil shu bo'ladi: ta'minotchi "men
   * yubormadim" desa yoki summa boshqacha chiqsa, qog'oz
   * hujjatni qidirib topish o'rniga shu yerdan ochiladi.
   * Nazoratchi ham partiya sertifikatini so'raydi.
   */
  documents: string[]
  /** Kim qabul qilgan */
  receivedById: ID
  receivedByName: string
  note: string
  createdAt: ISODateTime
}

/** Yangi ta'minotchi — kirim oynasining ichida ochiladi */
export interface SupplierInput {
  name: string
  phone: string
  inn: string
  note: string
}

/** Yangi dori — katalogda hali yo'q bo'lsa kirimda ochiladi */
export interface MedicineInput {
  name: string
  form: MedicineForm
  manufacturer: string
  country: string
  barcode: string
  unit: string
  prescriptionOnly: boolean
  sellPrice: UZS
}
