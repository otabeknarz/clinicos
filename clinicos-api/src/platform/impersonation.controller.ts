import { Controller, Post } from '@nestjs/common'

import { PlatformService } from './platform.service'

/**
 * KLINIKA PANELIDAN CHIQISH.
 *
 * NEGA ALOHIDA KONTROLLER: `PlatformController` butunlay
 * `platform.view` bilan yopilgan va bu ataylab — yangi platforma
 * endpointini ochiq qoldirib bo'lmaydi.
 *
 * Chiqish esa boshqacha: klinika panelida turgan odamda o'sha
 * payt `platform.*` ruxsatlari YO'Q, faqat ko'rish ruxsatlari
 * bor. Uni o'sha kontrollerga qo'ysak, kirgan odam chiqa olmay
 * qolardi.
 *
 * Kontroller darajasidagi qoidaga "istisno" mexanizmi qo'shish
 * ham mumkin edi, lekin u keyinchalik platforma endpointida
 * ishlatilib, himoyani ochib yuborishi mumkin. Shuning uchun
 * istisno emas — alohida joy, bitta marshrut bilan.
 *
 * XAVFSIZ: ruxsat talab qilinmaydi, lekin id ham qabul
 * qilinmaydi. Odam faqat O'ZI kirgan sessiyani yopadi — qaysi
 * biri ekanini server tokendan biladi. Klinika panelida
 * bo'lmagan odamga bu endpoint hech narsa bermaydi.
 */
@Controller('platform/impersonations')
export class ImpersonationController {
  constructor(private readonly platform: PlatformService) {}

  // POST /platform/impersonations/end
  @Post('end')
  end() {
    return this.platform.endImpersonation()
  }
}
