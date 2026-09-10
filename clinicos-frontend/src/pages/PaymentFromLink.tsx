import { useNavigate, useParams } from 'react-router-dom'

import { getAppointment } from '@/api/appointments'
import { PaymentFormModal } from '@/components/modals/PaymentFormModal'
import { Card } from '@/components/ui/Card'
import { CardSkeleton, EmptyState } from '@/components/ui/States'
import { useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * TELEGRAM XABARIDAGI "TO'LOV OLISH" TUGMASI SHU YERGA OLIB KELADI.
 *
 * Shifokor tashrifni yozgani zahoti registratorning telefoniga
 * "to'lov kutilmoqda" xabari tushadi. Tugmani bosgani zahoti
 * to'lov formasi to'ldirilgan holda ochiladi — bemorni ro'yxatdan
 * qaytadan qidirish shart emas.
 *
 * Qabul BAZADAN qayta o'qiladi: xabar kelgandan keyin pul boshqa
 * yo'l bilan olingan bo'lishi mumkin.
 */
export function PaymentFromLinkPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id = '' } = useParams()

  const { data, loading, error } = useAsync(() => getAppointment(id), [id])

  /* Forma yopilgach registrator o'z sahifasida qoladi */
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
    <PaymentFormModal
      open
      onClose={home}
      onSaved={home}
      preset={{
        patientId: data.patient.id,
        patientName: data.patient.fullName,
        doctorId: data.doctor.id,
        serviceId: data.service.id,
        appointmentId: data.id,
      }}
    />
  )
}
