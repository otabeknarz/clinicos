import { Activity } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { usePatient } from '@/store/patient-context'
import { useI18n } from '@/i18n'

/**
 * KABINETGA KIRA OLMAGAN BEMOR NIMA KO'RADI.
 *
 * Uch holat bor va uchalasi ham bemorga tushunarli bo'lishi kerak:
 *
 *   klinika tanlanmagan  — bir odam ikki klinikada bemor bo'lishi mumkin
 *   raqam ulanmagan      — botga qaytib "raqamni ulashish" bosishi kerak
 *   Telegramdan tashqari — kabinet brauzerda ochilmaydi
 *
 * Ilgari bu holatlarda bemor XODIM kirish sahifasiga tushib
 * qolardi: undan email va parol so'ralardi, uning esa ikkalasi
 * ham yo'q va hech qachon bo'lmaydi ham.
 */
export function CabinetGatePage() {
  const { t } = useI18n()
  const { clinics, error, chooseClinic } = usePatient()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand text-white shadow-md">
          <Activity size={26} strokeWidth={2.4} />
        </span>

        <h1 className="mt-4 text-title-2 text-label">{t('cabinet.title')}</h1>

        {clinics && clinics.length > 0 ? (
          <>
            <p className="mt-2 text-subhead text-label-secondary">
              {t('cabinet.chooseClinic')}
            </p>
            <div className="mt-6 space-y-2">
              {clinics.map((clinic) => (
                <Button
                  key={clinic.id}
                  className="w-full"
                  onClick={() => void chooseClinic(clinic.id)}
                >
                  {clinic.name}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-[12px] bg-raised px-4 py-3 text-subhead text-label-secondary">
            {error ?? t('cabinet.notLinked')}
          </p>
        )}
      </div>
    </div>
  )
}
