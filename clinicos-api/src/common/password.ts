import { randomBytes } from 'node:crypto'

/**
 * Vaqtinchalik parol.
 *
 * O'xshash belgilar (0/O, 1/l/I) yo'q: parol qog'ozga yozilib yoki
 * telefonda aytib beriladi va noto'g'ri o'qilgan belgi odamni
 * kirishdan to'sib qo'yardi. Egasi kirgach uni almashtiradi.
 */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join('')
}
