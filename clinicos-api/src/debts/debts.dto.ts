import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

/**
 * Qarzni kechirish.
 *
 * `appointmentId` va `admissionId` dan AYNAN BITTASI kelishi kerak —
 * tekshiruv servisda, chunki u maydonlar orasidagi bog'liqlik.
 */
export class WaiveDebtDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string

  @IsOptional()
  @IsUUID()
  admissionId?: string

  /*
    Sabab MAJBURIY EMAS, lekin bo'sh qolishi mumkin: kechirish
    yozuvining o'zi kim va qachon qilganini saqlaydi. Majburiy
    qilinsa, odam "..." yozib qo'yishni o'rganib oladi.
  */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note: string = ''
}
