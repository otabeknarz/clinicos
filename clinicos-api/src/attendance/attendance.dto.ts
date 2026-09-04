import { Type } from 'class-transformer'
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min, ValidateIf,
} from 'class-validator'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export class AttendanceRangeDto {
  @IsUUID() staffId!: string
  @IsDateString() from!: string
  @IsDateString() to!: string
}

export class AttendanceSummaryDto {
  @IsUUID() staffId!: string

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366)
  days: number = 30
}

export class DailyQueryDto {
  @IsDateString() date!: string
}

export class AttendanceInputDto {
  @IsUUID() staffId!: string
  @IsDateString() date!: string

  @IsIn(['present', 'late', 'absent', 'excused', 'day_off'])
  status!: 'present' | 'late' | 'absent' | 'excused' | 'day_off'

  /*
    `lateMinutes` ATAYLAB qabul qilinmaydi — u serverda
    `arrivedAt` va smena boshlanishidan hisoblanadi. Aks holda
    "kechikdi, 0 daqiqa" deb yozib, jarimani chetlab o'tish
    mumkin bo'lardi.
  */

  @IsOptional() @ValidateIf((_, v) => v !== null)
  @Matches(TIME, { message: 'Vaqt "09:20" ko‘rinishida bo‘lsin' })
  arrivedAt?: string | null

  @IsOptional() @IsString() @MaxLength(500)
  note: string = ''
}

export class FlagsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20
}
