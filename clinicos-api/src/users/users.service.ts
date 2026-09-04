import { Injectable, NotFoundException } from '@nestjs/common'

import { toApi, toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ProfileInputDto } from './users.dto'

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  /**
   * Foydalanuvchilar ro'yxati.
   *
   * IKKI XIL JAVOB, bitta endpoint:
   *
   *   `users.manage` bor   — to'liq yozuv (email, rol, ruxsatlar).
   *                          Sozlamalardagi boshqaruv uchun.
   *
   *   `users.manage` yo'q  — faqat ism va id. Ichki chatda guruhga
   *                          hamkasb qo'shish uchun shuncha yetadi.
   *
   * NEGA SHUNDAY: chat har bir xodimga kerak, lekin unga
   * hamkasblarning emaili, roli va ruxsatlari kerak emas.
   * Alohida endpoint ochish o'rniga javob qisqartiriladi.
   */
  async list() {
    const { permissions } = this.ctx.require()
    const full = permissions.includes('users.manage')

    const rows = await this.db.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: 'asc' },
    })

    if (!full) {
      return rows.map((row) => ({
        id: row.id,
        clinicId: row.clinicId,
        fullName: row.fullName,
        role: toApi(row.role),
        avatarUrl: row.avatarUrl,
        doctorId: row.doctorId,
      }))
    }

    return rows.map(toApiUser)
  }

  /**
   * O'z profilini tahrirlash.
   *
   * Foydalanuvchi FAQAT o'zinikini o'zgartira oladi — id tokendan
   * olinadi, so'rovdan emas. Rol va ruxsatlar bu yerdan
   * o'zgartirilmaydi: ularni faqat egasi xodimlar bo'limida
   * beradi, aks holda har kim o'ziga rol yozib olardi.
   */
  async updateProfile(dto: ProfileInputDto) {
    const { userId } = this.ctx.require()

    const found = await this.db.user.findFirst({
      where: { id: userId },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Foydalanuvchi topilmadi')

    const row = await this.db.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName?.trim(),
        phone: dto.phone?.trim(),
        avatarUrl: dto.avatarUrl,
      },
    })

    return toApiUser(row)
  }
}

function toApiUser(row: {
  id: string
  clinicId: string
  fullName: string
  email: string
  phone: string
  role: string
  avatarUrl: string | null
  isActive: boolean
  extraPermissions: string[]
  doctorId: string | null
  lastLoginAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    role: toApi(row.role),
    avatarUrl: row.avatarUrl,
    isActive: row.isActive,
    extraPermissions: row.extraPermissions,
    doctorId: row.doctorId,
    lastLoginAt: toApiDateTime(row.lastLoginAt),
    createdAt: toApiDateTime(row.createdAt)!,
    // Parol xeshi HECH QACHON javobga tushmaydi
  }
}
