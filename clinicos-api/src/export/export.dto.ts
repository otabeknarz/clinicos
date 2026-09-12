import { Type } from 'class-transformer'
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

/** Sana oralig'i — berilmasa butun tarix chiqadi */
export class ExportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string

  @IsOptional()
  @IsISO8601()
  to?: string
}

export class CreateExportLinkDto {
  @IsString()
  @MaxLength(60)
  dataset = ''

  /**
   * Havola necha kun yashaydi.
   *
   * Muddatsiz havola bo'lmaydi: unutilgan manzil yillab ochiq
   * turaverardi. Uzog'i — 180 kun.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  days?: number
}
