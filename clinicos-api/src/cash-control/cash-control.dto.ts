import { Type } from 'class-transformer'
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class CashRangeDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}

export class ShiftCloseDto {
  /*
    Faqat topshirilgan summa qabul qilinadi.

    `expectedCash` va `userId` MIJOZDAN OLINMAYDI — ikkalasi ham
    serverda aniqlanadi. Aks holda registrator kutilgan summani
    o'zi yozib, farqni nolga tenglashtirib qo'yardi.
  */
  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(0)
  @Max(1_000_000_000)
  declaredCash!: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note: string = ''
}
