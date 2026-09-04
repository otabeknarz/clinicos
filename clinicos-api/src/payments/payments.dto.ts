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

import { PageQueryDto } from '../common/pagination'

export const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const
export const PAYMENT_STATUSES = ['paid', 'pending', 'refunded'] as const

export class PaymentQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(['all', ...PAYMENT_METHODS])
  method: (typeof PAYMENT_METHODS)[number] | 'all' = 'all'

  @IsOptional()
  @IsIn(['all', ...PAYMENT_STATUSES])
  status: (typeof PAYMENT_STATUSES)[number] | 'all' = 'all'

  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string
}

export class PaymentInputDto {
  @IsUUID()
  patientId!: string

  @IsUUID()
  doctorId!: string

  @IsUUID()
  serviceId!: string

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  appointmentId: string | null = null

  /*
    Summa BUTUN SON, so'mda.

    Yuqori chegara servisda tekshiriladi: katalog narxidan oshib
    keta olmaydi. Bu yerda faqat mantiqiy chegara.
  */
  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(1, { message: 'Summa noldan katta bo‘lishi kerak' })
  @Max(1_000_000_000)
  amount!: number

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number]

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status: (typeof PAYMENT_STATUSES)[number] = 'paid'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes: string = ''
}

export class RevenueQueryDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}
