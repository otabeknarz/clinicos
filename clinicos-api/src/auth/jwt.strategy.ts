import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { RequestUser } from '../common/request-context'
import { resolvePermissions } from '../common/permissions'
import { PrismaService } from '../prisma/prisma.service'

/** Tokenning ichida nima yotadi */
export interface JwtPayload {
  sub: string
  clinicId: string
  impersonationId?: string | null
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
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessiya yaroqsiz')
    }

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

    return {
      userId: user.id,
      clinicId,
      role: user.role,
      doctorId: user.doctorId,
      permissions: resolvePermissions(user.role, user.extraPermissions),
      impersonationId,
    }
  }
}
