import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

/**
 * APTEKA — kiruvchi ma'lumot shakllari.
 *
 * Mijozdan KELMAYDIGAN narsalar ataylab yo'q: sotuv narxi (katalogdan
 * olinadi), kutilgan naqd summa (serverda hisoblanadi), kim sotgani
 * va kim qabul qilgani (tokendan). Ularni qabul qilsak, sotuvchi
 * o'zi yozib qo'yardi — va nazoratning ma'nosi qolmasdi.
 */

export const MEDICINE_FORMS = [
  'tablet',
  'capsule',
  'syrup',
  'ampoule',
  'ointment',
  'drops',
  'spray',
  'other',
] as const

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const TIME_MESSAGE = 'Vaqt 09:00 ko‘rinishida bo‘lishi kerak'

/** Querydagi `true`/`false` matnini mantiqiy qiymatga */
const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1'

/* ------------------------------------------------------------------ */
/* So'rovlar                                                           */
/* ------------------------------------------------------------------ */

export class DaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number
}

export class MedicineQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @IsOptional()
  @IsIn(['all', 'low', 'out'])
  stock?: 'all' | 'low' | 'out'

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  prescriptionOnly?: boolean
}

export class BatchQueryDto {
  @IsOptional()
  @IsIn(['all', 'expiring', 'expired'])
  filter?: 'all' | 'expiring' | 'expired'
}

export class SaleSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  term?: string
}

export class PrescriptionQueryDto {
  @IsOptional()
  @IsIn(['all', 'pending', 'dispensed', 'expired'])
  status?: 'all' | 'pending' | 'dispensed' | 'expired'
}

/* ------------------------------------------------------------------ */
/* Katalog                                                             */
/* ------------------------------------------------------------------ */

/** Dorini tahrirlash — faqat yuborilgan maydon o'zgaradi */
export class MedicinePatchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string

  @IsOptional()
  @IsIn(MEDICINE_FORMS)
  form?: (typeof MEDICINE_FORMS)[number]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string

  @IsOptional()
  @IsBoolean()
  prescriptionOnly?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  sellPrice?: number
}

/* ------------------------------------------------------------------ */
/* Savdo                                                               */
/* ------------------------------------------------------------------ */

export class SaleLineDto {
  @IsString()
  @MaxLength(64)
  batchId!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Savat bo‘sh' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[]

  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount!: number

  @IsIn(['cash', 'card', 'transfer'])
  method!: 'cash' | 'card' | 'transfer'

  @IsOptional()
  @IsString()
  @MaxLength(64)
  patientId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(64)
  prescriptionId?: string | null
}

/* ------------------------------------------------------------------ */
/* Smena                                                               */
/* ------------------------------------------------------------------ */

export class PharmacyShiftCloseDto {
  /*
    Faqat SANALGAN summa. Kutilgan summa serverda hisoblanadi, "rahbarga
    yuborish" belgisi ham — sotuvchi uni o'zi qo'ymaydi va olib ham
    tashlay olmaydi.
  */
  @Type(() => Number)
  @IsInt({ message: 'Summa butun son bo‘lishi kerak' })
  @Min(0)
  @Max(1_000_000_000)
  countedCash!: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  handedToId?: string | null
}

/* ------------------------------------------------------------------ */
/* Xodimlar                                                            */
/* ------------------------------------------------------------------ */

export class PharmacyStaffInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  /** To'liq login: `nom@clinic-os.uz` */
  @IsEmail({}, { message: 'Login noto‘g‘ri' })
  @MaxLength(120)
  login!: string

  @IsIn(['pharmacist', 'pharmacy_owner'])
  role!: 'pharmacist' | 'pharmacy_owner'

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  salary!: number

  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workdays!: number[]

  @Matches(TIME, { message: TIME_MESSAGE })
  shiftStart!: string

  @Matches(TIME, { message: TIME_MESSAGE })
  shiftEnd!: string

  @IsOptional()
  @IsIn(['active', 'fired'])
  status?: 'active' | 'fired'

  @IsOptional()
  @IsDateString()
  hiredAt?: string

  @IsBoolean()
  canReceive!: boolean
}

/** Qisman tahrir — faqat yuborilgan maydon o'zgaradi */
export class UpdatePharmacyStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsEmail({}, { message: 'Login noto‘g‘ri' })
  @MaxLength(120)
  login?: string

  @IsOptional()
  @IsIn(['pharmacist', 'pharmacy_owner'])
  role?: 'pharmacist' | 'pharmacy_owner'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  salary?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workdays?: number[]

  @IsOptional()
  @Matches(TIME, { message: TIME_MESSAGE })
  shiftStart?: string

  @IsOptional()
  @Matches(TIME, { message: TIME_MESSAGE })
  shiftEnd?: string

  @IsOptional()
  @IsIn(['active', 'fired'])
  status?: 'active' | 'fired'

  @IsOptional()
  @IsDateString()
  hiredAt?: string

  @IsOptional()
  @IsBoolean()
  canReceive?: boolean
}

/* ------------------------------------------------------------------ */
/* Kirim                                                               */
/* ------------------------------------------------------------------ */

export class SupplierCreateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  inn?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

/** Kirimda ochiladigan yangi dori */
export class NewMedicineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string

  @IsIn(MEDICINE_FORMS)
  form!: (typeof MEDICINE_FORMS)[number]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string

  @IsOptional()
  @IsBoolean()
  prescriptionOnly?: boolean
}

export class PurchaseLineDto {
  /** Katalogda bor bo'lsa — id; yangi dori bo'lsa `null` va `medicine` */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  medicineId?: string | null

  @IsOptional()
  @ValidateNested()
  @Type(() => NewMedicineDto)
  medicine?: NewMedicineDto | null

  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchCode?: string

  @IsDateString({}, { message: 'Yaroqlilik muddati noto‘g‘ri' })
  expiresAt!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  buyPrice!: number

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  sellPrice!: number
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(80)
  invoiceNumber?: string

  @IsDateString({}, { message: 'Qabul sanasi noto‘g‘ri' })
  receivedAt!: string

  @IsIn(['paid', 'partial', 'credit'])
  payment!: 'paid' | 'partial' | 'credit'

  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidAmount!: number

  @IsOptional()
  @IsDateString({}, { message: 'To‘lov muddati noto‘g‘ri' })
  dueDate?: string | null

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  documents!: string[]

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string

  @IsArray()
  @ArrayMinSize(1, { message: 'Kirimda kamida bitta dori bo‘lishi kerak' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[]
}
