import { IsOptional, IsString, Matches, MaxLength } from 'class-validator'

/** Kod: 4 dan 8 gacha raqam */
export const DELETE_CODE = /^\d{4,8}$/

export class SetDeleteCodeDto {
  /**
   * Egasining joriy paroli — faqat MAVJUD kodni almashtirishda. Birinchi kod
   * birinchi o'chirish paytida parolsiz yaratiladi (buni faqat egasi qila
   * oladi — `settings.manage`).
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string

  @Matches(DELETE_CODE, { message: 'Kod 4–8 ta raqamdan iborat bo‘lishi kerak' })
  code!: string
}

/** O'chirishni tasdiqlovchi kod — o'chirish so'rovlarida */
export class DeleteCodeDto {
  @IsString()
  @MaxLength(20)
  code!: string
}
