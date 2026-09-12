import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'

import { Audit } from '../common/audit.interceptor'
import { Public } from '../common/guards/jwt-auth.guard'
import { RequirePermission } from '../common/guards/permissions.guard'
import { CreateExportLinkDto, ExportQueryDto } from './export.dto'
import { ExportService } from './export.service'

/**
 * Eksport.
 *
 * `data.export` — ALOHIDA ruxsat: bo'limni ko'rish huquqi uni
 * butunlay faylga aylantirish huquqini bermaydi. Egasi uni
 * xodimga alohida beradi.
 *
 * Marshrutlar tartibi muhim: `datasets` va `links` `:dataset` dan
 * OLDIN turadi, aks holda ular bo'lim nomi deb o'qilardi.
 */
@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  // GET /export/datasets
  @Get('datasets')
  @RequirePermission('data.export')
  datasets() {
    return this.exports.list()
  }

  // GET /export/links
  @Get('links')
  @RequirePermission('data.export')
  links() {
    return this.exports.links()
  }

  // POST /export/links
  @Post('links')
  @RequirePermission('data.export')
  @Audit('create', 'export-link')
  createLink(@Body() dto: CreateExportLinkDto) {
    return this.exports.createLink(dto)
  }

  // DELETE /export/links/:id
  @Delete('links/:id')
  @RequirePermission('data.export')
  @Audit('delete', 'export-link')
  revokeLink(@Param('id') id: string) {
    return this.exports.revokeLink(id)
  }

  /**
   * Google Sheets o'qiydigan manzil.
   *
   * `@Public()`: jadval dasturi token bilan keladi, bizning
   * sessiyamiz bilan emas. Ruxsat tekshiruvi havolaning o'zida
   * (`csvByToken`).
   */
  // GET /export/sheet/:token
  @Public()
  @Get('sheet/:token')
  async sheet(@Param('token') token: string, @Res() res: Response) {
    const file = await this.exports.csvByToken(token)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(file.body)
  }

  // GET /export/:dataset
  @Get(':dataset')
  @RequirePermission('data.export')
  async download(
    @Param('dataset') dataset: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.exports.csv(dataset, query)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    res.send(file.body)
  }
}
