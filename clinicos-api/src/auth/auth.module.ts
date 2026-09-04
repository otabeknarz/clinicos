import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          /*
            `expiresIn` ning turi `ms` kutubxonasidan keladi va oddiy
            `string` ni qabul qilmaydi. Qiymat sozlamadan kelgani
            uchun turini shu yerda aniqlaymiz.
          */
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '12h') as `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  /*
    `PlatformModule` klinika paneliga kirish uchun sessiya
    yasaydi. Token yasashni o'zi takrorlamasin — muddat va
    ichidagi maydonlar bir joyda tursin.
  */
  exports: [AuthService],
})
export class AuthModule {}
