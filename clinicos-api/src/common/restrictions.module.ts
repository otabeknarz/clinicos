import { Global, Module } from '@nestjs/common'

import { RestrictionsService } from './restrictions.service'

/**
 * Global: cheklovlar sessiya yasashda ham, har bir so'rovdagi
 * darvozada ham, platforma panelida ham kerak.
 */
@Global()
@Module({
  providers: [RestrictionsService],
  exports: [RestrictionsService],
})
export class RestrictionsModule {}
