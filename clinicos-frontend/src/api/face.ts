/**
 * YUZ BO'YICHA DAVOMAT.
 *
 * Brauzer yuzni 128 ta songa aylantiradi va faqat shu sonlarni
 * yuboradi — rasm hech qayerga ketmaydi. Solishtirish serverda:
 * butun jamoaning biometrik ma'lumoti har bir planshetga
 * tushmasligi kerak.
 *
 * Demo rejimda solishtirish shu yerda bo'ladi (server yo'q), izlar
 * esa sahifa ochiq turganda xotirada yashaydi.
 */

import { delay, request, USE_MOCK } from './client'
import { faceDistance } from '@/lib/face'
import type { ID, ISODateTime } from '@/types/models'

export interface EnrolledFace {
  staffId: ID
  fullName: string
  position: string
  samples: number
  createdAt: ISODateTime
}

export interface FaceCheckInResult {
  staffId: ID
  fullName: string
  status: 'present' | 'late'
  arrivedAt: string | null
  /** Bugun allaqachon belgilangan bo'lsa — qayta yozilmaydi */
  alreadyMarked: boolean
  distance: number
}

// GET /attendance/face
export async function listEnrolledFaces(): Promise<EnrolledFace[]> {
  if (!USE_MOCK) return request<EnrolledFace[]>('GET', '/attendance/face')
  return delay(mockFaces.map(({ descriptors, ...rest }) => ({ ...rest, samples: descriptors.length })))
}

// POST /attendance/face
export async function enrollFace(input: {
  staffId: ID
  fullName: string
  descriptors: number[][]
}): Promise<void> {
  if (!USE_MOCK) {
    await request<{ staffId: string }>('POST', '/attendance/face', {
      body: { staffId: input.staffId, descriptors: input.descriptors },
    })
    return
  }

  mockFaces = [
    ...mockFaces.filter((face) => face.staffId !== input.staffId),
    {
      staffId: input.staffId,
      fullName: input.fullName,
      position: '',
      createdAt: new Date().toISOString(),
      descriptors: input.descriptors,
    },
  ]
  await delay(null, 300)
}

// DELETE /attendance/face/:staffId
export async function deleteFace(staffId: ID): Promise<void> {
  if (!USE_MOCK) {
    await request<{ ok: boolean }>('DELETE', `/attendance/face/${staffId}`)
    return
  }
  mockFaces = mockFaces.filter((face) => face.staffId !== staffId)
  await delay(null)
}

// POST /attendance/face/verify
export async function faceVerify(
  staffId: ID,
  descriptor: number[],
  photo?: string | null,
): Promise<FaceCheckInResult> {
  if (!USE_MOCK) {
    return request<FaceCheckInResult>('POST', '/attendance/face/verify', {
      body: { staffId, descriptor, photo: photo ?? undefined },
    })
  }

  const face = mockFaces.find((item) => item.staffId === staffId)
  if (!face) throw new Error('Bu xodimning yuz izi ro‘yxatdan o‘tmagan')

  /* Demo rejimda ham qoida bir xil: eng yaqin iz shu xodimniki bo'lsin */
  const ranked = mockFaces
    .map((item) => ({
      staffId: item.staffId,
      distance: Math.min(...item.descriptors.map((sample) => faceDistance(descriptor, sample))),
    }))
    .sort((a, b) => a.distance - b.distance)

  const best = ranked[0]
  if (best.distance > 0.5) throw new Error('Yuz tanilmadi')
  if (best.staffId !== staffId) throw new Error('Yuz mos kelmadi')

  return delay({
    staffId,
    fullName: face.fullName,
    status: 'present' as const,
    arrivedAt: new Date().toTimeString().slice(0, 5),
    alreadyMarked: false,
    distance: Math.round(best.distance * 1000) / 1000,
  })
}

// POST /attendance/face/check-in
export async function faceCheckIn(
  descriptor: number[],
  /** Kamera kadri — yozuvning dalili bo'lib saqlanadi */
  photo?: string | null,
): Promise<FaceCheckInResult> {
  if (!USE_MOCK) {
    return request<FaceCheckInResult>('POST', '/attendance/face/check-in', {
      body: { descriptor, photo: photo ?? undefined },
    })
  }

  if (mockFaces.length === 0) {
    throw new Error('Hali birorta xodimning yuzi ro‘yxatdan o‘tmagan')
  }

  const ranked = mockFaces
    .map((face) => ({
      face,
      distance: Math.min(...face.descriptors.map((sample) => faceDistance(descriptor, sample))),
    }))
    .sort((a, b) => a.distance - b.distance)

  const best = ranked[0]
  if (best.distance > 0.5) throw new Error('Yuz tanilmadi')

  const marked = mockMarked.has(best.face.staffId)
  mockMarked.add(best.face.staffId)

  return delay({
    staffId: best.face.staffId,
    fullName: best.face.fullName,
    status: 'present' as const,
    arrivedAt: new Date().toTimeString().slice(0, 5),
    alreadyMarked: marked,
    distance: Math.round(best.distance * 1000) / 1000,
  })
}

/* Demo: sahifa ochiq turganda yashaydigan izlar */
interface MockFace {
  staffId: string
  fullName: string
  position: string
  createdAt: string
  descriptors: number[][]
}

let mockFaces: MockFace[] = []
const mockMarked = new Set<string>()
