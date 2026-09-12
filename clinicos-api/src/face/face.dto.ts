import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, MaxLength,
} from 'class-validator'

/** Yuz izi — 128 ta son */
const SIZE = 128

export class EnrollFaceDto {
  @IsString()
  staffId = ''

  /**
   * Bir nechta namuna.
   *
   * Yuz turli yorug'likda boshqacha ko'rinadi — uch-to'rtta namuna
   * olinsa, tanish ancha ishonchli bo'ladi.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  descriptors: number[][] = []
}

export class FaceCheckInDto {
  /*
    KAMERADAN OLINGAN KADR — `data:image/jpeg;base64,...`.

    Yuz izi orqaga qaytarilmaydi: unga qarab "kim kelgani" ni
    ko'rib bo'lmaydi. Egasiga esa aynan shu kerak — xodim o'zi
    belgilaganda yagona dalil surat bo'ladi. Ixtiyoriy: S3
    sozlanmagan bo'lsa ham davomat belgilanaveradi.
  */
  @IsOptional() @IsString() @MaxLength(2_000_000)
  photo?: string

  @IsArray()
  @ArrayMinSize(SIZE)
  @ArrayMaxSize(SIZE)
  @IsNumber({}, { each: true })
  descriptor: number[] = []
}
