import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { CLINIC_MODULES, CORE_MODULES, RESTRICTABLE_MODULES } from '../common/modules'

/** Bo'limni yopish qoidasi */
export class RestrictionDto {
  /* Tizimdagi HAR BIR bo'lim — asosiylari va apteka ham */
  @IsIn([...RESTRICTABLE_MODULES])
  module!: string

  /*
    Sabab FOYDALANUVCHIGA ko'rinadi — shuning uchun ro'yxat qisqa
    va aniq. Erkin matn bo'lsa, har safar boshqacha yozilardi.
  */
  @IsIn(['soon', 'plan', 'maintenance', 'off'])
  reason!: 'soon' | 'plan' | 'maintenance' | 'off'

  /** Bo'sh bo'lsa — HAMMA klinika uchun */
  @IsOptional() @IsUUID()
  clinicId?: string

  @IsOptional() @IsString() @MaxLength(200)
  note?: string
}

/** Yo'nalish bo'yicha sinov sharti */
export class TrialPolicyDto {
  @IsIn(['default', 'general', 'dental', 'eye', 'lab'])
  direction!: string

  @Type(() => Number) @IsInt() @Min(1) @Max(180)
  days = 14

  @IsArray()
  @ArrayMaxSize(20)
  @IsIn([...CORE_MODULES, ...CLINIC_MODULES], { each: true })
  disabledModules: string[] = []
}
