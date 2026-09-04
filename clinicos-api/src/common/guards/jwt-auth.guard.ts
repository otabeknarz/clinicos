import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

import { RequestContext, RequestUser } from '../request-context'

export const PUBLIC_KEY = 'is-public'

/**
 * Tokensiz ochiq endpoint.
 *
 * Faqat kirish va shunga o'xshash bir-ikki joyda ishlatiladi.
 * Qolgan hamma narsa AVTOMATIK yopiq — yangi kontroller yozganda
 * qorovulni qo'shishni unutib, endpointni ochiq qoldirib bo'lmaydi.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true)

/**
 * Tokenni tekshiradi va foydalanuvchini so'rov kontekstiga qo'yadi.
 *
 * NEGA KONTEKST SHU YERDA QO'YILADI: NestJS'da tartib
 * qorovullar → interseptorlar. Kontekst interseptorda qo'yilsa,
 * undan oldin ishlaydigan ruxsat qorovuli bo'sh kontekstga
 * duch keladi. Buni ilgari sinovda ko'rdik: `/patients` 500
 * qaytardi, `/auth/me` esa ishladi — chunki unda ruxsat
 * talab qilinmaydi va qorovul erta chiqib ketardi.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly ctx: RequestContext,
  ) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (isPublic) return true

    // Passport tokenni tekshiradi va `request.user` ni to'ldiradi
    await super.canActivate(context)

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user
    if (user) this.ctx.set(user)

    return true
  }
}
