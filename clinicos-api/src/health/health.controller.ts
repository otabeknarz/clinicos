import { Controller, Get } from '@nestjs/common'

import { Public } from '../common/guards/jwt-auth.guard'

/**
 * GET /health — ilova so'rov qabul qilishga tayyormi.
 *
 * NEGA KERAK: Coolify yangi konteynerni shu javobga qarab "tayyor" deb
 * biladi (Dockerfile'dagi `HEALTHCHECK`). Tekshiruvsiz u eski konteynerni
 * yangisi migratsiya va ishga tushishni tugatmasdan to'xtatardi — har bir
 * yangilanishda 20–40 soniya barcha sahifalar "Xatolik yuz berdi" ko'rsatardi.
 *
 * Bazaga so'rov yubormaydi: baza bir zum sekinlashsa, sog'lom konteyner
 * "kasal" deb qayta ishga tushirilmasin. Ilova `Server tayyor` bo'lgach
 * (Prisma ulangandan keyin) quloq sola boshlaydi.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true }
  }
}
