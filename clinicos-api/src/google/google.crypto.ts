import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * GOOGLE TOKENINI SHIFRLASH.
 *
 * `refreshToken` — muddatsiz kalit: u bilan istalgan vaqtda
 * klinikaning Google hisobiga kirib bo'ladi. Bazada ochiq yotsa,
 * baza nusxasi (zaxira, dump, o'g'irlangan disk) shu zahoti
 * hisobga kirish huquqiga aylanardi.
 *
 * Kalit `JWT_SECRET` dan chiqariladi: yangi sir qo'shilsa uni
 * serverga alohida o'rnatish kerak bo'lardi va unutilardi. Sir
 * almashsa, ulangan Google hisoblari qaytadan ulanadi — bu
 * kutilgan xatti-harakat (sir almashganda sessiyalar ham uziladi).
 */
const ALGORITHM = 'aes-256-gcm'

function keyOf(): Buffer {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET yo‘q — Google tokenini shifrlab bo‘lmaydi')
  /* Qat'iy tuz: kalit har safar bir xil chiqishi kerak */
  return scryptSync(secret, 'clinicos.google', 32)
}

export function encryptToken(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, keyOf(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  /* iv.tag.matn — uchalasi birga saqlanadi */
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptToken(value: string): string {
  const [iv, tag, payload] = value.split('.')
  if (!iv || !tag || !payload) throw new Error('Google tokeni buzilgan')

  const decipher = createDecipheriv(ALGORITHM, keyOf(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8')
}
