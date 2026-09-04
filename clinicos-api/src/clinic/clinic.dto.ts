import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

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
