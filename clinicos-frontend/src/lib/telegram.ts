/**
 * TELEGRAM MINI APP.
 *
 * Mobil versiya bot ichida ochiladi. Telegram sahifaga `initData`
 * beradi — imzolangan qator, ichida kim ochgani yozilgan.
 *
 * BIZ UNI O'QIMAYMIZ, faqat serverga uzatamiz: imzoni bot tokeni
 * bilan tekshirish kerak, token esa mijozda bo'lmasligi shart.
 */

interface TelegramWebApp {
  initData?: string
  ready?: () => void
  expand?: () => void
}

function webApp(): TelegramWebApp | null {
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
  return tg?.WebApp ?? null
}

/** Ilova Telegram ichida ochilganmi */
export function insideTelegram(): boolean {
  return Boolean(webApp()?.initData)
}

/**
 * Telegram'ga "tayyor" deb aytadi va oynani to'liq ochadi.
 *
 * Ilova o'zini ko'rsatmaguncha Telegram yuklanish ekranini ushlab
 * turadi; `ready()` chaqirilmasa u osilib qolgandek ko'rinadi.
 */
export function announceReady(): void {
  const app = webApp()
  app?.ready?.()
  app?.expand?.()
}

/** Serverga yuboriladigan imzolangan qator */
export function initData(): string | null {
  return webApp()?.initData || null
}
