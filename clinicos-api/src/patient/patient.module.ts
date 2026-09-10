import { Module } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'

import { PatientAuthService } from './patient-auth.service'
import { PatientController } from './patient.controller'
import { PatientGuard } from './patient.guard'
import { PatientService } from './patient.service'

/**
 * Bemor kabineti — xodim tomonidan butunlay alohida.
 *
 * Alohida bot, alohida token turi, alohida qorovul va bo'sh
 * ruxsatlar ro'yxati. Umumiy narsa faqat baza.
 */
@Module({
  /*
    TEZLIK CHEKLOVI — faqat shu modulda.

    Kabinet marshrutlari OCHIQ (`@Public()`): ularni tokensiz
    chaqirish mumkin va har bir chaqiruv HMAC hisoblab, bazaga
    boradi. Xodim marshrutlari token orqasida turibdi, ya'ni
    ularga bu shart emas.

    Raqamlarni birma-bir sinab bemorlarni sanab chiqish yo'li
    boshqacha yopilgan: raqamni odam yozmaydi, uni Telegram
    "raqamni ulashish" tugmasi orqali o'zi tasdiqlab beradi. Bu
    cheklov esa oddiy zo'riqishga qarshi.
  */
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  controllers: [PatientController],
  providers: [PatientAuthService, PatientService, PatientGuard],
})
export class PatientModule {}
