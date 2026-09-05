import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { checkClinicAccess } from '../common/clinic-access'
import { RequestUser } from '../common/request-context'
import { IMPERSONATION_PERMISSIONS, resolvePermissions } from '../common/permissions'
import { PrismaService } from '../prisma/prisma.service'

/** Tokenning ichida nima yotadi */
export interface JwtPayload {
  sub: string
  clinicId: string
  impersonationId?: string | null
  /**
   * Token berilgan paytdagi `passwordChangedAt` (millisekundlarda).
   * Hech qachon almashtirmagan foydalanuvchida `0`.
   */
  pwd?: number
}

/**
 * Tokenni tekshirish.
 *
 * MUHIM: tokendan faqat `sub` (foydalanuvchi id'si) ishonchli
 * olinadi. Rol, ruxsatlar va klinika HAR SAFAR BAZADAN o'qiladi.
 *
 * Nega tokenga yozib qo'ymaymiz: xodim ishdan bo'shatilsa yoki
 * ruxsati olib qo'yilsa, uning qo'lidagi eski token yaroqli
 * bo'lib qolardi va u tizimga kirib turaverardi. Bazadan
 * o'qilsa — keyingi so'rovdayoq kirish yopiladi.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly db: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.db.acrossAllClinics().user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        clinicId: true,
        role: true,
        doctorId: true,
        isActive: true,
        extraPermissions: true,
        passwordChangedAt: true,
        clinic: {
          select: {
            isActive: true,
            subscription: { select: { status: true } },
          },
        },
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessiya yaroqsiz')
    }

    /*
      Parol almashtirilgandan OLDIN berilgan token yaroqsiz.

      NEGA: parol odatda sizib chiqqani uchun almashtiriladi. Uni
      bilgan odamning ochiq sessiyasi qolib ketsa, almashtirishning
      ma'nosi bo'lmasdi — u yana 12 soat ishlab yurardi.

      Taqqoslash ANIQ, vaqt bo'yicha emas: token o'zi bilan
      berilgan paytdagi qiymatni olib yuradi. Ilgari `iat` bilan
      solishtirilardi, lekin u butun soniyalarda — parol
      almashtirilgan soniyada berilgan eski token o'tib ketardi.
    */
    const currentPwd = user.passwordChangedAt?.getTime() ?? 0
    if ((payload.pwd ?? 0) !== currentPwd) {
      throw new UnauthorizedException('Parol o‘zgardi — qaytadan kiring')
    }

    /*
      Klinika to'xtatilgan bo'lsa, qo'ldagi eski token ham
      ishlamaydi. Faqat kirishda tekshirilsa, to'xtatilgan
      klinika xodimi yana 12 soat ishlab yurardi.
    */
    const access = checkClinicAccess({
      role: user.role,
      clinicIsActive: user.clinic.isActive,
      subscriptionStatus: user.clinic.subscription?.status ?? null,
    })
    if (!access.ok) throw new UnauthorizedException(access.reason)

    /*
      Platforma egasi klinika paneliga kirgan bo'lsa, tokendagi
      `clinicId` uning o'z klinikasidan farq qiladi. Bu holatda
      kirish yozuvi ochiq turganini tekshiramiz — yozuv yopilgan
      bo'lsa, kirish ham tugagan.
    */
    let clinicId = user.clinicId
    let impersonationId: string | null = null

    if (payload.impersonationId) {
      if (user.role !== 'SUPERADMIN') {
        throw new UnauthorizedException('Sessiya yaroqsiz')
      }
      const log = await this.db.acrossAllClinics().impersonationLog.findUnique({
        where: { id: payload.impersonationId },
        select: { id: true, clinicId: true, endedAt: true },
      })
      if (!log || log.endedAt) {
        throw new UnauthorizedException('Klinikaga kirish tugagan')
      }
      clinicId = log.clinicId
      impersonationId = log.id
    }

    /*
      Klinika ichida platforma egasining ruxsatlari ISHLAMAYDI.
      Uning o'z ro'yxati `platform.*` dan iborat va u klinika
      endpointlariga to'g'ri kelmaydi — kirgan odam hamma joyda
      403 olardi. Shuning uchun kirish paytiga alohida, faqat
      ko'rish ruxsatlari beriladi.
    */
    const permissions = impersonationId
      ? [...IMPERSONATION_PERMISSIONS]
      : resolvePermissions(user.role, user.extraPermissions)

    return {
      userId: user.id,
      clinicId,
      role: user.role,
      doctorId: user.doctorId,
      permissions,
      impersonationId,
    }
  }
}
