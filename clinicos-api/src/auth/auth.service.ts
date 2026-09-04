import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'

import { AuditService } from '../common/audit.service'
import { resolvePermissions } from '../common/permissions'
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

  /** Sahifa yangilanganda sessiyani tiklash */
  async me(userId: string) {
    return this.buildSession(userId)
  }

  private async buildSession(userId: string) {
    const user = await this.db.acrossAllClinics().user.findUniqueOrThrow({
      where: { id: userId },
      include: { clinic: true },
    })

    const token = await this.jwt.signAsync({
      sub: user.id,
      clinicId: user.clinicId,
    })

    return {
      token,
      user: {
        id: user.id,
        clinicId: user.clinicId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        doctorId: user.doctorId,
        isActive: user.isActive,
      },
      clinic: user.clinic,
      permissions: resolvePermissions(user.role, user.extraPermissions),
    }
  }
}

/*
  Mavjud bo'lmagan foydalanuvchi uchun ham xesh tekshiruvi bajarilsin
  deb turgan qiymat. Bu hech kimning paroli emas — argon2 ning bo'sh
  satrdan olingan xeshi.
*/
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'
