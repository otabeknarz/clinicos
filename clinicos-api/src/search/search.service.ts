import { Injectable } from '@nestjs/common'

import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'

/** Har turkumdan nechta natija — bu qidiruv oynasi, ro'yxat emas */
const LIMIT = 5

/**
 * Umumiy qidiruv: bemor, shifokor, xizmat va qabul.
 *
 * Ruxsat har turkum uchun alohida tekshiriladi — shifokorga
 * boshqa shifokorlar ro'yxati kerak emas va registratorga
 * ham bir xil natija chiqmasligi kerak.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async search(query: string) {
    const needle = query.trim()
    if (needle.length < 2) return []

    const { permissions, role, doctorId } = this.ctx.require()
    const hits: {
      id: string
      entity: string
      title: string
      subtitle: string
      href: string
    }[] = []

    if (permissions.includes('patients.view')) {
      const rows = await this.db.patient.findMany({
        where: {
          AND: [
            role === 'DOCTOR' && doctorId
              ? { OR: [{ primaryDoctorId: doctorId }, { appointments: { some: { doctorId } } }] }
              : {},
            {
              OR: [
                { fullName: { contains: needle, mode: 'insensitive' } },
                { phone: { contains: needle } },
              ],
            },
          ],
        },
        take: LIMIT,
        select: { id: true, fullName: true, phone: true },
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.id,
          entity: 'patient',
          title: r.fullName,
          subtitle: r.phone,
          href: `/patients/${r.id}`,
        })),
      )
    }

    if (permissions.includes('doctors.view')) {
      const rows = await this.db.doctor.findMany({
        where: {
          OR: [
            { fullName: { contains: needle, mode: 'insensitive' } },
            { phone: { contains: needle } },
          ],
        },
        take: LIMIT,
        select: { id: true, fullName: true, specialty: true },
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.id,
          entity: 'doctor',
          title: r.fullName,
          subtitle: r.specialty,
          href: `/doctors/${r.id}`,
        })),
      )
    }

    if (permissions.includes('services.view')) {
      const rows = await this.db.service.findMany({
        where: {
          status: 'ACTIVE',
          name: { contains: needle, mode: 'insensitive' },
        },
        take: LIMIT,
        select: { id: true, name: true, category: true },
      })
      hits.push(
        ...rows.map((r) => ({
          id: r.id,
          entity: 'service',
          title: r.name,
          subtitle: r.category,
          href: '/services',
        })),
      )
    }

    return hits
  }
}
