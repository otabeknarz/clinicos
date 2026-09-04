import { Global, Module } from '@nestjs/common'

import { AuditService } from './audit.service'

/**
 * Global: audit jurnali kirish moduliga ham, tibbiy yozuv
 * modullariga ham kerak. `PrismaModule` bilan bir xil sabab —
 * har birida qayta import qilib yurmaslik uchun.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
