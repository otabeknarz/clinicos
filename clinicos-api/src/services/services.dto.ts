import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class LoyaltyTierDto {
  /** Necha marta olgandan KEYIN chegirma boshlanadi */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  afterVisits!: number

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Chegirma kamida 1% bo‘lishi kerak' })
  @Max(100, { message: 'Chegirma 100% dan oshmaydi' })
  discountPct!: number
}

export class ServiceInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  category!: string

  /*
    Narx BUTUN SON, so'mda. Tiyin yo'q.

    Manfiy narx yoki nol ataylab taqiqlangan: bepul xizmat kerak
    bo'lsa, u alohida qaror va uni chetlab o'tib kiritib bo'lmasin.
  */
  @Type(() => Number)
  @IsInt({ message: 'Narx butun son bo‘lishi kerak' })
  @Min(1, { message: 'Narx noldan katta bo‘lishi kerak' })
  @Max(1_000_000_000)
  price!: number

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(600)
  durationMinutes!: number

  @IsIn(['prepaid', 'postpaid'])
  paymentTiming: 'prepaid' | 'postpaid' = 'postpaid'

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Chegirma pog‘onalari 10 tadan oshmasin' })
  @ValidateNested({ each: true })
  @Type(() => LoyaltyTierDto)
  loyaltyTiers: LoyaltyTierDto[] = []

  @IsOptional()
  @IsIn(['active', 'archived'])
  status: 'active' | 'archived' = 'active'
}

export class ServiceListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category: string = 'all'

  @IsOptional()
  @IsIn(['all', 'active', 'archived'])
  status: 'all' | 'active' | 'archived' = 'all'
}

export class PriceQueryDto {
  /*
    Bemor ko'rsatilmasa — chegirmasiz narx. Registrator bemorni
    tanlashdan oldin ham narxni ko'rishi kerak.
  */
  @IsOptional()
  @IsUUID()
  patientId?: string
}
