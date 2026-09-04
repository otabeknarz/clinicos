import { Global, Module } from '@nestjs/common'

import { RequestContext } from '../common/request-context'
import { PrismaService } from './prisma.service'

/**
 * Global: baza va so'rov konteksti har bir modulda kerak bo'ladi,
 * har birida qayta import qilib yurmaslik uchun.
 */
@Global()
@Module({
  providers: [PrismaService, RequestContext],
  exports: [PrismaService, RequestContext],
})
export class PrismaModule {}
