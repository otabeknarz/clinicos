import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * Bemorlarga xabar.
 *
 * Ikki yo'l: qabulga yozilganlarga (sana oralig'i bo'yicha) yoki
 * qo'lda tanlab olinganlarga. Uchinchi yo'l — "hamma bemorga" —
 * ATAYLAB YO'Q: klinikada minglab eski bemor bo'ladi va ularning
 * hammasiga xabar yuborish reklama tarqatishga aylanadi, keyin
 * odamlar botni bloklaydi va HAQIQIY eslatma ham yetib bormaydi.
 */
export class BroadcastDto {
  @IsString()
  @MinLength(5, { message: 'Xabar juda qisqa' })
  @MaxLength(600, { message: 'Xabar 600 belgidan oshmasin' })
  text = ''

  @IsIn(['appointments', 'patients'])
  scope: 'appointments' | 'patients' = 'appointments'

  /** `appointments` uchun — sana oralig'i (kiritilmasa: bugundan bir hafta) */
  @IsOptional()
  @IsISO8601()
  from?: string

  @IsOptional()
  @IsISO8601()
  to?: string

  /** `patients` uchun — tanlangan bemorlar */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500, { message: 'Bir martada 500 tagacha bemor' })
  @IsString({ each: true })
  patientIds?: string[]
}
