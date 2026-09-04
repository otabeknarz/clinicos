import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator'

import { PageQueryDto } from '../common/pagination'

export const PATIENT_FILTERS = ['all', 'new', 'returning', 'active', 'inactive'] as const
export type PatientFilter = (typeof PATIENT_FILTERS)[number]

export class PatientListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(PATIENT_FILTERS)
  filter: PatientFilter = 'all'
}

export class CreatePatientDto {
  @IsString()
  @MinLength(2, { message: 'Ism juda qisqa' })
  @MaxLength(120)
  fullName!: string

  /*
    Telefon shakli tekshirilmaydi, faqat uzunligi.

    NEGA: O'zbekistonda raqamlar turlicha yoziladi — "+998 90 123 45 67",
    "998901234567", "90 123 45 67". Qattiq shakl talab qilinsa,
    registrator shoshgan paytda bemorni umuman qo'sha olmaydi.
    Noyoblik esa baribir baza darajasida tekshiriladi.
  */
  @IsString()
  @MinLength(7, { message: 'Telefon raqami to‘liq emas' })
  @MaxLength(30)
  phone!: string

  @IsDateString({}, { message: 'Tug‘ilgan sana noto‘g‘ri' })
  birthDate!: string

  @IsIn(['male', 'female'], { message: 'Jinsi tanlanmagan' })
  gender!: 'male' | 'female'

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address: string = ''

  /*
    Registratura izohi. TIBBIY ma'lumot bu yerga yozilmaydi —
    tashxis `Visit` jadvalida va uni faqat shifokor ko'radi.
  */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes: string = ''

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  primaryDoctorId: string | null = null
}

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  phone?: string

  @IsOptional()
  @IsDateString()
  birthDate?: string

  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: 'male' | 'female'

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive'

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  primaryDoctorId?: string | null
}

/** `GET /patients/:id` va boshqalar uchun */
export class IdParamDto {
  @IsUUID('4', { message: 'Noto‘g‘ri id' })
  @Type(() => String)
  id!: string
}
