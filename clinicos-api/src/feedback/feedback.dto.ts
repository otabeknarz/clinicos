import { Transform, Type } from 'class-transformer'
import {
  IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString,
  IsUUID, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator'

import { PageQueryDto } from '../common/pagination'

export class LookupDto {
  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string
}

export class FeedbackQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string

  /*
    `@Type(() => Number)` ATAYLAB ishlatilmaydi.

    U tekshiruvdan OLDIN ishlaydi va 'all' ni NaN ga aylantiradi —
    keyin `ValidateIf` 'all' ni ko'rmay qoladi va so'rov 400 bilan
    rad etiladi. `@Transform` esa 'all' ni tegmasdan qoldiradi.
  */
  @IsOptional()
  @Transform(({ value }) => (value === 'all' ? 'all' : Number(value)))
  @ValidateIf((o) => o.rating !== 'all')
  @IsInt() @Min(1) @Max(5)
  rating: number | 'all' = 'all'

  @IsOptional() @ValidateIf((o) => o.doctorId !== 'all') @IsUUID()
  doctorId: string | 'all' = 'all'

  @IsOptional() @IsIn(['all', 'new', 'reviewed', 'archived'])
  status: 'all' | 'new' | 'reviewed' | 'archived' = 'all'
}

export class FeedbackInputDto {
  @IsString() @MinLength(7) @MaxLength(30)
  phone!: string

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  patientId: string | null = null

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  doctorId: string | null = null

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  appointmentId: string | null = null

  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating!: number

  /** doctor, service, cleanliness, waiting — har biri 1-5 */
  @IsOptional() @IsObject()
  scores: Record<string, number> = {}

  @IsOptional() @IsString() @MaxLength(2000)
  text: string = ''

  @IsOptional() @IsBoolean()
  isAnonymous: boolean = false
}

export class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  text!: string
}

export class StatusDto {
  @IsIn(['new', 'reviewed', 'archived'])
  status!: 'new' | 'reviewed' | 'archived'
}

export class StatsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366)
  days: number = 90
}

export class DaysQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90)
  days: number = 7
}
