import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

import { PAYMENT_METHODS } from '../payments/payments.dto'

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Qarzni kechirish.
 *
 * `appointmentId` va `admissionId` dan AYNAN BITTASI kelishi kerak —
 * tekshiruv servisda, chunki u maydonlar orasidagi bog'liqlik.
 */
export class WaiveDebtDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string

  @IsOptional()
  @IsUUID()
  admissionId?: string

  /*
    Sabab MAJBURIY EMAS, lekin bo'sh qolishi mumkin: kechirish
    yozuvining o'zi kim va qachon qilganini saqlaydi. Majburiy
    qilinsa, odam "..." yozib qo'yishni o'rganib oladi.
  */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note: string = ''
}

/** Qarz to'lash muddatini qo'yish yoki olib tashlash (`dueDate: null`) */
export class SetDebtDueDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string

  @IsOptional()
  @IsUUID()
  admissionId?: string

  @ValidateIf((_, v) => v !== null)
  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  dueDate!: string | null
}

/**
 * Qarzni undirish — qarzlar ro'yxatidan to'lov.
 *
 * Bemor, shifokor va xizmat SO'ROVDAN olinmaydi: ular qarzning o'zidan
 * (qabul yoki yotqizishdan) chiqadi. Summa qolgan qarzdan oshmaydi.
 */
export class CollectDebtDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string

  @IsOptional()
  @IsUUID()
  admissionId?: string

  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(1, { message: 'Summa noldan katta bo‘lishi kerak' })
  @Max(1_000_000_000)
  amount!: number

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes: string = ''

  /** Qisman to'lovda — qolganini qachongacha to'laydi */
  @IsOptional()
  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  dueDate?: string
}
