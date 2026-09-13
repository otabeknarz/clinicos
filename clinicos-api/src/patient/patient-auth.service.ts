import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { checkClinicAccess } from '../common/clinic-access'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'

/**
 * Bemor tokeni qancha yashaydi.
 *
 * Qisqa bo'lgani yaxshi: mini app har ochilganda `initData` bor,
 * ya'ni qayta kirish KO'RINMAS — bemor buni sezmaydi ham.
 */
const PATIENT_TOKEN_TTL = '12h'

/**
 * KABINETGA KIRISH.
 *
 * Bemor hech qanday parol kiritmaydi. U kabinetni Telegram mini
 * app ichida ochadi, ilova `initData` ni yuboradi, server uni
 * BEMOR BOTINING tokeni bilan tekshiradi va ichidan Telegram id
 * ni oladi. Id esa `Patient.telegramUserId` ga bog'langan.
 *
 * NEGA PAROL YO'Q: bemorga parol berish uni yo'qotish, tiklash va
 * telefon orqali tasdiqlash degani. Telegram bularning hammasini
 * allaqachon qilib bo'lgan.
 */
@Injectable()
export class PatientAuthService {
  private readonly log = new Logger(PatientAuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * `initData` dan bemor sessiyasi.
   *
   * Bir odam IKKI KLINIKADA bemor bo'lishi mumkin — telefon raqami
   * butun bazada noyob emas, faqat klinika ichida. Bunday holatda
   * token darhol berilmaydi: avval klinikalar ro'yxati qaytadi va
   * bemor birini tanlaydi. Birini o'zboshimchalik bilan tanlab
   * qo'ysak, u boshqa klinikadagi kartasini umuman ko'ra olmasdi.
   */
  async signIn(initData: string, clinicId?: string) {
    const verified = this.telegram.verifyInitData(initData, 'patient')
    if (!verified) {
      throw new UnauthorizedException('Telegram imzosi tasdiqlanmadi')
    }

    const rows = await this.prisma.acrossAllClinics().patient.findMany({
      where: { telegramUserId: verified.telegramUserId },
      select: {
        id: true,
        clinicId: true,
        clinic: {
          select: {
            name: true,
            isActive: true,
            deletedAt: true,
            subscription: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const open = rows.filter(
      (row) =>
        checkClinicAccess({
          role: 'PATIENT',
          clinicIsActive: row.clinic.isActive,
          subscriptionStatus: row.clinic.subscription?.status ?? null,
          clinicDeletedAt: row.clinic.deletedAt,
        }).ok,
    )

    if (open.length === 0) {
      /*
        Sabab ochiq aytiladi. Bu maxfiy ma'lumot emas — odam o'z
        Telegram hisobi haqida so'rayapti — va sababsiz "kirish
        rad etildi" bemorni botga qaytarmasdi.
      */
      throw new UnauthorizedException(
        'Telegram hisobingiz bemor kartasiga ulanmagan. Botga qaytib, ' +
          'telefon raqamingizni ulashing.',
      )
    }

    const chosen = clinicId ? open.find((row) => row.clinicId === clinicId) : null

    if (!chosen && open.length > 1) {
      return {
        token: null,
        clinics: open.map((row) => ({ id: row.clinicId, name: row.clinic.name })),
      }
    }

    const patient = chosen ?? open[0]

    return {
      token: this.jwt.sign(
        { sub: patient.id, clinicId: patient.clinicId, kind: 'patient' },
        { expiresIn: PATIENT_TOKEN_TTL },
      ),
      clinics: null,
    }
  }

  /**
   * Botda ulashilgan raqamni bemor kartasi bilan bog'lash.
   *
   * Raqamni ODAM YOZMAYDI — Telegram uni "raqamni ulashish"
   * tugmasi orqali O'ZI tasdiqlab beradi. Aynan shu narsa
   * raqamlarni birma-bir sinab bemorlarni sanab chiqish yo'lini
   * yopadi: har kim faqat o'z raqamini yubora oladi.
   *
   * BIR NECHTA KLINIKADA topilsa, HAMMASI bog'lanadi — bemorning
   * o'sha klinikalardagi kartalari bitta Telegram hisobiga
   * tegishli va tanlash kirishda bo'ladi.
   */
  async linkByPhone(telegramUserId: string, phone: string): Promise<number> {
    /*
      Telegram raqamni `998901234567` ko'rinishida beradi, bazada
      esa `+998901234567` turadi. Ikkalasini ham qidiramiz — bitta
      "+" tufayli hech kim kabinetsiz qolmasin.
    */
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) return 0

    const db = this.prisma.acrossAllClinics()

    /*
      RAQAM ESLAB QOLINADI — karta hali yo'q bo'lsa ham. Keyin ochilgan
      karta (shu yoki boshqa klinikada) shu yozuvdan bog'lanadi
      (`patients.service.ts`). Aks holda bemor botda "ro'yxatdan
      o'tganman" deydi, qabul xabari esa kelmaydi.
    */
    await db.telegramPhoneLink.upsert({
      where: { phone: digits },
      create: { phone: digits, telegramUserId },
      update: { telegramUserId },
    })

    /*
      Bazadagi raqam har xil yozilgan bo'lishi mumkin: `+998901234567`,
      `998901234567`, `+998 90 123 45 67` (Excel'dan ko'chirilgan).
      Shuning uchun faqat RAQAMLARI solishtiriladi. Barcha klinikalar
      bo'yicha — bu `auth` domeni, filtrsiz mijozga ruxsat bor.
    */
    const count = await db.$executeRaw`
      UPDATE "patients" p
      SET "telegram_user_id" = ${telegramUserId}
      FROM "clinics" c
      WHERE c."id" = p."clinic_id"
        AND c."deleted_at" IS NULL
        AND regexp_replace(p."phone", '[^0-9]', '', 'g') = ${digits}
    `

    this.log.log(`Bemor kabineti: raqam bo‘yicha ${count} ta karta bog‘landi`)
    return count
  }

  /**
   * BEMOR QABULNI TASDIQLADI (botdagi tugma).
   *
   * Qabul `CONFIRMED` ga o'tadi va registratura ertalab kim
   * tasdiqlaganini ko'radi — qo'ng'iroq faqat qolganlariga
   * qilinadi.
   *
   * QABUL AYNAN SHU ODAMNIKI EKANI TEKSHIRILADI: `telegramUserId`
   * qabulning bemoriga to'g'ri kelmasa, hech narsa o'zgarmaydi.
   * Aks holda birovning qabulini tasdiqlab qo'yish mumkin bo'lardi
   * — tugmadagi id ko'rinib turadi.
   *
   * FAQAT OLDINGA: `SCHEDULED` dan `CONFIRMED` ga. Bekor qilingan
   * yoki allaqachon yakunlangan qabul tugma bilan tirilmaydi.
   */
  async confirmAppointment(appointmentId: string, telegramUserId: string): Promise<boolean> {
    const { count } = await this.prisma.acrossAllClinics().appointment.updateMany({
      where: {
        id: appointmentId,
        status: 'SCHEDULED',
        patient: { telegramUserId },
      },
      data: { status: 'CONFIRMED' },
    })

    return count > 0
  }
}
