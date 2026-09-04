import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export class DoctorInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string

  /** Kalit sifatida saqlanadi ("therapist"), interfeys tarjima qiladi */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  specialty!: string

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone!: string

  @IsEmail({}, { message: 'Email formati noto‘g‘ri' })
  email!: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  consultationFee!: number

  /** 0 = yakshanba … 6 = shanba */
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workdays!: number[]

  @Matches(TIME, { message: 'Vaqt "09:00" ko‘rinishida bo‘lsin' })
  shiftStart!: string

  @Matches(TIME, { message: 'Vaqt "18:00" ko‘rinishida bo‘lsin' })
  shiftEnd!: string

  @IsOptional()
  @IsIn(['active', 'on_leave', 'inactive'])
  status: 'active' | 'on_leave' | 'inactive' = 'active'

  @IsOptional()
  @IsDateString()
  hiredAt?: string
}

export class DoctorListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search: string = ''

  /** `fields=short` — formalardagi tanlov uchun qisqa ro'yxat */
  @IsOptional()
  @IsIn(['short'])
  fields?: 'short'
}

export class DoctorRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}

export class EarningsQueryDto {
  /** "2026-09" */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Davr "2026-09" ko‘rinishida' })
  period!: string
}
