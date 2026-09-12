import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { isPermissionBlocked } from '../common/modules'
import { RequestContext } from '../common/request-context'
import type { RequestUser } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { parseCsv } from './csv-parse'
import { IMPORT_DATASETS } from './import.datasets'
import type { ImportDataset, ImportRowError } from './import.datasets'

/**
 * Bitta faylda eng ko'pi — 5000 qator.
 *
 * Kattaroq baza ko'chirilayotgan bo'lsa, uni bo'lib yuklash kerak:
 * shunda xato chiqsa ham qaysi qismda ekani ma'lum bo'ladi va
 * server bitta so'rovda o'nlab megabayt matn o'girmaydi.
 */
const MAX_ROWS = 5000

export interface ImportPreview {
  /** Fayldagi ustunlar — odam nima yuklayotganini ko'rsin */
  headers: string[]
  total: number
  ready: number
  errors: ImportRowError[]
  /** Dastlabki bir necha qator — tekshirib ko'rish uchun */
  sample: Record<string, string>[]
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /** Shu odam yuklay oladigan bo'limlar va ular kutayotgan ustunlar */
  list() {
    const user = this.ctx.require()
    return IMPORT_DATASETS.filter((dataset) => this.canUse(dataset, user)).map((dataset) => ({
      key: dataset.key,
      columns: dataset.columns.map((column) => ({
        field: column.field,
        header: column.headers[0],
        required: column.required ?? false,
        example: column.example,
      })),
    }))
  }

  private canUse(dataset: ImportDataset, user: RequestUser): boolean {
    if (!user.permissions.includes('data.import')) return false
    if (!user.permissions.includes(dataset.permission)) return false
    return !isPermissionBlocked(dataset.permission, user.disabledModules)
  }

  private requireDataset(key: string): ImportDataset {
    const dataset = IMPORT_DATASETS.find((row) => row.key === key)
    if (!dataset) throw new NotFoundException('Bunday bo‘lim yo‘q')
    if (!this.canUse(dataset, this.ctx.require())) {
      throw new ForbiddenException('Bu bo‘limga yuklash huquqingiz yo‘q')
    }
    return dataset
  }

  /**
   * FAYLNI O'QISH.
   *
   * Kodirovka: Excel "CSV" deganda ko'pincha windows-1251 yozadi va
   * unda o'zbek/rus harflari "�" bo'lib qoladi. Bunday faylni jimgina
   * bazaga yozib yuborsak, ism-familiyalar buzilib ketardi — shuning
   * uchun to'xtatamiz va nima qilish kerakligini aytamiz.
   */
  private read(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi')

    const text = file.buffer.toString('utf8')
    if (text.includes('�')) {
      throw new BadRequestException(
        'Fayl kodirovkasi mos emas. Excel’da “Save as → CSV UTF-8” qilib saqlang',
      )
    }

    const table = parseCsv(text)
    if (table.rows.length === 0) throw new BadRequestException('Faylda qator yo‘q')
    if (table.rows.length > MAX_ROWS) {
      throw new BadRequestException(`Bitta faylda ${MAX_ROWS} tagacha qator bo‘lishi mumkin`)
    }
    return table
  }

  /** Yuklashdan OLDIN ko'rsatiladi: nechtasi tayyor, qayerda xato */
  preview(key: string, file?: Express.Multer.File): ImportPreview {
    const dataset = this.requireDataset(key)
    const table = this.read(file)

    const errors: ImportRowError[] = []
    let ready = 0

    table.rows.forEach((row, index) => {
      const built = dataset.build(row)
      if (built.error) {
        /* +2: sarlavha qatori va odamlar 1 dan sanaydi */
        errors.push({ row: index + 2, message: built.error })
      } else {
        ready++
      }
    })

    return {
      headers: table.headers,
      total: table.rows.length,
      ready,
      errors: errors.slice(0, 50),
      sample: table.rows.slice(0, 5),
    }
  }

  /**
   * YOZISH.
   *
   * Xato qatorlar butun faylni to'xtatmaydi: to'g'rilari yoziladi,
   * xatolari ro'yxat bo'lib qaytadi. Aks holda bitta bo'sh katak
   * ming qatorlik ishni bekor qilardi.
   */
  async apply(key: string, file?: Express.Multer.File) {
    const dataset = this.requireDataset(key)
    const table = this.read(file)

    const errors: ImportRowError[] = []
    const items: { row: number; value: Record<string, unknown> }[] = []

    table.rows.forEach((row, index) => {
      const built = dataset.build(row)
      if (built.error || !built.value) {
        errors.push({ row: index + 2, message: built.error ?? 'O‘qilmadi' })
        return
      }
      items.push({ row: index + 2, value: built.value })
    })

    const saved = await dataset.save(this.db, items)

    return {
      total: table.rows.length,
      created: saved.created,
      skipped: saved.skipped.length,
      errors: [...errors, ...saved.skipped].slice(0, 50),
    }
  }
}
