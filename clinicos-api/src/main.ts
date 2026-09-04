/*
  Eng birinchi qator: `.env` o'qilishi kerak.

  NEGA `@nestjs/config` yetmaydi: `PrismaService` konstruktorida
  ulanish manzili `process.env` dan olinadi, u esa `super()` ichida —
  ya'ni ConfigService hali ishga tushmagan paytda. Shuning uchun
  muhit dasturning eng boshida yuklanadi.
*/
import 'dotenv/config'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      /*
        `whitelist` — DTO da e'lon qilinmagan maydonlar so'rovdan
        OLIB TASHLANADI. Bu shunchaki tozalik emas, himoya: mijoz
        `clinicId` yoki `role` yuborib, ularni yozuvga o'tkazib
        yuborishga urinishi mumkin.
      */
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  )

  /*
    `X-Powered-By: Express` sarlavhasi olib tashlanadi.

    O'z-o'zidan zaifllik emas, lekin qaysi texnologiya
    ishlatilayotganini aytib turadi — hujumchi shu yerdan
    boshlaydi. Bekorga aytmagan ma'qul.
  */
  app.getHttpAdapter().getInstance().disable('x-powered-by')

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  })

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  new Logger('ClinicOS').log(`Server tayyor: http://localhost:${port}`)
}

void bootstrap()
