import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/**
 * Sahifalash. Frontend hamma ro'yxatdan shu shaklni kutadi:
 *
 *     { items, total, page, pageSize }
 */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return { items, total, page, pageSize }
}

/**
 * Har bir ro'yxat so'rovi meros oladigan asos.
 *
 * `pageSize` cheklangan: mijoz `pageSize=1000000` yuborib, butun
 * bazani bitta so'rovda tortib ololmasin.
 *
 * NEGA 1000: interfeysda uch joyda to'liq ro'yxat kerak —
 * to'lov formasidagi bemor tanlash, platformadagi klinikalar
 * tanlovi va hisoblar jami. Chegara pastroq bo'lsa o'sha
 * sahifalar 400 oladi.
 *
 * DASTURCHIGA: 1000 ta yozuvni faqat jami hisoblash uchun
 * tortib olish isrof. To'g'rirog'i — server tomonda jamlovchi
 * endpoint qo'shish va frontendni unga o'tkazish. Hozircha
 * klinikalar soni kam, shuning uchun kutadi.
 */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize: number = 20
}

/** Prisma uchun `skip`/`take` */
export function toSkipTake(query: PageQueryDto) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  }
}
