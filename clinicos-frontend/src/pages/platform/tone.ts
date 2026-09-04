import type { InvoiceStatus, TenantStatus } from '@/types/models'
import type { Tone } from '@/lib/status'

/**
 * Platforma paneli ranglari.
 *
 * Alohida faylda, chunki bir nechta sahifada ishlatiladi. Komponent
 * faylidan eksport qilinsa, Fast Refresh buziladi — loyihada
 * kontekstlar ham shu sababdan ajratilgan.
 */

export const TENANT_TONE: Record<TenantStatus, Tone> = {
  active: 'ok',
  trial: 'accent',
  past_due: 'warn',
  suspended: 'bad',
  cancelled: 'neutral',
}

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  paid: 'ok',
  pending: 'warn',
  overdue: 'bad',
}
