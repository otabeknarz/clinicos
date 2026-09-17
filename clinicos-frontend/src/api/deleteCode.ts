/**
 * O'CHIRISH KODI.
 *
 * Bemor, xizmat yoki to'lovni o'chirish shu kod bilan tasdiqlanadi.
 * Kodni klinika egasi o'rnatadi (o'z paroli bilan). Server kodni
 * hech qachon qaytarmaydi — faqat o'rnatilganmi yoki yo'qmi.
 *
 * Demo rejimda kod brauzerda saqlanadi: server yo'q, tekshiruvni
 * boshqa joyda qilib bo'lmaydi.
 */

import { delay, request, USE_MOCK } from './client'

const MOCK_KEY = 'clinicos.mock.deleteCode'

function mockCode(): string | null {
  try {
    return localStorage.getItem(MOCK_KEY)
  } catch {
    return null
  }
}

// GET /clinic/delete-code
export async function getDeleteCodeStatus(): Promise<{ isSet: boolean }> {
  if (!USE_MOCK) return request<{ isSet: boolean }>('GET', '/clinic/delete-code')
  return delay({ isSet: Boolean(mockCode()) }, 60)
}

// POST /clinic/delete-code
export async function setDeleteCode(input: {
  password: string
  code: string
}): Promise<{ isSet: boolean }> {
  if (!USE_MOCK) return request<{ isSet: boolean }>('POST', '/clinic/delete-code', { body: input })
  if (!/^\d{4,8}$/.test(input.code)) throw new Error('Kod 4–8 ta raqamdan iborat bo‘lishi kerak')
  try {
    localStorage.setItem(MOCK_KEY, input.code)
  } catch {
    /* Saqlab bo'lmasa ham demo davom etadi */
  }
  return delay({ isSet: true }, 200)
}

/** Demo: server qiladigan tekshiruvni takrorlaydi */
export function assertMockDeleteCode(code: string) {
  const stored = mockCode()
  if (!stored) {
    throw new Error('O‘chirish kodi o‘rnatilmagan. Klinika egasi uni Sozlamalar → Klinika bo‘limida o‘rnatadi')
  }
  if (stored !== code) throw new Error('O‘chirish kodi noto‘g‘ri')
}
