import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'

import { toApi, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { AttendanceService } from '../attendance/attendance.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { EnrollFaceDto, FaceCheckInDto } from './face.dto'

/**
 * YUZ BO'YICHA DAVOMAT.
 *
 * Kamera brauzerda ishlaydi: u yuzni 128 ta songa ("iz") aylantiradi
 * va serverga faqat shu sonlar keladi. Rasm hech qayerga
 * yuborilmaydi va saqlanmaydi.
 *
 * SOLISHTIRISH SERVERDA. Izlarni brauzerga berib, u yerda
 * solishtirish osonroq bo'lardi — lekin unda butun jamoaning
 * biometrik ma'lumoti har bir planshetga tushardi. Shuning uchun
 * brauzer bitta iz yuboradi, javobni server aytadi.
 *
 * BU APPLE FACE ID EMAS. Oddiy kamera chuqurlikni ko'rmaydi, ya'ni
 * bosma surat bilan aldash mumkin. Brauzer tomonda "ko'zni qisish"
 * tekshiruvi bor, lekin bu ham mutlaq himoya emas — shuning uchun
 * har bir belgilash JURNALGA tushadi va egasi uni ko'rib turadi.
 */

/** Shu masofadan uzoq bo'lsa — begona odam */
const MATCH_THRESHOLD = 0.5

/**
 * Birinchi va ikkinchi o'rin orasidagi eng kam farq.
 *
 * Ikki xodimning izi bir-biriga juda yaqin chiqsa (aka-uka,
 * egizaklar), tizim taxmin qilib emas, "tanimadim" deb aytishi
 * kerak: noto'g'ri odamga davomat yozish eng yomon natija.
 */
const MIN_GAP = 0.06

@Injectable()
export class FaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
    private readonly attendance: AttendanceService,
    private readonly storage: StorageService,
  ) {}

  private readonly logger = new Logger(FaceService.name)

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /** Kimning yuzi ro'yxatdan o'tgan */
  async list() {
    const rows = await this.db.staffFace.findMany({
      include: { staff: { select: { id: true, fullName: true, positionTitle: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const byStaff = new Map<
      string,
      { staffId: string; fullName: string; position: string; samples: number; createdAt: Date }
    >()

    for (const row of rows) {
      const current = byStaff.get(row.staffId)
      if (current) {
        current.samples++
        continue
      }
      byStaff.set(row.staffId, {
        staffId: row.staffId,
        fullName: row.staff.fullName,
        position: row.staff.positionTitle,
        samples: 1,
        createdAt: row.createdAt,
      })
    }

    return [...byStaff.values()].map((row) => ({
      ...row,
      createdAt: toApiDateTime(row.createdAt),
    }))
  }

  /**
   * Ro'yxatdan o'tkazish.
   *
   * Eski izlar O'CHIRILADI: xodim qaytadan ro'yxatdan o'tsa (soch
   * turmagi, ko'zoynak, vaqt o'tishi), eskisi bilan aralashib
   * qolmasin.
   */
  async enroll(dto: EnrollFaceDto) {
    const { clinicId, userId } = this.ctx.require()

    const staff = await this.db.staff.findFirst({ where: { id: dto.staffId } })
    if (!staff) throw new NotFoundException('Xodim topilmadi')

    for (const descriptor of dto.descriptors) {
      if (descriptor.length !== 128 || descriptor.some((value) => !Number.isFinite(value))) {
        throw new BadRequestException('Yuz izi noto‘g‘ri')
      }
    }

    await this.db.staffFace.deleteMany({ where: { staffId: dto.staffId } })
    await this.db.staffFace.createMany({
      data: dto.descriptors.map((descriptor) => ({
        clinicId,
        staffId: dto.staffId,
        descriptor,
        createdById: userId,
      })),
    })

    return { staffId: dto.staffId, samples: dto.descriptors.length }
  }

  async remove(staffId: string) {
    const done = await this.db.staffFace.deleteMany({ where: { staffId } })
    if (done.count === 0) throw new NotFoundException('Bu xodimning yuz izi yo‘q')
    return { ok: true }
  }

  /**
   * Kamera oldida turgan odamni tanib, davomatni belgilaydi.
   *
   * Belgilashning o'zi `AttendanceService` da: kechikish, bayroq va
   * qoidalar o'sha yerda. Bu yerda faqat "kim ekani" hal qilinadi —
   * ikkita joyda ikkita qoida bo'lib qolmasligi kerak.
   */
  async checkIn(dto: FaceCheckInDto) {
    const faces = await this.db.staffFace.findMany({
      include: {
        staff: { select: { id: true, fullName: true, shiftStart: true, status: true } },
      },
    })

    const active = faces.filter((face) => face.staff.status === 'ACTIVE')
    if (active.length === 0) {
      throw new NotFoundException('Hali birorta xodimning yuzi ro‘yxatdan o‘tmagan')
    }

    /* Har bir xodim uchun ENG YAQIN namunasi olinadi */
    const best = new Map<string, { distance: number; face: (typeof active)[number] }>()
    for (const face of active) {
      const distance = euclidean(dto.descriptor, face.descriptor)
      const current = best.get(face.staffId)
      if (!current || distance < current.distance) best.set(face.staffId, { distance, face })
    }

    const ranked = [...best.values()].sort((a, b) => a.distance - b.distance)
    const winner = ranked[0]
    const runnerUp = ranked[1]

    if (!winner || winner.distance > MATCH_THRESHOLD) {
      throw new NotFoundException('Yuz tanilmadi')
    }
    if (runnerUp && runnerUp.distance - winner.distance < MIN_GAP) {
      throw new NotFoundException('Ishonchli tanilmadi — qaytadan urinib ko‘ring')
    }

    const staff = winner.face.staff
    const now = new Date()
    const arrivedAt = clock(now)

    /*
      BUGUN BELGILANGAN BO'LSA — QAYTA YOZILMAYDI. Xodim kun
      davomida kamera oldidan o'tib ketishi mumkin; har safar
      "keldi" deb yozilsa, kelgan vaqti eng oxirgisiga almashib
      qolardi va qo'lda kiritilgan izoh ham yo'qolardi.
    */
    const today = startOfToday()
    const existing = await this.db.attendance.findFirst({
      where: { staffId: staff.id, date: today },
      select: { status: true, arrivedAt: true },
    })

    if (existing) {
      return {
        staffId: staff.id,
        fullName: staff.fullName,
        status: toApi(existing.status),
        arrivedAt: existing.arrivedAt,
        alreadyMarked: true,
        distance: round(winner.distance),
      }
    }

    const late = minutesOf(arrivedAt) > minutesOf(staff.shiftStart)
    const photoKey = await this.savePhoto(dto.photo)

    await this.attendance.mark(
      {
        staffId: staff.id,
        date: dayString(now),
        status: late ? 'late' : 'present',
        arrivedAt,
        note: 'Yuz orqali',
      },
      { photoKey, selfMarked: true },
    )

    return {
      staffId: staff.id,
      fullName: staff.fullName,
      status: late ? 'late' : 'present',
      arrivedAt,
      alreadyMarked: false,
      distance: round(winner.distance),
    }
  }

  /**
   * Kelish suratini saqlaydi.
   *
   * XATO DAVOMATNI TO'XTATMAYDI: S3 sozlanmagan yoki o'chib
   * turgan bo'lsa ham xodim kelgani yoziladi — surat qulaylik,
   * davomatning o'zi esa ish.
   */
  private async savePhoto(photo?: string): Promise<string | null> {
    if (!photo || !this.storage.enabled) return null

    try {
      const base64 = photo.includes(',') ? photo.slice(photo.indexOf(',') + 1) : photo
      const buffer = Buffer.from(base64, 'base64')
      const type = this.storage.detectType(buffer)
      if (!type) return null

      const stored = await this.storage.put('davomat', buffer, type)
      return stored.key
    } catch (error) {
      this.logger.warn(`Davomat surati saqlanmadi: ${(error as Error).message}`)
      return null
    }
  }
}

/* ------------------------------------------------------------------ */

function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - (b[i] ?? 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function clock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}
