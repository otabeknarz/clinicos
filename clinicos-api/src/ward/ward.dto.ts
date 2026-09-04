import { Type } from 'class-transformer'
import {
  IsDateString,
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

export class RoomInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number!: string

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  floor!: number

  @IsIn(['luxury', 'standard', 'general'])
  category!: 'luxury' | 'standard' | 'general'

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  dailyRate!: number

  @IsOptional()
  @IsIn(['active', 'maintenance'])
  status: 'active' | 'maintenance' = 'active'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes: string = ''

  /** Palatada nechta joy — faqat yaratishda ishlatiladi */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  bedCount: number = 1
}

export class AdmissionQueryDto {
  @IsOptional()
  @IsIn(['all', 'planned', 'active', 'discharged'])
  status: 'all' | 'planned' | 'active' | 'discharged' = 'all'

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string
}

export class AdmissionInputDto {
  @IsUUID()
  patientId!: string

  @IsUUID()
  doctorId!: string

  @IsUUID()
  bedId!: string

  /*
    Palata `bedId` dan aniqlanadi — mijozdan olinmaydi. Aks holda
    joy bir palatadan, narx boshqasidan olinishi mumkin bo'lardi.
  */

  @IsOptional()
  @IsDateString()
  admittedAt?: string

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expectedDischargeAt: string | null = null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis: string = ''

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes: string = ''
}

export class WardRangeDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}
