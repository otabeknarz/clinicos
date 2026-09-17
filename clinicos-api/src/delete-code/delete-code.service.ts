import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import * as argon2 from 'argon2'

import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { SetDeleteCodeDto } from './delete-code.dto'

/** Ketma-ket nechta xato urinishdan keyin qulf */
const MAX_FAILS = 5
/** Qulf qancha turadi */
const LOCK_MS = 15 * 60_000

/**
 * O'CHIRISH KODI.
 *
 * Bemorni, xizmatni yoki to'lovni o'chirish qaytarib bo'lmaydigan amal —
 * u faqat klinika egasi o'rnatgan kod bilan bajariladi. Ruxsat "kim
 * o'chira oladi" degan savolga javob beradi; kod esa "egasi shu amalga
 * rozimi" degan savolga. Registratorda ruxsat bor, lekin kodni egasi
 * aytmaguncha u hech narsani o'chira olmaydi.
 *
 * KOD BAZADA XESH BO'LIB turadi (argon2), xuddi parol kabi. Uni o'rnatish
 * yoki almashtirish egasining O'Z PAROLINI talab qiladi — ochiq qolgan
 * kompyuterdan kodni almashtirib bo'lmasin.
 *
 * TAXMIN QILISHGA QARSHI: klinika bo'yicha 5 ta xato urinishdan keyin
 * 15 daqiqa qulf. Hisob xotirada — API bitta konteynerda ishlaydi
 * (Telegram ulash kodlari ham shunday). Qayta ishga tushsa hisob
 * nollanadi, bu qabul qilinadigan narx: 4 xonali kodni 15 daqiqada 5 tadan
 * sinab topish kunlar oladi, har bir urinish esa audit jurnalida qoladi.
 */
@Injectable()
export class DeleteCodeService {
  private readonly attempts = new Map<string, { fails: number; lockedUntil: number }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  async status() {
    const { clinicId } = this.ctx.require()
    const clinic = await this.prisma.acrossAllClinics().clinic.findUnique({
      where: { id: clinicId },
      select: { deleteCodeHash: true },
    })
    return { isSet: Boolean(clinic?.deleteCodeHash) }
  }

  async set(dto: SetDeleteCodeDto) {
    const { clinicId, userId } = this.ctx.require()

    const clinic = await this.prisma.acrossAllClinics().clinic.findUnique({
      where: { id: clinicId },
      select: { deleteCodeHash: true },
    })

    /*
      BIRINCHI KOD — PAROLSIZ: egasi uni birinchi o'chirish oynasining o'zida
      yaratadi. ALMASHTIRISH esa parol bilan: ochiq qolgan kompyuterdan
      kodni o'zgartirib, keyin hamma narsani o'chirib bo'lmasin.
    */
    if (clinic?.deleteCodeHash) {
      const user = await this.prisma.acrossAllClinics().user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi')
      const ok = await argon2.verify(user.passwordHash, dto.password ?? '').catch(() => false)
      if (!ok) throw new ForbiddenException('Parol noto‘g‘ri')
    }

    await this.prisma.acrossAllClinics().clinic.update({
      where: { id: clinicId },
      data: { deleteCodeHash: await argon2.hash(dto.code) },
    })
    this.attempts.delete(clinicId)
    return { isSet: true }
  }

  /** Kim o'chirdi — egasiga boradigan xabar uchun */
  async actorName(): Promise<string> {
    const { userId } = this.ctx.require()
    const user = await this.prisma.acrossAllClinics().user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    })
    return user?.fullName ?? '—'
  }

  /**
   * Kodni tekshiradi — noto'g'ri bo'lsa xato tashlaydi.
   * O'chirish xizmatlari ish boshlashdan OLDIN chaqiradi.
   */
  async assert(code: string | undefined): Promise<void> {
    const { clinicId } = this.ctx.require()
    const now = Date.now()

    const state = this.attempts.get(clinicId)
    if (state && state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60_000)
      throw new ForbiddenException(
        `Kod ko‘p marta noto‘g‘ri kiritildi. ${minutes} daqiqadan keyin urinib ko‘ring`,
      )
    }

    const clinic = await this.prisma.acrossAllClinics().clinic.findUnique({
      where: { id: clinicId },
      select: { deleteCodeHash: true },
    })
    if (!clinic?.deleteCodeHash) {
      throw new BadRequestException(
        'O‘chirish kodi o‘rnatilmagan. Klinika egasi uni Sozlamalar → Klinika bo‘limida o‘rnatadi',
      )
    }

    const ok = await argon2.verify(clinic.deleteCodeHash, code ?? '').catch(() => false)
    if (!ok) {
      const fails = (state?.fails ?? 0) + 1
      this.attempts.set(
        clinicId,
        fails >= MAX_FAILS
          ? { fails: 0, lockedUntil: now + LOCK_MS }
          : { fails, lockedUntil: 0 },
      )
      throw new ForbiddenException('O‘chirish kodi noto‘g‘ri')
    }

    this.attempts.delete(clinicId)
  }
}
