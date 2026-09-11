/**
 * Kirish va tanishtiruv sahifalarining belgilari.
 *
 * Tasdiqlangan dizayndagi SVG to'plami aynan ko'chirilgan — chiziq
 * qalinligi va burchaklari `.icon` uslubiga moslab chizilgan, shuning
 * uchun ilovadagi lucide belgilari bilan almashtirilmagan: ular
 * boshqacha ko'rinardi.
 */

export type PublicIconName =
  | 'pulse'
  | 'arrow'
  | 'login'
  | 'calendar'
  | 'users'
  | 'wallet'
  | 'grid'
  | 'chart'
  | 'settings'
  | 'check'
  | 'telegram'
  | 'shield'
  | 'globe'
  | 'lock'
  | 'doctor'
  | 'bed'
  | 'menu'
  | 'eye'

export function Icon({ name }: { name: PublicIconName }) {
  return (
    <svg className="icon" aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  )
}

/** Sahifada BIR MARTA qo'yiladi — `Icon` shu yerdagi belgilarga murojaat qiladi */
export function IconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="0"
      height="0"
      aria-hidden="true"
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        <symbol id="i-pulse" viewBox="0 0 24 24">
          <path d="M3 12h4l3-7 4 14 3-7h4" />
        </symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </symbol>
        <symbol id="i-login" viewBox="0 0 24 24">
          <path d="M10 5H5v14h5m4-14h5v14h-5M9 12h10m-4-4 4 4-4 4" />
        </symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" />
        </symbol>
        <symbol id="i-users" viewBox="0 0 24 24">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" />
        </symbol>
        <symbol id="i-wallet" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="15" rx="3" />
          <path d="M3 9h18m-5 4h5v4h-5z" />
        </symbol>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </symbol>
        <symbol id="i-chart" viewBox="0 0 24 24">
          <path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-7" />
        </symbol>
        <symbol id="i-settings" viewBox="0 0 24 24">
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="3" />
          <circle cx="15" cy="17" r="3" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="m5 12 4 4L19 6" />
        </symbol>
        <symbol id="i-telegram" viewBox="0 0 24 24">
          <path d="m21 3-4 18-6-5-4 3 1-7-6-2 19-7ZM8 12 17 7l-6 9" />
        </symbol>
        <symbol id="i-shield" viewBox="0 0 24 24">
          <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
          <path d="m8 12 3 3 5-6" />
        </symbol>
        <symbol id="i-globe" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18" />
        </symbol>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <rect x="5" y="10" width="14" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
        </symbol>
        <symbol id="i-doctor" viewBox="0 0 24 24">
          <path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4m6 0h4m-7 10v3a5 5 0 0 0 10 0v-3" />
          <circle cx="20" cy="10" r="3" />
        </symbol>
        <symbol id="i-bed" viewBox="0 0 24 24">
          <path d="M3 5v15m18-11v11M3 16h18M7 9h11a3 3 0 0 1 3 3v4" />
          <rect x="3" y="9" width="5" height="5" rx="1" />
        </symbol>
        <symbol id="i-menu" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </symbol>
        <symbol id="i-eye" viewBox="0 0 24 24">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </symbol>
      </defs>
    </svg>
  )
}
