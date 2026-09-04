import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * XATOLIKNI USHLAB QOLUVCHI QATLAM.
 *
 * NEGA KERAK: React'da bitta komponent chizilayotganda xato bersa,
 * REACT BUTUN DARAXTNI o'chirib tashlaydi — foydalanuvchi oq ekran
 * ko'radi va nima bo'lganini bilmaydi. Klinikada, bemor oldida
 * turganda bu qabul qilib bo'lmaydigan holat.
 *
 * Bu qatlam xatoni ushlab, o'rniga tushunarli xabar va "qayta
 * urinish" tugmasini chizadi. Ilovaning qolgan qismi tirik qoladi.
 *
 * IKKI JOYDA ISHLATILADI:
 *
 *   1. Sahifa ichida — yon menyu va yuqori panel joyida qoladi,
 *      odam boshqa bo'limga o'tib ketaveradi. U yerda `key` ga
 *      marshrut beriladi: yo'l o'zgarsa React qatlamni qaytadan
 *      yaratadi va xato o'z-o'zidan tozalanadi.
 *   2. Butun ilova ustida — oxirgi chora, agar tashqi qatlamning
 *      o'zi qulasa.
 *
 * DASTURCHIGA: `onError` ga xatoni kuzatuv xizmatiga (Sentry va
 * shunga o'xshash) yuborishni ulash mumkin. Hozir u faqat brauzer
 * konsoliga yozadi — ishlab chiqishda ko'rinsin uchun.
 */
export class ErrorBoundary extends Component<
  {
    children: ReactNode
    /** Xato o'rniga chiziladigan narsa */
    fallback: (retry: () => void, error: Error) => ReactNode
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // DASTURCHIGA: kuzatuv xizmati shu yerga ulanadi
    console.error('[ClinicOS] kutilmagan xato:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(() => this.setState({ error: null }), this.state.error)
    }
    return this.props.children
  }
}
