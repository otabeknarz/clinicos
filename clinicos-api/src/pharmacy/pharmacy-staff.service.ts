import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { PharmacyStaffStatus, Prisma, Role } from '@prisma/client'
import * as argon2 from 'argon2'

import { generatePassword } from '../common/password'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { PharmacyContextService } from './pharmacy-context.service'
import {
  PharmacyShiftCloseDto,
  PharmacyStaffInputDto,
  UpdatePharmacyStaffDto,
} from './pharmacy.dto'
import {
  SHIFT_TOLERANCE,
  apiShift,
  apiStaff,
  dateOnly,
  daysAgo,
  localDate,
  saleNet,
  saleProfit,
  startOfToday,
  todayDate,
} from './pharmacy.shared'

type PharmacyRole = Extract<Role, 'PHARMACIST' | 'PHARMACY_OWNER'>

function toRole(value: 'pharmacist' | 'pharmacy_owner'): PharmacyRole {
  return value === 'pharmacy_owner' ? 'PHARMACY_OWNER' : 'PHARMACIST'
}

function toStatus(value: 'active' | 'fired'): PharmacyStaffStatus {
  return value === 'fired' ? 'FIRED' : 'ACTIVE'
}

/**
 * Kirim huquqi — `User.extraPermissions` ga yoziladi, chunki ruxsat
 * HAR SO'ROVDA bazadan o'qiladi (`jwt.strategy.ts`): rahbar huquqni
 * olib qo'ysa, keyingi so'rovdayoq yopiladi. Rahbarda bu huquq
 * rolning o'zida bor.
 */
function extraFor(role: PharmacyRole, canReceive: boolean): string[] {
  return role === 'PHARMACIST' && canReceive ? ['pharmacy.receive'] : []
}

function uniqueDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b)
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002'
}

/**
 * APTEKA: xodimlar, smena va kassa topshirish.
 */
@Injectable()
export class PharmacyStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly pctx: PharmacyContextService,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /* ------------------------------------------------------------------ */
  /* Xodimlar                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Xodimlar va natijasi — SMENALAR va SOTUVLARDAN yig'iladi. Alohida
   * "ko'rsatkich" jadvali yo'q: u sotuvlar bilan ziddiyatga tushardi.
   */
  async list(days = 30) {
    const since = daysAgo(days)
    const [staff, sales, shifts] = await Promise.all([
      this.db.pharmacyStaff.findMany(),
      this.db.sale.findMany({ where: { soldAt: { gte: since } }, include: { items: true } }),
      this.db.pharmacyShift.findMany({ where: { date: { gte: dateOnly(localDate(since)) } } }),
    ])

    const rows = staff.map((person) => {
      const mySales = sales.filter((s) => s.soldById === person.id)
      const myShifts = shifts.filter((s) => s.sellerId === person.id)
      const revenue = mySales.reduce((sum, s) => sum + saleNet(s), 0)

      return {
        ...apiStaff(person),
        stats: {
          staffId: person.id,
          daysWorked: myShifts.length,
          receipts: mySales.length,
          revenue,
          profit: mySales.reduce((sum, s) => sum + saleProfit(s), 0),
          /* Bitta chek — bitta xaridor */
          customers: mySales.length,
          cashShort: myShifts
            .filter((s) => s.difference < 0)
            .reduce((sum, s) => sum + Math.abs(s.difference), 0),
          cashOver: myShifts
            .filter((s) => s.difference > 0)
            .reduce((sum, s) => sum + s.difference, 0),
          gapDays: myShifts.filter((s) => s.difference !== 0).length,
          dailyAverage: myShifts.length ? Math.round(revenue / myShifts.length) : 0,
        },
      }
    })

    /* Faol xodimlar tepada, ichida savdosi yuqorisi birinchi */
    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.stats.revenue - a.stats.revenue
    })
  }

  /**
   * Yangi xodim — kirish hisobi bilan birga.
   *
   * Parolni rahbar TERMAYDI: vaqtinchalik parol yaratiladi va BIR
   * MARTA qaytadi, bazada faqat xeshi qoladi. Xodim kirgach uni
   * almashtiradi. Rahbar biladigan doimiy parol bo'lsa, rahbar
   * sotuvchi nomidan sota olardi — kassa nazorati kimni
   * tekshirayotganini bilmay qolardi.
   */
  async create(dto: PharmacyStaffInputDto) {
    const { clinicId } = this.ctx.require()
    const login = dto.login.trim().toLowerCase()
    const role = toRole(dto.role)
    const status = toStatus(dto.status ?? 'active')
    const canReceive = role === 'PHARMACY_OWNER' ? true : dto.canReceive
    const fullName = dto.fullName.trim()
    const phone = dto.phone?.trim() ?? ''

    const password = generatePassword()
    const passwordHash = await argon2.hash(password)

    try {
      const staff = await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            clinicId,
            fullName,
            email: login,
            phone,
            passwordHash,
            role,
            mustChangePassword: true,
            extraPermissions: extraFor(role, canReceive),
            isActive: status === 'ACTIVE',
          },
        })

        return tx.pharmacyStaff.create({
          data: {
            clinicId,
            fullName,
            phone,
            login,
            role,
            salary: dto.salary,
            workdays: uniqueDays(dto.workdays),
            shiftStart: dto.shiftStart,
            shiftEnd: dto.shiftEnd,
            status,
            hiredAt: dto.hiredAt ? dateOnly(dto.hiredAt) : todayDate(),
            canReceive,
            userId: user.id,
          },
        })
      })

      return { staff: apiStaff(staff), password }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException(`${login} logini band — boshqa nom tanlang`)
      }
      throw error
    }
  }

  private async requireStaff(id: string) {
    const row = await this.db.pharmacyStaff.findFirst({ where: { id } })
    if (!row) throw new NotFoundException('Xodim topilmadi')
    return row
  }

  /**
   * Tahrirlash — xodim yozuvi va kirish hisobi BIRGA o'zgaradi.
   *
   * Klinikada `Staff` yangilanib `User` esa eski qolgani uchun xodim
   * kira olmay qolgan edi (login, rol, parol). Bu yerda ikkalasi
   * bitta tranzaksiyada.
   *
   * Uchta to'siq:
   *   - o'z rolini o'zgartirib bo'lmaydi (rahbar o'zini sotuvchiga
   *     tushirib qo'yib, aptekani rahbarsiz qoldirardi);
   *   - o'zini ishdan chiqarib bo'lmaydi;
   *   - oxirgi faol rahbar qoladi — aks holda xodim qo'shadigan,
   *     parol tiklaydigan odam qolmasdi.
   */
  async update(id: string, dto: UpdatePharmacyStaffDto) {
    const current = await this.requireStaff(id)
    const me = await this.pctx.me()

    const role = dto.role ? toRole(dto.role) : (current.role as PharmacyRole)
    const status = dto.status ? toStatus(dto.status) : current.status

    if (current.id === me.id) {
      if (role !== current.role) {
        throw new BadRequestException('O‘z rolingizni o‘zgartira olmaysiz')
      }
      if (status === 'FIRED') {
        throw new BadRequestException('O‘zingizni ishdan chiqara olmaysiz')
      }
    }

    const losesOwner =
      current.role === 'PHARMACY_OWNER' &&
      current.status === 'ACTIVE' &&
      (role !== 'PHARMACY_OWNER' || status !== 'ACTIVE')
    if (losesOwner) {
      const others = await this.db.pharmacyStaff.count({
        where: { role: 'PHARMACY_OWNER', status: 'ACTIVE', id: { not: current.id } },
      })
      if (others === 0) {
        throw new BadRequestException('Aptekada kamida bitta faol rahbar qolishi kerak')
      }
    }

    const canReceive = role === 'PHARMACY_OWNER' ? true : (dto.canReceive ?? current.canReceive)
    const login = dto.login?.trim().toLowerCase() ?? current.login

    const data: Prisma.PharmacyStaffUpdateManyMutationInput = { role, status, canReceive, login }
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim()
    if (dto.phone !== undefined) data.phone = dto.phone.trim()
    if (dto.salary !== undefined) data.salary = dto.salary
    if (dto.workdays !== undefined) data.workdays = uniqueDays(dto.workdays)
    if (dto.shiftStart !== undefined) data.shiftStart = dto.shiftStart
    if (dto.shiftEnd !== undefined) data.shiftEnd = dto.shiftEnd
    if (dto.hiredAt !== undefined) data.hiredAt = dateOnly(dto.hiredAt)

    try {
      const updated = await this.db.$transaction(async (tx) => {
        /*
          TRANZAKSIYA ICHIDA `update` EMAS, `updateMany`.

          Klinika filtri `update` dan oldin "yozuv shu klinikanikimi"
          tekshiruvini TRANZAKSIYADAN TASHQARIDA, alohida ulanishda
          bajaradi. Bitta ulanishli bazada (mahalliy `prisma dev`)
          tekshiruv tranzaksiyani, tranzaksiya tekshiruvni kutib qoladi
          va 5 soniyadan keyin yiqiladi. `updateMany` ga `clinicId`
          filtri shu so'rovning o'ziga qo'shiladi — ajratish saqlanadi,
          tashqi so'rov esa yo'q.
        */
        await tx.pharmacyStaff.updateMany({ where: { id }, data })
        const row = await tx.pharmacyStaff.findFirstOrThrow({ where: { id } })

        if (current.userId) {
          await tx.user.updateMany({
            where: { id: current.userId },
            data: {
              fullName: row.fullName,
              phone: row.phone,
              email: login,
              role,
              extraPermissions: extraFor(role, canReceive),
              /*
                Ishdan chiqsa kirish YOPILADI va qo'ldagi token ham
                darhol yaroqsiz bo'ladi. Qaytib ishga olinsa ochiladi:
                aptekada ish va kirish bitta narsa.
              */
              isActive: status === 'ACTIVE',
              ...(status === 'FIRED' && current.status !== 'FIRED'
                ? { passwordChangedAt: new Date() }
                : {}),
            },
          })
        }

        return row
      })
      return apiStaff(updated)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new BadRequestException(`${login} logini band — boshqa nom tanlang`)
      }
      throw error
    }
  }

  /**
   * Ishdan chiqarish — yozuv O'CHIRILMAYDI: uning sotuvlari va
   * smenalari joyida qoladi, aks holda o'tgan oy hisoboti egasiz
   * qolardi.
   */
  fire(id: string) {
    return this.update(id, { status: 'fired' })
  }

  /**
   * Parolni tiklash — rahbar sotuvchiga yangi vaqtinchalik parol beradi.
   *
   * Pochta xizmati yo'q, ya'ni parolni unutgan sotuvchining boshqa
   * yo'li yo'q. Eski sessiyalar uziladi va kirgach almashtirish
   * so'raladi. Parol FAQAT shu javobda.
   */
  async resetPassword(id: string) {
    const staff = await this.requireStaff(id)
    if (!staff.userId) throw new NotFoundException('Xodimning kirish hisobi yo‘q')

    const password = generatePassword()
    await this.db.user.update({
      where: { id: staff.userId },
      data: {
        passwordHash: await argon2.hash(password),
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    })

    return { staffId: staff.id, login: staff.login, password }
  }

  /* ------------------------------------------------------------------ */
  /* Kassa kimda                                                         */
  /* ------------------------------------------------------------------ */

  async onDuty() {
    const me = await this.pctx.me()
    const duty = await this.pctx.onDuty(me)
    return {
      holder: duty.holder ? apiStaff(duty.holder) : null,
      isMe: duty.holder?.id === me.id,
      reason: duty.reason,
    }
  }

  /**
   * Kassani kimga topshirish mumkin — o'zidan boshqa faol SOTUVCHILAR.
   * Rahbarga topshirilmaydi: u sotmaydi va smena yopa olmaydi, kassa
   * unda qolsa apteka qulflanib qolardi.
   */
  async handoverCandidates() {
    const me = await this.pctx.me()
    const rows = await this.db.pharmacyStaff.findMany({
      where: { status: 'ACTIVE', role: 'PHARMACIST', id: { not: me.id } },
      orderBy: { fullName: 'asc' },
    })
    return rows.map(apiStaff)
  }

  /* ------------------------------------------------------------------ */
  /* Smena                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Ochiq smena — bugungi OXIRGI yopilishdan (yoki kun boshidan)
   * hozirgacha.
   *
   * Kassa kun ichida qo'ldan qo'lga o'tadi: ertalabki sotuvchi 15:00
   * da yopib kechkisiga topshiradi, kechkisi 21:00 da o'zinikini
   * yopadi. Butun kun bitta smena deb hisoblansa, ikkinchi sotuvchi
   * "smena yopilgan" deb ko'rardi va kassani topshira olmasdi.
   */
  private async openShift(me: { id: string }) {
    const last = await this.pctx.lastCloseToday()
    const periodStart = last ? last.closedAt : startOfToday()

    const sales = await this.db.sale.findMany({
      where: { soldAt: { gt: periodStart } },
      select: { total: true, discount: true, method: true },
    })

    const expectedCash = sales
      .filter((s) => s.method === 'CASH')
      .reduce((sum, s) => sum + saleNet(s), 0)
    const cardTotal = sales
      .filter((s) => s.method !== 'CASH')
      .reduce((sum, s) => sum + saleNet(s), 0)

    return {
      periodStart,
      /* O'zi hozirgina yopgan va shundan beri savdo bo'lmagan */
      closed: Boolean(last) && last?.sellerId === me.id && sales.length === 0,
      expectedCash,
      cardTotal,
      receipts: sales.length,
    }
  }

  async todayShift() {
    const me = await this.pctx.me()
    const state = await this.openShift(me)
    return {
      closed: state.closed,
      expectedCash: state.expectedCash,
      cardTotal: state.cardTotal,
      receipts: state.receipts,
    }
  }

  /**
   * Smenani yopish.
   *
   * KUTILGAN summa va "rahbarga yuborilgan" belgisi SERVERDA
   * aniqlanadi. Sotuvchi faqat sanaganini yozadi — aks holda farqni
   * nolga tenglashtirib, belgini ham olib tashlab qo'yardi.
   */
  async closeShift(dto: PharmacyShiftCloseDto) {
    const me = await this.pctx.me()
    await this.pctx.assertOnDuty(me)
    const { clinicId } = this.ctx.require()

    const state = await this.openShift(me)
    if (state.closed) throw new BadRequestException('Smena allaqachon yopilgan')

    let handedTo: { id: string; fullName: string } | null = null
    if (dto.handedToId) {
      handedTo = await this.db.pharmacyStaff.findFirst({
        where: {
          id: dto.handedToId,
          status: 'ACTIVE',
          role: 'PHARMACIST',
          NOT: { id: me.id },
        },
        select: { id: true, fullName: true },
      })
      if (!handedTo) throw new BadRequestException('Kassani faqat boshqa faol sotuvchiga topshirish mumkin')
    }

    const difference = dto.countedCash - state.expectedCash

    const row = await this.db.pharmacyShift.create({
      data: {
        clinicId,
        sellerId: me.id,
        sellerName: me.fullName,
        date: todayDate(),
        periodStart: state.periodStart,
        expectedCash: state.expectedCash,
        countedCash: dto.countedCash,
        difference,
        cardTotal: state.cardTotal,
        receipts: state.receipts,
        note: dto.note?.trim() ?? '',
        handedToId: handedTo?.id ?? null,
        handedToName: handedTo?.fullName ?? '',
        flagged: difference < -SHIFT_TOLERANCE,
      },
    })

    return apiShift(row)
  }

  async listShifts(days = 30) {
    const rows = await this.db.pharmacyShift.findMany({
      where: { date: { gte: dateOnly(localDate(daysAgo(days))) } },
      orderBy: [{ date: 'desc' }, { closedAt: 'desc' }],
    })
    return rows.map(apiShift)
  }
}
