import { IsString, MaxLength, MinLength } from 'class-validator'

/**
 * Mini app yuboradigan imzolangan ma'lumot.
 *
 * ATAYLAB YO'Q: telegram id. U mijozdan qabul qilinmaydi — `initData`
 * ichidan, imzo tekshirilgandan keyin olinadi. Aks holda har kim
 * istagan id'ni "meniki" deb yuborib, boshqa odamning telefoniga
 * kelayotgan xabarlarni o'ziga burib olardi.
 */
export class TelegramLinkDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  initData!: string
}
