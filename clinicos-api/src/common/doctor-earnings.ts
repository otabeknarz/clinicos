/**
 * SHIFOKORNING FOIZ BO'YICHA ULUSHI.
 *
 * Har bir to'lov o'z xizmatining foizi bilan hisoblanadi: xizmat uchun
 * alohida foiz qo'yilgan bo'lsa o'shanisi (`DoctorServiceRate`), aks holda
 * xodimning umumiy foizi (`Staff.percentRate`). Statsionar to'lovida
 * xizmat yo'q — u umumiy foiz bilan.
 *
 * NEGA ALOHIDA FAYL: ikki joy hisoblaydi — xodimlar ro'yxatidagi ko'rsatkich
 * (`staff.service`) va shifokor daromadi (`doctors.service`). Ikki formula
 * bir xil oyga ikki xil summa ko'rsatardi.
 */
export function percentEarnings(
  rows: { serviceId: string | null; amount: number }[],
  defaultRate: number,
  rates: ReadonlyMap<string, number>,
): number {
  let total = 0
  for (const row of rows) {
    const rate = row.serviceId !== null ? (rates.get(row.serviceId) ?? defaultRate) : defaultRate
    total += (row.amount * rate) / 100
  }
  return Math.round(total)
}
