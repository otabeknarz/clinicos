import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { toApiDateTime } from '../common/api-enum'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'
import { ChatGroupInputDto, MessagesQueryDto, SendMessageDto } from './chat.dto'

/**
 * ICHKI CHAT.
 *
 * MUHIM: odam faqat O'ZI A'ZO bo'lgan guruhlarni ko'radi. Guruh
 * id'sini bilib olib, begona yozishmani o'qib bo'lmaydi — har bir
 * so'rovda a'zolik tekshiriladi.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  private get db() {
    return this.prisma.forCurrentClinic()
  }

  async listGroups(search: string) {
    const { userId } = this.ctx.require()
    const needle = search.trim()

    const groups = await this.db.chatGroup.findMany({
      where: {
        AND: [
          { members: { some: { userId } } },
          needle ? { name: { contains: needle, mode: 'insensitive' } } : {},
        ],
      },
      include: {
        members: { include: { user: { select: { id: true, fullName: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // O'qilmagan xabarlar sonini bir so'rovda olamiz
    const unread = await this.db.chatMessage.findMany({
      where: {
        groupId: { in: groups.map((g) => g.id) },
        authorId: { not: userId },
        reads: { none: { userId } },
      },
      select: { groupId: true },
    })
    const unreadByGroup = new Map<string, number>()
    for (const m of unread) {
      unreadByGroup.set(m.groupId, (unreadByGroup.get(m.groupId) ?? 0) + 1)
    }

    return groups.map((g) => {
      const last = g.messages[0]
      return {
        id: g.id,
        clinicId: g.clinicId,
        name: g.name,
        kind: g.kind.toLowerCase(),
        memberIds: g.members.map((m) => m.userId),
        description: g.description,
        createdBy: g.createdById,
        createdAt: toApiDateTime(g.createdAt)!,
        lastMessage: last
          ? {
              text: last.text,
              authorName: last.author.fullName,
              createdAt: toApiDateTime(last.createdAt)!,
              isSystem: last.isSystem,
            }
          : null,
        unreadCount: unreadByGroup.get(g.id) ?? 0,
        memberNames: g.members.map((m) => m.user.fullName),
      }
    })
  }

  async messages(groupId: string, query: MessagesQueryDto) {
    await this.assertMember(groupId)

    const rows = await this.db.chatMessage.findMany({
      where: {
        groupId,
        ...(query.since ? { createdAt: { gt: new Date(query.since) } } : {}),
      },
      include: {
        author: { select: { fullName: true } },
        reads: { select: { userId: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    })

    return rows.map((m) => ({
      id: m.id,
      clinicId: m.clinicId,
      groupId: m.groupId,
      authorId: m.authorId,
      authorName: m.author.fullName,
      text: m.text,
      createdAt: toApiDateTime(m.createdAt)!,
      readBy: m.reads.map((r) => r.userId),
      isSystem: m.isSystem,
    }))
  }

  async send(groupId: string, dto: SendMessageDto) {
    const { clinicId, userId } = this.ctx.require()
    await this.assertMember(groupId)

    const row = await this.db.chatMessage.create({
      data: {
        clinicId,
        groupId,
        // Muallif TOKENDAN olinadi — so'rovdan emas. Aks holda
        // boshqa odamning nomidan xabar yozib bo'lardi.
        authorId: userId,
        text: dto.text.trim(),
      },
      include: { author: { select: { fullName: true } } },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      groupId: row.groupId,
      authorId: row.authorId,
      authorName: row.author.fullName,
      text: row.text,
      createdAt: toApiDateTime(row.createdAt)!,
      readBy: [],
      isSystem: row.isSystem,
    }
  }

  async markRead(groupId: string) {
    const { userId } = this.ctx.require()
    await this.assertMember(groupId)

    const unread = await this.db.chatMessage.findMany({
      where: { groupId, authorId: { not: userId }, reads: { none: { userId } } },
      select: { id: true },
    })
    if (unread.length === 0) return { marked: 0 }

    await this.prisma.acrossAllClinics().chatMessageRead.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    })

    return { marked: unread.length }
  }

  async createGroup(dto: ChatGroupInputDto) {
    const { clinicId, userId } = this.ctx.require()

    // Yaratuvchi doim a'zo bo'ladi
    const memberIds = [...new Set([userId, ...dto.memberIds])]

    // A'zolar SHU klinikadanmi
    const valid = await this.db.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    })
    if (valid.length !== memberIds.length) {
      throw new NotFoundException('Ba’zi foydalanuvchilar topilmadi')
    }

    const row = await this.db.chatGroup.create({
      data: {
        clinicId,
        name: dto.name.trim(),
        description: dto.description,
        createdById: userId,
        members: { create: memberIds.map((id) => ({ userId: id })) },
      },
      include: { members: true },
    })

    return {
      id: row.id,
      clinicId: row.clinicId,
      name: row.name,
      kind: row.kind.toLowerCase(),
      memberIds: row.members.map((m) => m.userId),
      description: row.description,
      createdBy: row.createdById,
      createdAt: toApiDateTime(row.createdAt)!,
    }
  }

  /**
   * A'zolik tekshiruvi.
   *
   * Guruh SHU klinikaniki ekani avtomatik filtr bilan ta'minlanadi,
   * a'zolik esa shu yerda. Ikkalasi ham kerak: bir klinika ichida
   * ham begona yozishmani o'qish mumkin bo'lmasligi kerak.
   */
  private async assertMember(groupId: string) {
    const { userId } = this.ctx.require()
    const group = await this.db.chatGroup.findFirst({
      where: { id: groupId },
      select: { id: true, members: { where: { userId }, select: { userId: true } } },
    })
    if (!group) throw new NotFoundException('Guruh topilmadi')
    if (group.members.length === 0) {
      throw new ForbiddenException('Siz bu guruh a’zosi emassiz')
    }
  }
}
