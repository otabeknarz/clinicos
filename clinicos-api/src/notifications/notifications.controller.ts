import { Controller, Get } from '@nestjs/common'

import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /*
    GET /notifications

    Ruxsat talab qilinmaydi: xizmatning o'zi foydalanuvchining
    ruxsatiga qarab filtrlaydi va u ko'ra oladigan narsanigina beradi.
  */
  @Get()
  list() {
    return this.notifications.list()
  }

  /*
    GET /notifications/badges

    Yon menyudagi sonlar. Bildirishnomalardan alohida, chunki
    ular boshqa savolga javob beradi: bildirishnoma "nima
    bo'ldi" desa, bu "qaysi bo'limga kirish kerak" deydi.
  */
  @Get('badges')
  badges() {
    return this.notifications.badges()
  }
}
