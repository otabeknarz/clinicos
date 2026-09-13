import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

/** Retseptdagi bitta dori */
export class RxItemDto {
  @IsString() @MaxLength(160)
  name!: string

  @Type(() => Number) @IsInt() @Min(1) @Max(999)
  qty = 1

  /** "Kuniga 2 mahal" kabi ko'rsatma */
  @IsOptional() @IsString() @MaxLength(200)
  note = ''
}

/**
 * Aptekalar taklifini so'rash.
 *
 * Dorilar KERAK: ro'yxatdagi har bir apteka uchun narx aynan shu
 * dorilar bo'yicha hisoblanadi.
 */
export class OfferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RxItemDto)
  items!: RxItemDto[]
}

export class PrescribeDto extends OfferDto {
  @IsString()
  pharmacyId!: string

  /*
    KO'RSATILGAN RO'YXAT ham yuboriladi: server tanlov haqiqatan
    taklifdan qilinganini tekshiradi va ro'yxatni yozuvda
    saqlaydi. Aks holda monopoliyaga qarshi aylanmani chetlab
    o'tish uchun taklifni umuman so'ramaslik kifoya bo'lardi.
  */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  offeredIds!: string[]

  @IsOptional() @IsUUID()
  patientId?: string

  /** Bazada yo'q bemor uchun — qo'lda yoziladi */
  @IsOptional() @IsString() @MaxLength(160)
  patientName?: string

  @IsOptional() @IsString() @MaxLength(40)
  patientPhone?: string

  @IsOptional() @IsString() @MaxLength(500)
  note?: string
}

export class RxStatusDto {
  @IsIn(['ready', 'dispensed', 'cancelled'])
  status!: 'ready' | 'dispensed' | 'cancelled'
}

export class RxQueryDto {
  @IsOptional() @IsIn(['all', 'sent', 'ready', 'dispensed', 'cancelled'])
  status: 'all' | 'sent' | 'ready' | 'dispensed' | 'cancelled' = 'all'
}
