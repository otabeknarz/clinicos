import { useState } from 'react'
import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useIsPhone } from '@/lib/useMediaQuery'
import { useI18n } from '@/i18n'

/**
 * Filtrlar to'plami.
 *
 * KOMPYUTERDA — hammasi bir qatorda, ko'z oldida.
 *
 * TELEFONDA — bitta "Filtr" tugmasiga yig'iladi va varaqda ochiladi.
 *
 * NEGA: oltita tanlov ustma-ust turganda telefon ekranida birorta
 * natija ko'rinmasdi — odam filtrlarni aylanib o'tib, keyin ro'yxatga
 * yetardi. Holbuki ko'p hollarda filtr umuman kerak emas, ro'yxatning
 * o'zi kerak.
 *
 * Tugmada nechta filtr yoqilgani turadi: yig'ilgan holatda ham nima
 * qo'llanganini bilib turish kerak, aks holda "nega ro'yxat bo'sh"
 * degan savol tug'iladi.
 */
export function FilterBar({
  activeCount,
  onReset,
  children,
}: {
  /** Nechta filtr yoqilgan — tugmada raqam bo'lib chiqadi */
  activeCount: number
  /** Varaqdagi "Tozalash" tugmasi uchun */
  onReset?: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)

  if (!isPhone) {
    return <div className="flex flex-wrap items-center gap-3">{children}</div>
  }

  return (
    <>
      <Button
        variant="gray"
        className="w-full"
        icon={<SlidersHorizontal size={16} />}
        onClick={() => setOpen(true)}
      >
        {t('action.filter')}
        {activeCount > 0 ? (
          <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-caption-2 font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={t('action.filter')}
        footer={
          <>
            {onReset ? (
              <Button
                variant="gray"
                onClick={() => {
                  onReset()
                  setOpen(false)
                }}
              >
                {t('action.reset')}
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)}>{t('action.apply')}</Button>
          </>
        }
      >
        <div className="space-y-3 pb-2 [&_select]:max-w-none [&_input]:max-w-none">{children}</div>
      </Modal>
    </>
  )
}
