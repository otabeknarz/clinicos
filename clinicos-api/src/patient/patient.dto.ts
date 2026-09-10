import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

/**
 * Kabinetga kirish.
 *
 * ATAYLAB YO'Q: bemor id va telefon raqami. Ikkalasi ham
 * `initData` ichidan, imzo tekshirilgandan keyin chiqadi.
 * So'rovdan qabul qilinsa, har kim istagan bemorning kartasini
 * so'rab olardi.
 */
export class PatientAuthDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  initData!: string

  /**
   * Bir odam ikki klinikada bemor bo'lsa — qaysi biri.
   *
   * Birinchi so'rovda bo'sh keladi: server klinikalar ro'yxatini
   * qaytaradi, bemor tanlaydi va so'rov shu maydon bilan
   * takrorlanadi.
   */
  @IsOptional()
  @IsUUID()
  clinicId?: string
}
