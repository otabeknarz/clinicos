import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

/** Yangi apteka — rahbarining kirish hisobi bilan birga */
export class PharmacyCreateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string

  /** To'liq login: `nom@clinic-os.uz` */
  @IsEmail({}, { message: 'Rahbar logini noto‘g‘ri' })
  @MaxLength(120)
  ownerEmail!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ownerPhone?: string
}

/** Apteka ma'lumotlari — rahbar va holat bu yerdan o'zgarmaydi */
export class PharmacyUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string
}

export class PharmacySuspendDto {
  /* Sabab MAJBURIY: rahbar kirishga urinib uni o'qiydi */
  @IsString()
  @MinLength(2, { message: 'Sababni yozing' })
  @MaxLength(500)
  reason!: string
}
