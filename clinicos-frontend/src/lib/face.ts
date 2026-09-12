import type * as FaceApi from '@vladmandic/face-api'

/**
 * YUZNI O'QISH — BRAUZERDA.
 *
 * Hech qanday tashqi xizmat yo'q: model fayllari o'zimizning
 * serverda (`public/models`), hisob-kitob esa qurilmaning o'zida
 * bajariladi. Kameradan olingan tasvir hech qayerga yuborilmaydi —
 * serverga faqat 128 ta sondan iborat "iz" ketadi.
 *
 * Kutubxona KERAK BO'LGANDA yuklanadi (`import()`): u ~2 MB va
 * model fayllari ~7 MB. Ular faqat yuz sahifalari ochilganda
 * keladi, qolgan sahifalar buni umuman bilmaydi.
 */

let loader: Promise<typeof FaceApi> | null = null

export function loadFace(): Promise<typeof FaceApi> {
  if (!loader) {
    loader = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      const models = '/models'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(models),
        faceapi.nets.faceLandmark68Net.loadFromUri(models),
        faceapi.nets.faceRecognitionNet.loadFromUri(models),
      ])
      return faceapi
    })()
  }
  return loader
}

export interface FaceReading {
  /** 128 ta son — yuzning raqamli izi */
  descriptor: number[]
  /**
   * Ko'z ochiqligi.
   *
   * Ko'z qisilganda bu qiymat keskin tushadi. Jonlilik tekshiruvi
   * shunga tayanadi: bosma surat ko'z qismaydi.
   */
  eyeOpenness: number
  /** Yuz kadrning qancha qismini egallagan — juda uzoq bo'lsa aniqlik tushadi */
  size: number
}

export async function readFace(video: HTMLVideoElement): Promise<FaceReading | null> {
  const faceapi = await loadFace()

  const result = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!result) return null

  const box = result.detection.box
  const frame = video.videoWidth * video.videoHeight || 1

  return {
    descriptor: Array.from(result.descriptor),
    eyeOpenness: eyeOpenness(result.landmarks),
    size: (box.width * box.height) / frame,
  }
}

/**
 * Ko'z qanchalik ochiq (Eye Aspect Ratio).
 *
 * Ko'zning balandligining eniga nisbati: ochiq ko'zda ~0.3, qisilganda
 * ~0.1 gacha tushadi. Ikkala ko'zning o'rtachasi olinadi.
 */
function eyeOpenness(landmarks: FaceApi.FaceLandmarks68): number {
  const ratio = (eye: { x: number; y: number }[]): number => {
    if (eye.length < 6) return 0.3
    const height = (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / 2
    const width = distance(eye[0], eye[3]) || 1
    return height / width
  }
  return (ratio(landmarks.getLeftEye()) + ratio(landmarks.getRightEye())) / 2
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Ikki iz orasidagi masofa — serverdagi qoida bilan bir xil */
export function faceDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - (b[i] ?? 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Kadrni suratga oladi (JPEG, `data:` ko'rinishida).
 *
 * Davomat yozuvining DALILI shu bo'ladi: yuz izi orqaga
 * qaytarilmaydi, ya'ni unga qarab kim kelganini ko'rib bo'lmaydi.
 * Egasi esa yozuvni tekshirmoqchi bo'lsa, odamni ko'rishi kerak.
 *
 * Eni 480 px ga tushiriladi — bu yuzni tanish uchun yetarli va
 * bitta yozuv uchun ~40 KB bo'ladi.
 */
export function snapshot(video: HTMLVideoElement, width = 480): string | null {
  const ratio = video.videoHeight / (video.videoWidth || 1)
  if (!ratio || !Number.isFinite(ratio)) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(width * ratio)

  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.75)
}

/* ------------------------------------------------------------------ */
/* Kamera                                                              */
/* ------------------------------------------------------------------ */

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  return stream
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}
