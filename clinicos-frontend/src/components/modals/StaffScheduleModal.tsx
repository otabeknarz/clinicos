import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { WorkScheduleCalendar } from '@/components/staff/WorkScheduleCalendar'
import { useI18n } from '@/i18n'

/**
 * Xodimning ish jadvali — ro'yxatdan ochiladi.
 *
 * Egasi xodim qatorini bosib, uning ish kunlarini va o'sha kunlardagi
 * davomatini bir ekranda ko'radi. Bu yerdan hech narsa o'zgartirilmaydi:
 * ish kunlarini o'zgartirish — xodim kartasini tahrirlash ishi.
 */
export function StaffScheduleModal({
  open,
  staffId,
  staffName,
  onClose,
}: {
  open: boolean
  staffId: string | null
  staffName: string
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open && staffId !== null}
      onClose={onClose}
      title={t('schedule.openTitle', { name: staffName })}
      footer={
        <Button variant="gray" onClick={onClose}>
          {t('action.close')}
        </Button>
      }
    >
      {staffId ? <WorkScheduleCalendar staffId={staffId} className="pb-2" /> : null}
    </Modal>
  )
}
