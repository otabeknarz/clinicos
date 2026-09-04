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
  ValidateIf,
} from 'class-validator'

export class VisitInputDto {
  @IsUUID()
  appointmentId!: string

  /*
    Bemor va shifokor id'si so'rovda kelmaydi — ular QABULDAN
    olinadi. Mijozdan qabul qilinsa, shifokor boshqa bemorning
    kartasiga tashxis yozib qo'yishi mumkin bo'lardi.
  */

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  complaint: string = ''

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis: string = ''

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatment: string = ''

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes: string = ''

  /** Takroriy tashrif tavsiya qilinsa */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  followUpDate: string | null = null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  followUpReason: string = ''
}

export class FollowUpsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  daysAhead: number = 7
}

export class FollowUpPatchDto {
  @IsOptional()
  @IsIn(['pending', 'scheduled', 'done', 'missed'])
  status?: 'pending' | 'scheduled' | 'done' | 'missed'

  @IsOptional()
  @IsDateString()
  recommendedDate?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  appointmentId?: string | null
}
