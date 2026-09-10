import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
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
  imports: [
    /*
      `JwtModule` SHU YERDA HAM ro'yxatdan o'tadi.

      `AuthModule` uni o'zi uchun ochgan va tashqariga chiqarmagan
      — ya'ni bu modulda `JwtService` mavjud emas edi va ilova
      ishga tushishda yiqilardi. `npm run check` buni ushlamaydi:
      Nest bog'lanishlari KOMPILYATSIYADA emas, ishga tushishda
      tekshiriladi.

      `AuthModule` ni import qilish ham mumkin edi, lekin u bilan
      birga butun kirish mantiqi kelardi — bemor kabinetiga esa
      faqat token imzolash kerak. Kalit bir xil: bemor tokeni
      xodimnikidan `kind` bilan farq qiladi.
    */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [PatientController],
  providers: [PatientAuthService, PatientService, PatientGuard],
})
export class PatientModule {}
