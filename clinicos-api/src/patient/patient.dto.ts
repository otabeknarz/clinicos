import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

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


/**
 * Ko'rik haqidagi fikr.
 *
 * ATAYLAB YO'Q: shifokor id va anonimlik bayrog'i. Shifokor
 * qabuldan olinadi — bemor uni almashtirib, fikrni boshqa
 * odamning reytingiga yozib qo'ymasligi kerak. Anonimlik esa
 * kabinetda tanlanmaydi: u doim yoqilgan.
 */
export class CabinetFeedbackDto {
  @IsUUID()
  appointmentId!: string

  @IsInt() @Min(1) @Max(5)
  rating!: number

  @IsOptional() @IsString() @MaxLength(2000)
  text: string = ''

  /*
    Rasm KALITLARI — yuklash alohida so'rovda bo'lgan.

    Har bir kalit joriy klinikanikimi — servisda tekshiriladi:
    shakl to'g'ri bo'la turib boshqa klinikaning kalitini
    yuborish mumkin. Tashriflar DTO si ham xuddi shunday.
  */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Bitta fikrga 5 tadan ortiq rasm biriktirilmaydi' })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageKeys: string[] = []
}
