import { IsString, Matches, MaxLength } from 'class-validator'

/** Kod: 4 dan 8 gacha raqam */
export const DELETE_CODE = /^\d{4,8}$/

export class SetDeleteCodeDto {
  /** Egasining joriy paroli — kodni faqat u almashtira olsin */
  @IsString()
  @MaxLength(200)
  password!: string

  @Matches(DELETE_CODE, { message: 'Kod 4–8 ta raqamdan iborat bo‘lishi kerak' })
  code!: string
}

/** O'chirishni tasdiqlovchi kod — o'chirish so'rovlarida */
export class DeleteCodeDto {
  @IsString()
  @MaxLength(20)
  code!: string
}
