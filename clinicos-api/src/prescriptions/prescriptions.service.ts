import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomInt } from 'node:crypto'

import { toApi, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { OfferDto, PrescribeDto } from './prescriptions.dto'

/**
 * ============================================================
 *  ONLAYN RETSEPT — KLINIKADAN APTEKAGA
 * ============================================================
 *
 * Shifokor dorilarni yozadi, tizim aptekalar ro'yxatini taklif
 * qiladi, shifokor (yoki administrator) bittasini tanlaydi. Bemor
 * aptekaga borib qisqa kodni aytadi va dorisini oladi.
 *
 * MONOPOLIYAGA QARSHI AYLANMA — SHU BO'LIMNING ASOSIY QOIDASI.
 *
 * Onlayn retseptning tabiiy xavfi shundaki, klinika bitta apteka
 * bilan "kelishib" oladi va butun oqimni o'sha yerga yuboradi:
 * bemor tanlovsiz qoladi, narx esa kelishuvga qarab qo'yiladi.
 * Shuning uchun APTEKANI RO'YXATDAN TANLASH MAJBURIY va ro'yxatni
 * har safar TIZIM tuzadi:
 *
 *   1. Oxirgi yuborilgan aptekalar ro'yxatdan CHIQARIB tashlanadi
 *      (`AVOID_LAST`) — ketma-ket bir joyga yuborib bo'lmaydi.
 *   2. Qolganlari TASODIFIY aralashtiriladi, ya'ni tartib ham
 *      har safar boshqacha bo'ladi.
 *   3. Ko'rsatilgan ro'yxat yozuvda saqlanadi (`offeredIds`):
 *      keyin "tanlov haqiqatan bo'lganmi" degan savolga javob
 *      beriladi.
 *
 * Taklif qilinmagan aptekaga yuborib bo'lmaydi — mijoz id'ni
 * qo'lda yozib yuborsa, so'rov rad etiladi.
 *
 * NARX OLDINDAN. Har bir taklifda o'sha aptekaning O'Z narxlari
 * bo'yicha hisoblangan summa turadi — shifokor ham, bemor ham
 * qancha bo'lishini oldindan biladi. Yuborishda summa
 * MUZLATILADI: bemor shu raqamga ishonib yo'lga chiqqan.
 *
 * TENANT AJRATISH BU YERDA QO'LDA. Yozuv ikki klinikaga tegishli
 * (yozgan klinika va apteka), shuning uchun `clinicId` ustuni yo'q
 * va avtomatik filtr ishlamaydi. Har bir so'rov AYNAN chaqiruvchi
 * tomonning ustuni bo'yicha filtrlanadi — pastdagi
 * `issuerClinicId` / `pharmacyClinicId` shartlari o'sha qoidaning
 * o'zi. Yangi metod qo'shilganda ham shu shart bo'lishi SHART.
 */

/** Nechta apteka taklif qilinadi */
const OFFER_SIZE = 3

/**
 * Oxirgi shuncha yuborish qaytarilmaydi.
 *
 * Ikkita — eng kam va yetarli chegara: uchinchi retseptdagina
 * birinchi apteka qaytadi, ya'ni "doim bitta joy" holati
 * texnik jihatdan imkonsiz. Ko'proq qilinsa, kichik shaharda
 * ro'yxat bo'shab qolardi.
 */
const AVOID_LAST = 2

/** Bazadan kelgan qator — javobga o'girishdan oldin */
type RxRow = {
  id: string
  issuerClinicId: string
  pharmacyClinicId: string
  patientId: string | null
  patientName: string
  patientPhone: string
  doctorName: string
  items: unknown
  code: string
  estimatedTotal: number
  status: string
  note: string
  readyAt: Date | null
  dispensedAt: Date | null
  createdAt: Date
}

export interface RxItem {
  name: string
  qty: number
  note: string
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  /** Tenant filtridan tashqaridagi jadval — izoh sinf tepasida */
  private get db() {
    return this.prisma.acrossAllClinics()
  }

  /**
   * APTEKALAR TAKLIFI.
   *
   * Har chaqiruvda yangi ro'yxat: tasodifiy tartib, oxirgi
   * yuborilganlari chetda. Narx o'sha aptekaning katalogidan
   * hisoblanadi.
   */
  async offers(dto: OfferDto) {
    const { clinicId } = this.ctx.require()
    const items = normalizeItems(dto.items)

    /* Oxirgi yuborilgan aptekalar — ular ro'yxatdan chiqadi */
    const recent = await this.db.onlinePrescription.findMany({
      where: { issuerClinicId: clinicId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { pharmacyClinicId: true },
    })

    const avoid = new Set<string>()
    for (const row of recent) {
      if (avoid.size >= AVOID_LAST) break
      avoid.add(row.pharmacyClinicId)
    }

    const pharmacies = await this.db.clinic.findMany({
      where: { kind: 'PHARMACY', isActive: true, deletedAt: null },
      select: { id: true, name: true, phone: true, address: true, city: true },
    })

    if (pharmacies.length === 0) {
      throw new BadRequestException('Tizimda ulangan apteka yo‘q')
    }

    /*
      Chetlatish RO'YXAT BO'SHAB QOLMAGUNCHA ishlaydi. Bitta
      aptekasi bor shaharda "oxirgisi chetda" qoidasi retseptni
      umuman yuborib bo'lmaydigan qilib qo'yardi.
    */
    const pool = pharmacies.filter((one) => !avoid.has(one.id))
    const chosen = shuffle(pool.length > 0 ? pool : pharmacies).slice(0, OFFER_SIZE)

    return Promise.all(chosen.map((pharmacy) => this.priceFor(pharmacy, items)))
  }

  /** Bitta aptekaning narxi va bor-yo'qligi */
  private async priceFor(
    pharmacy: { id: string; name: string; phone: string; address: string; city: string },
    items: RxItem[],
  ) {
    const medicines = await this.db.medicine.findMany({
      where: { clinicId: pharmacy.id, status: 'ACTIVE' },
      select: { name: true, sellPrice: true, unit: true },
    })

    const byName = new Map(medicines.map((one) => [one.name.trim().toLowerCase(), one]))

    const lines = items.map((item) => {
      const found = byName.get(item.name.trim().toLowerCase())
      return {
        name: item.name,
        qty: item.qty,
        /* Topilmagan dori narxsiz ko'rsatiladi — yashirilmaydi */
        price: found ? found.sellPrice : null,
        total: found ? found.sellPrice * item.qty : null,
        available: Boolean(found),
      }
    })

    return {
      pharmacyId: pharmacy.id,
      name: pharmacy.name,
      phone: pharmacy.phone,
      address: pharmacy.address || pharmacy.city,
      /* Topilmaganlari qo'shilmaydi: bor narsaning narxi aniq */
      total: lines.reduce((sum, line) => sum + (line.total ?? 0), 0),
      availableCount: lines.filter((line) => line.available).length,
      itemCount: lines.length,
      lines,
    }
  }

  /**
   * RETSEPTNI YUBORISH.
   *
   * Apteka FAQAT taklif qilinganlar ichidan tanlanadi: id qo'lda
   * yozib yuborilsa, so'rov rad etiladi — aks holda aylanma
   * qoidasini chetlab o'tish uchun taklifni umuman so'ramaslik
   * kifoya bo'lardi.
   */
  async create(dto: PrescribeDto) {
    const { clinicId, doctorId } = this.ctx.require()
    const items = normalizeItems(dto.items)

    if (!dto.offeredIds.includes(dto.pharmacyId)) {
      throw new BadRequestException('Apteka ro‘yxatdan tanlanishi kerak')
    }

    const pharmacy = await this.db.clinic.findFirst({
      where: { id: dto.pharmacyId, kind: 'PHARMACY', isActive: true, deletedAt: null },
      select: { id: true, name: true, phone: true, address: true, city: true },
    })
    if (!pharmacy) throw new NotFoundException('Apteka topilmadi')

    const patient = dto.patientId
      ? await this.prisma
          .forCurrentClinic()
          .patient.findFirst({
            where: { id: dto.patientId },
            select: { id: true, fullName: true, phone: true },
          })
      : null

    const doctor = doctorId
      ? await this.prisma
          .forCurrentClinic()
          .doctor.findFirst({ where: { id: doctorId }, select: { fullName: true } })
      : null

    const priced = await this.priceFor(pharmacy, items)

    const row = await this.db.onlinePrescription.create({
      data: {
        issuerClinicId: clinicId,
        pharmacyClinicId: pharmacy.id,
        patientId: patient?.id ?? null,
        patientName: patient?.fullName ?? dto.patientName?.trim() ?? '',
        patientPhone: patient?.phone ?? dto.patientPhone?.trim() ?? '',
        doctorId: doctorId ?? null,
        doctorName: doctor?.fullName ?? '',
        items: items as unknown as object,
        code: await this.freeCode(),
        estimatedTotal: priced.total,
        offeredIds: dto.offeredIds,
        note: dto.note?.trim() ?? '',
      },
    })

    return toApiRx(row, pharmacy.name)
  }

  /** Klinikaning o'z retseptlari */
  async list(status?: string) {
    const { clinicId } = this.ctx.require()

    const rows = await this.db.onlinePrescription.findMany({
      where: {
        issuerClinicId: clinicId,
        ...(status && status !== 'all' ? { status: toDbStatus(status) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return this.withPharmacyNames(rows)
  }

  /** Aptekaga kelgan retseptlar */
  async inbox(status?: string) {
    const { clinicId } = this.ctx.require()

    const rows = await this.db.onlinePrescription.findMany({
      where: {
        pharmacyClinicId: clinicId,
        ...(status && status !== 'all' ? { status: toDbStatus(status) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const clinics = await this.db.clinic.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.issuerClinicId))] } },
      select: { id: true, name: true },
    })
    const names = new Map(clinics.map((one) => [one.id, one.name]))

    return rows.map((row) => ({
      ...toApiRx(row, ''),
      clinicName: names.get(row.issuerClinicId) ?? '',
    }))
  }

  /**
   * Apteka holatni o'zgartiradi.
   *
   * FAQAT O'ZIGA KELGANINI: shart `pharmacyClinicId` bo'yicha va
   * `updateMany` bilan — begona yozuv shunchaki topilmaydi.
   */
  async setStatus(id: string, next: 'ready' | 'dispensed' | 'cancelled') {
    const { clinicId } = this.ctx.require()

    const done = await this.db.onlinePrescription.updateMany({
      where: {
        id,
        pharmacyClinicId: clinicId,
        /* Berilgan retsept qaytarilmaydi */
        status: next === 'cancelled' ? { in: ['SENT', 'READY'] } : { in: ['SENT', 'READY'] },
      },
      data: {
        status: toDbStatus(next),
        readyAt: next === 'ready' ? new Date() : undefined,
        dispensedAt: next === 'dispensed' ? new Date() : undefined,
      },
    })

    if (done.count === 0) throw new NotFoundException('Retsept topilmadi')
    return { ok: true }
  }

  /** Shifokor bekor qiladi — faqat o'zi yozganini */
  async cancel(id: string) {
    const { clinicId } = this.ctx.require()

    const done = await this.db.onlinePrescription.updateMany({
      where: { id, issuerClinicId: clinicId, status: { in: ['SENT', 'READY'] } },
      data: { status: 'CANCELLED' },
    })

    if (done.count === 0) throw new NotFoundException('Retsept topilmadi')
    return { ok: true }
  }

  /** Bemor kabineti uchun */
  async forPatient(patientId: string, clinicId: string) {
    const rows = await this.db.onlinePrescription.findMany({
      where: { patientId, issuerClinicId: clinicId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return this.withPharmacyNames(rows)
  }

  private async withPharmacyNames(rows: RxRow[]) {
    const pharmacies = await this.db.clinic.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.pharmacyClinicId))] } },
      select: { id: true, name: true, phone: true, address: true },
    })
    const byId = new Map(pharmacies.map((one) => [one.id, one]))

    return rows.map((row) => ({
      ...toApiRx(row, byId.get(row.pharmacyClinicId)?.name ?? ''),
      pharmacyPhone: byId.get(row.pharmacyClinicId)?.phone ?? '',
      pharmacyAddress: byId.get(row.pharmacyClinicId)?.address ?? '',
    }))
  }

  /**
   * Bemor aptekada aytadigan kod.
   *
   * Qisqa (6 belgi) va O'QILADIGAN: chalkashadigan harflar
   * (0/O, 1/I) ro'yxatda yo'q — kod og'zaki aytiladi.
   */
  private async freeCode(): Promise<string> {
    const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

    for (let attempt = 0; attempt < 10; attempt++) {
      let code = ''
      for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]

      const taken = await this.db.onlinePrescription.findUnique({
        where: { code },
        select: { id: true },
      })
      if (!taken) return code
    }

    throw new BadRequestException('Kod yaratilmadi — qayta urinib ko‘ring')
  }
}

/* ------------------------------------------------------------------ */

function normalizeItems(items: RxItem[]): RxItem[] {
  const clean = items
    .map((item) => ({
      name: String(item.name ?? '').trim(),
      qty: Math.max(1, Math.min(Math.round(Number(item.qty) || 1), 999)),
      note: String(item.note ?? '').trim().slice(0, 200),
    }))
    .filter((item) => item.name.length > 0)

  if (clean.length === 0) throw new BadRequestException('Kamida bitta dori yozing')
  return clean.slice(0, 30)
}

/** Fisher-Yates — tartib har safar boshqacha bo'lishi uchun */
function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function toDbStatus(value: string) {
  return value.toUpperCase() as 'SENT' | 'READY' | 'DISPENSED' | 'CANCELLED'
}

function toApiRx(row: RxRow, pharmacyName: string) {
  return {
    id: row.id,
    pharmacyId: row.pharmacyClinicId,
    pharmacyName,
    patientId: row.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    doctorName: row.doctorName,
    items: (row.items as RxItem[]) ?? [],
    code: row.code,
    estimatedTotal: row.estimatedTotal,
    status: toApi(row.status as never),
    note: row.note,
    readyAt: toApiDateTime(row.readyAt),
    dispensedAt: toApiDateTime(row.dispensedAt),
    createdAt: toApiDateTime(row.createdAt)!,
  }
}
