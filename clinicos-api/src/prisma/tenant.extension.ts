import { Prisma } from '@prisma/client'

import { TENANT_MODELS } from './tenant-models'

/**
 * ============================================================
 *  MAJBURIY KLINIKA FILTRI
 * ============================================================
 *
 * Bu — butun tizimdagi eng muhim fayl. U buzilsa, bir klinika
 * boshqasining bemorlarini ko'radi. Bu tuzatiladigan xato emas:
 * shundan keyin sizga hech kim ishonmaydi.
 *
 * NEGA QO'LDA YOZILGAN `where` YETMAYDI: yuzlab so'rovning
 * birortasida `clinicId` unutilsa yetarli. Va u albatta unutiladi —
 * shoshilinch tuzatishda, yangi dasturchi kelganda, nusxa-ko'chirmada.
 * Shuning uchun filtr so'rov yozuvchiga emas, QATLAMGA qo'yiladi.
 *
 * `clinicId` faqat tokendan olinadi. So'rov tanasida kelgan
 * `clinicId` e'tiborga OLINMAYDI — u shu yerda ustidan yoziladi.
 *
 * ------------------------------------------------------------
 * NEGA HUJJATDAGI ODDIY NAMUNA YETARLI EMAS
 * ------------------------------------------------------------
 *
 * `args.where = { ...args.where, clinicId }` uchta joyda sinadi:
 *
 *   1. `create` da `where` umuman yo'q — `data` ga yozish kerak.
 *      `createMany` da esa `data` massiv.
 *
 *   2. `findUnique` faqat unikal maydonlarni qabul qiladi.
 *      `{ id, clinicId }` bersangiz Prisma xato beradi.
 *      Yechim: uni `findFirst` ga aylantiramiz.
 *
 *   3. `update` va `delete` ham unikal `where` talab qiladi.
 *      Ularni `updateMany`/`deleteMany` ga aylantirib bo'lmaydi,
 *      chunki chaqiruvchi bitta yozuv qaytishini kutadi. Shuning
 *      uchun avval egalik tekshiriladi, keyin amal bajariladi.
 *
 * ------------------------------------------------------------
 * IKKINCHI QATLAM
 * ------------------------------------------------------------
 *
 * Bu — dastur darajasidagi himoya. Bazada Row Level Security ham
 * yoqilishi kerak (`docs/DATABASE.md`, 1-bo'lim): kodda xato
 * bo'lsa ham PostgreSQL o'zi to'sadi. Ikkalasi birga ishlaydi.
 */

/** Yozuv boshqa klinikaga tegishli bo'lsa tashlanadi */
export class CrossTenantAccessError extends Error {
  constructor(model: string) {
    super(`${model}: yozuv boshqa klinikaga tegishli`)
    this.name = 'CrossTenantAccessError'
  }
}

/** `where` ichida `clinicId` bo'lishi shart bo'lgan amallar */
const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
])

/** Bitta unikal yozuvni oladigan amallar — `findFirst` ga aylantiriladi */
const UNIQUE_READ_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow'])

/** Bitta yozuvni o'zgartiradigan amallar — avval egalik tekshiriladi */
const UNIQUE_WRITE_OPERATIONS = new Set(['update', 'delete'])

type AnyArgs = Record<string, unknown>

export function forClinic<T extends { $extends: unknown }>(
  prisma: T,
  clinicId: string,
) {
  if (!clinicId) {
    // Bu holat bo'lmasligi kerak: qorovul tokensiz so'rovni o'tkazmaydi.
    // Baribir tekshiramiz — bo'sh `clinicId` bilan filtr HAMMA narsani
    // ochib yuborardi, ya'ni jim ishlaydigan eng xavfli xato bo'lardi.
    throw new Error('forClinic: clinicId bo‘sh')
  }

  return (prisma as never as Prisma.DefaultPrismaClient).$extends({
    name: 'clinic-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args)

          const a = (args ?? {}) as AnyArgs

          /* --- Oddiy o'qish va ommaviy amallar --- */
          if (WHERE_OPERATIONS.has(operation)) {
            a.where = { ...((a.where as AnyArgs) ?? {}), clinicId }
            return query(a as never)
          }

          /* --- Yaratish --- */
          if (operation === 'create') {
            a.data = { ...((a.data as AnyArgs) ?? {}), clinicId }
            return query(a as never)
          }

          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const rows = a.data
            a.data = Array.isArray(rows)
              ? rows.map((row) => ({ ...(row as AnyArgs), clinicId }))
              : { ...((rows as AnyArgs) ?? {}), clinicId }
            return query(a as never)
          }

          /*
            --- Unikal o'qish ---
            `findUnique` qo'shimcha shartni qabul qilmaydi, shuning
            uchun uni `findFirst` ga aylantiramiz. Natija bir xil:
            id ham unikal, clinicId esa qo'shimcha cheklov.
          */
          if (UNIQUE_READ_OPERATIONS.has(operation)) {
            a.where = { ...((a.where as AnyArgs) ?? {}), clinicId }
            const target = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow'
            return (
              prisma as never as Record<string, Record<string, (x: unknown) => unknown>>
            )[lowerFirst(model)][target](a)
          }

          /*
            --- Unikal yozish ---
            Avval yozuv shu klinikanikimi — tekshiramiz. Tekshirmasdan
            `updateMany` ga aylantirsak, chaqiruvchi kutgan yagona
            yozuv o'rniga son qaytardi va kod jim buzilardi.
          */
          if (UNIQUE_WRITE_OPERATIONS.has(operation)) {
            await assertOwned(prisma, model, a.where as AnyArgs, clinicId)
            return query(a as never)
          }

          /* --- upsert: ikkala yo'l ham cheklanadi --- */
          if (operation === 'upsert') {
            a.create = { ...((a.create as AnyArgs) ?? {}), clinicId }
            const existing = await findOwned(prisma, model, a.where as AnyArgs, clinicId)
            if (existing === 'other-tenant') throw new CrossTenantAccessError(model)
            return query(a as never)
          }

          /*
            Ro'yxatda yo'q amal chiqsa — o'tkazmaymiz.
            Prisma yangi amal qo'shsa, u jimgina filtrsiz o'tib
            ketmasligi kerak. Xato berib to'xtagani xavfsizroq.
          */
          throw new Error(
            `Klinika filtri qo‘llanmagan amal: ${model}.${operation}. ` +
              `tenant.extension.ts ga qo‘shing.`,
          )
        },
      },
    },
  })
}

/* ------------------------------------------------------------------ */

async function findOwned(
  prisma: unknown,
  model: string,
  where: AnyArgs,
  clinicId: string,
): Promise<'ok' | 'missing' | 'other-tenant'> {
  const delegate = (prisma as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>)[
    lowerFirst(model)
  ]

  const row = (await delegate.findFirst({
    where: flattenUniqueWhere(where),
    select: { clinicId: true },
  })) as { clinicId: string } | null

  if (!row) return 'missing'
  return row.clinicId === clinicId ? 'ok' : 'other-tenant'
}

async function assertOwned(
  prisma: unknown,
  model: string,
  where: AnyArgs,
  clinicId: string,
) {
  const state = await findOwned(prisma, model, where, clinicId)

  /*
    Yozuv topilmasa o'tkazamiz: Prisma o'zi "topilmadi" xatosini
    beradi va bu to'g'ri javob. Boshqa klinikaniki bo'lsa esa
    "topilmadi" deymiz — "bor, lekin sizniki emas" degan javob
    boshqa klinikada shunday yozuv borligini oshkor qiladi.
  */
  if (state === 'other-tenant') throw new CrossTenantAccessError(model)
}

/**
 * Qo'shma unikal kalitni oddiy filtrga aylantiradi.
 *
 * `update`, `delete` va `upsert` da `where` UNIKAL kalit bo'ladi.
 * Qo'shma kalit esa ichma-ich keladi:
 *
 *     { staffId_date: { staffId: '…', date: … } }
 *
 * `findFirst` bunday shaklni tushunmaydi va xato beradi — shuning
 * uchun uni bir qavat yoyamiz:
 *
 *     { staffId: '…', date: … }
 *
 * Bu yoyish faqat SHU YERDA xavfsiz: unikal kalitda faqat maydonlar
 * bo'ladi, `AND`/`OR` yoki bog'lanish filtri bo'lmaydi.
 */
function flattenUniqueWhere(where: AnyArgs): AnyArgs {
  const out: AnyArgs = {}

  for (const [key, value] of Object.entries(where ?? {})) {
    const isPlainObject =
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)

    if (isPlainObject) Object.assign(out, value as AnyArgs)
    else out[key] = value
  }

  return out
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}
