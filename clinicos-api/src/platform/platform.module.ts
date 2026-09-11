import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ImpersonationController } from './impersonation.controller'
import { PlatformController } from './platform.controller'
import { PlatformPharmaciesController } from './platform-pharmacies.controller'
import { PlatformPharmaciesService } from './platform-pharmacies.service'
import { PlatformService } from './platform.service'

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, ImpersonationController, PlatformPharmaciesController],
  providers: [PlatformService, PlatformPharmaciesService],
})
export class PlatformModule {}
