import {
  ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString,
  IsUUID, MaxLength, MinLength,
} from 'class-validator'

export class ChatSearchDto {
  @IsOptional() @IsString() @MaxLength(100)
  search: string = ''
}

export class MessagesQueryDto {
  /** Shu vaqtdan keyingi xabarlar — yangilanish uchun */
  @IsOptional() @IsDateString()
  since?: string
}

export class SendMessageDto {
  /*
    `authorId` ATAYLAB qabul qilinmaydi — u tokendan olinadi.
    Aks holda boshqa odamning nomidan xabar yozib bo'lardi.
  */
  @IsString() @MinLength(1) @MaxLength(4000)
  text!: string
}

export class ChatGroupInputDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string

  @IsOptional() @IsString() @MaxLength(500)
  description: string = ''

  @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true })
  memberIds!: string[]
}
