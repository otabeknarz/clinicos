import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'

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
/**
 * Qaysi bot.
 *
 * `staff` — xodimlar ilovasi va shifokorga keladigan xabarlar.
 * `patient` — bemor kabineti, butunlay alohida bot va token.
 */
export type BotKind = 'staff' | 'patient'

/** Ulanish kodining amal qilish muddati */
const LINK_CODE_TTL_MS = 15 * 60 * 1000

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name)

  /**
   * BIR MARTALIK ULANISH KODLARI.
   *
   * Xotirada, bazada emas — ataylab. Kod 15 daqiqa yashaydi va
   * bir marta ishlatiladi, ya'ni saqlashga arzimaydi; server
   * qayta yuklansa odam tugmani yana bosadi, xolos. Buning
   * evaziga migratsiya ham, tozalab turadigan fon vazifasi ham
   * kerak emas.
   *
   * SHART: API bitta nusxada ishlaydi. Ikkinchi nusxa qo'shilsa
   * kod boshqa nusxaga tushib qolishi mumkin — o'shanda bu
   * jadvalga ko'chiriladi.
   */
  private readonly linkCodes = new Map<string, { userId: string; expiresAt: number }>()

  /** Bot foydalanuvchi nomlari — `getMe` dan bir marta olinadi */
  private botUsername: Record<BotKind, string | null> = {
    staff: null,
    patient: null,
  }

  /*
    IKKITA BOT, IKKITA TOKEN.

    Xodimlar boti ilovani ochadi va shifokorga xabar yuboradi.
    Bemor boti esa butunlay boshqa dunyo: unda bemor o'z
    kartasini ko'radi.

    NEGA BIR BOTDA EMAS: `initData` imzosi bot tokeni bilan
    tekshiriladi. Bitta token bo'lsa, bemor botida imzolangan
    qator xodim ilovasida ham haqiqiy hisoblanardi — ya'ni
    kimdir bemor sifatida kirib, xodim marshrutlariga token
    so'rab ko'rishi mumkin bo'lardi. Ikki token bunday
    savolning o'zini yo'q qiladi.
  */
  private tokenOf(bot: BotKind): string | null {
    const name = bot === 'patient' ? 'PATIENT_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN'
    return process.env[name]?.trim() || null
  }

  private get token(): string | null {
    return this.tokenOf('staff')
  }

  get enabled(): boolean {
    return this.token !== null
  }

  get patientEnabled(): boolean {
    return this.tokenOf('patient') !== null
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
  private webhookSecretOf(bot: BotKind): string | null {
    const name =
      bot === 'patient' ? 'PATIENT_WEBHOOK_SECRET' : 'TELEGRAM_WEBHOOK_SECRET'
    return process.env[name]?.trim() || null
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
  webhookAllowed(headerValue: string | undefined, bot: BotKind = 'staff'): boolean {
    const secret = this.webhookSecretOf(bot)
    if (!secret || !headerValue) return false

    const a = Buffer.from(secret)
    const b = Buffer.from(headerValue)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  /**
   * Foydalanuvchiga bir martalik ulanish kodi beradi.
   *
   * NEGA KERAK: mini app ichida ulanish O'ZIDAN bo'ladi, lekin
   * ilovani brauzerdan ochgan shifokor hech qachon ulanmasdi va
   * buni bilmasdi ham — xabar shunchaki kelmasdi. Bundan
   * tashqari bot O'ZI birinchi bo'lib yoza olmaydi: odam bot
   * bilan suhbatni ochishi shart. Kod bilan havola ikkalasini
   * bir vaqtda hal qiladi — odam botni ochadi (suhbat boshlanadi)
   * va kod hisobni bog'laydi.
   */
  issueLinkCode(userId: string): string {
    this.sweepLinkCodes()
    /* base64url — Telegram `start` parametrida faqat shu belgilar mumkin */
    const code = randomBytes(9).toString('base64url')
    this.linkCodes.set(code, { userId, expiresAt: Date.now() + LINK_CODE_TTL_MS })
    return code
  }

  /** Kodni ishlatadi va egasini qaytaradi. Ikkinchi marta ishlamaydi. */
  consumeLinkCode(code: string): string | null {
    this.sweepLinkCodes()
    const found = this.linkCodes.get(code)
    if (!found) return null
    this.linkCodes.delete(code)
    return found.expiresAt > Date.now() ? found.userId : null
  }

  private sweepLinkCodes(): void {
    const now = Date.now()
    for (const [code, value] of this.linkCodes) {
      if (value.expiresAt <= now) this.linkCodes.delete(code)
    }
  }

  /**
   * Botning foydalanuvchi nomi (`@` siz).
   *
   * Alohida o'zgaruvchi ochmadik: nom tokenning O'ZIDAN kelib
   * chiqadi va ikkitasi bir-biriga to'g'ri kelmasa, havola
   * boshqa botga olib borardi.
   */
  async username(bot: BotKind = 'staff'): Promise<string | null> {
    const cached = this.botUsername[bot]
    if (cached) return cached

    const token = this.tokenOf(bot)
    if (!token) return null

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(5000),
      })
      const data = (await res.json()) as { result?: { username?: string } }
      this.botUsername[bot] = data.result?.username ?? null
      return this.botUsername[bot]
    } catch (error) {
      this.log.warn(`Bot nomi olinmadi: ${String(error)}`)
      return null
    }
  }

  /**
   * Mini appning ichidagi sahifaga olib boradigan manzil.
   *
   * Xabardagi tugma shuni ochadi — shifokor ilovani qidirib,
   * ro'yxatdan bemorni topib o'tirmasin.
   */
  appLink(path: string): string {
    return `${this.appUrl}${path}`
  }

  /**
   * Botga kelgan xabar.
   *
   * `ownPhone` — "raqamni ulashish" tugmasi bosilganda to'ladi va
   * u ro'yxatdan o'tishni tasdiqlaydi. `contact.user_id ===
   * from.id` TEKSHIRUVI SHART: Telegram odamning O'ZINIKI emas,
   * adres daftaridagi boshqa kontaktni ham yuborishga ruxsat
   * beradi — tekshirilmasa, birovning raqami bilan hisob ochib
   * ketish yo'li ochiq qolardi. Bemor botida ham shu qoida.
   */
  parseMessage(
    update: unknown,
  ): { chatId: string; text: string; ownPhone: string | null } | null {
    const message = (
      update as {
        message?: {
          chat?: { id?: number }
          from?: { id?: number }
          text?: string
          contact?: { phone_number?: string; user_id?: number }
        }
      }
    )?.message

    const chatId = message?.chat?.id
    if (!chatId) return null

    const contact = message.contact
    const ownPhone =
      contact?.phone_number && contact.user_id && contact.user_id === message.from?.id
        ? contact.phone_number
        : null

    return { chatId: String(chatId), text: (message.text ?? '').trim(), ownPhone }
  }

  /**
   * Bemor botiga kelgan xabar.
   *
   * `contact` — "raqamni ulashish" tugmasi bosilganda keladi.
   *
   * `contact.user_id === from.id` TEKSHIRUVI SHART: Telegram'da
   * odam O'ZINING emas, ADRES DAFTARIDAGI boshqa odamning
   * kontaktini ham yubora oladi. Tekshirilmasa, kimdir tanishining
   * raqamini yuborib uning tibbiy kartasini ochib olardi.
   */
  parsePatientMessage(
    update: unknown,
  ): { chatId: string; text: string; ownPhone: string | null } | null {
    const message = (
      update as {
        message?: {
          chat?: { id?: number }
          from?: { id?: number }
          text?: string
          contact?: { phone_number?: string; user_id?: number }
        }
      }
    )?.message

    const chatId = message?.chat?.id
    if (!chatId) return null

    const contact = message.contact
    const ownPhone =
      contact?.phone_number && contact.user_id && contact.user_id === message.from?.id
        ? contact.phone_number
        : null

    return { chatId: String(chatId), text: (message.text ?? '').trim(), ownPhone }
  }

  /** `/start KOD` dan kodni ajratadi */
  startPayload(text: string): string {
    const [command, payload] = text.split(/\s+/)
    return command === '/start' && payload ? payload : ''
  }

  /**
   * Botga kelgan xabarga javob.
   *
   * Bot har qanday xabarga javob beradi — javobsiz bot buzuq
   * bot bo'lib ko'rinadi. Buyruqlar ro'yxati yo'q: botning
   * vazifasi bitta.
   */
  async sendWelcome(chatId: string, linked: boolean): Promise<void> {
    await this.send(
      chatId,
      linked
        ? [
            '<b>Hisob ulandi</b>',
            '',
            'Endi sizga bemor yozilsa, shu yerga xabar keladi.',
          ].join('\n')
        : [
            '<b>ClinicOS</b>',
            '',
            'Ilova shu bot ichida ochiladi.',
            '',
            'Xabar kelishi uchun ilovaga kiring:',
            'Sozlamalar -> Telegram -> Ulash.',
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
  verifyInitData(
    initData: string,
    bot: BotKind = 'staff',
  ): { telegramUserId: string } | null {
    const token = this.tokenOf(bot)
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
    bot: BotKind = 'staff',
  ): Promise<void> {
    const token = this.tokenOf(bot)
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
          403 — odam botni ochmagan yoki bloklagan. Ilgari bu `debug`
          ga yozilardi "odatiy holat" deb, lekin amalda AYNAN SHU
          holat "xabar kelmayapti" ning eng ko'p uchraydigan sababi
          bo'lib chiqdi va logda ko'rinmasdi. `debug` esa bu muhitda
          umuman chiqmaydi ekan.
        */
        this.log.warn(`Telegram ${res.status}: ${await res.text()}`)
      }
    } catch (error) {
      this.log.warn(`Telegram yuborilmadi: ${String(error)}`)
    }
  }
}
