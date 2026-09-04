import { Body, Controller, Get, Post } from '@nestjs/common'
import { IsEmail, IsString, MinLength } from 'class-validator'

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly ctx: RequestContext,
  ) {}

  // POST /auth/login  →  { user, clinic, permissions, token }
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }

  // GET /auth/me  →  sahifa yangilanganda sessiyani tiklash
  @Get('me')
  me() {
    return this.auth.me(this.ctx.require().userId)
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
