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
}
