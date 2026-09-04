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

  @IsOptional() @IsIn(['all', ...TENANT_STATUSES])
  status: (typeof TENANT_STATUSES)[number] | 'all' = 'all'

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
