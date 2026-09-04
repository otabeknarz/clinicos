import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

export class ProfileInputDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  fullName?: string

  @IsOptional() @IsString() @MinLength(7) @MaxLength(30)
  phone?: string

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500)
  avatarUrl?: string | null

  /*
    `role`, `extraPermissions` va `email` ATAYLAB yo'q.

    Rol va ruxsatlarni foydalanuvchi o'ziga o'zi bera olmasligi
    kerak. Email esa kirish logini — uni almashtirish alohida,
    tasdiqlash bilan bo'ladigan jarayon.
  */
}
