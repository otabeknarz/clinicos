import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

import { PageQueryDto } from '../common/pagination'

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const

export type ApiAppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export class AppointmentQueryDto extends PageQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string

  @IsOptional()
  @ValidateIf((_, v) => v !== 'all')
  @IsUUID()
  doctorId: string | 'all' = 'all'

  @IsOptional()
  @IsIn(['all', ...APPOINTMENT_STATUSES])
  status: ApiAppointmentStatus | 'all' = 'all'

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string
}

/** Kalendar uchun: sahifalashsiz, davr bo'yicha */
export class AppointmentRangeDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string

  @IsOptional()
  @ValidateIf((_, v) => v !== 'all')
  @IsUUID()
  doctorId: string | 'all' = 'all'
}

export class AppointmentInputDto {
  @IsUUID()
  patientId!: string

  @IsUUID()
  doctorId!: string

  @IsUUID()
  serviceId!: string

  @IsDateString({}, { message: 'Qabul vaqti noto‘g‘ri' })
  startsAt!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes: string = ''
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  patientId?: string

  @IsOptional()
  @IsUUID()
  doctorId?: string

  @IsOptional()
  @IsUUID()
  serviceId?: string

  @IsOptional()
  @IsDateString()
  startsAt?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}

export class SetStatusDto {
  @IsIn(APPOINTMENT_STATUSES)
  status!: ApiAppointmentStatus

  /*
    Bekor qilish sababi.

    Bemor kelib bo'lgandan keyin bekor qilinsa, sabab MAJBURIY —
    bu firibgarlikka qarshi nazorat. "Bemor keldi, keyin qabul
    bekor bo'ldi" degan yozuv puli olinib, tizimga kiritilmagan
    holatni yashirishning eng oson yo'li.
  */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

export class DoctorLoadQueryDto {
  @IsDateString()
  from!: string

  @IsDateString()
  to!: string
}

/**
 * QABULLARNI KO'CHIRISH — bir yo'la bir nechta.
 *
 * `date` — boshqa kunga, VAQTI saqlanadi (09:30 bo'lsa yangi kunda ham
 * 09:30). `doctor` — o'sha vaqtda boshqa shifokorga. Shifokor kasal
 * bo'lib qolgan kunning ikki odatiy yechimi shu.
 */
export class BulkMoveDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Qabul tanlanmagan' })
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids!: string[]

  @IsIn(['date', 'doctor'])
  mode!: 'date' | 'doctor'

  @ValidateIf((dto: BulkMoveDto) => dto.mode === 'date')
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Yangi sana tanlanmagan' })
  date?: string

  @ValidateIf((dto: BulkMoveDto) => dto.mode === 'doctor')
  @IsUUID('all', { message: 'Yangi shifokor tanlanmagan' })
  doctorId?: string

  /** Bemorlarga bemor botidan xabar yuborilsinmi */
  @IsOptional()
  @IsBoolean()
  notify: boolean = true
}
