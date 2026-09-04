import { Request } from 'express'

/**
 * So'rov kelgan manzil.
 *
 * Nginx yoki boshqa proksi orqasida `req.ip` proksining o'zini
 * ko'rsatadi, shuning uchun `X-Forwarded-For` ning BIRINCHI
 * qiymati olinadi.
 *
 * DASTURCHIGA: bu sarlavhani mijoz o'zi ham yubora oladi. Unga
 * ishonish uchun Nginx uni QAYTA YOZISHI kerak
 * (`proxy_set_header X-Forwarded-For $remote_addr`), aks holda
 * jurnaldagi manzil mijoz xohlagan narsa bo'ladi. Taxminiy
 * manzil yo'qdan yaxshi, lekin uni dalil sifatida ishlatishdan
 * oldin shuni sozlang.
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? null
}
