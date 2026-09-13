import { Clock } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * SINOV MUDDATI TASMASI.
 *
 * "14 kun bepul" degan va'da mijozga KO'RINIB turmasa, muddat
 * sezdirmay tugaydi va u bir kuni umuman kira olmay qoladi —
 * eng yomon birinchi taassurot. Qolgan kun soni tepada turadi.
 *
 * OXIRIGA YAQIN RANGI O'ZGARADI: uch kun qolganda sariq, bir kun
 * qolganda qizil. Doim bir xil kulrang tasma bir kunda ko'rinmay
 * qoladi — ko'z unga o'rganib qoladi.
 */
export function TrialBar() {
  const { t } = useI18n()
  const { session } = useAuth()

  const trial = session?.trial
  if (!trial) return null

  const urgent = trial.daysLeft <= 1
  const soon = trial.daysLeft <= 3

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-4 py-2 text-footnote sm:px-6',
        urgent
          ? 'bg-bad-soft text-bad'
          : soon
            ? 'bg-warn-soft text-warn'
            : 'bg-accent-soft text-accent',
      )}
    >
      <Clock size={14} className="shrink-0" />
      <span className="font-medium">
        {trial.daysLeft > 0
          ? t('trial.daysLeft', { count: trial.daysLeft })
          : t('trial.lastDay')}
      </span>
      <span className="text-label-secondary">{t('trial.hint')}</span>
    </div>
  )
}
