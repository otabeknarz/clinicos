import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'

import { RequestContext } from './request-context'

/**
 * Har bir so'rov uchun bo'sh kontekst ochadi.
 *
 * NEGA MIDDLEWARE: NestJS'da tartib
 * middleware → qorovullar → interseptorlar → ishlovchi.
 * Kontekst butun so'rovni qamrab olishi kerak, ya'ni eng birinchi
 * bosqichda ochilishi shart. Foydalanuvchi esa keyinroq, qorovulda
 * qo'yiladi — shuning uchun bu yerda faqat bo'sh idish ochiladi.
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContext) {}

  use(_req: Request, _res: Response, next: NextFunction) {
    this.ctx.begin(() => next())
  }
}
