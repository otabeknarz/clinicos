import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import { RequestContext } from '../common/request-context'
import { forClinic } from './tenant.extension'

/**
 * Bazaga ulanish.
 *
 * IKKI XIL MIJOZ BOR va ularning nomi ATAYLAB har xil:
 *
 *   `db.forCurrentClinic()` — kundalik ish. Har bir so'rov joriy
 *                             klinika bilan cheklanadi.
 *
 *   `db.acrossAllClinics()` — cheklovsiz. FAQAT platforma paneli
 *                             uchun (SUPERADMIN).
 *
 * Nomlar bir-biriga o'xshamaydi, chunki ikkinchisini adashib
 * ishlatish butun tizimni ochib yuboradi. `db.client` degan
 * betaraf nom bo'lganida, qaysi biri ekanini kod o'qiyotgan odam
 * payqamasdi.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  /*
    Kengaytirilgan mijoz har bir so'rovda qayta yasalmaydi —
    klinika bo'yicha eslab qolinadi. Yasash arzon emas, so'rov
    esa sekundiga o'nlab bo'ladi.
  */
  private readonly scoped = new Map<string, ReturnType<typeof forClinic>>()

  constructor(private readonly ctx: RequestContext) {
    /*
      Prisma 7 dan boshlab mijoz bazaga o'zi ulanmaydi — drayver
      adapteri beriladi. Ulanish manzili faqat muhitdan olinadi.
    */
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Bazaga ulandi')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  /**
   * Joriy klinika bilan cheklangan mijoz.
   *
   * Klinika ichidagi HAR QANDAY so'rov shu orqali ketadi.
   */
  forCurrentClinic() {
    const { clinicId } = this.ctx.require()

    const cached = this.scoped.get(clinicId)
    if (cached) return cached

    const client = forClinic(this, clinicId)
    this.scoped.set(clinicId, client)
    return client
  }

  /**
   * CHEKLOVSIZ mijoz — barcha klinikalar bo'ylab.
   *
   * FAQAT platforma paneli uchun: klinikalar ro'yxati, obunalar,
   * hisoblar, umumiy tahlil. Chaqiruvchi joyda `SUPERADMIN`
   * qorovuli bo'lishi SHART.
   *
   * Klinika bo'limlarida buni ishlatmang. Ishlatilsa, bir klinika
   * boshqasining ma'lumotini ko'radi.
   */
  acrossAllClinics(): PrismaClient {
    return this
  }
}
