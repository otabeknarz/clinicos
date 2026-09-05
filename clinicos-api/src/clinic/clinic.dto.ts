import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

import { STORAGE_KEY_MESSAGE, STORAGE_KEY_PATTERN } from '../storage/storage-key'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export class WorkingHourDto {
  /** 0 = yakshanba … 6 = shanba */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number

  @Matches(TIME)
  open!: string

  @Matches(TIME)
  close!: string

  @IsOptional()
  @IsBoolean()
  isClosed: boolean = false
}

export class ClinicInputDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string

  /*
    Klinika logosining KALITI.

    Bu maydon ilgari DTO da UMUMAN YO'Q edi. `whitelist: true`
    e'lon qilinmagan maydonni jimgina tashlab yuboradi, ya'ni
    logo yuborilardi, so'rov 200 qaytarardi, logo esa hech
    qachon saqlanmasdi. Xato ko'rinmasligi bilan yomon edi.
  */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(STORAGE_KEY_PATTERN, { message: STORAGE_KEY_MESSAGE })
  logoUrl?: string | null

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string

  /** Kalendardagi bitta katak necha daqiqa */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  slotMinutes?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkingHourDto)
  workingHours?: WorkingHourDto[]
}
