import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { RequestContext } from './request-context'

/**
 * AUDIT JURNALI — tibbiy yozuvga kim tegganini qayd etish.
 *
 * NEGA KERAK: bemorning tashxisi — tibbiy sir. Kim ochganini
 * bilmasak, sizib chiqqanda kimdan so'rashni ham bilmaymiz.
 * Jurnal o'g'irlikni to'smaydi, lekin uni ANIQLASA bo'ladigan
 * qiladi — va bilinishini bilgan odam ochmaydi.
 *
 * QAYD KIRISHDAN OLDIN YOZILADI. Bu tizimdagi boshqa joylar
 * bilan bir xil qoida: klinika paneliga kirish yozuvi ham
 * kirishdan oldin yaratiladi. Ma'lumot berilib, keyin qayd
 * yozilsa — orada xato chiqqanda ma'lumot ketgan, iz qolmagan
 * bo'lardi. Shuning uchun jurnal yozilmasa, so'rov ham bajarilmaydi.
 *
 * IZOH: qayd urinish haqida. Yozuv topilmasa yoki boshqa
 * klinikaniki bo'lsa ham jurnalda qoladi — begona bemor id'sini
 * birma-bir sinab ko'rish aynan shunday ko'rinadi.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  /** Kirgan foydalanuvchi nomidan qayd */
  async record(entry: {
    action: string
    entityType: string
    entityId?: string | null
    meta?: Record<string, unknown>
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<void> {
    const user = this.ctx.require()

    /*
      Platforma egasi klinika paneliga kirgan bo'lsa, jurnalda
      shu ham ko'rinsin: yozuvni ochgan odam klinika xodimi emas.
    */
    const meta = user.impersonationId
      ? { ...(entry.meta ?? {}), impersonationId: user.impersonationId }
      : (entry.meta ?? {})

    await this.prisma.forCurrentClinic().auditLog.create({
      data: {
        // Filtr buni baribir bosib yozadi — tip talab qilgani uchun turibdi
        clinicId: user.clinicId,
        userId: user.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        meta: meta as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    })
  }

  /**
   * Tizimga kirish qaydi.
   *
   * Alohida metod, chunki kirish paytida so'rov konteksti hali
   * yo'q — qorovul `@Public()` endpointda ishlamaydi. Shuning
   * uchun `clinicId` qo'lda beriladi va filtrsiz mijoz ishlatiladi.
   *
   * Bu qayd so'rovni TO'XTATMAYDI: parol to'g'ri bo'la turib,
   * jurnal yozilmagani uchun odamni ishga qo'ymaslik — tibbiy
   * muassasada zarari foydasidan ko'p. Xato jurnalga chiqadi.
   */
  async recordLogin(entry: {
    clinicId: string
    userId: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<void> {
    try {
      await this.prisma.acrossAllClinics().auditLog.create({
        data: {
          clinicId: entry.clinicId,
          userId: entry.userId,
          action: 'login',
          entityType: 'User',
          entityId: entry.userId,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      })
    } catch (error) {
      this.logger.error('Kirish qaydi yozilmadi', error as Error)
    }
  }
}
