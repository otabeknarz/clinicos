import { Type } from 'class-transformer'
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator'

import { POSITIONS } from '../staff/staff.dto'

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

export const TRIGGERS = [
  'late', 'late_minutes', 'absent', 'cash_shortfall',
  'backdated_attendance', 'discipline_below',
] as const

export class PeriodDto {
  @Matches(PERIOD, { message: 'Davr "2026-09" ko‘rinishida' })
  period!: string
}

export class PenaltyRuleInputDto {
  @IsString() @MinLength(2) @MaxLength(150)
  name!: string

  @IsIn(TRIGGERS)
  trigger!: (typeof TRIGGERS)[number]

  /** Chegaraviy qiymat: kechikish daqiqasi, kamomad summasi va h.k. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000)
  threshold: number = 0

  @IsIn(['fixed', 'percent_of_shortfall', 'percent_of_daily_salary'])
  amountType!: 'fixed' | 'percent_of_shortfall' | 'percent_of_daily_salary'

  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000)
  amountValue!: number

  @IsArray() @ArrayMaxSize(11) @IsIn(POSITIONS, { each: true })
  positions!: (typeof POSITIONS)[number][]

  @IsOptional() @IsBoolean()
  isActive: boolean = true
}

export class WaiveDto {
  /*
    Izoh MAJBURIY: kechirish sababi yozilmasa, keyinchalik
    "nega kechirilgan" degan savolga javob qolmaydi.
  */
  @IsString() @MinLength(3, { message: 'Kechirish sababini yozing' }) @MaxLength(500)
  note!: string
}
