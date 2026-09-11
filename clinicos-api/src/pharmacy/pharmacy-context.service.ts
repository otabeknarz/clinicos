import { ForbiddenException, Injectable } from '@nestjs/common'
import type { PharmacyStaff } from '@prisma/client'

import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { minutesOf, todayDate } from './pharmacy.shared'

export type DutyReason = 'handover' | 'schedule' | 'none'

/**
 * KIM ISHLAYAPTI VA HOZIR KASSA KIMDA.
 *
 * Alohida servis, chunki savdo, retsept va smena — uchalasi ham
 * shu savolga tayanadi. Uch joyda yozilsa, biri ertami-kechmi
 * boshqacha javob berardi va sotuvchi bitta ekranda "sota olasiz",
 * boshqasida "sota olmaysiz" degan gapni ko'rardi.
 */
@Injectable()
export class PharmacyContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Kirgan odamning apteka xodimi yozuvi.
   *
   * TOKENDAN aniqlanadi — mijoz "men falonchiman" deb aytib
   * turmaydi. Aks holda bir sotuvchi savdoni boshqasining nomiga
   * yozib, kassa farqini unga o'tkazib qo'yardi.
   */
  async me(): Promise<PharmacyStaff> {
    const { userId } = this.ctx.require()
    const row = await this.db.pharmacyStaff.findFirst({ where: { userId } })
    if (!row || row.status !== 'ACTIVE') {
      throw new ForbiddenException('Apteka xodimi yozuvi topilmadi')
    }
    return row
  }

  /** Bugun oxirgi yopilgan smena — kassa kimga o'tganini aytadi */
  lastCloseToday() {
    return this.db.pharmacyShift.findFirst({
      where: { date: todayDate() },
      orderBy: { closedAt: 'desc' },
    })
  }

  /**
   * HOZIR KIM SMENADA.
   *
   * Faqat SOTUVCHILAR orasidan: apteka rahbari sotmaydi va smena
   * yopa olmaydi. U kassa egasi bo'lib qolsa, apteka o'zini o'zi
   * qulflab qo'yardi — hech kim sota olmas, smenani ham hech kim
   * yopa olmasdi.
   *
   * Ikki manba, shu tartibda:
   *   1. BUGUNGI topshirish — haqiqatda kim turgani jadvaldan
   *      muhimroq. Kechagisi hisobga olinmaydi: aks holda kassa
   *      bir odamda muzlab qolardi.
   *   2. JADVAL — ish kuni va soati bo'yicha. Bir paytda ikki
   *      sotuvchi yozilgan bo'lsa, ikkalasi ham ishlay oladi.
   *
   * Hech kim chiqmasa `null` — kassa bo'sh, uni kim ochsa o'sha
   * ishlaydi. Ataylab yumshoq: jadvaldagi bitta xato butun
   * aptekani to'xtatib qo'ymasin.
   */
  async onDuty(me: PharmacyStaff | null): Promise<{
    holder: PharmacyStaff | null
    reason: DutyReason
  }> {
    const sellers = await this.db.pharmacyStaff.findMany({
      where: { status: 'ACTIVE', role: 'PHARMACIST' },
      orderBy: [{ shiftStart: 'asc' }, { fullName: 'asc' }],
    })

    const last = await this.lastCloseToday()
    if (last?.handedToId) {
      const holder = sellers.find((one) => one.id === last.handedToId)
      if (holder) return { holder, reason: 'handover' }
    }

    const now = new Date()
    const weekday = now.getDay()
    const minutes = now.getHours() * 60 + now.getMinutes()

    const scheduled = sellers.filter((one) => {
      if (!one.workdays.includes(weekday)) return false
      const from = minutesOf(one.shiftStart)
      const to = minutesOf(one.shiftEnd)
      /* Tunda tugaydigan smena: oxiri boshidan kichik */
      return to > from ? minutes >= from && minutes < to : minutes >= from || minutes < to
    })

    if (scheduled.length > 0) {
      const mine = me ? scheduled.find((one) => one.id === me.id) : undefined
      return { holder: mine ?? scheduled[0], reason: 'schedule' }
    }

    return { holder: null, reason: 'none' }
  }

  /**
   * Savdo va retsept FAQAT smenadagi odamda.
   *
   * Interfeysdagi to'siq himoya emas — brauzer konsolidan so'rov
   * yuborib chetlab o'tish mumkin. Qoida shu yerda, serverda.
   */
  async assertOnDuty(me: PharmacyStaff): Promise<void> {
    const duty = await this.onDuty(me)
    if (duty.holder && duty.holder.id !== me.id) {
      throw new ForbiddenException(
        `Hozir smena ${duty.holder.fullName} da — savdo va retseptlarni o‘sha kishi yuritadi`,
      )
    }
  }
}
