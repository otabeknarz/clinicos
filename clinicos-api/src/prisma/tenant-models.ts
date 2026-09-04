/**
 * Klinikaga tegishli jadvallar ro'yxati.
 *
 * Shu ro'yxatdagi har bir jadvalga har qanday so'rov avtomatik
 * `clinicId` bilan cheklanadi — `tenant.extension.ts` ga qarang.
 *
 * RO'YXATNI QO'LDA TAHRIRLAMANG. Sxemaga yangi jadval qo'shsangiz:
 *
 *     npm run gen:tenant-models
 *
 * Nega generatsiya qilinadi: bu ro'yxatga jadval qo'shish unutilsa,
 * o'sha jadval filtrsiz qoladi va bir klinika boshqasining
 * ma'lumotini ko'radi. Buni odamning e'tiboriga qoldirib bo'lmaydi.
 */
export const TENANT_MODELS = new Set<string>([
  'Admission',
  'Appointment',
  'Attendance',
  'AuditLog',
  'Bed',
  'Bonus',
  'BonusRule',
  'ChatGroup',
  'ChatMessage',
  'Doctor',
  'Feedback',
  'FollowUp',
  'ImpersonationLog',
  'Notification',
  'Patient',
  'Payment',
  'Penalty',
  'PenaltyRule',
  'PenaltyWaiver',
  'Room',
  'Service',
  'ServiceLoyaltyTier',
  'ShiftClosure',
  'Staff',
  'Subscription',
  'User',
  'Visit',
  'WorkingHour',
])

/**
 * `clinicId` ustuni YO'Q jadvallar.
 *
 * Ular ikki xil:
 *
 *   Umumiy      — `Clinic`, `Plan`, `PlatformMember`, `Session`.
 *                 Bularning klinikaga aloqasi yo'q yoki ular
 *                 klinikaning o'zi.
 *
 *   Bola jadval — `ChatGroupMember`, `ChatMessageRead`,
 *                 `TenantInvoice`. Ular ota jadval orqali
 *                 cheklanadi (guruh, xabar, obuna).
 *
 * DIQQAT: bola jadvallarga to'g'ridan-to'g'ri so'rov yozmang.
 * Har doim ota jadval orqali boring, aks holda cheklov yo'qoladi:
 *
 *     // NOTO'G'RI — barcha klinikaning a'zoliklari
 *     db.chatGroupMember.findMany({ where: { userId } })
 *
 *     // TO'G'RI — guruh allaqachon klinika bo'yicha cheklangan
 *     db.chatGroup.findMany({ where: { members: { some: { userId } } } })
 */
export const GLOBAL_MODELS = new Set<string>([
  'ChatGroupMember',
  'ChatMessageRead',
  'Clinic',
  'Plan',
  'PlatformMember',
  'Session',
  'TenantInvoice',
])
