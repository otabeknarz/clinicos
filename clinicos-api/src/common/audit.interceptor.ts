import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { Observable } from 'rxjs'

import { AuditService } from './audit.service'
import { clientIp } from './client-ip'

export const AUDIT_KEY = 'audit-entry'

export interface AuditSpec {
  /** `AuditLog.action`: view_medical | create | update | delete | export */
  action: string
  /** Qaysi jadval haqida: 'Visit', 'Patient' … */
  entityType: string
  /** Yozuv id'si qaysi marshrut parametrida. Bo'lmasa — null */
  idParam?: string
}

/**
 * Endpointni audit jurnaliga tushiradi.
 *
 *     @Audit('view_medical', 'Visit')
 *     @Get('visits/:id')
 *
 * Qayd HANDLER ISHLASHIDAN OLDIN yoziladi va yozilmasa so'rov
 * bajarilmaydi — sabablari `audit.service.ts` da.
 */
export const Audit = (action: string, entityType: string, idParam = 'id') =>
  SetMetadata(AUDIT_KEY, { action, entityType, idParam } satisfies AuditSpec)

/**
 * NEGA INTERSEPTOR, HAR BIR SERVISDA QO'LDA EMAS:
 *
 * Qo'lda yozilsa, yangi tibbiy endpoint qo'shgan odam uni
 * unutadi — va aynan unutilgan joy jurnalda ko'rinmay qoladi.
 * Bu yerda esa yozuv marshrutning o'ziga, dekorator bilan
 * biriktiriladi: kod o'qiganda ham darrov ko'rinadi.
 *
 * TARTIB: NestJS'da qorovullar interseptorlardan OLDIN ishlaydi,
 * ya'ni bu yerga yetib kelganda foydalanuvchi allaqachon
 * tekshirilgan va so'rov kontekstiga qo'yilgan.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const spec = this.reflector.getAllAndOverride<AuditSpec | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!spec) return next.handle()

    const req = context.switchToHttp().getRequest<Request>()
    const params = (req.params ?? {}) as Record<string, string | undefined>

    await this.audit.record({
      action: spec.action,
      entityType: spec.entityType,
      entityId: spec.idParam ? (params[spec.idParam] ?? null) : null,
      meta: { method: req.method, path: req.route?.path ?? req.path },
      ipAddress: clientIp(req),
      userAgent: req.get('user-agent') ?? null,
    })

    return next.handle()
  }
}
