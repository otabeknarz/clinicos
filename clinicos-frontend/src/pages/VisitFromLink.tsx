import { lazy, Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { getAppointment } from '@/api/appointments'
import { Card } from '@/components/ui/Card'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

const VisitFormModal = lazy(() =>
  import('@/components/modals/VisitFormModal').then((m) => ({ default: m.VisitFormModal })),
)

/**
 * TELEGRAM XABARIDAGI TUGMA SHU YERGA OLIB KELADI.
 *
 * Shifokorning telefoniga "yangi qabul" xabari tushadi va tugmani
 * bosgani zahoti tashrif formasi ochiladi. Aks holda u ilovani
 * ochib, bugungi ro'yxatdan o'sha bemorni qidirib topishi kerak
 * bo'lardi — xabarning butun foydasi shunda yo'qolardi.
 *
 * Qabul BAZADAN qayta o'qiladi: xabar bir hafta oldin kelgan
 * bo'lishi mumkin va u orada bekor qilingan yoki ko'chirilgan
 * bo'lishi ham mumkin.
 */
export function VisitFromLinkPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id = '' } = useParams()

  const { data, loading, error } = useAsync(() => getAppointment(id), [id])

  /* Forma yopilgach shifokor o'z sahifasida qoladi */
  const home = () => navigate('/', { replace: true })

  if (loading) return <CardSkeleton />

  if (error || !data) {
    return (
      <Card>
        <EmptyState title={t('visit.linkGone')} description={t('visit.linkGoneHint')} />
      </Card>
    )
  }

  return (
    <Suspense fallback={null}>
      <VisitFormModal open appointment={data} onClose={home} onSaved={home} />
    </Suspense>
  )
}
