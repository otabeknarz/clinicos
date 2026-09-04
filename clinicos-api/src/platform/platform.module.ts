import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ImpersonationController } from './impersonation.controller'
import { PlatformController } from './platform.controller'
import { PlatformService } from './platform.service'

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, ImpersonationController],
  providers: [PlatformService],
})
export class PlatformModule {}
