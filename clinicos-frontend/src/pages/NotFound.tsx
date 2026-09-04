import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { useI18n } from '@/i18n'

export function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <EmptyState
      icon={<Compass size={24} strokeWidth={1.75} />}
      title={t('state.notFound.title')}
      description={t('state.notFound.desc')}
      action={
        <Button variant="tinted" onClick={() => navigate('/')}>
          {t('nav.dashboard')}
        </Button>
      }
    />
  )
}
