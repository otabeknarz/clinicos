import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'

import { Audit } from '../common/audit.interceptor'
import { Public } from '../common/guards/jwt-auth.guard'
import { RequirePermission } from '../common/guards/permissions.guard'
import { ExportQueryDto } from '../export/export.dto'
import { GoogleService } from './google.service'

/**
 * GOOGLE SHEETS.
 *
 * Ulash `data.export` ruxsatini talab qiladi: jadvalga ma'lumot
 * chiqarish — eksportning o'zi, faqat fayl o'rniga Google'ga.
 *
 * Qaytish marshruti (`callback`) OCHIQ: Google bizning tokenimiz
 * bilan kelmaydi. Kim uchun ekanini bir martalik `state` aytadi.
 */
@Controller('integrations/google')
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  // GET /integrations/google
  @Get()
  @RequirePermission('data.export')
  status() {
    return this.google.status()
  }

  // POST /integrations/google/connect
  @Post('connect')
  @RequirePermission('data.export')
  connect() {
    return this.google.connectUrl()
  }

  // DELETE /integrations/google
  @Delete()
  @RequirePermission('data.export')
  @Audit('delete', 'google-account')
  disconnect() {
    return this.google.disconnect()
  }

  // GET /integrations/google/sheets
  @Get('sheets')
  @RequirePermission('data.export')
  sheets() {
    return this.google.sheets()
  }

  // POST /integrations/google/sheets/:dataset
  @Post('sheets/:dataset')
  @RequirePermission('data.export')
  @Audit('create', 'google-sheet')
  sync(@Param('dataset') dataset: string, @Body() query: ExportQueryDto) {
    return this.google.sync(dataset, { from: query.from, to: query.to })
  }

  /**
   * Google shu manzilga qaytaradi.
   *
   * Javob — kichik sahifa: oyna o'zi yopiladi va asosiy oynaga
   * "ulandi" deb xabar beradi. Foydalanuvchini API manzilida
   * qoldirib ketmaslik kerak.
   */
  // GET /integrations/google/callback
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    let message = ''
    if (error) {
      message = 'Ulash bekor qilindi'
    } else {
      try {
        const result = await this.google.handleCallback(code, state)
        message = `Ulandi: ${result.email}`
      } catch (failure) {
        message = failure instanceof Error ? failure.message : 'Ulanib bo‘lmadi'
      }
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(page(message))
  }
}

/** Oyna yopiladigan kichik sahifa */
function page(message: string): string {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClinicOS — Google</title>
    <style>
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        background: #eef1f7;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        color: #101828;
      }
      .card {
        background: #fff;
        padding: 28px 32px;
        border-radius: 20px;
        box-shadow: 0 18px 40px -18px rgb(20 35 70 / 0.3);
        text-align: center;
      }
      p { margin: 8px 0 0; color: #667085; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      <strong>${safe}</strong>
      <p>Bu oynani yopishingiz mumkin.</p>
    </div>
    <script>
      try {
        window.opener && window.opener.postMessage({ source: 'clinicos-google' }, '*')
      } catch (error) {
        /* boshqa domen — muhim emas */
      }
      setTimeout(function () { window.close() }, 1200)
    </script>
  </body>
</html>`
}
