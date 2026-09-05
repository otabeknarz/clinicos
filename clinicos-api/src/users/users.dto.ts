import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator'

import { STORAGE_KEY_MESSAGE, STORAGE_KEY_PATTERN } from '../storage/storage-key'

export class ProfileInputDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string

  @IsOptional() @IsString() @MinLength(7) @MaxLength(30)
  phone?: string

  /*
    Yuklangan faylning KALITI, rasmning o'zi emas. `null` —
    rasmni olib tashlash.

    Ilgari bu yerga interfeys base64 data URL yuborardi va
    500 belgilik chegaraga urilib, har bir profil tahriri 400
    olardi. Shakli — `storage/storage-key.ts` da.
  */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(STORAGE_KEY_PATTERN, { message: STORAGE_KEY_MESSAGE })
  avatarUrl?: string | null

  /*
    `role`, `extraPermissions` va `email` ATAYLAB yo'q.

    Rol va ruxsatlarni foydalanuvchi o'ziga o'zi bera olmasligi
    kerak. Email esa kirish logini — uni almashtirish alohida,
    tasdiqlash bilan bo'ladigan jarayon.
  */
}
