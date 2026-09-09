import { Moon, Sun, SunMoon } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { useTheme } from '@/store/theme-context'
import type { ThemeMode } from '@/store/theme-context'

/**
 * KO'RINISH ALMASHTIRGICHI — uchta variant yonma-yon.
 *
 * Yuqori paneldagi menyu telefonda YASHIRILGAN: u yerda joy tor va
 * qidiruv bilan bildirishnoma muhimroq. Natijada rejimni almashtirish
 * uchun Sozlamalar > Ko'rinish ga borish kerak edi — kuniga bir marta
 * bosiladigan narsa uchun uzoq yo'l.
 *
 * MENYU EMAS, SEGMENT: uch variant ham ko'rinib turadi, ya'ni tanlash
 * bir bosishda tugaydi va hozir qaysi rejim yoqilgani ham o'sha
 * qarashda ma'lum bo'ladi.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { t } = useI18n()
  const { mode, setMode } = useTheme()

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('settings.theme.light'), icon: Sun },
    { value: 'dark', label: t('settings.theme.dark'), icon: Moon },
    { value: 'system', label: t('settings.theme.system'), icon: SunMoon },
  ]

  return (
    <section className={cn('card squircle rounded-[20px] p-4 sm:p-5', className)}>
      <h2 className="mb-3 text-subhead font-semibold text-label">
        {t('settings.appearance')}
      </h2>

      <div
        role="radiogroup"
        aria-label={t('settings.appearance')}
        className="flex gap-1 rounded-full bg-fill-4 p-1"
      >
        {options.map((option) => {
          const active = mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(option.value)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2',
                'text-footnote font-medium transition-colors duration-200 ease-apple',
                active
                  ? /*
                      Faol variant TO'Q KO'K — pastki paneldagi faol
                      band bilan bir xil. Ikki xil "faol" ko'rinishi
                      bo'lsa, ilova ikki xil tizimdan yig'ilgandek
                      tuyulardi.
                    */
                    'bg-navy text-white'
                  : 'text-label-secondary hover:text-label',
              )}
            >
              <option.icon size={15} className="shrink-0" />
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
