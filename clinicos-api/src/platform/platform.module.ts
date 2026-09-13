import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ImpersonationController } from './impersonation.controller'
import { PlatformController } from './platform.controller'
import { PlatformPharmaciesController } from './platform-pharmacies.controller'
import { PlatformPharmaciesService } from './platform-pharmacies.service'
import { AccessService } from './access.service'
import { PlatformService } from './platform.service'

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, ImpersonationController, PlatformPharmaciesController],
  providers: [PlatformService, AccessService, PlatformPharmaciesService],
})
export class PlatformModule {}
