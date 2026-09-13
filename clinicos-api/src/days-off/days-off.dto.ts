import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export class DaysOffRangeDto {
  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  from!: string

  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  to!: string
}

/**
 * Dam olish kunini belgilash.
 *
 * `Update...Dto` YO'Q: dam olish kuni tahrirlanmaydi — xato bo'lsa
 * o'chiriladi va qaytadan belgilanadi. Unda o'zgaradigan narsa deyarli
 * yo'q (sana va sabab), ikki yo'l esa ortiqcha.
 */
export class CreateDayOffDto {
  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  from!: string

  @Matches(DAY, { message: 'Sana YYYY-MM-DD ko‘rinishida' })
  to!: string

  /** Bo'sh — butun klinika yopiq */
  @IsOptional()
  @IsUUID()
  doctorId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason: string = ''
}
