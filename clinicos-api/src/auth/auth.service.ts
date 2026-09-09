import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'

import { toApi } from '../common/api-enum'
import { checkClinicAccess } from '../common/clinic-access'
import { AuditService } from '../common/audit.service'
import { toApiClinic } from '../clinic/clinic.service'
import { RequestContext } from '../common/request-context'
import { isPermissionBlocked } from '../common/modules'
import { IMPERSONATION_PERMISSIONS, resolvePermissions } from '../common/permissions'
import { PrismaService } from '../prisma/prisma.service'

/** Kirish qaydiga yoziladigan so'rov ma'lumoti */
export interface LoginMeta {
  ipAddress?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly ctx: RequestContext,
  ) {}

  /**
   * Tizimga kirish.
   *
   * Email KLINIKA ICHIDA noyob, butun tizimda emas — ikki xil
   * klinikada bir xil email bo'lishi mumkin. Shuning uchun avval
   * email bo'yicha topamiz, keyin parolni tekshiramiz.
   *
   * XAVFSIZLIK: email topilmasa ham parol xeshi bilan solishtirish
   * bajariladi. Aks holda javob vaqti farq qilib, qaysi email
   * ro'yxatda borligini aniqlab olish mumkin bo'lardi.
   */
  async login(email: string, password: string, meta: LoginMeta = {}) {
    const user = await this.db.acrossAllClinics().user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            isActive: true,
            deletedAt: true,
            subscription: { select: { status: true } },
          },
        },
      },
    })

    const hash = user?.passwordHash ?? DUMMY_HASH
    const ok = await argon2.verify(hash, password).catch(() => false)

    if (!user || !ok) {
      // Bir xil xabar: qaysi biri noto'g'ri ekanini aytmaymiz
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri')
    }
    /*
      Klinika ishlashga yaroqlimi — obuna holati bilan birga.
      Batafsil: `common/clinic-access.ts`.
    */
    const access = checkClinicAccess({
      role: user.role,
      clinicIsActive: user.clinic.isActive,
      subscriptionStatus: user.clinic.subscription?.status ?? null,
      clinicDeletedAt: user.clinic.deletedAt,
    })
    if (!access.ok) throw new UnauthorizedException(access.reason)

    await this.db
      .acrossAllClinics()
      .user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    /*
      Kim, qachon va qayerdan kirgani audit jurnalida qoladi.
      Muvaffaqiyatsiz urinish YOZILMAYDI: noto'g'ri terilgan
      parol jurnalni to'ldirib, haqiqiy hodisani ko'mib yuboradi.
      Urinishlarni cheklash — alohida ish (rate limiting).
    */
    await this.audit.recordLogin({
      clinicId: user.clinicId,
      userId: user.id,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    })

    return this.buildSession(user.id)
  }

  /**
   * O'Z PAROLINI ALMASHTIRISH.
   *
   * Joriy parol SO'RALADI. Sababi: qarovsiz qolgan ochiq sessiya
   * yonidan o'tgan odam parolni almashtirib, hisobni o'zlashtirib
   * ololmasin. Token borligi "bu o'sha odam" degani emas.
   *
   * Almashtirilgach `passwordChangedAt` yoziladi va SHU VAQTDAN
   * OLDIN berilgan barcha tokenlar yaroqsiz bo'ladi
   * (`jwt.strategy.ts`). Ya'ni parol sizib chiqqan bo'lsa, uni
   * bilgan odamning ochiq sessiyasi ham darhol uziladi — aks
   * holda almashtirishning ma'nosi qolmasdi.
   *
   * Javobda YANGI sessiya qaytadi: chaqiruvchining o'z tokeni ham
   * eskirgan bo'lardi va u o'zi chiqib qolardi.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.acrossAllClinics().user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    })

    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false)
    if (!ok) {
      throw new BadRequestException('Joriy parol noto‘g‘ri')
    }

    /*
      Bir xil parolni qayta qo'yishning ma'nosi yo'q va u
      `passwordChangedAt` ni surib, boshqa qurilmalarni bekorga
      uzib yuborardi.
    */
    if (await argon2.verify(user.passwordHash, newPassword).catch(() => false)) {
      throw new BadRequestException('Yangi parol eskisidan farq qilsin')
    }

    await this.db.acrossAllClinics().user.update({
      where: { id: user.id },
      data: {
        passwordHash: await argon2.hash(newPassword),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    })

    const { impersonationId, clinicId } = this.ctx.require()
    return this.buildSession(
      userId,
      impersonationId ? { id: impersonationId, clinicId } : null,
    )
  }

  /**
   * Sahifa yangilanganda sessiyani tiklash.
   *
   * Platforma egasi klinika paneliga kirgan bo'lsa, sessiya
   * O'SHA klinikaniki bo'lib qaytadi — aks holda yangilashdan
   * keyin u bilmasdan platforma paneliga qaytib qolardi.
   */
  async me(userId: string) {
    const { impersonationId, clinicId } = this.ctx.require()
    return this.buildSession(
      userId,
      impersonationId ? { id: impersonationId, clinicId } : null,
    )
  }

  /**
   * Klinika paneliga kirish uchun sessiya.
   *
   * Token QISQA MUDDATLI (`IMPERSONATION_TTL`): platforma xodimi
   * ishini tugatib, chiqishni unutsa ham kirish o'zi yopiladi.
   * Odatdagi 12 soat bu yerda uzoq — bu vaqtinchalik kirish.
   */
  async buildImpersonatedSession(userId: string, impersonationId: string, clinicId: string) {
    return this.buildSession(userId, { id: impersonationId, clinicId })
  }

  private async buildSession(
    userId: string,
    impersonation: { id: string; clinicId: string } | null = null,
  ) {
    const user = await this.db.acrossAllClinics().user.findUniqueOrThrow({
      where: { id: userId },
    })

    /*
      Kirilgan holatda sessiyada KO'RSATILADIGAN klinika — nishon
      klinika, foydalanuvchining o'zinikisi emas. Interfeys shu
      nomni yuqorida ko'rsatadi.
    */
    /*
      Klinikani AYNAN `GET /clinic` bilan bir xil shaklda
      qaytaramiz. Xom Prisma yozuvi qaytarilsa, `workingHours`
      tushib qolar, `isActive` va `updatedAt` esa ortiqcha
      chiqib ketardi — sxemaga yangi ustun qo'shilganda u ham
      o'z-o'zidan tashqariga chiqardi.
    */
    const clinicRow = await this.db.acrossAllClinics().clinic.findUniqueOrThrow({
      where: { id: impersonation?.clinicId ?? user.clinicId },
      include: { workingHours: { orderBy: { weekday: 'asc' } } },
    })

    const token = await this.jwt.signAsync(
      {
        sub: user.id,
        clinicId: impersonation?.clinicId ?? user.clinicId,
        impersonationId: impersonation?.id ?? null,
        /*
          Parol qachon almashtirilgani. Tokendagi qiymat bazadagi
          bilan mos kelmasa, token yaroqsiz (`jwt.strategy.ts`).

          NEGA `iat` YETMAYDI: u butun soniyalarda va yaxlitlangan.
          Parol almashtirilgan soniyada berilgan eski token
          tekshiruvdan o'tib ketardi — sinov aynan shuni ushladi.
          Bu yerda esa taqqoslash aniq: eski token eski qiymatni
          olib yuradi.

          Hech qachon almashtirmagan foydalanuvchida `0`, ya'ni
          bu o'zgarish mavjud sessiyalarni uzmaydi.
        */
        pwd: user.passwordChangedAt?.getTime() ?? 0,
      },
      impersonation ? { expiresIn: IMPERSONATION_TTL } : undefined,
    )

    return {
      token,
      user: {
        id: user.id,
        clinicId: impersonation?.clinicId ?? user.clinicId,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        /*
          Interfeys rolni KICHIK harfda kutadi ('superadmin'),
          bazada esa 'SUPERADMIN'. Bu yerda o'girish unutilgan
          edi: natijada `role === 'superadmin'` tekshiruvlari
          hech qachon to'g'ri bo'lmasdi va platforma egasi
          o'zining paneli o'rniga klinika paneliga tushib,
          hamma joyda 403 olardi.
        */
        role: toApi(user.role),
        avatarUrl: user.avatarUrl,
        doctorId: user.doctorId,
        isActive: user.isActive,
        /*
          Egasi parolni qayta belgilagan bo'lsa, interfeys
          almashtirishni so'raydi.
        */
        mustChangePassword: user.mustChangePassword,
      },
      clinic: toApiClinic(clinicRow),
      /*
        O'CHIRILGAN MODULNING RUXSATLARI SESSIYAGA TUSHMAYDI.

        Frontend `permissions` ro'yxatiga qarab menyuni quradi va
        tugmalarni ko'rsatadi. Modulni shu yerda kesib tashlasak,
        butun interfeys o'z-o'zidan bo'ysunadi — har bir sahifada
        alohida "bu modul yoqilganmi" degan shart yozish shart emas
        va yangi sahifada u unutilmaydi.

        Bu XAVFSIZLIK EMAS, ko'rinish. Haqiqiy to'siq —
        `PermissionsGuard`, u har so'rovda modulni qaytadan
        tekshiradi.
      */
      permissions: (impersonation
        ? [...IMPERSONATION_PERMISSIONS]
        : resolvePermissions(user.role, user.extraPermissions)
      ).filter((permission) => !isPermissionBlocked(permission, clinicRow.disabledModules)),
    }
  }
}

/*
  Klinika paneliga kirish tokenining muddati.

  Qisqa: bu vaqtinchalik kirish, ish smenasi emas. Muddati
  tugagach platforma xodimi qaytadan sabab yozib kiradi va
  yangi yozuv qoladi — ya'ni jurnal ham aniqroq bo'ladi.
*/
const IMPERSONATION_TTL = '30m'

/*
  Mavjud bo'lmagan foydalanuvchi uchun ham xesh tekshiruvi bajarilsin
  deb turgan qiymat. Bu hech kimning paroli emas — argon2 ning bo'sh
  satrdan olingan xeshi.
*/
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'
