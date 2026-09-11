import { Send } from 'lucide-react'

import { telegramLinkUrl, telegramStatus, unlinkTelegram } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { useAction, useAsync } from '@/lib/useAsync'
import { useI18n } from '@/i18n'
import { useToast } from '@/store/toast-context'

/**
 * TELEGRAM ULANISHI.
 *
 * NEGA BU BO'LIM KERAK: xabar yuborish uchun xodimning Telegram
 * id'si kerak, u esa faqat ilova mini app ichida ochilganda
 * jimgina yozilardi. Brauzerdan ishlaydigan shifokor hech qachon
 * ulanmasdi va buni bilmasdi ham — xabar shunchaki kelmasdi,
 * hech qayerda hech qanday belgi yo'q edi.
 *
 * Ustiga-ustak Telegram boti odamga BIRINCHI bo'lib yoza olmaydi:
 * suhbatni odam ochishi shart, aks holda har bir xabar 403 bo'ladi.
 * "Ulash" tugmasi ikkalasini bir yo'la hal qiladi — havola botni
 * ochadi (suhbat boshlanadi) va ichidagi bir martalik kod hisobni
 * bog'laydi.
 */
export function TelegramSection() {
  const { t } = useI18n()
  const toast = useToast()
  const status = useAsync(telegramStatus, [])

  const connect = useAction(async () => {
    const { url } = await telegramLinkUrl()
    if (!url) {
      toast.error(t('telegram.unavailable'))
      return
    }
    /*
      Yangi oynada ochamiz: mini app ichida `_self` ilovaning
      o'zini bot suhbatiga almashtirib yuborardi.
    */
    window.open(url, '_blank', 'noopener')
  })

  const disconnect = useAction(async () => {
    await unlinkTelegram()
    toast.success(t('telegram.unlinked'))
    void status.reload()
  })

  /* Serverda bot tokeni yo'q bo'lsa bo'limni ko'rsatishning ma'nosi yo'q */
  if (!status.data?.available) return null

  const linked = status.data.linked

  return (
    <div className="hairline-t space-y-3 pt-6">
      <p className="text-footnote font-medium text-label-secondary">
        {t('telegram.title')}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            linked
              ? 'rounded-[8px] bg-ok-soft px-2.5 py-1 text-caption font-medium text-ok'
              : 'rounded-[8px] bg-warn-soft px-2.5 py-1 text-caption font-medium text-warn'
          }
        >
          {linked ? t('telegram.linked') : t('telegram.notLinked')}
        </span>

        {linked ? (
          <Button variant="gray" loading={disconnect.pending} onClick={disconnect.run}>
            {t('telegram.unlink')}
          </Button>
        ) : (
          <Button loading={connect.pending} onClick={connect.run}>
            <Send size={16} />
            {t('telegram.connect')}
          </Button>
        )}
      </div>

      <p className="text-caption text-label-tertiary">
        {linked ? t('telegram.linkedHint') : t('telegram.connectHint')}
      </p>

      {!linked ? (
        <Button variant="plain" onClick={() => void status.reload()}>
          {t('telegram.recheck')}
        </Button>
      ) : null}
    </div>
  )
}
