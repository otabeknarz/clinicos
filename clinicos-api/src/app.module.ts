import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { AnalyticsModule } from './analytics/analytics.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { AttendanceModule } from './attendance/attendance.module'
import { AuthModule } from './auth/auth.module'
import { BonusesModule } from './bonuses/bonuses.module'
import { CashControlModule } from './cash-control/cash-control.module'
import { ChatModule } from './chat/chat.module'
import { ClinicModule } from './clinic/clinic.module'
import { DoctorsModule } from './doctors/doctors.module'
import { AuditInterceptor } from './common/audit.interceptor'
import { AuditModule } from './common/audit.module'
import { ContextMiddleware } from './common/context.middleware'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'
import { FeedbackModule } from './feedback/feedback.module'
import { DebtsModule } from './debts/debts.module'
import { ExportModule } from './export/export.module'
import { ImportModule } from './import/import.module'
import { FaceModule } from './face/face.module'
import { GoogleModule } from './google/google.module'
import { NoticesModule } from './notices/notices.module'
import { NotificationsModule } from './notifications/notifications.module'
import { ForecastModule } from './forecast/forecast.module'
import { PatientsModule } from './patients/patients.module'
import { PaymentsModule } from './payments/payments.module'
import { PenaltiesModule } from './penalties/penalties.module'
import { PlatformModule } from './platform/platform.module'
import { PrismaModule } from './prisma/prisma.module'
import { ReceptionModule } from './reception/reception.module'
import { SearchModule } from './search/search.module'
import { StaffModule } from './staff/staff.module'
import { UsersModule } from './users/users.module'
import { VisitsModule } from './visits/visits.module'
import { WardModule } from './ward/ward.module'
import { PharmacyModule } from './pharmacy/pharmacy.module'
import { ServicesModule } from './services/services.module'
import { SignedUrlInterceptor } from './storage/signed-url.interceptor'
import { StorageModule } from './storage/storage.module'
import { PatientModule } from './patient/patient.module'
import { TelegramModule } from './telegram/telegram.module'

@Module({
  imports: [
    TelegramModule,
    PatientModule,
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    PatientsModule,
    ServicesModule,
    AppointmentsModule,
    PaymentsModule,
    DebtsModule,
    ExportModule,
    ImportModule,
    NoticesModule,
    GoogleModule,
    FaceModule,
    ReceptionModule,
    SearchModule,
    VisitsModule,
    DoctorsModule,
    ClinicModule,
    CashControlModule,
    WardModule,
    PharmacyModule,
    StaffModule,
    AttendanceModule,
    BonusesModule,
    PenaltiesModule,
    FeedbackModule,
    ChatModule,
    AnalyticsModule,
    ForecastModule,
    PlatformModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [
    /*
      Tartib muhim va u ATAYLAB shunday.

      NestJS global qorovullarni shu ro'yxatdagi tartibda ishlatadi:

        1. JwtAuthGuard  — tokenni tekshiradi va foydalanuvchini
                           so'rov kontekstiga qo'yadi
        2. PermissionsGuard — o'sha kontekstdan ruxsatlarni o'qiydi

      Ilgari kontekst interseptorda qo'yilgan edi va bu xato edi:
      NestJS'da qorovullar interseptorlardan OLDIN ishlaydi, ya'ni
      ruxsat qorovuli bo'sh kontekstga duch kelardi.

      Barcha endpointlar sukut bo'yicha YOPIQ. Ochiq qilish uchun
      `@Public()` kerak — yangi kontroller yozganda qorovulni
      qo'shishni unutib, uni ochiq qoldirib bo'lmaydi.
    */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    /*
      Audit jurnali. Interseptorlar qorovullardan KEYIN ishlaydi,
      shuning uchun bu yerga yetganda foydalanuvchi tekshirilgan
      va so'rov kontekstiga qo'yilgan bo'ladi.

      Faqat `@Audit(...)` bilan belgilangan marshrutlarga tegadi —
      qolganlariga qo'shimcha so'rov qo'shmaydi.
    */
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    /*
      Fayl kalitlarini imzolangan havolaga o'giradi. Audit'dan
      KEYIN turadi: audit so'rov boshida yozilishi kerak, bu esa
      javob qaytayotganda ishlaydi.
    */
    { provide: APP_INTERCEPTOR, useClass: SignedUrlInterceptor },
  ],
})
export class AppModule implements NestModule {
  /*
    Kontekst BARCHA so'rovlar uchun ochiladi — kirish sahifasi ham
    kiradi. Bir necha yo'l uchun istisno qilinsa, o'sha yo'llarda
    kontekst bo'lmay qolardi va xato faqat ish paytida bilinardi.
  */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*')
  }
}
