import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

/**
 * O'ZI RO'YXATDAN O'TISH.
 *
 * EMAIL SO'RALMAYDI. Klinika rahbari o'z pochtasini ko'pincha
 * ishlatmaydi yoki eslay olmaydi, telefon esa har doim yonida —
 * va sotuv uchun ham aynan raqam kerak. Kirish ham shu raqam
 * bilan bo'ladi.
 *
 * LAVOZIM VA YO'NALISH — sotuv uchun: kim gapirayotgani (rahbarmi,
 * administratormi) va qanday klinika ekani qo'ng'iroqning
 * mazmunini butunlay o'zgartiradi.
 */

/** Klinikaning yo'nalishi — `ClinicKind` bilan bir xil ro'yxat */
export const CLINIC_DIRECTIONS = ['general', 'dental', 'eye', 'lab'] as const

/** Ro'yxatdan o'tayotgan odam klinikada kim */
export const LEAD_POSITIONS = [
  'owner',
  'chief_doctor',
  'manager',
  'administrator',
  'doctor',
  'other',
] as const

/** Klinika hajmi — sotuvda gapni shunga qarab boshlanadi */
export const STAFF_COUNTS = ['1-5', '6-15', '16-40', '40+'] as const

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Klinika nomini kiriting' })
  @MaxLength(120)
  clinicName!: string

  @IsString()
  @MinLength(3, { message: 'Ism va familiyangizni kiriting' })
  @MaxLength(120)
  fullName!: string

  /*
    Raqam shakli erkin terilishi mumkin (`+998 90 123 45 67`,
    `909 123 456`), server uni bir ko'rinishga keltiradi — bir xil
    odam ikki xil yozib, ikkita hisob ochib olmasligi kerak.
  */
  @IsString()
  @Matches(/^[\d\s()+-]{7,20}$/, { message: 'Telefon raqamini to‘g‘ri kiriting' })
  phone!: string

  @IsIn(LEAD_POSITIONS, { message: 'Lavozimni tanlang' })
  position!: (typeof LEAD_POSITIONS)[number]

  @IsIn(CLINIC_DIRECTIONS, { message: 'Klinika yo‘nalishini tanlang' })
  direction!: (typeof CLINIC_DIRECTIONS)[number]

  @IsOptional() @IsString() @MaxLength(80)
  city?: string

  @IsOptional() @IsIn(STAFF_COUNTS, { message: 'Klinika hajmini tanlang' })
  staffCount?: (typeof STAFF_COUNTS)[number]

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgi bo‘lsin' })
  @MaxLength(200)
  password!: string
}
