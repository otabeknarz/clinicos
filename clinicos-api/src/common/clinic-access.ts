import { TenantStatus } from '@prisma/client'

/**
 * KLINIKA ISHLASHGA YAROQLIMI.
 *
 * Bitta joyda, chunki ikki joyda tekshiriladi:
 *
 *   `auth.service.ts`   — kirishda
 *   `jwt.strategy.ts`   — HAR BIR so'rovda
 *
 * NEGA IKKALASIDA: faqat kirishda tekshirilsa, to'xtatilgan
 * klinikaning xodimi qo'lidagi eski token bilan yana 12 soat
 * ishlab yurardi. Tizimning boshqa joyida ham shu qoida bor —
 * rol va faollik har so'rovda bazadan o'qiladi.
 *
 * TARIXI: ilgari `suspend` faqat obuna holatini o'zgartirardi va
 * kirishga UMUMAN ta'sir qilmasdi. Platforma panelida "to'xtatilgan"
 * deb turardi, klinika esa bemalol ishlayverardi — ya'ni SaaS
 * ning asosiy tutqichi ishlamas edi.
 */

/**
 * Ishlashni to'sadigan obuna holatlari.
 *
 * `PAST_DUE` ATAYLAB ro'yxatda YO'Q: hisob kechikkani — to'lov
 * masalasi, klinikani darhol yopish emas. Kechikkan mijozni
 * ogohlantirish kerak, bemorlarini navbatda qoldirish emas.
 * Yopish kerak bo'lsa, egasi `suspend` ni qo'lda bosadi.
 */
const BLOCKING_STATUSES: readonly TenantStatus[] = [
  TenantStatus.SUSPENDED,
  TenantStatus.CANCELLED,
]

export interface ClinicAccess {
  ok: boolean
  /** Foydalanuvchiga ko'rsatiladigan sabab */
  reason: string
}

const ALLOWED: ClinicAccess = { ok: true, reason: '' }

export function checkClinicAccess(input: {
  role: string
  clinicIsActive: boolean
  subscriptionStatus: TenantStatus | null
  /**
   * Sinov muddati qachon tugaydi.
   *
   * `TRIAL` holatining o'zi to'smaydi — u yangi mijozning normal
   * holati. To'sadigani MUDDAT: 14 kun o'tgach klinika yopiladi,
   * aks holda "bepul 14 kun" cheksiz bepul bo'lib qolardi.
   */
  trialEndsAt?: Date | null
  /** Klinika o'chirilgan payt. `null` — o'chirilmagan. */
  clinicDeletedAt?: Date | null
  /**
   * Klinika yoki apteka — faqat xabar matni uchun.
   *
   * Aptekaning obunasi yo'q, uni platforma egasi `isActive` bilan
   * to'xtatadi va sababini shu yerga yozadi: rahbar kirishga urinib
   * "nega" degan savolga javobni darhol o'qishi kerak.
   */
  clinicKind?: 'CLINIC' | 'PHARMACY'
  suspendReason?: string
}): ClinicAccess {
  /*
    Platforma egasi klinika xodimi emas. Uning "klinikasi" —
    platforma yozuvi, unda obuna yo'q. Uni obuna holatiga qarab
    to'sish noto'g'ri bo'lardi: aynan u to'xtatilgan klinikalarni
    boshqarishi kerak.
  */
  if (input.role === 'SUPERADMIN') return ALLOWED

  /*
    O'CHIRILGAN KLINIKA — obuna holatidan QAT'I NAZAR yopiq.

    Arxivlash obunani `CANCELLED` ga o'tkazadi, o'chirish esa alohida
    belgi qo'yadi: klinika arxivlanmagan holatda ham o'chirilgan
    bo'lishi mumkin. Shuning uchun tekshiruv obunadan oldin turadi.
  */
  const pharmacy = input.clinicKind === 'PHARMACY'

  if (input.clinicDeletedAt) {
    return { ok: false, reason: pharmacy ? 'Apteka o‘chirilgan' : 'Klinika o‘chirilgan' }
  }

  if (!input.clinicIsActive) {
    if (pharmacy) {
      return {
        ok: false,
        reason: input.suspendReason?.trim()
          ? `Apteka to‘xtatilgan: ${input.suspendReason.trim()}`
          : 'Apteka to‘xtatilgan',
      }
    }
    return { ok: false, reason: 'Klinika hisobi to‘xtatilgan' }
  }

  /*
    Obunasi yo'q klinika o'tkaziladi. Bunday holat faqat qo'lda
    yaratilgan yozuvda bo'ladi; obunani majburiy qilib qo'ysak,
    bitta yetishmagan qator butun klinikani yopib qo'yardi.
  */
  if (input.subscriptionStatus === null) return ALLOWED

  /*
    SINOV MUDDATI TUGAGANMI.

    Kunning oxirigacha ishlaydi: muddat sanasi `@db.Date`, ya'ni
    tungi 00:00. Aniq o'sha soniyada yopilsa, mijoz oxirgi kuni
    ishlay olmasdi.
  */
  if (input.subscriptionStatus === TenantStatus.TRIAL && input.trialEndsAt) {
    const endOfDay = new Date(input.trialEndsAt)
    endOfDay.setHours(23, 59, 59, 999)
    if (Date.now() > endOfDay.getTime()) {
      return { ok: false, reason: 'Sinov muddati tugadi — tarif tanlash uchun bog‘laning' }
    }
  }

  if (BLOCKING_STATUSES.includes(input.subscriptionStatus)) {
    return {
      ok: false,
      reason:
        input.subscriptionStatus === TenantStatus.CANCELLED
          ? 'Klinika arxivlangan'
          : 'Klinika hisobi to‘xtatilgan',
    }
  }

  return ALLOWED
}
