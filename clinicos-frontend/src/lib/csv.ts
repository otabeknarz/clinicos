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
