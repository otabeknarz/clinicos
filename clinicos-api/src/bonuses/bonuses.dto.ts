import { Type } from 'class-transformer'
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional,
  IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator'

import { POSITIONS } from '../staff/staff.dto'

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

export class PeriodQueryDto {
  @IsOptional() @Matches(PERIOD, { message: 'Davr "2026-09" ko‘rinishida' })
  period?: string

  @IsOptional() @IsUUID()
  staffId?: string
}

export class RequiredPeriodDto {
  @Matches(PERIOD, { message: 'Davr "2026-09" ko‘rinishida' })
  period!: string
}

export class BonusInputDto {
  @IsUUID() staffId!: string

  @Matches(PERIOD, { message: 'Davr "2026-09" ko‘rinishida' })
  period!: string

  @Type(() => Number) @IsInt() @Min(1, { message: 'Summa noldan katta bo‘lsin' })
  @Max(1_000_000_000)
  amount!: number

  @IsOptional() @IsString() @MaxLength(500)
  reason: string = ''

  @IsOptional() @IsIn(['manual', 'suggested', 'rule'])
  source: 'manual' | 'suggested' | 'rule' = 'manual'

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  ruleId: string | null = null
}

export class BonusRuleInputDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string

  @IsArray() @ArrayMaxSize(11) @IsIn(POSITIONS, { each: true })
  positions!: (typeof POSITIONS)[number][]

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  minPerformance: number = 0

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5)
  minRating: number = 0

  @IsIn(['percent_of_salary', 'fixed'])
  rewardType!: 'percent_of_salary' | 'fixed'

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000)
  rewardValue!: number

  @IsOptional() @IsBoolean()
  isActive: boolean = true
}
