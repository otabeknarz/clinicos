import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { Request } from 'express'
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

import { clientIp } from '../common/client-ip'
import { Public } from '../common/guards/jwt-auth.guard'
import { RequestContext } from '../common/request-context'
import { AuthService } from './auth.service'

class LoginDto {
  @IsEmail({}, { message: 'Email formati noto‘g‘ri' })
  email!: string

  @IsString()
  @MinLength(1, { message: 'Parol kiritilmagan' })
  password!: string
}

/**
 * Parolni almashtirish.
 *
 * Joriy parol MAJBURIY: token borligi "bu o'sha odam" degani
 * emas. Qarovsiz qolgan ochiq sessiya yonidan o'tgan odam
 * hisobni o'zlashtirib ololmasin.
 */
class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Joriy parolni kiriting' })
  currentPassword!: string

  @IsString()
  @MinLength(8, { message: 'Yangi parol kamida 8 belgi bo‘lsin' })
  @MaxLength(200)
  newPassword!: string
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly ctx: RequestContext,
  ) {}

  /*
    POST /auth/login  →  { user, clinic, permissions, token }

    Manzil va brauzer audit jurnaliga yoziladi. Proksi orqasida
    manzil qanday olinishi — `common/client-ip.ts` da.
  */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, {
      ipAddress: clientIp(req),
      userAgent: req.get('user-agent') ?? null,
    })
  }

  // GET /auth/me  →  sahifa yangilanganda sessiyani tiklash
  @Get('me')
  me() {
    return this.auth.me(this.ctx.require().userId)
  }

  /*
    POST /auth/password

    O'z parolini almashtirish. Har bir rol uchun ochiq — bu
    o'zining hisobi, ruxsat talab qilinmaydi.

    Javobda YANGI sessiya qaytadi: almashtirilgach eski tokenlar
    yaroqsiz bo'ladi va chaqiruvchi o'zi chiqib qolardi.
    Interfeys tokenni almashtirib qo'yishi kerak.
  */
  @Post('password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      this.ctx.require().userId,
      dto.currentPassword,
      dto.newPassword,
    )
  }

  /*
    POST /auth/logout

    Token serverda saqlanmaydi, shuning uchun bu yerda o'chiradigan
    narsa yo'q — mijoz tokenni tashlab yuboradi.

    DASTURCHIGA: tokenni majburan bekor qilish kerak bo'lsa
    (masalan xodim ishdan bo'shatilganda), `Session` jadvalidan
    foydalaning: token xeshini saqlab, har so'rovda tekshiring.
    Hozir bunga ehtiyoj yo'q, chunki rol va faollik baribir har
    so'rovda bazadan o'qiladi.
  */
  @Post('logout')
  logout() {
    return { ok: true }
  }
}
