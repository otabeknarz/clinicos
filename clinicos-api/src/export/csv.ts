/**
 * CSV YOZISH.
 *
 * Excel UTF-8 ni o'zi tanimaydi — fayl boshiga BOM qo'yiladi, aks
 * holda o'zbek va rus harflari buziladi. Ajratgich NUQTALI VERGUL:
 * bizdagi Excel'da o'nlik ajratgich vergul bo'lgani uchun oddiy
 * vergul bilan butun fayl bitta ustunga yopishib ochiladi.
 *
 * Frontenddagi `lib/csv.ts` ayni shu qoidada yozadi — brauzerdan
 * yuklangan fayl bilan serverdan olingani bir xil bo'lishi kerak.
 */
const BOM = '﻿'

/**
 * Bitta katak.
 *
 * FORMULA IN'YEKSIYASI. `=`, `+`, `-`, `@` bilan boshlangan matn
 * Excel'da FORMULA bo'lib ishga tushadi. Bemor ismi o'rniga
 * `=HYPERLINK(...)` yozib qo'yilsa, faylni ochgan buxgalterning
 * kompyuterida o'sha narsa bajarilardi. Shunday katak oldiga
 * apostrof qo'yiladi — Excel uni oddiy matn deb oladi.
 */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  if (/[";\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return BOM + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')
}
