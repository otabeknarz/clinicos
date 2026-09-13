import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

/**
 * ============================================================
 *  BO'LIM CHEKLOVLARI — SABABI BILAN
 * ============================================================
 *
 * `Clinic.disabledModules` bo'limni JIMGINA yashiradi: mijoz
 * uchun u umuman yo'q. Ba'zan esa aynan buning aksi kerak —
 * bo'lim ko'rinib tursin, lekin nega yopiqligi yozilsin:
 *
 *   "Tez kunda"                — hali tayyor emas;
 *   "Tarifingizda yo'q"        — sotuvga ishora;
 *   "Texnik ishlar olib borilmoqda" — vaqtinchalik.
 *
 * Qoida ikki darajali: HAMMA uchun (`targetClinicId` bo'sh) va
 * bitta klinika uchun. Klinikaniki umumiysidan USTUN — masalan
 * bo'lim hamma uchun "tez kunda", lekin sinovdan o'tayotgan
 * mijozga ochib berilgan bo'lishi mumkin (u yerda qoida
 * o'chiriladi).
 *
 * KESH — HAR SO'ROVDA BAZAGA BORMASLIK UCHUN. Darvoza
 * (`PermissionsGuard`) har bir so'rovda ishlaydi va u yerdagi
 * qo'shimcha so'rov butun tizimni sekinlashtirardi. Qoida kamdan
 * kam o'zgaradi, shuning uchun 30 soniyalik kesh yetarli:
 * platforma admini tugmani bosgach, o'zgarish yarim daqiqada
 * hamma joyda ko'rinadi.
 *
 * BIR KONTEYNER: kesh xotirada. Ikkinchi nusxa qo'shilsa,
 * o'zgarish ikkinchisida 30 soniya kechikadi — Telegram kodlari
 * va sinov yozuvlari ham shu taxminda ishlaydi.
 */
const CACHE_MS = 30_000

export interface Restriction {
  module: string
  reason: 'soon' | 'plan' | 'maintenance' | 'off'
  note: string
}

@Injectable()
export class RestrictionsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache = new Map<string, { at: number; rows: Restriction[] }>()

  /** Klinikaga tegishli barcha cheklovlar (umumiy + shaxsiy) */
  async forClinic(clinicId: string): Promise<Restriction[]> {
    const hit = this.cache.get(clinicId)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows

    const rows = await this.prisma.acrossAllClinics().moduleRestriction.findMany({
      where: { OR: [{ targetClinicId: '' }, { targetClinicId: clinicId }] },
    })

    /* Klinikaniki umumiysining ustidan yozadi */
    const byModule = new Map<string, Restriction>()
    for (const row of rows) {
      const current = byModule.get(row.module)
      const personal = row.targetClinicId !== ''
      if (!current || personal) {
        byModule.set(row.module, {
          module: row.module,
          reason: row.reason.toLowerCase() as Restriction['reason'],
          note: row.note,
        })
      }
    }

    const result = [...byModule.values()]
    this.cache.set(clinicId, { at: Date.now(), rows: result })
    return result
  }

  /** Faqat kalitlar — ruxsatlarni kesish uchun */
  async blockedModules(clinicId: string): Promise<string[]> {
    return (await this.forClinic(clinicId)).map((row) => row.module)
  }

  /** Qoida o'zgarganda — keyingi so'rov bazadan o'qisin */
  clearCache(): void {
    this.cache.clear()
  }
}
