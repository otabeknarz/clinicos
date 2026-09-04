import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'

import { toApi } from '../common/api-enum'
import { AuditService } from '../common/audit.service'
import { toApiClinic } from '../clinic/clinic.service'
import { RequestContext } from '../common/request-context'
import { IMPERSONATION_PERMISSIONS, resolvePermissions } from '../common/permissions'
import { PrismaService } from '../prisma/prisma.service'

/** Kirish qaydiga yoziladigan so'rov ma'lumoti */
export interface LoginMeta {
  ipAddress?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly ctx: RequestContext,
  ) {}

  /**
   * Tizimga kirish.
   *
   * Email KLINIKA ICHIDA noyob, butun tizimda emas — ikki xil
   * klinikada bir xil email bo'lishi mumkin. Shuning uchun avval
   * email bo'yicha topamiz, keyin parolni tekshiramiz.
   *
   * XAVFSIZLIK: email topilmasa ham parol xeshi bilan solishtirish
   * bajariladi. Aks holda javob vaqti farq qilib, qaysi email
   * ro'yxatda borligini aniqlab olish mumkin bo'lardi.
   */
  async login(email: string, password: string, meta: LoginMeta = {}) {
    const user = await this.db.acrossAllClinics().user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
      include: { clinic: { select: { id: true, name: true, isActive: true } } },
    })

    const hash = user?.passwordHash ?? DUMMY_HASH
    const ok = await argon2.verify(hash, password).catch(() => false)

    if (!user || !ok) {
      // Bir xil xabar: qaysi biri noto'g'ri ekanini aytmaymiz
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri')
    }
    if (!user.clinic.isActive) {
      throw new UnauthorizedException('Klinika hisobi to‘xtatilgan')
    }

    await this.db
      .acrossAllClinics()
      .user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    /*
      Kim, qachon va qayerdan kirgani audit jurnalida qoladi.
      Muvaffaqiyatsiz urinish YOZILMAYDI: noto'g'ri terilgan
      parol jurnalni to'ldirib, haqiqiy hodisani ko'mib yuboradi.
      Urinishlarni cheklash — alohida ish (rate limiting).
    */
    await this.audit.recordLogin({
      clinicId: user.clinicId,
      userId: user.id,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    })

    return this.buildSession(user.id)
  }

  /**
   * Sahifa yangilanganda sessiyani tiklash.
   *
   * Platforma egasi klinika paneliga kirgan bo'lsa, sessiya
   * O'SHA klinikaniki bo'lib qaytadi — aks holda yangilashdan
   * keyin u bilmasdan platforma paneliga qaytib qolardi.
   */
  async me(userId: string) {
    const { impersonationId, clinicId } = this.ctx.require()
    return this.buildSession(
      userId,
      impersonationId ? { id: impersonationId, clinicId } : null,
    )
  }

  /**
   * Klinika paneliga kirish uchun sessiya.
   *
   * Token QISQA MUDDATLI (`IMPERSONATION_TTL`): platforma xodimi
   * ishini tugatib, chiqishni unutsa ham kirish o'zi yopiladi.
   * Odatdagi 12 soat bu yerda uzoq — bu vaqtinchalik kirish.
   */
  async buildImpersonatedSession(userId: string, impersonationId: string, clinicId: string) {
    return this.buildSession(userId, { id: impersonationId, clinicId })
  }

  private async buildSession(
    userId: string,
    impersonation: { id: string; clinicId: string } | null = null,
  ) {
    const user = await this.db.acrossAllClinics().user.findUniqueOrThrow({
      where: { id: userId },
    })

    /*
      Kirilgan holatda sessiyada KO'RSATILADIGAN klinika — nishon
      klinika, foydalanuvchining o'zinikisi emas. Interfeys shu
      nomni yuqorida ko'rsatadi.
    */
    /*
      Klinikani AYNAN `GET /clinic` bilan bir xil shaklda
      qaytaramiz. Xom Prisma yozuvi qaytarilsa, `workingHours`
      tushib qolar, `isActive` va `updatedAt` esa ortiqcha
      chiqib ketardi — sxemaga yangi ustun qo'shilganda u ham
      o'z-o'zidan tashqariga chiqardi.
    */
    const clinicRow = await this.db.acrossAllClinics().clinic.findUniqueOrThrow({
      where: { id: impersonation?.clinicId ?? user.clinicId },
      include: { workingHours: { orderBy: { weekday: 'asc' } } },
    })

    const token = await this.jwt.signAsync(
      {
        sub: user.id,
        clinicId: impersonation?.clinicId ?? user.clinicId,
        impersonationId: impersonation?.id ?? null,
      },
      impersonation ? { expiresIn: IMPERSONATION_TTL } : undefined,
    )

    return {
      token,
      user: {
        id: user.id,
        clinicId: impersonation?.clinicId ?? user.clinicId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        /*
          Interfeys rolni KICHIK harfda kutadi ('superadmin'),
          bazada esa 'SUPERADMIN'. Bu yerda o'girish unutilgan
          edi: natijada `role === 'superadmin'` tekshiruvlari
          hech qachon to'g'ri bo'lmasdi va platforma egasi
          o'zining paneli o'rniga klinika paneliga tushib,
          hamma joyda 403 olardi.
        */
        role: toApi(user.role),
        avatarUrl: user.avatarUrl,
        doctorId: user.doctorId,
        isActive: user.isActive,
      },
      clinic: toApiClinic(clinicRow),
      permissions: impersonation
        ? [...IMPERSONATION_PERMISSIONS]
        : resolvePermissions(user.role, user.extraPermissions),
    }
  }
}

/*
  Klinika paneliga kirish tokenining muddati.

  Qisqa: bu vaqtinchalik kirish, ish smenasi emas. Muddati
  tugagach platforma xodimi qaytadan sabab yozib kiradi va
  yangi yozuv qoladi — ya'ni jurnal ham aniqroq bo'ladi.
*/
const IMPERSONATION_TTL = '30m'

/*
  Mavjud bo'lmagan foydalanuvchi uchun ham xesh tekshiruvi bajarilsin
  deb turgan qiymat. Bu hech kimning paroli emas — argon2 ning bo'sh
  satrdan olingan xeshi.
*/
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'
