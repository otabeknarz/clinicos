import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
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

  /*
    NARXNI SHIFOKOR BELGILAYDIGAN XIZMAT UCHUN SUMMA.

    Xizmat `doctor_set` bo'lsa MAJBURIY va xizmatning oralig'i
    ichida bo'lishi kerak — tekshiruv servisda, chunki oraliq
    xizmat yozuvida turadi. `fixed` xizmatga yuborilsa rad etiladi:
    jimgina tashlab yuborilsa, shifokor "narx yozdim" deb o'ylab
    qolardi.
  */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(1, { message: 'Summa noldan katta bo‘lishi kerak' })
  @Max(1_000_000_000)
  price?: number

  /*
    TASHRIFGA BIRIKTIRILGAN RASMLAR — fayl KALITLARI.

    Rasm avval `POST /uploads/visits` ga yuboriladi va kalit qaytadi;
    shu kalit bu yerga keladi. Ikki qadam ataylab: forma bekor
    qilinsa fayl yozuvga bog'lanmay qoladi.

    Har bir kalit joriy klinikanikimi — servisda tekshiriladi.
  */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Bitta tashrifga 10 tadan ortiq rasm biriktirilmaydi' })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageKeys: string[] = []

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

/**
 * Yozib bo'lingan tashrifni TUZATISH.
 *
 * NEGA BOR: shifokor tashxisni xato yozib qo'yishi yoki biror
 * narsani unutib qoldirishi mumkin. Kartochkada noto'g'ri tashxis
 * turgani — yozuv umuman yo'qligidan xavfliroq: keyingi shifokor
 * unga ishonadi.
 *
 * ATAYLAB YO'Q: appointmentId — tashrifni boshqa qabulga ko'chirib
 * bo'lmaydi. Bu qabulning bemori va shifokori bilan bog'liq, ya'ni
 * ko'chirish yozuvni butunlay boshqa odamnikiga aylantirardi.
 *
 * ATAYLAB YO'Q: followUpDate, followUpReason — takroriy tashrif
 * alohida yozuv (`FollowUp`) va uning o'z tahrirlash yo'li bor
 * (`PATCH /follow-ups/:id`). Shu yerdan ham o'zgartirilsa, ikkita
 * manba bir-biriga zid qolardi.
 *
 * O'ZGARISH IZ QOLDIRADI: marshrut `@Audit` bilan belgilangan, ya'ni
 * kim va qachon tuzatgani jurnalda qoladi. Tibbiy yozuvni jimgina
 * almashtirib bo'lmaydi.
 */
export class UpdateVisitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(1, { message: 'Summa noldan katta bo‘lishi kerak' })
  @Max(1_000_000_000)
  price?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Bitta tashrifga 10 tadan ortiq rasm biriktirilmaydi' })
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageKeys?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  complaint?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatment?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
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
