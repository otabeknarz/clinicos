import { Global, Module } from '@nestjs/common'

import { DeleteCodeController } from './delete-code.controller'
import { DeleteCodeService } from './delete-code.service'

/**
 * `@Global` — kodni bemorlar, xizmatlar va to'lovlar tekshiradi.
 * Xato urinishlar hisobi xizmat ichida, ya'ni nusxa bitta bo'lishi shart.
 */
@Global()
@Module({
  controllers: [DeleteCodeController],
  providers: [DeleteCodeService],
  exports: [DeleteCodeService],
})
export class DeleteCodeModule {}
