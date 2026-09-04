import { Body, Controller, Get, Patch } from '@nestjs/common'

import { ProfileInputDto } from './users.dto'
import { UsersService } from './users.service'

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /*
    GET /users

    Ruxsat talab qilinmaydi — servisning o'zi javobni qisqartiradi.
    `users.manage` bo'lmasa faqat ism va id qaytadi (chat uchun).
  */
  @Get('users')
  list() {
    return this.users.list()
  }

  /*
    PATCH /profile

    Ruxsat talab qilinmaydi: har bir xodim o'z ismini, telefonini
    va rasmini o'zgartira olishi kerak. Qaysi yozuv o'zgarishi
    tokendan aniqlanadi.
  */
  @Patch('profile')
  updateProfile(@Body() dto: ProfileInputDto) {
    return this.users.updateProfile(dto)
  }
}
