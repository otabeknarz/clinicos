import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useI18n } from '@/i18n'
import { useAuth } from '@/store/auth-context'

/**
 * KLINIKA PANELIGA KIRILGANDA TEPADA TURADIGAN TASMA.
 *
 * NEGA DOIM KO'RINIB TURADI: platforma egasi klinika panelini o'z
 * paneli deb adashtirmasligi kerak. U yerda ko'rgan har bir raqam
 * boshqa tashkilotning ma'lumoti, va u yerda qilingan har bir amal
 * o'sha klinikaning ishiga ta'sir qiladi.
 *
 * Rangi ataylab keskin: bu vaqtinchalik va odatiy bo'lmagan holat.
 */
export function ImpersonationBar() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { impersonating, exitClinic } = useAuth()

  if (!impersonating) return null

  return (
    <div className="flex flex-wrap items-center gap-3 bg-warn px-4 py-2.5 text-white sm:px-6">
      <ShieldAlert size={17} className="shrink-0" />

      <span className="min-w-0 flex-1 text-footnote">
        <span className="font-semibold">{impersonating.tenantName}</span>
        <span className="opacity-90"> — {t('platform.impersonateBar')}</span>
      </span>

      <Button
        size="sm"
        variant="gray"
        icon={<LogOut size={14} />}
        onClick={() => {
          /*
            Chiqish serverga so'rov yuboradi (kirish yozuvini
            yopadi), shuning uchun tugatilishini kutamiz —
            aks holda platforma paneli hali eski token bilan
            ochilib qolardi.
          */
          void exitClinic().finally(() => navigate('/platform/clinics'))
        }}
      >
        {t('platform.exitClinic')}
      </Button>
    </div>
  )
}
