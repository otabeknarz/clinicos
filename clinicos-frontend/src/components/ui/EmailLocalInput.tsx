import { TextInput } from './Form'

/**
 * PLATFORMA EMAIL DOMENI.
 *
 * Barcha hisoblar shu domenda ochiladi: `nom@clinic-os.uz`. Domenni
 * qo'lda yozdirmaymiz — u har safar bir xil, ya'ni terish faqat
 * xatolik manbai bo'lardi (`.uz` o'rniga `.ru`, ortiqcha bo'shliq,
 * bosh harf).
 *
 * NEGA MUHIM: email hisобning KALITI. Bitta noto'g'ri belgi bilan
 * ochilgan hisobga odam kira olmaydi va sababi ko'rinmaydi —
 * "email yoki parol noto'g'ri" degan xabar ikkalasiga ham bir xil.
 */
export const PLATFORM_EMAIL_DOMAIN = 'clinic-os.uz'

/** `nom@clinic-os.uz` dan faqat `nom` qismini ajratadi */
export function emailLocalPart(email: string): string {
  return email.split('@')[0] ?? ''
}

/** Terilgan nomdan to'liq email yasaydi */
export function buildPlatformEmail(local: string): string {
  return `${local.trim().toLowerCase()}@${PLATFORM_EMAIL_DOMAIN}`
}

/**
 * Faqat nom qismi teriladigan email maydoni.
 *
 * Domen o'ng tomonda o'zgarmas yozuv bo'lib turadi — ya'ni u
 * ko'rinadi, lekin unga tegib bo'lmaydi.
 */
export function EmailLocalInput({
  label,
  value,
  onChange,
  error,
  hint,
  required,
}: {
  label: string
  /** Faqat nom qismi, `@` siz */
  value: string
  onChange: (local: string) => void
  error?: string
  hint?: string
  required?: boolean
}) {
  return (
    <TextInput
      label={label}
      value={value}
      required={required}
      error={error}
      hint={hint}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="ism.familiya"
      suffix={<span className="text-footnote text-label-tertiary">@{PLATFORM_EMAIL_DOMAIN}</span>}
      onChange={(e) => {
        /*
          `@` va bo'shliq TERILMAYDI: domen allaqachon yozib
          qo'yilgan, ikkinchisi esa `nom@x@clinic-os.uz` kabi
          buzuq qiymat berardi.
        */
        const clean = e.target.value
          .toLowerCase()
          .replace(/[@\s]/g, '')
          .slice(0, 64)
        onChange(clean)
      }}
    />
  )
}
