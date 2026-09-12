import { randomBytes } from 'node:crypto'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { ExportService } from '../export/export.service'
import { PrismaService } from '../prisma/prisma.service'
import { decryptToken, encryptToken } from './google.crypto'

/**
 * GOOGLE SHEETS INTEGRATSIYASI.
 *
 * Klinika o'z Google hisobini bir marta ulaydi, keyin istalgan
 * bo'limni bir bosishda jadvalga yuboradi. Jadval KLINIKANING
 * Drive'ida yaratiladi — ya'ni ma'lumot ularniki bo'lib qoladi,
 * bizda esa faqat jadval manzili saqlanadi.
 *
 * NEGA HAVOLA EMAS. Ilgari `=IMPORTDATA("...")` uchun maxfiy
 * havola berilardi: u ishlaydi, lekin tushuntirish talab qiladi va
 * havola qo'ldan-qo'lga o'tib ketishi mumkin. Google hisobi orqali
 * esa ruxsatni Google o'zi boshqaradi va odam tanish oynani ko'radi.
 *
 * RUXSAT ENG TORI: `drive.file` — tizim faqat O'ZI YARATGAN
 * fayllarni ko'radi. Klinikaning boshqa hujjatlariga kira olmaydi.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/** Jadvalga sig'adigan eng ko'p qator — Google chegarasi emas, sog'lom chegara */
const MAX_ROWS = 20_000

interface PendingState {
  clinicId: string
  userId: string
  userName: string
  expiresAt: number
}

@Injectable()
export class GoogleService {
  private readonly log = new Logger('Google')

  /*
    Ulash jarayonidagi vaqtinchalik holatlar — xotirada. Telegram
    ulash kodlari ham shunday: ular 10 daqiqa yashaydi va server
    qayta ko'tarilsa, odam tugmani qaytadan bosadi. Bu bitta
    konteyner uchun to'g'ri; ikkinchi nusxa qo'shilsa jadvalga
    ko'chirish kerak bo'ladi.
  */
  private readonly pending = new Map<string, PendingState>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly exports: ExportService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  private get config() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri:
        process.env.GOOGLE_REDIRECT_URI ?? 'https://api.clinic-os.uz/integrations/google/callback',
    }
  }

  /**
   * Holat: sozlanganmi va ulanganmi.
   *
   * `configured` — serverda kalitlar bormi. Yo'q bo'lsa interfeys
   * "sozlanmagan" deb yozadi: `S3_*` va Telegram ham shunday
   * ishlaydi — kalitsiz butun tizim emas, faqat shu imkoniyat
   * o'chadi.
   */
  async status() {
    const { clientId, clientSecret } = this.config
    const configured = Boolean(clientId && clientSecret)

    const account = await this.db.googleAccount.findFirst({
      select: { email: true, connectedByName: true, createdAt: true },
    })

    return {
      configured,
      connected: Boolean(account),
      email: account?.email ?? null,
      connectedBy: account?.connectedByName ?? null,
      connectedAt: toApiDateTime(account?.createdAt ?? null),
    }
  }

  /** Ulash oynasining manzili */
  connectUrl() {
    const { clientId, redirectUri } = this.config
    if (!clientId) {
      throw new ServiceUnavailableException('Google integratsiyasi serverda sozlanmagan')
    }

    const user = this.ctx.require()
    const state = randomBytes(24).toString('base64url')
    this.pending.set(state, {
      clinicId: user.clinicId,
      userId: user.userId,
      userName: '',
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    this.sweep()

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      /* `offline` + `consent` — uzoq muddatli kalit shundagina beriladi */
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    })

    return { url: `${AUTH_URL}?${params.toString()}` }
  }

  /**
   * Google qaytgan kod — hisobni saqlaymiz.
   *
   * Bu marshrut OCHIQ: Google bizning tokenimiz bilan kelmaydi.
   * Kim uchun ekanini `state` aytadi — u bizda yaratilgan va
   * 10 daqiqa yashaydi, ya'ni tashqaridan o'ylab topib bo'lmaydi.
   */
  async handleCallback(code: string, state: string) {
    const saved = this.pending.get(state)
    this.pending.delete(state)
    if (!saved || saved.expiresAt < Date.now()) {
      throw new BadRequestException('Ulash muddati tugadi — qaytadan urinib ko‘ring')
    }

    const tokens = await this.exchange(code)
    if (!tokens.refresh_token) {
      throw new BadRequestException('Google uzoq muddatli kalit bermadi — qaytadan ulang')
    }

    const email = await this.emailOf(tokens.access_token)
    const all = this.prisma.acrossAllClinics()

    const user = await all.user.findFirst({
      where: { id: saved.userId },
      select: { fullName: true },
    })

    await all.googleAccount.upsert({
      where: { clinicId: saved.clinicId },
      create: {
        clinicId: saved.clinicId,
        email,
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        connectedById: saved.userId,
        connectedByName: user?.fullName ?? '',
      },
      update: {
        email,
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        connectedById: saved.userId,
        connectedByName: user?.fullName ?? '',
      },
    })

    this.log.log(`Google ulandi: ${email}`)
    return { email }
  }

  async disconnect() {
    await this.db.googleAccount.deleteMany({})
    /*
      Jadvallar Drive'da QOLADI va ular klinikaniki. Biz faqat
      bog'lanishni unutamiz: odamning hujjatini o'chirish bizning
      ishimiz emas.
    */
    await this.db.googleSheet.deleteMany({})
    return { ok: true }
  }

  async sheets() {
    const rows = await this.db.googleSheet.findMany({ orderBy: { lastSyncAt: 'desc' } })
    return rows.map((row) => ({
      dataset: row.dataset,
      url: row.url,
      rows: row.rows,
      lastSyncAt: toApiDateTime(row.lastSyncAt),
    }))
  }

  /**
   * Bo'limni jadvalga yuborish.
   *
   * Jadval bor bo'lsa — o'sha yangilanadi, yo'q bo'lsa yaratiladi.
   * Har safar yangisini yaratsak, Drive'da "Bemorlar (1)",
   * "Bemorlar (2)" to'planib, qaysi biri yangi ekani bilinmasdi.
   */
  async sync(dataset: string, range: { from?: string; to?: string }) {
    const data = await this.exports.rowsFor(dataset, range)
    if (data.rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `Jadvalga ${MAX_ROWS} tagacha qator sig‘adi — sana oralig‘ini qisqartiring`,
      )
    }

    const token = await this.accessToken()
    const existing = await this.db.googleSheet.findFirst({ where: { dataset } })

    let spreadsheetId = existing?.spreadsheetId ?? ''
    let url = existing?.url ?? ''

    if (!spreadsheetId) {
      const clinic = await this.db.clinic.findFirst({ select: { name: true } })
      const created = await this.call<{ spreadsheetId: string; spreadsheetUrl: string }>(
        SHEETS_URL,
        token,
        'POST',
        { properties: { title: `${clinic?.name ?? 'ClinicOS'} — ${data.title}` } },
      )
      spreadsheetId = created.spreadsheetId
      url = created.spreadsheetUrl
    } else {
      /* Eski qatorlar qolib ketmasin: avval tozalanadi */
      await this.call(`${SHEETS_URL}/${spreadsheetId}/values/A:ZZ:clear`, token, 'POST', {})
    }

    await this.call(
      `${SHEETS_URL}/${spreadsheetId}/values/A1?valueInputOption=RAW`,
      token,
      'PUT',
      { values: [data.headers, ...data.rows] },
    )

    const saved = await this.db.googleSheet.upsert({
      where: { clinicId_dataset: { clinicId: this.ctx.require().clinicId, dataset } },
      create: {
        clinicId: this.ctx.require().clinicId,
        dataset,
        spreadsheetId,
        url,
        rows: data.rows.length,
        lastSyncAt: new Date(),
      },
      update: { spreadsheetId, url, rows: data.rows.length, lastSyncAt: new Date() },
    })

    return {
      dataset,
      url: saved.url,
      rows: saved.rows,
      lastSyncAt: toApiDateTime(saved.lastSyncAt),
    }
  }

  /* ------------------------------------------------------------------ */

  /** Har so'rovda yangi kirish kaliti — uzoq muddatlisi almashtiriladi */
  private async accountOrThrow() {
    const account = await this.db.googleAccount.findFirst()
    if (!account) throw new NotFoundException('Google hisobi ulanmagan')
    return account
  }

  private async accessToken(): Promise<string> {
    const account = await this.accountOrThrow()
    const { clientId, clientSecret } = this.config

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptToken(account.refreshTokenEnc),
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const text = await response.text()
      this.log.warn(`Google kaliti yangilanmadi: ${text}`)
      /*
        Odam Google tomonda ruxsatni bekor qilgan bo'lishi mumkin —
        shunda bog'lanishni o'chiramiz, aks holda interfeys "ulangan"
        deb turaveradi va har bosishda xato chiqadi.
      */
      if (response.status === 400 || response.status === 401) {
        await this.db.googleAccount.deleteMany({})
        throw new BadRequestException('Google ruxsati bekor qilingan — qaytadan ulang')
      }
      throw new ServiceUnavailableException('Google javob bermadi')
    }

    const body = (await response.json()) as { access_token: string }
    return body.access_token
  }

  private async exchange(code: string) {
    const { clientId, clientSecret, redirectUri } = this.config

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      this.log.warn(`Google kod almashmadi: ${await response.text()}`)
      throw new BadRequestException('Google bilan ulanib bo‘lmadi')
    }

    return (await response.json()) as { access_token: string; refresh_token?: string }
  }

  private async emailOf(accessToken: string): Promise<string> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return ''
    const body = (await response.json()) as { email?: string }
    return body.email ?? ''
  }

  private async call<T>(url: string, token: string, method: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const text = await response.text()
      this.log.warn(`Google Sheets xatosi (${response.status}): ${text.slice(0, 300)}`)
      throw new ServiceUnavailableException('Google jadvalni yangilay olmadi')
    }

    return (await response.json()) as T
  }

  /** Muddati o'tgan holatlarni tozalaydi */
  private sweep() {
    const now = Date.now()
    for (const [key, value] of this.pending) {
      if (value.expiresAt < now) this.pending.delete(key)
    }
  }
}
