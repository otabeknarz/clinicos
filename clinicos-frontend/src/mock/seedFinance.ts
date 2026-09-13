import { createRandom } from './random'
import type { FinanceEntry } from '@/types/models'

/** Demo bazada yozuv klinikaga bog'lanadi — filtr `clinicId` bo'yicha */
export type MockFinanceEntry = FinanceEntry & { clinicId: string }

/**
 * Kirim-chiqimning demo yozuvlari — oxirgi 90 kun.
 *
 * O'Z URUG'I BILAN: umumiy tasodifiy oqimdan olinsa, undan keyingi
 * hamma demo ma'lumot (bemorlar, qabullar) siljib ketardi va eski
 * skrinshotlar bilan mos kelmay qolardi.
 *
 * Summalar o'rtacha xususiy klinikaga yaqin: ijara, maosh, sarf
 * materiallari, kommunal — va kassadan kichik naqd chiqimlar.
 */
export function generateFinance(
  clinicId: string,
  today: Date,
  people: { owner: { id: string; name: string }; reception: { id: string; name: string } },
): MockFinanceEntry[] {
  const r = createRandom(20260916)
  const rows: MockFinanceEntry[] = []
  let seq = 0

  function add(
    daysAgo: number,
    hour: number,
    entry: Pick<FinanceEntry, 'type' | 'category' | 'amount' | 'method' | 'counterparty' | 'note'>,
    by: { id: string; name: string },
  ) {
    const at = new Date(today)
    at.setDate(at.getDate() - daysAgo)
    at.setHours(hour, r.int(0, 59), 0, 0)
    seq += 1
    rows.push({
      id: `fin_${seq}`,
      clinicId,
      ...entry,
      receipts: [],
      occurredAt: at.toISOString(),
      createdAt: at.toISOString(),
      createdById: by.id,
      createdByName: by.name,
      voidedAt: null,
      voidedByName: null,
      voidReason: '',
    })
  }

  const round = (value: number) => Math.round(value / 1000) * 1000

  for (let day = 89; day >= 0; day--) {
    const date = new Date(today)
    date.setDate(date.getDate() - day)
    const dom = date.getDate()

    /* --- Oyda bir marta --- */
    if (dom === 1) {
      add(day, 10, { type: 'expense', category: 'rent', amount: 18_000_000, method: 'transfer', counterparty: 'Yunusobod Biznes Markaz', note: 'Bino ijarasi' }, people.owner)
      add(day, 11, { type: 'income', category: 'rent_income', amount: 4_000_000, method: 'transfer', counterparty: 'Sog‘lom dorixonasi', note: 'Birinchi qavatdagi xona ijarasi' }, people.owner)
    }
    if (dom === 5) {
      add(day, 15, { type: 'expense', category: 'utilities', amount: round(r.int(3_200_000, 4_600_000)), method: 'transfer', counterparty: 'Hududiy elektr tarmoqlari', note: 'Svet, gaz, suv' }, people.owner)
      add(day, 15, { type: 'expense', category: 'utilities', amount: 450_000, method: 'card', counterparty: 'Uzonline', note: 'Internet' }, people.owner)
    }
    if (dom === 10) {
      add(day, 12, { type: 'expense', category: 'salary', amount: round(r.int(52_000_000, 58_000_000)), method: 'transfer', counterparty: 'Xodimlar', note: 'Oylik maosh' }, people.owner)
    }
    if (dom === 15) {
      add(day, 16, { type: 'expense', category: 'taxes', amount: round(r.int(6_000_000, 8_500_000)), method: 'transfer', counterparty: 'Soliq qo‘mitasi', note: 'Oylik soliq to‘lovi' }, people.owner)
      add(day, 17, { type: 'income', category: 'partner', amount: round(r.int(2_000_000, 3_500_000)), method: 'transfer', counterparty: 'MedLab laboratoriyasi', note: 'Yo‘llanmalar ulushi' }, people.owner)
    }
    if (dom === 20) {
      add(day, 14, { type: 'expense', category: 'marketing', amount: 2_500_000, method: 'card', counterparty: 'Instagram reklama', note: '' }, people.owner)
    }

    /* --- Haftada bir: sarf materiallari --- */
    if (date.getDay() === 2) {
      add(day, 11, { type: 'expense', category: 'supplies', amount: round(r.int(1_800_000, 4_200_000)), method: r.chance(0.5) ? 'transfer' : 'cash', counterparty: 'Medtex MChJ', note: 'Shprits, qo‘lqop, bint' }, people.owner)
    }

    /* --- Kassadan kichik naqd chiqimlar (registrator) --- */
    if (date.getDay() !== 0 && r.chance(0.45)) {
      const kind = r.pick([
        { category: 'transport', counterparty: 'Yandex Go', note: 'Tahlilni laboratoriyaga yuborish', min: 25_000, max: 60_000 },
        { category: 'purchase', counterparty: 'Kanselyariya do‘koni', note: 'Qog‘oz, ruchka, papka', min: 80_000, max: 250_000 },
        { category: 'food', counterparty: 'Non va choy', note: 'Xodimlar uchun', min: 40_000, max: 120_000 },
        { category: 'repair', counterparty: 'Santexnik', note: 'Kran almashtirildi', min: 150_000, max: 400_000 },
      ] as const)
      add(day, r.int(10, 17), { type: 'expense', category: kind.category, amount: round(r.int(kind.min, kind.max)), method: 'cash', counterparty: kind.counterparty, note: kind.note }, people.reception)
    }

    /* --- Kamdan-kam: katta xarid --- */
    if (r.chance(0.04)) {
      add(day, 13, { type: 'expense', category: 'purchase', amount: round(r.int(4_000_000, 12_000_000)), method: 'transfer', counterparty: 'Tibbiy jihozlar', note: r.pick(['Stomatologik kreslo uchun lampa', 'Sterilizator', 'Kutish zaliga kreslolar']) }, people.owner)
    }
  }

  /* Bitta bekor qilingan yozuv — ro'yxatda qanday ko'rinishini ko'rsatish uchun */
  const cash = rows.filter((row) => row.method === 'cash' && row.createdById === people.reception.id)
  const voided = cash[cash.length - 3]
  if (voided) {
    voided.voidedAt = new Date(new Date(voided.occurredAt).getTime() + 3_600_000).toISOString()
    voided.voidedByName = people.owner.name
    voided.voidReason = 'Ikki marta yozilgan'
  }

  return rows
}
