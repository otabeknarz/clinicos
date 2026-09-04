import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 dan boshlab ulanish manzili sxemada emas, shu yerda.
 *
 * `dotenv/config` yuqorida import qilingan: Prisma 7 `.env` ni
 * o'zi o'qimaydi, oldingi versiyalarda esa o'qirdi.
 *
 * DASTURCHIGA: `DATABASE_URL` ni `.env` ga yozing. Kodga yozib
 * qo'ymang — parol git tarixida qolib ketadi.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
})
