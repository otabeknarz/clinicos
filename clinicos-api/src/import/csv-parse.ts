/**
 * CSV O'QISH.
 *
 * Excel'dan kelgan fayl uchta joyda "o'ziga xos" bo'ladi:
 *
 *   1. Ajratgich — bizdagi Excel nuqtali vergul yozadi, ingliz
 *      versiyasi vergul, ba'zan tab. Shuning uchun u FAYLNING
 *      O'ZIDAN aniqlanadi, so'rovda berilmaydi.
 *   2. BOM — fayl boshidagi ko'rinmas belgi. Olib tashlanmasa,
 *      birinchi ustun nomi hech qaysi sarlavhaga to'g'ri kelmaydi.
 *   3. Qo'shtirnoq ichidagi vergul va yangi qator — matn ichidagi
 *      ajratgich qatorni bo'lib yubormasligi kerak.
 *
 * Tashqi kutubxona olinmadi: qoida qisqa, xatti-harakati esa
 * bizga to'liq ma'lum bo'lishi kerak — import bazaga yozadi.
 */

export interface CsvTable {
  headers: string[]
  /** Har bir qator: sarlavha → qiymat */
  rows: Record<string, string>[]
}

/** Eng ko'p uchraydigan ajratgichni tanlaydi */
function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [';', ',', '\t'].map((sep) => ({
    sep,
    count: line.split(sep).length - 1,
  }))
  counts.sort((a, b) => b.count - a.count)
  return counts[0].count > 0 ? counts[0].sep : ';'
}

/** Bitta qatorni kataklarga bo'ladi (qo'shtirnoqni hisobga olib) */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
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
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const table = parseRows(clean, detectDelimiter(clean))
  if (table.length === 0) return { headers: [], rows: [] }

  const headers = table[0].map((header) => header.trim())
  const rows: Record<string, string>[] = []

  for (const line of table.slice(1)) {
    /* Bo'sh qator — Excel fayl oxiriga qo'shib qo'yadi */
    if (line.every((cell) => cell.trim() === '')) continue

    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (line[index] ?? '').trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}
