/**
 * Hisobotlarni CSV sifatida yuklab olish.
 *
 * NEGA CSV: egasi raqamlarni Excel yoki Google Sheets'da ochib, o'zicha
 * hisob-kitob qilishi kerak. PDF chiroyli, lekin u bilan ishlab
 * bo'lmaydi. CSV esa har qanday jadval dasturida ochiladi.
 *
 * Excel UTF-8 ni o'zi tanimaydi, shuning uchun fayl boshiga BOM
 * qo'yiladi — aks holda kirill va o'zbek harflari buziladi.
 */

const BOM = '﻿'

/** Bitta katakni CSV qoidalariga moslash */
function escapeCell(value: string | number): string {
  const text = String(value ?? '')
  // Vergul, qo'shtirnoq yoki yangi qator bo'lsa — qo'shtirnoqqa olamiz
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Qatorlarni CSV matniga aylantirish.
 *
 * Ajratgich sifatida NUQTALI VERGUL ishlatiladi: rus va o'zbek tilidagi
 * Excel'da o'nlik ajratgich vergul bo'lgani uchun oddiy vergul bilan
 * fayl noto'g'ri ochiladi.
 */
function toCsv(rows: (string | number)[][]): string {
  return BOM + rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

/**
 * Faylni yuklab olish.
 *
 * Blob orqali — server kerak emas, hammasi brauzerda bajariladi.
 */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Xotirani bo'shatamiz
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Fayl nomiga sana qo'shish: "daromad-2026-09-02.csv" */
export function datedFilename(base: string): string {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return `${base}-${stamp}.csv`
}

/**
 * Serverdan kelgan tayyor CSV matnini saqlash.
 *
 * Matn allaqachon to'g'ri yozilgan (BOM, nuqtali vergul) — bu yerda
 * unga tegilmaydi, faqat fayl qilib beriladi.
 */
export function downloadCsvText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * CSV O'QISH (demo rejim uchun).
 *
 * Serverda o'zining o'qish qismi bor (`src/import/csv-parse.ts`) —
 * bu esa faqat demoda, fayl brauzerda ochilganda ishlaydi. Qoida bir
 * xil: ajratgich fayldan aniqlanadi, qo'shtirnoq ichidagi ajratgich
 * qatorni bo'lib yubormaydi.
 */
export function parseCsvText(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const best = [';', ',', '\t']
    .map((sep) => ({ sep, count: firstLine.split(sep).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]
  const delimiter = best.count > 0 ? best.sep : ';'

  const table: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      table.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    table.push(row)
  }

  if (table.length === 0) return []
  const headers = table[0].map((header) => header.trim())

  return table
    .slice(1)
    .filter((line) => line.some((value) => value.trim() !== ''))
    .map((line) => {
      const out: Record<string, string> = {}
      headers.forEach((header, position) => {
        out[header] = (line[position] ?? '').trim()
      })
      return out
    })
}
