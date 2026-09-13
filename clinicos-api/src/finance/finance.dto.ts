import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

/**
 * CHIQIM TURLARI.
 *
 * Kalit sifatida saqlanadi, interfeys tarjima qiladi. Ro'yxat qisqa va
 * klinikaning haqiqiy pullariga qarab tuzilgan: egasi oy oxirida "pul
 * qayerga ketdi" deb so'raganda javob 10-12 ta qatordan oshmasligi kerak.
 * Mos kelmagani `other` ga tushadi, aniq nomi izohda yoziladi.
 */
export const EXPENSE_CATEGORIES = [
  /* Buyurtma va xarid: jihoz, mebel, kanselyariya */
  'purchase',
  /* Dori va sarf materiallari: shprits, qo'lqop, reagent */
  'supplies',
  /* Maosh, avans, bonus */
  'salary',
  'rent',
  /* Svet, gaz, suv, internet, telefon */
  'utilities',
  /* Ta'mirlash va jihozga xizmat */
  'repair',
  'marketing',
  /* Soliq va davlat to'lovlari */
  'taxes',
  /* Transport, taksi, yetkazib berish */
  'transport',
  /* Oziq-ovqat: statsionar, xodimlar */
  'food',
  'other',
] as const

/** Bemor to'lovidan TASHQARI kirim turlari */
export const INCOME_CATEGORIES = [
  /* Xonani ijaraga berish */
  'rent_income',
  /* Egasi yoki sherik qo'shgan pul */
  'investment',
  /* Sug'urta kompaniyasidan */
  'insurance',
  /* Hamkordan: laboratoriya, apteka ulushi */
  'partner',
  'other_income',
] as const

export const FINANCE_METHODS = ['cash', 'card', 'transfer'] as const

export class FinanceRangeDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string

  @IsOptional()
  @IsIn(['all', 'expense', 'income'])
  type: 'all' | 'expense' | 'income' = 'all'
}

/**
 * Yozuv yaratish.
 *
 * `Update...Dto` ATAYLAB YO'Q: kirim-chiqim yozuvi o'zgarmaydi, xuddi
 * to'lov kabi. Xato yozuv bekor qilinadi (`VoidFinanceEntryDto`) va
 * to'g'risi yangidan yoziladi — ikkalasi ham ro'yxatda qoladi.
 */
export class CreateFinanceEntryDto {
  @IsIn(['expense', 'income'])
  type!: 'expense' | 'income'

  /* Turi `type` ga mosligi servisda tekshiriladi — maydonlar orasidagi bog'liqlik */
  @IsString()
  @MaxLength(40)
  category!: string

  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(1, { message: 'Summa noldan katta bo‘lishi kerak' })
  @Max(10_000_000_000)
  amount!: number

  @IsIn(FINANCE_METHODS)
  method!: (typeof FINANCE_METHODS)[number]

  /** Pul qachon berilgan. Bo'sh — hozir. */
  @IsOptional()
  @IsDateString()
  occurredAt?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  counterparty: string = ''

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note: string = ''

  /**
   * Chek va hujjat suratlari — avval `POST /uploads/finance` orqali
   * yuklangan kalitlar. Bir nechta: nakladnoy ko'pincha ikki-uch varaq,
   * ustiga to'lov cheki.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Ko‘pi bilan 10 ta rasm' })
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  receipts: string[] = []
}

export class VoidFinanceEntryDto {
  /*
    Sabab MAJBURIY — qarz kechirishdan farqli. Bekor qilingan pul yozuvi
    "nega?" degan savolni albatta tug'diradi va javob yozuvning o'zida
    turishi kerak.
  */
  @IsString()
  @MinLength(3, { message: 'Bekor qilish sababini yozing' })
  @MaxLength(500)
  reason!: string
}
