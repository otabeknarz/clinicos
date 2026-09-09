import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Plan, Prisma } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import * as argon2 from 'argon2'

import { AuthService } from '../auth/auth.service'
import { toApi, toApiDate, toApiDateTime, toDb } from '../common/api-enum'
import { DISABLED_BY_KIND } from '../common/modules'
import { paginated } from '../common/pagination'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import {
  ArchiveDto,
  BillingTermDto,
  ImpersonateDto,
  InvoiceQueryDto,
  MemberInputDto,
  PlanInputDto,
  PlatformDoctorQueryDto,
  PlatformPatientQueryDto,
  PlatformSearchDto,
  SuspendDto,
  TenantModulesDto,
  TenantCreateDto,
  TenantQueryDto,
  TenantUpdateDto,
} from './platform.dto'

/**
 * PLATFORMA PANELI — SaaS qatlami.
 *
 * DIQQAT: bu yerdagi hamma so'rov klinika filtridan TASHQARIDA
 * ishlaydi (`acrossAllClinics`). Bu ataylab: platforma egasi
 * barcha klinikalarni ko'rishi kerak.
 *
 * Aynan shuning uchun har bir endpoint `platform.*` ruxsati
 * bilan yopilgan va klinika xodimlarida bu ruxsatlar YO'Q.
 * Bitta xato bu yerda butun tizimni ochib yuboradi.
 */

/**
 * Klinika egasi uchun boshlang'ich parol.
 *
 * O'qishda adashtiradigan belgilar (0/O, 1/l/I) yo'q — admin uni
 * telefonda aytib berishi mumkin.
 */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from(randomBytes(18), (b) => alphabet[b % alphabet.length]).join('')
}

/** Ish haqi fondi taxminan aylanmaning yarmi */
const PAYROLL_SHARE = 0.5

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly auth: AuthService,
  ) {}

  /** Klinika filtridan tashqaridagi mijoz — faqat shu modulda */
  private get db() {
    return this.prisma.acrossAllClinics()
  }

  /* ---------------- Klinikalar ---------------- */

  async listTenants(query: TenantQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.SubscriptionWhereInput = {
      AND: [
        /*
          O'CHIRILGAN KLINIKALAR RO'YXATDA CHIQMAYDI.

          Ular ish ro'yxatini to'ldirib turmasligi kerak — o'chirishning
          ma'nosi shu. Ko'rish uchun `status=deleted` filtri bor:
          ma'lumot yo'qolmagan, faqat ko'zdan olib qo'yilgan.

          Arxivlangan (`cancelled`) klinika esa ro'yxatda QOLADI:
          u "ketgan mijoz", o'chirilgan emas.
        */
        query.status === 'deleted'
          ? { clinic: { deletedAt: { not: null } } }
          : { clinic: { deletedAt: null } },
        query.status === 'all' || query.status === 'deleted'
          ? {}
          : { status: toDb(query.status) },
        query.planId === 'all' ? {} : { planId: query.planId },
        search
          ? {
              OR: [
                { clinic: { name: { contains: search, mode: 'insensitive' } } },
                { city: { contains: search, mode: 'insensitive' } },
                { ownerName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.subscription.findMany({
        where,
        include: { clinic: true, plan: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.subscription.count({ where }),
    ])

    const usage = await this.usageFor(rows.map((r) => r.clinicId))
    return paginated(
      rows.map((r) => toApiTenant(r, usage[r.clinicId])),
      total,
      query.page,
      query.pageSize,
    )
  }

  async getTenant(id: string) {
    const row = await this.db.subscription.findFirst({
      where: { OR: [{ id }, { clinicId: id }] },
      include: { clinic: true, plan: true },
    })
    if (!row) throw new NotFoundException('Klinika topilmadi')

    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  /** Bir nechta klinikaning yuklamasi — bitta so'rovda */
  private async usageFor(clinicIds: string[]) {
    const empty = { doctors: 0, staff: 0, patients: 0, users: 0, appointmentsThisMonth: 0 }
    const out: Record<string, typeof empty> = {}
    for (const id of clinicIds) out[id] = { ...empty }
    if (clinicIds.length === 0) return out

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [doctors, staff, patients, users, appointments] = await Promise.all([
      this.db.doctor.groupBy({ by: ['clinicId'], where: { clinicId: { in: clinicIds } }, _count: { _all: true } }),
      this.db.staff.groupBy({ by: ['clinicId'], where: { clinicId: { in: clinicIds } }, _count: { _all: true } }),
      this.db.patient.groupBy({ by: ['clinicId'], where: { clinicId: { in: clinicIds } }, _count: { _all: true } }),
      this.db.user.groupBy({ by: ['clinicId'], where: { clinicId: { in: clinicIds } }, _count: { _all: true } }),
      this.db.appointment.groupBy({
        by: ['clinicId'],
        where: { clinicId: { in: clinicIds }, startsAt: { gte: monthStart } },
        _count: { _all: true },
      }),
    ])

    for (const r of doctors) out[r.clinicId].doctors = r._count._all
    for (const r of staff) out[r.clinicId].staff = r._count._all
    for (const r of patients) out[r.clinicId].patients = r._count._all
    for (const r of users) out[r.clinicId].users = r._count._all
    for (const r of appointments) out[r.clinicId].appointmentsThisMonth = r._count._all

    return out
  }

  /**
   * YANGI KLINIKA.
   *
   * Klinika + egasi + obuna BITTA TRANZAKSIYADA. Uchtasidan
   * birortasi yaratilmasa hammasi bekor qilinadi: obunasiz
   * klinika ro'yxatda ko'rinmaydi, egasiz klinikaga esa hech kim
   * kira olmaydi — yarim yaratilgan yozuv faqat chalkashlik
   * keltiradi.
   */
  async createTenant(dto: TenantCreateDto) {
    const plan = await this.db.plan.findUnique({ where: { id: dto.planId } })
    if (!plan) throw new NotFoundException('Tarif topilmadi')

    const password = dto.ownerPassword?.trim() || generatePassword()
    const passwordHash = await argon2.hash(password)
    const email = dto.ownerEmail.trim().toLowerCase()

    const now = new Date()

    /*
      Hisob OYLIK emas, MUDDAT bo'yicha chiqadi: 6 oyga obuna
      bo'lgan mijozdan har oy pul so'ralmaydi.
    */
    const discountPct = await this.discountFor(dto.termMonths)
    const termEnd = new Date(now)
    termEnd.setMonth(termEnd.getMonth() + dto.termMonths)

    const sub = await this.db.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          address: dto.address.trim(),
          /*
            Tur bo'yicha keraksiz bo'limlar darrov o'chiriladi.
            Turning o'zi saqlanmaydi — u faqat boshlang'ich to'plam.
          */
          disabledModules: DISABLED_BY_KIND[dto.kind] ?? [],
          /* Dushanbadan shanbagacha 09:00-18:00. Egasi keyin o'zgartiradi. */
          workingHours: {
            create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              open: '09:00',
              close: '18:00',
            })),
          },
        },
      })

      const owner = await tx.user.create({
        data: {
          clinicId: clinic.id,
          fullName: dto.ownerName.trim(),
          email,
          phone: dto.ownerPhone.trim(),
          passwordHash,
          role: 'OWNER',
        },
      })

      /*
        EGASIGA HAM XODIM YOZUVI.

        Egasi klinikaning xodimi: uning profili, ish jadvali,
        davomati va bonusi `Staff` ga bog'langan. Yozuvsiz
        "Mening profilim" va "Mening ish jadvalim" sahifalari
        404 qaytarardi — yangi klinikada egasi kirishi bilan
        ikkala sahifa ham ochilmasdi.

        Maosh 0: uni egasining o'zi belgilaydi. Klinika egasi
        ko'pincha o'ziga oylik yozmaydi.
      */
      await tx.staff.create({
        data: {
          clinicId: clinic.id,
          userId: owner.id,
          fullName: dto.ownerName.trim(),
          phone: dto.ownerPhone.trim(),
          email,
          position: 'MANAGER',
          positionTitle: 'Klinika egasi',
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

      return tx.subscription.create({
        data: {
          clinicId: clinic.id,
          status: 'ACTIVE',
          planId: plan.id,
          /*
            Narx obuna paytida MUZLATILADI — tarif keyin
            qimmatlashsa, mavjud mijozning hisobi o'z-o'zidan
            oshib ketmasin.
          */
          /*
            Chegirma SHU YERDA qo'llanadi va natija muzlatiladi:
            `pricePerMonth` — mijoz haqiqatan to'laydigan oylik summa.
            Foizning o'zi ham saqlanadi, "nega bu narx" degan savolga
            javob bo'lishi uchun.
          */
          pricePerMonth: discountedMonthly(plan.pricePerMonth, discountPct),
          termMonths: dto.termMonths,
          discountPct,
          subscribedAt: now,
          nextInvoiceAt: termEnd,
          ownerName: dto.ownerName.trim(),
          ownerEmail: email,
          ownerPhone: dto.ownerPhone.trim(),
          city: dto.city?.trim() ?? '',
        },
        include: { clinic: true, plan: true },
      })
    })

    const usage = await this.usageFor([sub.clinicId])
    return {
      ...toApiTenant(sub, usage[sub.clinicId]),
      /*
        Parol FAQAT SHU JAVOBDA. Bazada xeshi saqlanadi, ya'ni
        keyin ko'rsatib bo'lmaydi. Interfeys uni bir marta
        ko'rsatib, admin nusxalab olishini kutadi.
      */
      ownerPassword: dto.ownerPassword ? undefined : password,
    }
  }

  /**
   * KLINIKA EGASINING PAROLINI TIKLASH.
   *
   * NEGA KERAK: klinika egasi `Staff` yozuvi emas, faqat `User`.
   * Ya'ni `POST /staff/:id/password` unga yetmaydi va egasi
   * parolini unutsa, tizimga qaytadigan yo'l umuman yo'q edi.
   * Pochta xizmati yo'q, shuning uchun tiklash platforma
   * admini orqali bo'ladi.
   *
   * FAQAT EGASI tiklanadi. Klinika ichidagi qolgan xodimlarni
   * egasining o'zi tiklaydi (`POST /staff/:id/password`) —
   * platforma admini klinikaning kundalik ishiga aralashmaydi.
   *
   * XAVFSIZLIK CHEGARASI, OCHIQ AYTAMIZ: parolni tiklagan
   * platforma admini o'sha parol bilan egasi nomidan kira
   * oladi, ya'ni "klinika paneliga faqat ko'rish uchun kirish"
   * qoidasini chetlab o'tadi. Tiklash yo'li bo'lgan har qanday
   * tizimda shunday. Yumshatuvchi omillar: amal audit jurnalida
   * qoladi, egasining mavjud sessiyalari uziladi va u kirgach
   * parolni almashtirishga majbur bo'ladi — ya'ni bexabar
   * qolmaydi.
   */
  async resetOwnerPassword(tenantId: string) {
    const sub = await this.requireSubscription(tenantId)

    const owner = await this.db.user.findFirst({
      where: { clinicId: sub.clinicId, role: 'OWNER', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, fullName: true },
    })
    if (!owner) {
      throw new NotFoundException('Bu klinikada faol egasi topilmadi')
    }

    const password = generatePassword()

    await this.db.user.update({
      where: { id: owner.id },
      data: {
        passwordHash: await argon2.hash(password),
        /*
          Egasining mavjud sessiyalari uziladi va kirgach
          almashtirish so'raladi.
        */
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    })

    return {
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      /* Parol FAQAT shu javobda. Bazada xeshi saqlanadi. */
      password,
    }
  }

  /** Klinika ma'lumotlarini tahrirlash */
  async updateTenant(id: string, dto: TenantUpdateDto) {
    const sub = await this.requireSubscription(id)

    const row = await this.db.$transaction(async (tx) => {
      await tx.clinic.update({
        where: { id: sub.clinicId },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
        },
      })
      return tx.subscription.update({
        where: { id: sub.id },
        data: { city: dto.city?.trim() },
        include: { clinic: true, plan: true },
      })
    })

    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  /**
   * ARXIVLASH.
   *
   * Klinika O'CHIRILMAYDI — bemor, tashrif, to'lov va audit
   * jurnali joyida qoladi. Tibbiy yozuvni o'chirish odatda
   * qonun bilan taqiqlanadi, tasodifiy bosishning narxi esa
   * qaytarib bo'lmas.
   *
   * Arxivdagi klinika xodimlari tizimga kira olmaydi
   * (`common/clinic-access.ts`), ro'yxatda "Ketgan" filtrida
   * ko'rinadi va `activate` bilan qaytariladi.
   */
  async archiveTenant(id: string, dto: ArchiveDto) {
    const sub = await this.requireSubscription(id)
    const row = await this.db.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED', suspendReason: dto.reason.trim() },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  /**
   * KLINIKANI O'CHIRISH.
   *
   * ARXIVLASHDAN FARQI: arxiv — "mijoz ketdi, lekin qaytishi mumkin",
   * u obunani `CANCELLED` ga o'tkazadi va klinika ro'yxatda turaveradi.
   * O'chirish esa uni platformaning ish ro'yxatidan olib tashlaydi.
   *
   * MA'LUMOT BARIBIR O'CHMAYDI. Bemorlar, tashriflar, to'lovlar va
   * audit jurnali joyida qoladi — bazadan yo'qotadigan `DELETE` yo'q
   * va bo'lmasligi kerak: tibbiy yozuvni o'chirish odatda qonun
   * bilan taqiqlanadi.
   *
   * Xodimlar darhol kira olmay qoladi (`clinic-access.ts`), qo'ldagi
   * eski token ham ishlamaydi — tekshiruv har so'rovda bo'ladi.
   */
  async deleteTenant(id: string, dto: ArchiveDto) {
    const clinic = await this.db.clinic.findUnique({ where: { id } })
    if (!clinic) throw new NotFoundException('Klinika topilmadi')
    if (clinic.deletedAt) {
      throw new BadRequestException('Klinika allaqachon o‘chirilgan')
    }

    await this.db.clinic.update({
      where: { id },
      data: { deletedAt: new Date(), deletedReason: dto.reason.trim() },
    })

    return this.tenantById(id)
  }

  /**
   * O'chirilgan klinikani qaytarish.
   *
   * Ma'lumot hech qayoqqa ketmagani uchun qaytarish — bitta belgini
   * olib tashlash. Obuna holatiga TEGILMAYDI: klinika o'chirilishidan
   * oldin qanday bo'lsa, shundayligicha qaytadi.
   */
  async undeleteTenant(id: string) {
    const clinic = await this.db.clinic.findUnique({ where: { id } })
    if (!clinic) throw new NotFoundException('Klinika topilmadi')
    if (!clinic.deletedAt) {
      throw new BadRequestException('Klinika o‘chirilmagan')
    }

    await this.db.clinic.update({
      where: { id },
      data: { deletedAt: null, deletedReason: '' },
    })

    return this.tenantById(id)
  }

  /** Klinikani obunasi bilan birga qaytaradi */
  private async tenantById(clinicId: string) {
    const row = await this.db.subscription.findFirstOrThrow({
      where: { clinicId },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([clinicId])
    return toApiTenant(row, usage[clinicId])
  }

  /**
   * Klinikada qaysi bo'limlar ishlashini belgilash.
   *
   * O'chirilganlari saqlanadi, yoqilganlari emas: bo'sh ro'yxat
   * "hammasi yoqilgan" degani, ya'ni keyin qo'shiladigan yangi
   * bo'lim barcha klinikada o'z-o'zidan ishlaydi.
   *
   * O'chirish MA'LUMOTNI O'CHIRMAYDI: statsionar yopilsa, yotgan
   * bemorlar yozuvi joyida qoladi va bo'lim qayta yoqilganda
   * hammasi o'z o'rnida chiqadi.
   */
  async setModules(id: string, dto: TenantModulesDto) {
    const clinic = await this.db.clinic.findUnique({ where: { id } })
    if (!clinic) throw new NotFoundException('Klinika topilmadi')

    await this.db.clinic.update({
      where: { id },
      data: { disabledModules: dto.disabledModules },
    })

    const sub = await this.requireSubscription(id)
    const row = await this.db.subscription.findUniqueOrThrow({
      where: { id: sub.id },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  async suspend(id: string, dto: SuspendDto) {
    const sub = await this.requireSubscription(id)
    const row = await this.db.subscription.update({
      where: { id: sub.id },
      data: { status: 'SUSPENDED', suspendReason: dto.reason.trim() },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  async activate(id: string) {
    const sub = await this.requireSubscription(id)
    const row = await this.db.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', suspendReason: '' },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  /**
   * Tarifni o'zgartirish.
   *
   * Yangi narx KEYINGI hisobdan boshlab qo'llanadi — joriy oy
   * uchun chiqarilgan hisob o'zgarmaydi. Aks holda mijoz
   * allaqachon ko'rgan summa o'zgarib qolardi.
   */
  async changePlan(id: string, planId: string, termMonths?: number) {
    const sub = await this.requireSubscription(id)
    const plan = await this.db.plan.findUnique({ where: { id: planId } })
    if (!plan) throw new NotFoundException('Tarif topilmadi')

    /*
      Muddat berilmasa hozirgisi qoladi. Chegirma esa HAR DOIM
      qaytadan hisoblanadi: tarif almashgach eski foizni yangi
      narxga qo'llash noto'g'ri bo'lardi.
    */
    const months = termMonths ?? sub.termMonths
    const discountPct = await this.discountFor(months)

    const row = await this.db.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        pricePerMonth: discountedMonthly(plan.pricePerMonth, discountPct),
        termMonths: months,
        discountPct,
      },
      include: { clinic: true, plan: true },
    })
    const usage = await this.usageFor([row.clinicId])
    return toApiTenant(row, usage[row.clinicId])
  }

  /* ---------------- To'lov muddatlari ---------------- */

  /**
   * Muddatlar va ularning chegirmasi.
   *
   * Chegirma MUDDATGA biriktirilgan, tarifga emas: "6 oy — 10%"
   * barcha tariflarga bir xil qo'llanadi.
   */
  async listBillingTerms() {
    const rows = await this.db.billingTerm.findMany({ orderBy: { months: 'asc' } })
    return rows.map(toApiBillingTerm)
  }

  /**
   * Chegirmani o'zgartirish.
   *
   * MAVJUD OBUNALARGA TEGMAYDI: ularda narx ham, chegirma ham obuna
   * paytida muzlatilgan. Yangi foiz faqat yangi obunaga va muddat
   * almashtirilganda qo'llanadi — xuddi tarif narxi kabi.
   */
  async updateBillingTerm(id: string, dto: BillingTermDto) {
    const found = await this.db.billingTerm.findUnique({ where: { id } })
    if (!found) throw new NotFoundException('Muddat topilmadi')

    const row = await this.db.billingTerm.update({
      where: { id },
      data: { discountPct: dto.discountPct, isActive: dto.isActive },
    })
    return toApiBillingTerm(row)
  }

  /**
   * Muddatning chegirmasi. Muddat topilmasa yoki o'chirilgan bo'lsa — 0.
   *
   * Xato o'rniga nolga tushadi: chegirma yo'qligi to'g'ri narx,
   * xato esa klinika ochilishini butunlay to'xtatib qo'yardi.
   */
  private async discountFor(months: number): Promise<number> {
    const term = await this.db.billingTerm.findUnique({ where: { months } })
    return term && term.isActive ? term.discountPct : 0
  }

  /* ---------------- Tariflar ---------------- */

  async listPlans() {
    const rows = await this.db.plan.findMany({ orderBy: { pricePerMonth: 'asc' } })
    return rows.map(toApiPlan)
  }

  async updatePlan(id: string, dto: Partial<PlanInputDto>) {
    const found = await this.db.plan.findUnique({ where: { id }, select: { id: true } })
    if (!found) throw new NotFoundException('Tarif topilmadi')

    /*
      Narx o'zgarishi MAVJUD obunalarga tegmaydi: ularda narx
      obuna paytida muzlatilgan. Yangi narx faqat yangi
      mijozlarga va tarif almashtirilganda qo'llanadi.
    */
    const row = await this.db.plan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        pricePerMonth: dto.pricePerMonth,
        limitDoctors: dto.limits?.doctors,
        limitStaff: dto.limits?.staff,
        features: dto.features,
        isActive: dto.isActive,
      },
    })
    return toApiPlan(row)
  }

  /* ---------------- Hisoblar ---------------- */

  async listInvoices(query: InvoiceQueryDto) {
    const where: Prisma.TenantInvoiceWhereInput = {
      AND: [
        query.status === 'all' ? {} : { status: toDb(query.status) },
        query.tenantId === 'all'
          ? {}
          : { subscription: { OR: [{ id: query.tenantId }, { clinicId: query.tenantId }] } },
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.tenantInvoice.findMany({
        where,
        include: { subscription: { include: { clinic: { select: { name: true } } } } },
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.tenantInvoice.count({ where }),
    ])

    return paginated(rows.map(toApiInvoice), total, query.page, query.pageSize)
  }

  async markInvoicePaid(id: string) {
    const current = await this.db.tenantInvoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!current) throw new NotFoundException('Hisob topilmadi')
    if (current.status === 'PAID') {
      throw new BadRequestException('Bu hisob allaqachon to‘langan')
    }

    const row = await this.db.tenantInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: { subscription: { include: { clinic: { select: { name: true } } } } },
    })
    return toApiInvoice(row)
  }

  /* ---------------- Klinika paneliga kirish ---------------- */

  async listImpersonations(limit: number, tenantId?: string) {
    const rows = await this.db.impersonationLog.findMany({
      where: tenantId ? { clinicId: tenantId } : {},
      include: { clinic: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.clinicId,
      tenantName: r.clinic.name,
      adminName: r.adminName,
      reason: r.reason,
      startedAt: toApiDateTime(r.startedAt)!,
      endedAt: toApiDateTime(r.endedAt),
    }))
  }

  /**
   * Klinika paneliga kirish.
   *
   * YOZUV AVVAL yaratiladi, keyin kirish ruxsati beriladi.
   * Teskarisi bo'lsa, yozuv yaratilmay qolgan holatda kirish
   * qayd etilmasdan amalga oshgan bo'lardi.
   *
   * DASTURCHIGA: haqiqiy tizimda bu yerda MUDDATI CHEKLANGAN
   * va faqat shu klinikaga tegishli yangi token berilishi kerak.
   */
  async startImpersonation(tenantId: string, dto: ImpersonateDto) {
    const { userId } = this.ctx.require()

    const sub = await this.requireSubscription(tenantId)
    const admin = await this.db.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    })

    const row = await this.db.impersonationLog.create({
      data: {
        clinicId: sub.clinicId,
        adminId: userId,
        adminName: admin?.fullName ?? '',
        reason: dto.reason.trim(),
      },
      include: { clinic: { select: { name: true } } },
    })

    /*
      Kirish uchun ALOHIDA token beriladi.

      Ilgari bu yerda faqat yozuv yaratilardi va token berilmasdi.
      Natijada mijoz tomoni klinikaga "kirdim" deb ko'rsatardi,
      server esa eski tokendagi o'z klinikasini ko'rib turardi —
      ya'ni kirish umuman ishlamasdi.

      Yangi tokenda `impersonationId` bor: undan `jwt.strategy.ts`
      qaysi klinika ekanini va faqat ko'rish ruxsatlarini oladi.
      Muddati qisqa — `auth.service.ts` da.
    */
    const session = await this.auth.buildImpersonatedSession(
      userId,
      row.id,
      row.clinicId,
    )

    return {
      id: row.id,
      tenantId: row.clinicId,
      tenantName: row.clinic.name,
      adminName: row.adminName,
      reason: row.reason,
      startedAt: toApiDateTime(row.startedAt)!,
      endedAt: null,
      token: session.token,
    }
  }

  /**
   * Klinika panelidan chiqish.
   *
   * Kirish yozuvi YOPILADI (`endedAt`), shundan keyin o'sha
   * token bilan kelgan har qanday so'rov rad etiladi —
   * `jwt.strategy.ts` yopilgan yozuvni tekshiradi.
   *
   * Id so'ralmaydi: odam FAQAT o'zi kirgan sessiyani yopadi,
   * uni kontekstdan olamiz. Aks holda id yuborib, boshqa
   * xodimning ishini uzib qo'yish mumkin bo'lardi.
   */
  async endImpersonation() {
    const { impersonationId } = this.ctx.require()
    if (!impersonationId) {
      throw new BadRequestException('Siz klinika panelida emassiz')
    }

    const row = await this.db.impersonationLog.findUnique({
      where: { id: impersonationId },
      select: { endedAt: true },
    })

    // Yopilgan bo'lsa xato bermaymiz: natija baribir bir xil
    if (row && !row.endedAt) {
      await this.db.impersonationLog.update({
        where: { id: impersonationId },
        data: { endedAt: new Date() },
      })
    }

    return { ok: true }
  }

  /* ---------------- Ro'yxatlar ---------------- */

  async listTenantDoctors(query: PlatformDoctorQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.DoctorWhereInput = {
      AND: [
        query.tenantId === 'all' ? {} : { clinicId: query.tenantId },
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {},
        query.specialty === 'all' ? {} : { specialty: query.specialty },
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.doctor.findMany({
        where,
        include: { clinic: { select: { name: true } }, staff: true },
        orderBy: { fullName: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.doctor.count({ where }),
    ])

    const from = new Date()
    from.setDate(from.getDate() - 30)

    const completed = rows.length
      ? await this.db.appointment.groupBy({
          by: ['doctorId'],
          where: {
            doctorId: { in: rows.map((r) => r.id) },
            status: 'COMPLETED',
            startsAt: { gte: from },
          },
          _count: { _all: true },
        })
      : []
    const byDoctor = new Map(completed.map((c) => [c.doctorId, c._count._all]))

    const items = rows.map((r) => ({
      id: r.id,
      tenantId: r.clinicId,
      tenantName: r.clinic.name,
      fullName: r.fullName,
      specialty: r.specialty,
      phone: r.phone,
      email: r.email,
      status: toApi(r.status),
      completedLast30d: byDoctor.get(r.id) ?? 0,
      monthlyPay: r.staff?.salary ?? 0,
      payType: r.staff ? toApi(r.staff.payType) : 'salary',
      percentRate: r.staff?.percentRate ?? 0,
      rating: null,
      hiredAt: toApiDate(r.hiredAt)!,
    }))

    return paginated(items, total, query.page, query.pageSize)
  }

  async listTenantPatients(query: PlatformPatientQueryDto) {
    const search = query.search?.trim() ?? ''

    const where: Prisma.PatientWhereInput = {
      AND: [
        query.tenantId === 'all' ? {} : { clinicId: query.tenantId },
        search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {},
      ],
    }

    const [rows, total] = await Promise.all([
      this.db.patient.findMany({
        where,
        include: { clinic: { select: { name: true, address: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.patient.count({ where }),
    ])

    const ids = rows.map((r) => r.id)
    const [visits, spent] = await Promise.all([
      ids.length
        ? this.db.visit.groupBy({
            by: ['patientId'],
            where: { patientId: { in: ids } },
            _count: { _all: true },
            _max: { visitedAt: true },
          })
        : [],
      ids.length
        ? this.db.payment.groupBy({
            by: ['patientId'],
            where: { patientId: { in: ids }, status: 'PAID' },
            _sum: { amount: true },
          })
        : [],
    ])
    const visitMap = new Map(visits.map((v) => [v.patientId, v]))
    const spentMap = new Map(spent.map((s) => [s.patientId, s._sum.amount ?? 0]))

    const now = new Date()
    const items = rows.map((r) => {
      const v = visitMap.get(r.id)
      const age = Math.floor(
        (now.getTime() - r.birthDate.getTime()) / (365.25 * 86_400_000),
      )
      return {
        id: r.id,
        tenantId: r.clinicId,
        tenantName: r.clinic.name,
        fullName: r.fullName,
        phone: r.phone,
        gender: toApi(r.gender),
        age,
        // Shahar klinika manzilidan olinadi — bemorda alohida maydon yo'q
        city: r.clinic.address.split(',')[0]?.trim() ?? '',
        /*
          Tashxis platforma darajasida CHIQMAYDI.

          Bu ataylab: platforma tahlili kasallik turlari bo'yicha
          JAMLANGAN ko'rinishda ishlaydi, ayrim bemorning
          tashxisi bilan emas.
        */
        condition: '',
        registeredAt: toApiDate(r.createdAt)!,
        lastVisitAt: toApiDate(v?._max.visitedAt ?? null),
        visitCount: v?._count._all ?? 0,
        totalSpent: spentMap.get(r.id) ?? 0,
        isReturning: (v?._count._all ?? 0) >= 2,
      }
    })

    return paginated(items, total, query.page, query.pageSize)
  }

  /* ---------------- Jamoa ---------------- */

  async listTeam() {
    const rows = await this.db.platformMember.findMany({
      include: { user: { select: { fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(toApiMember)
  }

  async createMember(dto: MemberInputDto) {
    const { clinicId } = this.ctx.require()

    const row = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          // Platforma xodimi ham `User`: kirish bir xil yo'l bilan
          clinicId,
          fullName: dto.fullName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone.trim(),
          passwordHash: await argon2.hash(dto.password),
          role: 'SUPERADMIN',
        },
      })

      return tx.platformMember.create({
        data: {
          userId: user.id,
          position: dto.position,
          permissions: dto.permissions,
          isActive: dto.isActive,
        },
        include: { user: { select: { fullName: true, email: true, phone: true } } },
      })
    })

    return toApiMember(row)
  }

  async updateMember(id: string, dto: Partial<MemberInputDto>) {
    const found = await this.db.platformMember.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!found) throw new NotFoundException('Xodim topilmadi')

    const row = await this.db.$transaction(async (tx) => {
      if (dto.fullName || dto.phone) {
        await tx.user.update({
          where: { id: found.userId },
          data: { fullName: dto.fullName?.trim(), phone: dto.phone?.trim() },
        })
      }
      return tx.platformMember.update({
        where: { id },
        data: {
          position: dto.position,
          permissions: dto.permissions,
          isActive: dto.isActive,
        },
        include: { user: { select: { fullName: true, email: true, phone: true } } },
      })
    })

    return toApiMember(row)
  }

  async deleteMember(id: string) {
    const found = await this.db.platformMember.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!found) throw new NotFoundException('Xodim topilmadi')

    /*
      Foydalanuvchi O'CHIRILMAYDI, faqat faolsizlantiriladi.

      Uning nomi kirish jurnalida va boshqa yozuvlarda qoladi —
      o'chirilsa, "kim kirgan edi" degan savolga javob yo'qolardi.
    */
    await this.db.$transaction(async (tx) => {
      await tx.platformMember.update({ where: { id }, data: { isActive: false } })
      await tx.user.update({ where: { id: found.userId }, data: { isActive: false } })
    })

    return { deactivated: true }
  }

  /* ---------------- Statistika ---------------- */

  async stats() {
    const subs = await this.db.subscription.findMany({ include: { plan: true } })

    const count = (s: string) => subs.filter((x) => x.status === s).length
    const paying = subs.filter((s) => s.status === 'ACTIVE' || s.status === 'PAST_DUE')
    const mrr = paying.reduce((sum, s) => sum + s.pricePerMonth, 0)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const prevStart = new Date(monthStart)
    prevStart.setMonth(prevStart.getMonth() - 1)

    const newThisMonth = subs.filter((s) => s.createdAt >= monthStart).length
    const newPrevMonth = subs.filter(
      (s) => s.createdAt >= prevStart && s.createdAt < monthStart,
    ).length

    const cancelled = count('CANCELLED')
    const churnedThisMonth = subs.filter(
      (s) => s.status === 'CANCELLED' && s.updatedAt >= monthStart,
    ).length

    /*
      Sinovdan to'lovga o'tish: sinovni boshlagan va keyin
      obuna bo'lganlar ulushi. Sinovda ketganlar `subscribedAt`
      siz qoladi.
    */
    const startedTrial = subs.filter((s) => s.trialEndsAt !== null).length
    const converted = subs.filter(
      (s) => s.trialEndsAt !== null && s.subscribedAt !== null,
    ).length

    const byPlanMap = new Map<string, { planName: string; count: number; mrr: number }>()
    for (const s of paying) {
      const acc = byPlanMap.get(s.planId) ?? { planName: s.plan.name, count: 0, mrr: 0 }
      acc.count += 1
      acc.mrr += s.pricePerMonth
      byPlanMap.set(s.planId, acc)
    }

    const overdue = await this.db.tenantInvoice.aggregate({
      where: { status: 'OVERDUE' },
      _count: { _all: true },
      _sum: { amount: true },
    })

    return {
      tenants: {
        total: subs.length,
        trial: count('TRIAL'),
        active: count('ACTIVE'),
        pastDue: count('PAST_DUE'),
        suspended: count('SUSPENDED'),
        cancelled,
      },
      mrr: { value: mrr, changePct: null },
      newThisMonth: {
        value: newThisMonth,
        changePct: newPrevMonth > 0
          ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 1000) / 10
          : null,
      },
      churnedThisMonth: { value: churnedThisMonth, changePct: null },
      churnRate: subs.length ? Math.round((cancelled / subs.length) * 1000) / 10 : 0,
      trialConversionRate: startedTrial
        ? Math.round((converted / startedTrial) * 1000) / 10
        : 0,
      byPlan: [...byPlanMap.entries()].map(([planId, a]) => ({ planId, ...a })),
      history: [],
      overdue: { count: overdue._count._all, amount: overdue._sum.amount ?? 0 },
    }
  }

  /**
   * Jamlangan bozor ma'lumoti.
   *
   * MUHIM: bu yerda AYRIM bemor yoki tashxis yo'q — faqat
   * yig'ma raqamlar. Bu startupning ikkinchi g'oyasi bo'lgan
   * "bizda baza bor" qismi, lekin u shaxsni oshkor qilmasligi
   * kerak.
   */
  async data() {
    const [clinics, patients, doctors, appointments, first] = await Promise.all([
      this.db.clinic.count(),
      this.db.patient.count(),
      this.db.doctor.count(),
      this.db.appointment.count(),
      this.db.patient.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ])

    const services = await this.db.service.groupBy({
      by: ['category'],
      _count: { _all: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    })
    const serviceTotal = services.reduce((s, r) => s + r._count._all, 0)

    const specialties = await this.db.doctor.groupBy({
      by: ['specialty'],
      _count: { _all: true },
    })
    const specialtyTotal = specialties.reduce((s, r) => s + r._count._all, 0)

    return {
      totals: {
        clinics,
        patients,
        doctors,
        appointments,
        since: toApiDate(first?.createdAt ?? new Date())!,
      },
      growth: [],
      byCity: [],
      topServices: services
        .map((r) => ({
          key: r.category,
          share: serviceTotal ? Math.round((r._count._all / serviceTotal) * 1000) / 10 : 0,
          avgPrice: Math.round(r._avg.price ?? 0),
          priceMin: r._min.price ?? 0,
          priceMax: r._max.price ?? 0,
        }))
        .sort((a, b) => b.share - a.share),
      bySpecialty: specialties
        .map((r) => ({
          key: r.specialty,
          share: specialtyTotal
            ? Math.round((r._count._all / specialtyTotal) * 1000) / 10
            : 0,
          changePct: 0,
        }))
        .sort((a, b) => b.share - a.share),
      byCondition: [],
      seasonality: [],
    }
  }

  async analytics() {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [payments, subs] = await Promise.all([
      this.db.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: monthStart } },
        include: {
          clinic: { select: { id: true, name: true, address: true } },
          doctor: { select: { id: true, fullName: true, specialty: true } },
        },
      }),
      this.db.subscription.findMany({
        where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        include: { clinic: { select: { id: true, name: true } }, plan: true },
      }),
    ])

    const turnover = payments.reduce((s, p) => s + p.amount, 0)
    const ourRevenue = subs.reduce((s, x) => s + x.pricePerMonth, 0)

    const byClinic = new Map<
      string,
      { name: string; city: string; turnover: number; patients: Set<string> }
    >()
    for (const p of payments) {
      const acc = byClinic.get(p.clinicId) ?? {
        name: p.clinic.name,
        city: p.clinic.address.split(',')[0]?.trim() ?? '',
        turnover: 0,
        patients: new Set<string>(),
      }
      acc.turnover += p.amount
      acc.patients.add(p.patientId)
      byClinic.set(p.clinicId, acc)
    }

    const byDoctor = new Map<
      string,
      { fullName: string; tenantName: string; specialty: string; revenue: number; count: number }
    >()
    for (const p of payments) {
      const acc = byDoctor.get(p.doctorId) ?? {
        fullName: p.doctor.fullName,
        tenantName: p.clinic.name,
        specialty: p.doctor.specialty,
        revenue: 0,
        count: 0,
      }
      acc.revenue += p.amount
      acc.count += 1
      byDoctor.set(p.doctorId, acc)
    }

    const planName = new Map(subs.map((s) => [s.clinicId, s.plan.name]))

    return {
      turnover: { value: turnover, changePct: null },
      estimatedProfit: {
        value: Math.round(turnover * (1 - PAYROLL_SHARE)),
        changePct: null,
      },
      // Foyda TAXMINIY: ijara, dori va kommunal xarajat tizimda yo'q
      payrollShare: PAYROLL_SHARE * 100,
      ourRevenue: { value: ourRevenue, changePct: null },
      takeRate: turnover ? Math.round((ourRevenue / turnover) * 10000) / 100 : 0,
      history: [],
      topClinics: [...byClinic.entries()]
        .map(([tenantId, a]) => ({
          tenantId,
          name: a.name,
          city: a.city,
          planName: planName.get(tenantId) ?? '',
          turnover: a.turnover,
          profit: Math.round(a.turnover * (1 - PAYROLL_SHARE)),
          patients: a.patients.size,
          perPatient: a.patients.size ? Math.round(a.turnover / a.patients.size) : 0,
        }))
        .sort((x, y) => y.turnover - x.turnover)
        .slice(0, 20),
      topDoctors: [...byDoctor.entries()]
        .map(([id, a]) => ({
          id,
          fullName: a.fullName,
          tenantName: a.tenantName,
          specialty: a.specialty,
          revenue: a.revenue,
          appointments: a.count,
          rating: null,
          monthlyPay: 0,
        }))
        .sort((x, y) => y.revenue - x.revenue)
        .slice(0, 20),
      topPaid: [],
      avgPay: 0,
      topConditions: [],
      revenueBySpecialty: [],
    }
  }

  async search(dto: PlatformSearchDto) {
    const needle = dto.q.trim()
    if (needle.length < 2) return []

    const LIMIT = 5
    const hits: {
      id: string
      scope: string
      title: string
      subtitle: string
      meta: string
      href: string
    }[] = []

    if (dto.scope === 'all' || dto.scope === 'clinic') {
      const rows = await this.db.subscription.findMany({
        where: {
          OR: [
            { clinic: { name: { contains: needle, mode: 'insensitive' } } },
            { city: { contains: needle, mode: 'insensitive' } },
            { ownerName: { contains: needle, mode: 'insensitive' } },
          ],
        },
        include: { clinic: { select: { name: true } }, plan: { select: { name: true } } },
        take: LIMIT,
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.clinicId,
          scope: 'clinic',
          title: r.clinic.name,
          subtitle: `${r.city} · ${r.ownerName}`,
          meta: r.plan.name,
          href: `/platform/clinics/${r.clinicId}`,
        })),
      )
    }

    if (dto.scope === 'all' || dto.scope === 'doctor') {
      const rows = await this.db.doctor.findMany({
        where: {
          OR: [
            { fullName: { contains: needle, mode: 'insensitive' } },
            { phone: { contains: needle } },
          ],
        },
        include: { clinic: { select: { name: true } } },
        take: LIMIT,
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.id,
          scope: 'doctor',
          title: r.fullName,
          subtitle: r.clinic.name,
          meta: r.phone,
          href: `/platform/registry?view=doctors&tenant=${r.clinicId}`,
        })),
      )
    }

    if (dto.scope === 'all' || dto.scope === 'patient') {
      const rows = await this.db.patient.findMany({
        where: {
          OR: [
            { fullName: { contains: needle, mode: 'insensitive' } },
            { phone: { contains: needle } },
          ],
        },
        include: { clinic: { select: { name: true, address: true } } },
        take: LIMIT,
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.id,
          scope: 'patient',
          title: r.fullName,
          subtitle: `${r.clinic.name} · ${r.clinic.address.split(',')[0]?.trim() ?? ''}`,
          meta: r.phone,
          href: `/platform/registry?view=patients&tenant=${r.clinicId}`,
        })),
      )
    }

    return hits
  }

  private async requireSubscription(id: string) {
    const sub = await this.db.subscription.findFirst({
      where: { OR: [{ id }, { clinicId: id }] },
      /* `termMonths` — tarif almashtirilganda muddat berilmasa kerak bo'ladi */
      select: { id: true, clinicId: true, termMonths: true },
    })
    if (!sub) throw new NotFoundException('Klinika topilmadi')
    return sub
  }
}

/* ------------------------------------------------------------------ */

function toApiTenant(
  row: {
    id: string
    clinicId: string
    status: string
    planId: string
    pricePerMonth: number
    termMonths: number
    discountPct: number
    trialEndsAt: Date | null
    subscribedAt: Date | null
    nextInvoiceAt: Date | null
    suspendReason: string
    ownerName: string
    ownerEmail: string
    ownerPhone: string
    city: string
    lastActiveAt: Date | null
    createdAt: Date
    clinic: {
      name: string
      logoUrl: string | null
      phone: string
      disabledModules: string[]
      deletedAt: Date | null
      deletedReason: string
    }
    plan: { name: string }
  },
  usage: { doctors: number; staff: number; patients: number; users: number; appointmentsThisMonth: number },
) {
  return {
    id: row.clinicId,
    name: row.clinic.name,
    logoUrl: row.clinic.logoUrl,
    city: row.city,
    phone: row.clinic.phone,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    ownerPhone: row.ownerPhone,
    status: toApi(row.status),
    planId: row.planId,
    planName: row.plan.name,
    pricePerMonth: row.pricePerMonth,
    trialEndsAt: toApiDate(row.trialEndsAt),
    subscribedAt: toApiDate(row.subscribedAt),
    nextInvoiceAt: toApiDate(row.nextInvoiceAt),
    suspendReason: row.suspendReason,
    /* Necha oyga obuna va o’sha paytdagi chegirma — “nega bu narx” degan savolga javob */
    termMonths: row.termMonths,
    discountPct: row.discountPct,
    /* Shu klinikada o'chirilgan bo'limlar — platforma paneli shuni belgilaydi */
    disabledModules: row.clinic.disabledModules,
    /* O'chirilgan bo'lsa — qachon va nima uchun. Arxivdan alohida holat. */
    deletedAt: toApiDateTime(row.clinic.deletedAt),
    deletedReason: row.clinic.deletedReason,
    usage,
    lastActiveAt: toApiDateTime(row.lastActiveAt),
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

function toApiPlan(row: Plan) {
  return {
    id: row.id,
    tier: toApi(row.tier),
    name: row.name,
    pricePerMonth: row.pricePerMonth,
    limits: { doctors: row.limitDoctors, staff: row.limitStaff },
    features: row.features,
    isActive: row.isActive,
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

function toApiInvoice(row: {
  id: string
  subscriptionId: string
  period: string
  planName: string
  amount: number
  status: string
  issuedAt: Date
  dueAt: Date
  paidAt: Date | null
  subscription: { clinicId: string; clinic: { name: string } }
}) {
  return {
    id: row.id,
    tenantId: row.subscription.clinicId,
    tenantName: row.subscription.clinic.name,
    period: row.period,
    planName: row.planName,
    amount: row.amount,
    status: toApi(row.status),
    issuedAt: toApiDate(row.issuedAt)!,
    dueAt: toApiDate(row.dueAt)!,
    paidAt: toApiDateTime(row.paidAt),
  }
}

function toApiMember(row: {
  id: string
  position: string
  permissions: string[]
  isActive: boolean
  lastActiveAt: Date | null
  createdAt: Date
  user: { fullName: string; email: string; phone: string }
}) {
  return {
    id: row.id,
    fullName: row.user.fullName,
    email: row.user.email,
    phone: row.user.phone,
    position: row.position,
    permissions: row.permissions,
    isActive: row.isActive,
    lastActiveAt: toApiDateTime(row.lastActiveAt),
    createdAt: toApiDateTime(row.createdAt)!,
  }
}

/**
 * Chegirma qo'llangan oylik narx.
 *
 * Bitta joyda, chunki uch joyda kerak: obuna ochilganda, tarif
 * almashtirilganda va platforma panelidagi jadvalda. Uch marta
 * yozilsa, yaxlitlash bir-biridan farq qilib qolardi.
 */
function discountedMonthly(pricePerMonth: number, discountPct: number): number {
  return Math.round((pricePerMonth * (100 - discountPct)) / 100)
}

function toApiBillingTerm(row: {
  id: string
  months: number
  discountPct: number
  isActive: boolean
}) {
  return {
    id: row.id,
    months: row.months,
    discountPct: row.discountPct,
    isActive: row.isActive,
  }
}
