/**
 * Xodimlar chati uchun demo ma'lumot.
 */

import type { Random } from './random'
import { addDays } from '@/lib/dates'
import type { ChatGroup, ChatMessage, User } from '@/types/models'

interface ChatSeed {
  groups: ChatGroup[]
  messages: ChatMessage[]
}

/** Guruhlar bo'yicha namunaviy yozishmalar */
const CONVERSATIONS: Record<string, string[]> = {
  general: [
    'Xayrli tong! Bugun 3-qavatda suv o‘chiriladi, 14:00 gacha.',
    'Tushundik, bemorlarni ogohlantiramiz.',
    'Yangi UZI apparati ertaga keladi, o‘rnatish 10:00 da.',
    'Ertaga umumiy yig‘ilish soat 8:30 da, hamma bo‘lsin.',
    'Registraturada printer qog‘ozi tugadi, buyurtma berildi.',
    'Rahmat, bugun oqim juda zich bo‘ldi. Hammaga rahmat!',
  ],
  doctors: [
    '204-xonadagi bemorning tahlil natijasi tayyor.',
    'Ko‘rib chiqdim, davolashni o‘zgartirdim.',
    'Ertangi konsilium soat 15:00 da bo‘ladi.',
    'Kardiologiyaga yo‘llanma kerak bo‘lsa menga yozing.',
    'Bugun 3 ta shoshilinch holat bo‘ldi, hammasi joyida.',
  ],
  reception: [
    'Ertangi jadval to‘ldirildi, 6 ta bo‘sh joy qoldi.',
    'Bemor qo‘ng‘iroq qildi, qabulni ko‘chirishni so‘radi.',
    'Kassa yopildi, farq yo‘q.',
    'Yangi bemorlar uchun anketa qog‘ozi tugab qolyapti.',
    'Ertaga ertalab 8:00 da almashamiz.',
  ],
}

export function generateChat(r: Random, clinicId: string, today: Date, users: User[]): ChatSeed {
  const owner = users.find((u) => u.role === 'owner')
  const doctors = users.filter((u) => u.role === 'doctor')
  const receptionists = users.filter((u) => u.role === 'receptionist')

  if (!owner) return { groups: [], messages: [] }

  const iso = (d: Date) => d.toISOString()

  const groups: ChatGroup[] = [
    {
      id: 'chat_general',
      clinicId,
      name: 'Umumiy',
      kind: 'group',
      memberIds: users.map((u) => u.id),
      description: 'Barcha xodimlar uchun',
      createdBy: owner.id,
      createdAt: iso(addDays(today, -200)),
    },
    {
      id: 'chat_doctors',
      clinicId,
      name: 'Shifokorlar',
      kind: 'group',
      memberIds: [owner.id, ...doctors.map((u) => u.id)],
      description: 'Tibbiy masalalar',
      createdBy: owner.id,
      createdAt: iso(addDays(today, -180)),
    },
    {
      id: 'chat_reception',
      clinicId,
      name: 'Registratura',
      kind: 'group',
      memberIds: [owner.id, ...receptionists.map((u) => u.id)],
      description: 'Kundalik ish oqimi',
      createdBy: owner.id,
      createdAt: iso(addDays(today, -150)),
    },
  ]

  // Egasi va bosh shifokor orasidagi shaxsiy yozishma
  const firstDoctor = doctors[0]
  if (firstDoctor) {
    groups.push({
      id: 'chat_direct_1',
      clinicId,
      name: firstDoctor.fullName,
      kind: 'direct',
      memberIds: [owner.id, firstDoctor.id],
      description: '',
      createdBy: owner.id,
      createdAt: iso(addDays(today, -40)),
    })
  }

  /* --- Xabarlar --- */

  const messages: ChatMessage[] = []
  let seq = 0

  const addMessages = (groupId: string, pool: string[], members: User[]) => {
    if (members.length === 0) return

    // Oxirgi 6 kun ichida tarqalgan xabarlar
    let cursor = addDays(today, -6)

    pool.forEach((text, index) => {
      const author = members[index % members.length]
      cursor = new Date(cursor.getTime() + r.int(3, 14) * 3_600_000)
      if (cursor > today) cursor = new Date(today.getTime() - r.int(1, 5) * 3_600_000)

      seq++
      messages.push({
        id: `msg_${seq}`,
        clinicId,
        groupId,
        authorId: author.id,
        authorName: author.fullName,
        text,
        createdAt: iso(cursor),
        // Oxirgi ikkita xabar o'qilmagan bo'lsin — belgi ko'rinsin
        readBy:
          index >= pool.length - 2 ? [author.id] : members.map((m) => m.id),
        isSystem: false,
      })
    })
  }

  addMessages('chat_general', CONVERSATIONS.general, users.slice(0, 6))
  addMessages('chat_doctors', CONVERSATIONS.doctors, [owner, ...doctors].slice(0, 5))
  addMessages('chat_reception', CONVERSATIONS.reception, [owner, ...receptionists])

  if (firstDoctor) {
    addMessages(
      'chat_direct_1',
      [
        'Salom, ertangi konsiliumga tayyormisiz?',
        'Ha, materiallarni tayyorladim.',
        'Zo‘r, rahmat.',
      ],
      [owner, firstDoctor],
    )
  }

  messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { groups, messages }
}
