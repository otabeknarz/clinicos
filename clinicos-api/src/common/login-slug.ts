/**
 * PLATFORMA LOGINI: `nom@clinic-os.uz`.
 *
 * Platforma admini klinika ochganda loginni qo'lda yozadi. O'zi ro'yxatdan
 * o'tgan klinika uchun esa login klinika nomidan yasaladi — aks holda egasi
 * faqat telefon bilan qolardi, admin panelda esa login ustuni bo'sh turardi.
 */
export const PLATFORM_EMAIL_DOMAIN = 'clinic-os.uz'

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

/** "Shifo-Med klinikasi" → "shifo.med.klinikasi" (ko'pi bilan 24 belgi) */
export function loginBase(name: string): string {
  const latin = [...name.toLowerCase()]
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join('')
    .replace(/[ʻʼ'’`‘]/g, '')

  const slug = latin
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)
    .replace(/\.+$/g, '')

  return slug.length >= 3 ? slug : 'klinika'
}

export function platformEmail(local: string): string {
  return `${local}@${PLATFORM_EMAIL_DOMAIN}`
}
