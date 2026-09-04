import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const POSITIONS = [
  'doctor', 'nurse', 'receptionist', 'manager', 'accountant',
  'lab_tech', 'pharmacist', 'cleaner', 'security', 'driver', 'other',
] as const

export class StaffQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(['all', ...POSITIONS])
  position: (typeof POSITIONS)[number] | 'all' = 'all'

  @IsOptional()
  @IsIn(['all', 'active', 'on_leave', 'fired'])
  status: 'all' | 'active' | 'on_leave' | 'fired' = 'all'

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withAccess?: boolean
}

export class StaffInputDto {
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string

  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string

  @IsOptional() @IsString() @MaxLength(150)
  email: string = ''

  @IsIn(POSITIONS)
  position!: (typeof POSITIONS)[number]

  @IsString() @MinLength(2) @MaxLength(100)
  positionTitle!: string

  @IsOptional() @IsString() @MaxLength(100)
  department: string = ''

  @IsArray() @ArrayMaxSize(7)
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  workdays!: number[]

  @Matches(TIME) shiftStart!: string
  @Matches(TIME) shiftEnd!: string

  /** Stavka: 100 = to'liq, 50 = yarim */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  workRate: number = 100

  @IsIn(['salary', 'percent', 'salary_percent'])
  payType!: 'salary' | 'percent' | 'salary_percent'

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  percentRate: number = 0

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000)
  salary: number = 0

  @IsDateString()
  hiredAt!: string

  @IsOptional() @IsIn(['active', 'on_leave', 'fired'])
  status: 'active' | 'on_leave' | 'fired' = 'active'

  @IsOptional() @IsBoolean()
  hasSystemAccess: boolean = false

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @IsIn(['owner', 'receptionist', 'doctor'])
  role: 'owner' | 'receptionist' | 'doctor' | null = null

  @IsOptional() @IsString() @MaxLength(150)
  login: string = ''

  /*
    Parol faqat KIRADI, hech qachon qaytmaydi. Bazada ham
    parolning o'zi emas, argon2 xeshi saqlanadi.
  */
  @IsOptional() @IsString() @MinLength(8, { message: 'Parol kamida 8 belgi' }) @MaxLength(200)
  password?: string

  @IsOptional() @IsBoolean()
  mustChangePassword: boolean = false

  @IsOptional() @IsString() @MaxLength(1000)
  notes: string = ''
}

export class ResetPasswordDto {
  @IsString() @MinLength(8, { message: 'Parol kamida 8 belgi' }) @MaxLength(200)
  password!: string

  @IsOptional() @IsBoolean()
  mustChangePassword: boolean = true
}

export class MonthQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Oy "2026-09" ko‘rinishida' })
  month!: string
}
