import { Module } from '@nestjs/common'

import { PharmacyContextService } from './pharmacy-context.service'
import { PharmacyController } from './pharmacy.controller'
import { PharmacyPurchasesService } from './pharmacy-purchases.service'
import { PharmacyStaffService } from './pharmacy-staff.service'
import { PharmacyService } from './pharmacy.service'

/**
 * Apteka — klinikadan alohida biznes, o'z moduli.
 *
 * `PrismaService`, `RequestContext` va `StorageService` global
 * modullardan keladi — shu yerda qayta ro'yxatga olinmaydi.
 */
@Module({
  controllers: [PharmacyController],
  providers: [
    PharmacyContextService,
    PharmacyService,
    PharmacyStaffService,
    PharmacyPurchasesService,
  ],
})
export class PharmacyModule {}
