import { createHmac, timingSafeEqual } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

/**
 * TELEGRAM — mini app va bot xabarlari.
 *
 * Mobil versiya Telegram mini app ichida ochiladi, ya'ni bot orqali
 * xodimning telefoniga xabar yuborish mumkin. Ilova ichidagi
 * bildirishnoma faqat ilova ochilganda ko'rinadi; bu esa telefonni
 * jiringlatadi.
 *
 * TOKEN BO'LMASA HAMMA NARSA ISHLAYVERADI. `TELEGRAM_BOT_TOKEN`
 * o'rnatilmagan bo'lsa (mahalliy ishlab chiqishda odatda shunday),
 * tekshirish rad etadi va yuborish jimgina o'tkazib yuboriladi —
 * xuddi `S3_*` yo'q bo'lganda fayl yuklash 503 qaytarib, qolgan
 * hamma narsa ishlagani kabi.
 */
@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name)

  private get token(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
  }

  get enabled(): boolean {
    return this.token !== null
  }

  /**
   * Webhook maxfiy kaliti.
   *
   * `POST /telegram/webhook` OCHIQ marshrut bo'lishi shart —
   * Telegram'da bizning tokenimiz yo'q. Ochiq qoldirilsa, har kim
   * o'zini Telegram deb ko'rsatib bot nomidan xabar yozdirardi.
   * Telegram har so'rovda `X-Telegram-Bot-Api-Secret-Token`
   * sarlavhasini qaytaradi — biz `setWebhook` da bergan qiymatni.
   */
  private get webhookSecret(): string | null {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null
  }

  /**
   * Mini app manzili.
   *
   * Alohida o'zgaruvchi ochmadik: `CORS_ORIGIN` da allaqachon
   * ilovaning haqiqiy manzili turibdi va ikkitasi bir-biridan
   * uzilib qolsa, tugma ishlamay qolardi.
   */
  private get appUrl(): string {
    const fromCors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
    return fromCors || 'https://clinic-os.uz'
  }

  /**
   * Webhook so'rovi HAQIQATAN Telegram'danmi.
   *
   * Kalit o'rnatilmagan bo'lsa RAD ETAMIZ. "Kalit yo'q — hammaga
   * ruxsat" degan yumshoq yo'l bu yerda xavfli: sozlash unutilsa
   * marshrut jimgina ochiq qolardi.
   */
  webhookAllowed(headerValue: string | undefined): boolean {
    const secret = this.webhookSecret
    if (!secret || !headerValue) return false

    const a = Buffer.from(secret)
    const b = Buffer.from(headerValue)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  /**
   * Botga kelgan xabarga javob.
   *
   * NEGA UMUMAN KERAK: Telegram bot O'ZI birinchi bo'lib yoza
   * olmaydi — odam avval bot bilan suhbatni ochishi kerak. Ya'ni
   * `/start` bosilmagan shifokorga qabul haqidagi xabar HECH
   * QACHON yetib bormaydi va sababi hech qayerda ko'rinmaydi
   * (`send()` 403 ni `debug` ga yozadi, xolos).
   *
   * Shuning uchun bot har qanday xabarga bir xil javob beradi:
   * qisqa izoh va ilovani ochadigan tugma. Buyruqlar ro'yxati
   * yo'q — botning vazifasi bitta.
   */
  async handleUpdate(update: unknown): Promise<void> {
    const message = (update as { message?: { chat?: { id?: number } } })?.message
    const chatId = message?.chat?.id
    if (!chatId) return

    await this.send(
      String(chatId),
      [
        '<b>ClinicOS</b>',
        '',
        'Ilova shu bot ichida ochiladi. Yangi bemor yozilsa,',
        'shu yerga xabar keladi.',
      ].join('\n'),
      {
        inline_keyboard: [
          [{ text: 'Ilovani ochish', web_app: { url: this.appUrl } }],
        ],
      },
    )
  }

  /**
   * Mini app yuborgan `initData` ni tekshiradi va Telegram id qaytaradi.
   *
   * Telegram hujjatidagi tartib: `hash` ajratib olinadi, qolgan
   * maydonlar alifbo tartibida `key=value` bo'lib qatorga yig'iladi,
   * kalit esa `HMAC_SHA256("WebAppData", bot_token)` bo'ladi.
   *
   * NEGA IMZO SHART: `initData` ni mijoz yuboradi, ya'ni uni qo'lda
   * yozib ham bo'ladi. Imzosiz ishonsak, har kim istagan Telegram
   * id'ni "meniki" deb ko'rsatib, boshqa odamning hisobiga
   * bog'lanib olardi.
   */
  verifyInitData(initData: string): { telegramUserId: string } | null {
    const token = this.token
    if (!token || !initData) return null

    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null

    params.delete('hash')

    const dataCheckString = [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n')

    const secret = createHmac('sha256', 'WebAppData').update(token).digest()
    const computed = createHmac('sha256', secret).update(dataCheckString).digest('hex')

    /*
      Taqqoslash VAQT BO'YICHA BARQAROR: oddiy `===` birinchi farqli
      belgida to'xtaydi va javob vaqti bo'yicha imzoni bitta-bitta
      topib olish mumkin bo'lardi.
    */
    const a = Buffer.from(computed, 'hex')
    const b = Buffer.from(hash, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    /*
      ESKIRISH TEKSHIRUVI. `auth_date` — imzo qo'yilgan payt. Usiz bir
      marta qo'lga tushgan `initData` abadiy ishlab turardi.
    */
    const authDate = Number(params.get('auth_date') ?? 0)
    const ageHours = (Date.now() / 1000 - authDate) / 3600
    if (!authDate || ageHours > 24) return null

    try {
      const user = JSON.parse(params.get('user') ?? '{}') as { id?: number }
      return user.id ? { telegramUserId: String(user.id) } : null
    } catch {
      return null
    }
  }

  /**
   * Xabar yuboradi. HECH QACHON XATO TASHLAMAYDI.
   *
   * Chaqiruvchi joy — qabul yaratish. Telegram sekinlashsa yoki
   * yiqilsa, registrator bemorni yozolmay qolishi mumkin emas:
   * xabar qulaylik, qabul esa ishning o'zi. Shuning uchun xato
   * faqat jurnalga yoziladi.
   */
  async send(
    telegramUserId: string,
    text: string,
    replyMarkup?: unknown,
  ): Promise<void> {
    const token = this.token
    if (!token || !telegramUserId) return

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        /* Osilib qolmasin — qabul yaratish shuni kutib turmaydi */
        signal: AbortSignal.timeout(5000),
      })

      if (!res.ok) {
        /*
          403 — odam botni bloklagan yoki hech qachon ochmagan. Bu
          xato emas, odatiy holat; shuning uchun `warn` emas `debug`.
        */
        const level = res.status === 403 ? 'debug' : 'warn'
        this.log[level](`Telegram ${res.status}: ${await res.text()}`)
      }
    } catch (error) {
      this.log.warn(`Telegram yuborilmadi: ${String(error)}`)
    }
  }
}
