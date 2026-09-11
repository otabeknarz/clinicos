/**
 * SHTRIX-KOD.
 *
 * Aptekada ikkita kod uchraydi va ular boshqa-boshqa savolga
 * javob beradi:
 *
 *   EAN-13         — "bu QAYSI dori". Har bir qutida bir xil.
 *   GS1 DataMatrix — "bu AYNAN QAYSI quti": dori + partiya +
 *                    muddat + o'sha qutining yagona seriyasi.
 *
 * O'zbekistonda dorilar 2022-yildan beri "Asl Belgisi" tizimida
 * majburiy markirovka qilinadi va sotuvda aynan DataMatrix
 * skanerlanadi. Shuning uchun ikkalasi ham qo'llab-quvvatlanadi.
 */

/** GS1 kodidan ajratib olingan ma'lumot */
export interface Gs1Data {
  /** (01) — global tovar raqami */
  gtin: string
  /** (17) — muddati, `2027-12-15` ko'rinishida */
  expiresAt: string | null
  /** (10) — partiya raqami */
  batch: string | null
  /** (21) — shu qutining yagona seriyasi */
  serial: string | null
}

/**
 * GS1 ajratuvchi belgisi (FNC1).
 *
 * O'zgaruvchan uzunlikdagi maydonlar (partiya, seriya) shu belgi
 * bilan tugaydi. Skanerlar uni odatda `GS` (ASCII 29) qilib
 * beradi, ba'zilari esa `` yoki hatto `<GS>` matni bilan.
 */
const SEPARATORS = /|<GS>|␝/

/** Maydonlarning aniq uzunligi — ular ajratuvchisiz tugaydi */
const FIXED: Record<string, number> = {
  '01': 14, // GTIN
  '17': 6, // muddati YYMMDD
  '11': 6, // ishlab chiqarilgan sana
  '15': 6, // eng yaxshi sifat muddati
}

/**
 * `YYMMDD` → `2027-12-15`.
 *
 * Kun `00` bo'lishi mumkin — GS1 da bu "oyning oxirgi kuni"
 * degani. Uni 01 qilib qo'ysak, muddati bir oy oldin tugagandek
 * ko'rinardi.
 */
function gs1Date(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null

  const year = 2000 + Number(value.slice(0, 2))
  const month = Number(value.slice(2, 4))
  const day = Number(value.slice(4, 6))
  if (month < 1 || month > 12) return null

  const last = new Date(year, month, 0).getDate()
  const safeDay = day === 0 ? last : day
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(safeDay)}`
}

/**
 * GS1 qatorini ajratadi. GS1 bo'lmasa — `null`.
 *
 * Tanib olish belgisi: kod `01` bilan boshlanadi va undan keyin
 * 14 ta raqam keladi. Oddiy EAN-13 bunday bo'lishi mumkin emas —
 * u 13 ta raqam, xolos.
 */
export function parseGs1(raw: string): Gs1Data | null {
  const clean = raw.replace(/^\]d2/, '').trim()
  if (!/^01\d{14}/.test(clean)) return null

  const out: Gs1Data = { gtin: '', expiresAt: null, batch: null, serial: null }
  let rest = clean

  while (rest.length >= 2) {
    const ai = rest.slice(0, 2)
    rest = rest.slice(2)

    const fixed = FIXED[ai]
    let value: string

    if (fixed) {
      value = rest.slice(0, fixed)
      rest = rest.slice(fixed)
    } else {
      /* O'zgaruvchan uzunlik — ajratuvchigacha yoki oxirigacha */
      const parts = rest.split(SEPARATORS)
      value = parts[0]
      rest = parts.slice(1).join('')
    }

    if (ai === '01') out.gtin = value
    if (ai === '17') out.expiresAt = gs1Date(value)
    if (ai === '10') out.batch = value
    if (ai === '21') out.serial = value

    /* Ajratuvchi qolgan bo'lsa — tashlab yuboramiz */
    rest = rest.replace(new RegExp(`^(${SEPARATORS.source})`), '')
  }

  return out.gtin ? out : null
}

/**
 * Skanerdan kelgan qatordan QIDIRUV so'zini oladi.
 *
 * GS1 bo'lsa — GTIN, aks holda kodning o'zi. Kassa aynan shu
 * bilan qidiradi.
 */
export function searchTermFrom(raw: string): string {
  const gs1 = parseGs1(raw)
  if (!gs1) return raw.trim()

  /*
    GTIN 14 xonali, EAN-13 esa 13 xonali — GTIN oldiga bitta nol
    qo'shilgan holos. Katalogda EAN-13 saqlanadi, shuning uchun
    boshidagi nolni olib tashlaymiz.
  */
  return gs1.gtin.replace(/^0+/, '')
}

/** Brauzer kamerada shtrix-kod o'qiy oladimi */
export function scanSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

/**
 * O'qiladigan kod turlari.
 *
 * `data_matrix` birinchi: dorilarda majburiy bo'lgan kod aynan
 * shu. `ean_13` — katalog kodi. QR dorilarda ishlatilmaydi,
 * lekin ba'zi qadoqlarda uchraydi.
 */
export const SCAN_FORMATS = ['data_matrix', 'ean_13', 'ean_8', 'code_128', 'qr_code']
