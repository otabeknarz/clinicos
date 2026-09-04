import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { RequestContext } from '../request-context'

export const PERMISSION_KEY = 'required-permission'

/**
 * Endpoint uchun talab qilinadigan ruxsat.
 *
 *     @RequirePermission('payments.create')
 *     @Post()
 *     create() { ... }
 *
 * Ruxsat belgilanmagan endpoint — kirgan har qanday foydalanuvchiga
 * ochiq. Shuning uchun uni belgilashni unutmang.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission)

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ctx: RequestContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!required) return true

    const user = this.ctx.require()
    if (user.permissions.includes(required)) return true

    /*
      Nima yetishmayotganini aytmaymiz. "Sizda payments.create yo'q"
      degan javob tizimning ichki tuzilishini oshkor qiladi va
      kerakli ruxsatni topib olishga yordam beradi.
    */
    throw new ForbiddenException('Bu amalga ruxsatingiz yo‘q')
  }
}
