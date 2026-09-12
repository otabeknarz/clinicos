import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomBytes } from 'node:crypto'
import * as argon2 from 'argon2'

import { toApi } from '../common/api-enum'
import { checkClinicAccess } from '../common/clinic-access'
import { AuditService } from '../common/audit.service'
import { toApiClinic } from '../clinic/clinic.service'
import { RequestContext } from '../common/request-context'
import { isPermissionBlocked, TRIAL_DAYS, TRIAL_DISABLED_MODULES } from '../common/modules'
import { looksLikePhone, normalizePhone } from '../common/phone'
import { IMPERSONATION_PERMISSIONS, resolvePermissions } from '../common/permissions'
import { DISABLED_BY_KIND } from '../common/modules'
import { PrismaService } from '../prisma/prisma.service'
import { TelegramService } from '../telegram/telegram.service'
import { RegisterDto } from './register.dto'

/** Kirish qaydiga yoziladigan so'rov ma'lumoti */
export interface LoginMeta {
  ipAddress?: string | null
  userAgent?: string | null
}

@Injectable()
export class AuthService {
  /**
   * TASDIQLANMAGAN RO'YXATDAN O'TISHLAR — XOTIRADA.
   *
   * Bazaga yozilmaydi: bu yerda hali klinika ham, foydalanuvchi ham
   * yo'q — faqat 15 daqiqalik niyat. Server qayta ishga tushsa
   * yo'qoladi va odam formani qaytadan to'ldiradi. Bir martalik
   * Telegram kodlari ham xuddi shunday saqlanadi
   * (`telegram.service.ts`), ya'ni bu ILOVA BITTA NUSXADA
   * ishlashiga tayanadi — ikkinchi nusxa qo'shilsa, ikkalasini ham
   * jadvalga ko'chirish kerak bo'ladi.
   */
  private readonly pending = new Map<string, PendingRegistration>()

  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly ctx: RequestContext,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
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
    /*
      TELEFON YOKI EMAIL.

      Yangi klinikalar telefon bilan ro'yxatdan o'tadi, eskilari
      esa email bilan ochilgan. Kirish maydoni bitta: odam nima
      bilan ro'yxatdan o'tganini eslab o'tirmasligi kerak.

      Raqam yozilishi erkin (`+998 90 123 45 67`, `909123456`) —
      shu sababdan bazadagi bilan solishtirishdan oldin bir
      ko'rinishga keltiriladi.
    */
    const typed = email.trim()
    const asPhone = looksLikePhone(typed) ? normalizePhone(typed) : null
    /*
      BITTA EMAIL BILAN BIR NECHTA HISOB BO'LISHI MUMKIN.

      Email butun tizimda emas, KLINIKA ICHIDA noyob
      (`@@unique([clinicId, email])`) — ya'ni bitta odam ikki
      klinikada ishlashi mumkin va bu ataylab shunday.

      Ilgari bu yerda `findFirst` turardi va u tartibsiz bitta
      yozuvni olardi. Natijada: platforma egasi yangi klinika
      ochib, egasiga allaqachon mavjud emailni bersa, o'sha odam
      YANGI paroli bilan kira olmasdi — tekshiruv ESKI hisobning
      xeshiga qarshi ketardi va "email yoki parol noto'g'ri" deb
      chiqardi. Sababi ko'rinmasdi, chunki xabar ataylab umumiy.

      Endi barcha mos hisob olinadi va parol har biriga solishtiriladi:
      qaysi biriga to'g'ri kelsa, o'shanikiga kiriladi.
    */
    const candidates = await this.db.acrossAllClinics().user.findMany({
      where: {
        isActive: true,
        ...(asPhone
          ? { phone: asPhone }
          : { email: typed.toLowerCase() }),
      },
      /* Barqaror tartib: bir xil parolli ikki hisobda ham javob o'zgarmasin */
      orderBy: { createdAt: 'asc' },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            isActive: true,
            deletedAt: true,
            kind: true,
            suspendReason: true,
            subscription: { select: { status: true, trialEndsAt: true } },
          },
        },
      },
    })

    const matched: typeof candidates = []
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.passwordHash, password).catch(() => false)) {
        matched.push(candidate)
      }
    }

    /*
      PAROL TO'G'RI KELGANLAR ICHIDAN ISHLAYDIGANINI TANLAYMIZ.

      Eski hisob o'chirilgan yoki to'xtatilgan klinikaga tegishli
      bo'lishi mumkin. Faqat birinchi mos kelganini olsak, odam
      yangi klinikasiga kira turib "klinika o'chirilgan" degan
      xabarni ko'rardi — holbuki uning ishlaydigan hisobi ham bor.
    */
    const user =
      matched.find(
        (candidate) =>
          checkClinicAccess({
            role: candidate.role,
            clinicIsActive: candidate.clinic.isActive,
            subscriptionStatus: candidate.clinic.subscription?.status ?? null,
            trialEndsAt: candidate.clinic.subscription?.trialEndsAt ?? null,
            clinicDeletedAt: candidate.clinic.deletedAt,
            clinicKind: candidate.clinic.kind,
            suspendReason: candidate.clinic.suspendReason,
          }).ok,
      ) ??
      matched[0] ??
      null

    if (!user) {
      /*
        Email umuman topilmagan bo'lsa ham vaqt bir xil ketsin — aks
        holda javob tezligiga qarab qaysi email ro'yxatda borligini
        bilib olish mumkin edi.
      */
      if (candidates.length === 0) {
        await argon2.verify(DUMMY_HASH, password).catch(() => false)
      }
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
      trialEndsAt: user.clinic.subscription?.trialEndsAt ?? null,
      clinicDeletedAt: user.clinic.deletedAt,
      clinicKind: user.clinic.kind,
      suspendReason: user.clinic.suspendReason,
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

  /**
   * O'ZI RO'YXATDAN O'TISH — 14 KUN BEPUL.
   *
   * Hech kimning tasdig'ini kutmaydi: klinika shu zahoti ochiladi
   * va odam ichkariga KIRGAN holda chiqadi. Sotuvchi qo'ng'iroq
   * qilguncha kutish mahsulotni ko'rsatmasdan sovutib yuborardi.
   *
   * Ayni paytda yozuv platformaga SO'ROV bo'lib tushadi (`Lead`):
   * kim, qaysi klinikadan, qaysi lavozimda va qaysi raqamdan —
   * sotuv ishi shundan boshlanadi.
   *
   * SINOV MODULLARI CHEKLANGAN (`TRIAL_DISABLED_MODULES`):
   * kundalik ish to'liq ochiq, rahbar qatlami (tushum, tahlil,
   * kassa solishtiruvi, statsionar) yopiq turadi.
   *
   * TASDIQLASH KODI YO'Q. SMS xizmati yo'q, Telegram orqali
   * tasdiqlash esa ro'yxatdan o'tishga ikkinchi ilova qo'shadi.
   * Raqam baribir tekshiriladi — sotuvchi qo'ng'iroq qilganda.
   */
  async startRegistration(dto: RegisterDto) {
    const phone = normalizePhone(dto.phone)

    /*
      RAQAM BAND BO'LSA — YANGI HISOB OCHILMAYDI.

      Aks holda bir odam ikki marta ro'yxatdan o'tib, birinchi
      klinikasini "yo'qotib" qo'yardi: kirish ikkalasiga ham
      to'g'ri kelib, qaysi biriga tushishi tasodifga qolardi.
    */
    const taken = await this.db
      .acrossAllClinics()
      .user.findFirst({ where: { phone, isActive: true }, select: { id: true } })

    if (taken) {
      throw new BadRequestException(
        'Bu raqam bilan hisob allaqachon bor — kirish bo‘limidan foydalaning',
      )
    }

    /*
      RAQAM TASDIQLANMAGUNCHA HECH NARSA YARATILMAYDI.

      Bu ro'yxatdan o'tishning yagona himoyasi: aks holda kimdir
      tanishining (yoki raqobatchisining) raqamini yozib, uning
      nomidan hisob ochib ketardi — keyin haqiqiy egasi o'z
      raqami bilan kira olmasdi.

      NEGA TELEGRAM, SMS EMAS: bepul SMS xizmati yo'q —
      O'zbekistondagi shlyuzlar (Eskiz, Play Mobile) har bir xabar
      uchun pul oladi va shartnoma talab qiladi. Telegram esa
      raqamni O'ZI tasdiqlaydi: "raqamni ulashish" tugmasi
      hisobga bog'langan haqiqiy raqamni yuboradi va biz
      `contact.user_id === from.id` ni tekshiramiz, ya'ni adres
      daftaridan boshqa odamning kontaktini yuborib bo'lmaydi.
      Bu — bemor kabinetida allaqachon ishlayotgan usul.

      Yon foydasi ham bor: egasi shu zahoti botga ulanadi va
      birinchi kunidanoq xabar oladi.
    */
    const username = await this.telegram.username()
    if (!username) {
      throw new BadRequestException(
        'Ro‘yxatdan o‘tish vaqtincha yopiq — bog‘lanish uchun qo‘ng‘iroq qiling',
      )
    }

    sweepPending(this.pending)
    if (this.pending.size >= MAX_PENDING) {
      throw new BadRequestException('Hozir band — bir necha daqiqadan keyin urinib ko‘ring')
    }

    const code = `reg${randomBytes(9).toString('base64url')}`
    this.pending.set(code, {
      dto: { ...dto, phone },
      expiresAt: Date.now() + PENDING_TTL_MS,
      session: null,
      chatId: null,
    })

    return {
      code,
      url: `https://t.me/${username}?start=${code}`,
      phone,
      expiresInSec: Math.round(PENDING_TTL_MS / 1000),
    }
  }

  /**
   * Brauzer so'raydi: tasdiqlandimi.
   *
   * Sessiya BIR MARTA beriladi va kod o'chiriladi — kod havolada
   * ko'rinib turadi, ya'ni uni ikkinchi marta ishlatib bo'lmasligi
   * kerak.
   */
  registrationStatus(code: string) {
    sweepPending(this.pending)
    const entry = this.pending.get(code)
    if (!entry) return { status: 'expired' as const, session: null }
    if (!entry.session) return { status: 'waiting' as const, session: null }

    this.pending.delete(code)
    return { status: 'ready' as const, session: entry.session }
  }

  /** Botda `/start reg...` bosilganda — qaysi kod, qaysi suhbat */
  claimRegistration(code: string, chatId: string): { phone: string } | null {
    sweepPending(this.pending)
    const entry = this.pending.get(code)
    if (!entry) return null
    entry.chatId = chatId
    return { phone: entry.dto.phone }
  }

  /**
   * Telegram raqamni yubordi — klinika shu yerda ochiladi.
   *
   * Raqam MOS KELISHI shart: formada boshqa raqam yozib, o'zining
   * Telegramidan tasdiqlab ketish yo'li yopiq bo'lishi kerak.
   */
  async finishRegistration(chatId: string, sharedPhone: string) {
    sweepPending(this.pending)

    const entry = [...this.pending.entries()].find(([, value]) => value.chatId === chatId)
    if (!entry) return { ok: false as const, reason: 'no-code' as const }

    const [code, pending] = entry
    if (normalizePhone(sharedPhone) !== pending.dto.phone) {
      return { ok: false as const, reason: 'mismatch' as const }
    }
    if (pending.session) return { ok: true as const, clinicName: pending.dto.clinicName }

    const session = await this.createClinic(pending.dto, chatId)
    this.pending.set(code, { ...pending, session })

    return { ok: true as const, clinicName: pending.dto.clinicName }
  }

  /** Klinika, egasi, obuna va sotuv so'rovi — bitta tranzaksiyada */
  private async createClinic(dto: RegisterDto, telegramUserId: string) {
    const phone = normalizePhone(dto.phone)
    const fullName = dto.fullName.trim()
    const clinicName = dto.clinicName.trim()

    /*
      SINOV UCHUN ENG ARZON TARIF OLINADI.

      Obunada tarif MAJBURIY, lekin sinovda hech narsa
      kelishilmagan: `termPrice` 0 va `subscribedAt` bo'sh —
      hisobotda bu pul sifatida ko'rinmasligi kerak.
    */
    const plan = await this.db
      .acrossAllClinics()
      .plan.findFirst({ where: { isActive: true }, orderBy: { basePrice: 'asc' } })

    if (!plan) throw new BadRequestException('Tariflar sozlanmagan')

    const now = new Date()
    const trialEnds = new Date(now)
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS)

    /* Kirish uchun email kerak emas, lekin ustun bo'sh qolmasligi kerak */
    const login = phone

    const owner = await this.db.acrossAllClinics().$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          phone,
          address: dto.city?.trim() ?? '',
          kind: toDbKind(dto.direction),
          /* Yo'nalish bo'yicha keraksizlari + sinovda yopiladiganlari */
          disabledModules: [
            ...new Set([...DISABLED_BY_KIND[dto.direction], ...TRIAL_DISABLED_MODULES]),
          ],
          /* Dushanbadan shanbagacha 09:00-18:00 — keyin o'zgartiriladi */
          workingHours: {
            create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              open: '09:00',
              close: '18:00',
            })),
          },
        },
      })

      const user = await tx.user.create({
        data: {
          clinicId: clinic.id,
          fullName,
          email: login,
          phone,
          passwordHash: await argon2.hash(dto.password),
          role: 'OWNER',
          /* Raqamni tasdiqlagan hisob — xabarlar shu yerga boradi */
          telegramUserId,
        },
      })

      /* Egasi ham xodim: "Mening profilim" va jadval shunga tayanadi */
      await tx.staff.create({
        data: {
          clinicId: clinic.id,
          userId: user.id,
          fullName,
          phone,
          email: '',
          position: 'MANAGER',
          positionTitle: POSITION_TITLES[dto.position],
          department: 'Boshqaruv',
          workdays: [1, 2, 3, 4, 5, 6],
          shiftStart: '09:00',
          shiftEnd: '18:00',
          payType: 'SALARY',
          hiredAt: now,
          status: 'ACTIVE',
          hasSystemAccess: true,
        },
      })

      await tx.subscription.create({
        data: {
          clinicId: clinic.id,
          status: 'TRIAL',
          planId: plan.id,
          termPrice: 0,
          termMonths: 3,
          trialEndsAt: trialEnds,
          nextInvoiceAt: trialEnds,
          ownerName: fullName,
          ownerEmail: '',
          ownerPhone: phone,
          city: dto.city?.trim() ?? '',
        },
      })

      await tx.lead.create({
        data: {
          createdClinicId: clinic.id,
          clinicName,
          fullName,
          phone,
          position: dto.position,
          direction: dto.direction,
          city: dto.city?.trim() ?? '',
          staffCount: dto.staffCount ?? '',
        },
      })

      return user
    })

    await this.audit.recordLogin({ clinicId: owner.clinicId, userId: owner.id })
    return this.buildSession(owner.id)
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

/* ------------------------------------------------------------------ */

/** Tasdiqlashni kutayotgan ro'yxatdan o'tish */
interface PendingRegistration {
  dto: RegisterDto
  expiresAt: number
  /** Tasdiqlangach tayyor bo'ladi va brauzer bir marta olib ketadi */
  session: Awaited<ReturnType<AuthService['me']>> | null
  /** Botdagi suhbat — raqam shu yerdan keladi */
  chatId: string | null
}

/** Kod necha vaqt yashaydi */
const PENDING_TTL_MS = 15 * 60 * 1000

/**
 * Bir vaqtning o'zida nechta kutish mumkin.
 *
 * Chegara bo'lmasa, forma bilan xotirani to'ldirib tashlash
 * mumkin edi. Yaratiladigan yozuv yo'q, lekin xotira ham cheksiz
 * emas.
 */
const MAX_PENDING = 500

function sweepPending(map: Map<string, PendingRegistration>): void {
  const now = Date.now()
  for (const [code, value] of map) {
    if (value.expiresAt <= now) map.delete(code)
  }
}

/** Ro'yxatdan o'tish oynasidagi yo'nalish → bazadagi tur */
function toDbKind(direction: string): 'CLINIC' | 'PHARMACY' {
  /*
    Hozircha hammasi klinika: yo'nalish (stomatologiya, ko'z,
    laboratoriya) MODULLAR bilan ajratiladi, `kind` esa klinika va
    aptekani ajratadi — bular boshqa-boshqa narsa.
  */
  return direction === 'pharmacy' ? 'PHARMACY' : 'CLINIC'
}

/** Lavozim → xodim yozuvidagi nom */
const POSITION_TITLES: Record<string, string> = {
  owner: 'Klinika egasi',
  chief_doctor: 'Bosh shifokor',
  manager: 'Menejer',
  administrator: 'Administrator',
  doctor: 'Shifokor',
  other: 'Rahbariyat',
}
