/**
 * ============================================================
 *  XODIMLAR CHATI
 * ============================================================
 *
 * DASTURCHIGA — REALTIME HAQIDA:
 *
 * Bu yerdagi funksiyalar oddiy HTTP so'rovlar sifatida yozilgan, chunki
 * mock rejimda realtime kerak emas. Haqiqiy tizimda esa yangi xabar
 * DARHOL yetib borishi kerak.
 *
 * Tavsiya etilgan yechim — WebSocket:
 *
 *   1. Mijoz kirgach `wss://api.clinicos.uz/chat` ga ulanadi va
 *      tokenni yuboradi.
 *   2. Server foydalanuvchi a'zo bo'lgan guruhlarga obuna qiladi.
 *   3. Yangi xabar kelganda server uni barcha ulangan a'zolarga yuboradi:
 *        { type: 'message', payload: ChatMessage }
 *   4. `sendMessage` HTTP orqali ketaveradi (ishonchliroq), javob esa
 *      WebSocket orqali hammaga tarqaladi.
 *
 * Agar WebSocket qo'yish qiyin bo'lsa, boshlang'ich variant sifatida
 * har 3-5 soniyada `getMessages(groupId, since)` so'rovi ham ishlaydi —
 * kichik klinikada bu yetarli.
 *
 * MAXFIYLIK: server har bir so'rovda foydalanuvchi SHU guruh a'zosi
 * ekanini tekshirishi shart. A'zo bo'lmagan guruh xabarlari hech qachon
 * qaytmasligi kerak.
 */

import { apiContext, delay, matches, request, USE_MOCK } from './client'
import { getDb } from '@/mock/db'
import type { ChatGroup, ChatGroupSummary, ChatMessage, ID } from '@/types/models'

/* ------------------------------------------------------------------ */
/* Suhbatlar                                                           */
/* ------------------------------------------------------------------ */

// GET /chat/groups
export async function listChatGroups(
  userId: ID,
  search = '',
): Promise<ChatGroupSummary[]> {
  if (!USE_MOCK) {
    return request<ChatGroupSummary[]>('GET', '/chat/groups', { query: { search } })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const users = new Map(db.users.all(clinicId).map((u) => [u.id, u]))
  const allMessages = db.chatMessages.all(clinicId)

  const rows = db.chatGroups
    .all(clinicId)
    // Foydalanuvchi faqat o'zi a'zo bo'lgan suhbatlarni ko'radi
    .filter((group) => group.memberIds.includes(userId))
    .filter((group) => matches(group.name, search))
    .map((group) => {
      const groupMessages = allMessages
        .filter((m) => m.groupId === group.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      const last = groupMessages[groupMessages.length - 1]

      return {
        ...group,
        lastMessage: last
          ? {
              text: last.text,
              authorName: last.authorName,
              createdAt: last.createdAt,
              isSystem: last.isSystem,
            }
          : null,
        unreadCount: groupMessages.filter(
          (m) => m.authorId !== userId && !m.readBy.includes(userId),
        ).length,
        memberNames: group.memberIds
          .map((id) => users.get(id)?.fullName ?? '')
          .filter(Boolean),
      }
    })

  // Oxirgi yozishmalar tepada
  rows.sort((a, b) =>
    (b.lastMessage?.createdAt ?? b.createdAt).localeCompare(
      a.lastMessage?.createdAt ?? a.createdAt,
    ),
  )

  return delay(rows, 140)
}

/* ------------------------------------------------------------------ */
/* Xabarlar                                                            */
/* ------------------------------------------------------------------ */

// GET /chat/groups/:id/messages?since=
export async function getMessages(groupId: ID, since?: string): Promise<ChatMessage[]> {
  if (!USE_MOCK) {
    return request<ChatMessage[]>('GET', `/chat/groups/${groupId}/messages`, {
      query: { since },
    })
  }

  const rows = getDb()
    .chatMessages.all(apiContext().clinicId)
    .filter((m) => m.groupId === groupId)
    .filter((m) => !since || m.createdAt > since)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return delay(rows, 120)
}

export interface SendMessageInput {
  groupId: ID
  authorId: ID
  authorName: string
  text: string
}

// POST /chat/groups/:id/messages
export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  if (!USE_MOCK) {
    return request<ChatMessage>('POST', `/chat/groups/${input.groupId}/messages`, {
      body: { text: input.text },
    })
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const message: ChatMessage = {
    id: db.chatMessages.nextId('msg'),
    clinicId,
    groupId: input.groupId,
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
    createdAt: new Date().toISOString(),
    // Yuboruvchi o'z xabarini o'qigan hisoblanadi
    readBy: [input.authorId],
    isSystem: false,
  }

  db.chatMessages.insert(message)
  return delay(message, 180)
}

/**
 * Xabarlarni o'qilgan deb belgilash.
 *
 * Serverda bu alohida endpoint bo'lishi kerak — har bir xabarni
 * alohida yangilash o'rniga bitta so'rovda butun guruh belgilanadi.
 */
// POST /chat/groups/:id/read
export async function markGroupRead(groupId: ID, userId: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<void>('POST', `/chat/groups/${groupId}/read`)
    return
  }

  const { clinicId } = apiContext()
  const db = getDb()

  const unread = db.chatMessages
    .all(clinicId)
    .filter((m) => m.groupId === groupId && !m.readBy.includes(userId))

  for (const message of unread) {
    db.chatMessages.update(message.id, { readBy: [...message.readBy, userId] }, clinicId)
  }

  await delay(null, 80)
}

/* ------------------------------------------------------------------ */
/* Guruh yaratish                                                      */
/* ------------------------------------------------------------------ */

export interface ChatGroupInput {
  name: string
  description: string
  memberIds: ID[]
}

// POST /chat/groups
export async function createChatGroup(
  input: ChatGroupInput,
  createdBy: ID,
): Promise<ChatGroup> {
  if (!USE_MOCK) return request<ChatGroup>('POST', '/chat/groups', { body: input })

  const { clinicId } = apiContext()
  const db = getDb()

  const group: ChatGroup = {
    id: db.chatGroups.nextId('chat'),
    clinicId,
    name: input.name.trim(),
    kind: 'group',
    // Yaratuvchi doim a'zo bo'ladi
    memberIds: Array.from(new Set([createdBy, ...input.memberIds])),
    description: input.description.trim(),
    createdBy,
    createdAt: new Date().toISOString(),
  }

  db.chatGroups.insert(group)
  return delay(group, 300)
}

/** Umumiy o'qilmagan xabarlar soni — yon menyudagi belgi uchun */
export async function getUnreadTotal(userId: ID): Promise<number> {
  if (!USE_MOCK) return request<number>('GET', '/chat/unread')

  const { clinicId } = apiContext()
  const db = getDb()

  const myGroups = new Set(
    db.chatGroups
      .all(clinicId)
      .filter((g) => g.memberIds.includes(userId))
      .map((g) => g.id),
  )

  const count = db.chatMessages
    .all(clinicId)
    .filter((m) => myGroups.has(m.groupId))
    .filter((m) => m.authorId !== userId && !m.readBy.includes(userId)).length

  return delay(count, 90)
}
