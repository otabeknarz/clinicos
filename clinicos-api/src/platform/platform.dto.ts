import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

import { CLINIC_KINDS, CLINIC_MODULES, type ClinicKind } from '../common/modules'
import { PageQueryDto } from '../common/pagination'

export const TENANT_STATUSES = [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
] as const

export const INVOICE_STATUSES = ['paid', 'pending', 'overdue'] as const

export const PLATFORM_PERMISSIONS = [
  'clinics.view',
  'clinics.manage',
  'billing.view',
  'billing.manage',
  'data.view',
  'registry.doctors',
  'registry.patients',
  'clinics.impersonate',
  'team.manage',
] as const

export class TenantQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string

  /*
    `deleted` — obuna holati EMAS, alohida filtr.

    O'chirilgan klinikalar odatdagi ro'yxatda umuman chiqmaydi;
    ularni ko'rish uchun ataylab shu qiymat tanlanadi.
  */
  @IsOptional() @IsIn(['all', 'deleted', ...TENANT_STATUSES])
  status: (typeof TENANT_STATUSES)[number] | 'all' | 'deleted' = 'all'

  @IsOptional() @ValidateIf((o) => o.planId !== 'all') @IsUUID()
  planId: string | 'all' = 'all'
}

export class SuspendDto {
  /*
    Sabab MAJBURIY. Klinikaning ishini to'xtatish jiddiy amal —
    keyinchalik "nega to'xtatilgan" degan savolga javob qolishi
    kerak, ayniqsa mijoz bilan tortishuv chiqsa.
  */
  @IsString()
  @MinLength(3, { message: 'To‘xtatish sababini yozing' })
  @MaxLength(500)
  reason!: string
}

export class ChangePlanDto {
  @IsUUID()
  planId!: string
}

export class PlanInputDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000)
  pricePerMonth?: number

  /** -1 = cheksiz */
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) @Max(100000)
  limitDoctors?: number

  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) @Max(100000)
  limitStaff?: number

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  features?: string[]

  @IsOptional() @IsBoolean()
  isActive?: boolean
}

export class InvoiceQueryDto extends PageQueryDto {
  @IsOptional() @ValidateIf((o) => o.tenantId !== 'all') @IsUUID()
  tenantId: string | 'all' = 'all'

  @IsOptional() @IsIn(['all', ...INVOICE_STATUSES])
  status: (typeof INVOICE_STATUSES)[number] | 'all' = 'all'
}

export class ImpersonationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit: number = 20

  @IsOptional() @IsUUID()
  tenantId?: string
}

export class ImpersonateDto {
  @IsString()
  @MinLength(5, { message: 'Kirish sababini yozing' })
  @MaxLength(500)
  reason!: string
}

export class PlatformDoctorQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string

  @IsOptional() @ValidateIf((o) => o.tenantId !== 'all') @IsUUID()
  tenantId: string | 'all' = 'all'

  @IsOptional() @IsString() @MaxLength(60)
  specialty: string = 'all'
}

export class PlatformPatientQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string

  @IsOptional() @ValidateIf((o) => o.tenantId !== 'all') @IsUUID()
  tenantId: string | 'all' = 'all'
}

export class MemberInputDto {
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string

  @IsEmail()
  email!: string

  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string

  @IsOptional() @IsString() @MaxLength(100)
  position: string = ''

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(PLATFORM_PERMISSIONS, { each: true })
  permissions: (typeof PLATFORM_PERMISSIONS)[number][] = []

  @IsOptional() @IsBoolean()
  isActive: boolean = true

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgi' })
  @MaxLength(200)
  password!: string
}

export class PlatformSearchDto {
  @IsOptional() @IsString() @MaxLength(100)
  q: string = ''

  @IsOptional() @IsIn(['all', 'clinic', 'doctor', 'patient'])
  scope: 'all' | 'clinic' | 'doctor' | 'patient' = 'all'
}

/**
 * Platforma xodimini TAHRIRLASH.
 *
 * `password` bu yerda IXTIYORIY: yaratishda majburiy, tahrirda
 * esa faqat almashtirmoqchi bo'lganda yuboriladi. Majburiy
 * qolsa, ismni o'zgartirish uchun ham parol terish kerak bo'lardi.
 */
export class UpdateMemberDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string

  @IsOptional() @IsEmail()
  email?: string

  @IsOptional() @IsString() @MinLength(7) @MaxLength(30)
  phone?: string

  @IsOptional() @IsString() @MaxLength(100)
  position?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(PLATFORM_PERMISSIONS, { each: true })
  permissions?: (typeof PLATFORM_PERMISSIONS)[number][]

  @IsOptional() @IsBoolean()
  isActive?: boolean

  @IsOptional() @IsString() @MinLength(8, { message: 'Parol kamida 8 belgi' }) @MaxLength(200)
  password?: string
}

/**
 * YANGI KLINIKA.
 *
 * Klinika, uning egasi va obuna BIRGA yaratiladi. Uchtasi bitta
 * tranzaksiyada: obunasiz klinika platforma ro'yxatida ko'rinmaydi,
 * egasiz klinikaga esa hech kim kira olmaydi. Yarim yaratilgan
 * klinika hech kimga kerak emas.
 *
 * Ilgari klinika faqat `prisma/seed.ts` va `npm run bootstrap`
 * orqali paydo bo'lardi — ya'ni mijozni tizimga qo'shish uchun
 * serverga kirish kerak edi.
 */
export class TenantCreateDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string

  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string

  @IsString() @MinLength(2) @MaxLength(300)
  address!: string

  @IsOptional() @IsString() @MaxLength(100)
  city?: string

  @IsUUID()
  planId!: string

  /* --- Klinika egasi --- */

  @IsString() @MinLength(2) @MaxLength(120)
  ownerName!: string

  @IsEmail({}, { message: 'Email formati noto‘g‘ri' })
  ownerEmail!: string

  @IsString() @MinLength(7) @MaxLength(30)
  ownerPhone!: string

  /*
    Parol IXTIYORIY. Berilmasa server kuchli parol yasaydi va
    javobda BIR MARTA qaytaradi — bazada faqat xeshi qoladi.
  */
  @IsOptional() @IsString() @MinLength(8, { message: 'Parol kamida 8 belgi' }) @MaxLength(200)
  ownerPassword?: string

  /*
    KLINIKA TURI — faqat boshlang'ich to'plam uchun.

    Turga qarab keraksiz bo'limlar darrov o'chiriladi
    (stomatologiyada statsionar yo'q). Turning o'zi SAQLANMAYDI:
    u qaror emas, qulaylik. Platforma egasi keyin har bir bo'limni
    alohida yoqib-o'chira oladi va tur bilan bog'lanib qolmaydi.
  */
  @IsOptional()
  @IsIn([...CLINIC_KINDS])
  kind: ClinicKind = 'general'
}

/** Klinikada qaysi bo'limlar o'chirilgani */
export class TenantModulesDto {
  @IsArray()
  @IsIn([...CLINIC_MODULES], { each: true })
  disabledModules!: string[]
}

/**
 * Klinika ma'lumotlarini tahrirlash.
 *
 * Egasi va tarif bu yerdan o'zgarmaydi: tarif uchun alohida
 * endpoint bor (`/plan`), egasini almashtirish esa xodimlar
 * bo'limining ishi.
 */
export class TenantUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150)
  name?: string

  @IsOptional() @IsString() @MinLength(7) @MaxLength(30)
  phone?: string

  @IsOptional() @IsString() @MinLength(2) @MaxLength(300)
  address?: string

  @IsOptional() @IsString() @MaxLength(100)
  city?: string
}

/**
 * Arxivlash sababi.
 *
 * ATAYLAB majburiy: arxivlangan klinika xodimlari tizimga kira
 * olmaydi va bu ular uchun kutilmagan bo'ladi. Sabab yozilmasa,
 * bir oydan keyin nima uchun yopilgani hech kimga ma'lum bo'lmaydi.
 */
export class ArchiveDto {
  @IsString() @MinLength(5, { message: 'Sababni yozing' }) @MaxLength(500)
  reason!: string
}
