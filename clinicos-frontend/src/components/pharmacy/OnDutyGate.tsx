import type { ReactNode } from 'react'
import { UserRoundX } from 'lucide-react'

import { onDutyNow } from '@/api/pharmacy'
import { Card } from '@/components/ui/Card'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * SMENADA BO'LMAGAN ODAM ISHLAY OLMAYDI.
 *
 * Kassa va retsept berish — bitta odamning ishi. Ikki sotuvchi bir
 * vaqtda kassaga kirsa, bir kunning savdosi ikkiga bo'linib
 * ketardi va kassa nazorati kimni tekshirayotganini bilmay
 * qolardi: kamomad chiqqanda ikkalasi ham "men emas" deydi.
 *
 * TO'SIQ YUMSHOQ: kassa hech kimda bo'lmasa (topshirish yozilmagan
 * va jadvalda ham hech kim yo'q), ishlashga ruxsat beriladi. Aks
 * holda jadvalda bitta xatolik bo'lgan kuni butun apteka to'xtab
 * qolardi — bu tizimni o'chirib qo'yishga olib keladigan turdagi
 * qattiqlik.
 *
 * SABABI AYTILADI. "Sizda ruxsat yo'q" degan quruq yozuv odamni
 * rahbarga qo'ng'iroq qilishga majbur qiladi; "hozir Ozoda
 * Qodirova smenada" esa nima qilish kerakligini o'zi tushuntiradi.
 */
export function OnDutyGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { data, loading } = useAsync(onDutyNow, [])

  if (loading) return <CardSkeleton />

  /* Kassa bo'sh yoki o'zimizda — ishlayveramiz */
  if (!data || !data.holder || data.isMe) return <>{children}</>

  return (
    <Card>
      <EmptyState
        icon={<UserRoundX size={22} />}
        title={t('pharmacy.notOnDuty')}
        description={
          data.reason === 'handover'
            ? t('pharmacy.notOnDutyHandover', { name: data.holder.fullName })
            : t('pharmacy.notOnDutySchedule', {
                name: data.holder.fullName,
                from: data.holder.shiftStart,
                to: data.holder.shiftEnd,
              })
        }
      />
    </Card>
  )
}
