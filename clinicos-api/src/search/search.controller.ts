import { Controller, Get, Query } from '@nestjs/common'
import { IsOptional, IsString, MaxLength } from 'class-validator'

import { SearchService } from './search.service'

class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q: string = ''
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /*
    GET /search?q=

    Ruxsat talab qilinmaydi: qidiruv o'zi ruxsat bo'yicha
    filtrlaydi va foydalanuvchi ko'ra oladigan narsanigina beradi.
  */
  @Get()
  find(@Query() query: SearchQueryDto) {
    return this.search.search(query.q)
  }
}
