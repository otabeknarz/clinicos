import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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
