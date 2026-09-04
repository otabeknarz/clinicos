import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Lock, RotateCw, SearchX } from 'lucide-react'

import { Button } from './Button'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'

/**
 * Yuklanish / bo'sh / xato holatlari.
 *
 * Har bir sahifa uchtasini ham ishlatishi shart — spec talabi.
 */

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse-soft rounded-[8px] bg-fill-3', className)}
      aria-hidden
    />
  )
}

/** Jadval o'rniga ko'rsatiladigan skelet */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-px" aria-busy>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          {Array.from({ length: columns - 1 }).map((__, c) => (
            <Skeleton
              key={c}
              className="h-3.5 flex-1"
              // Har xil kenglik — jonli ko'rinadi
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Karta o'rniga skelet */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('card squircle p-5 sm:p-6', className)} aria-busy>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bo'sh / xato                                                        */
/* ------------------------------------------------------------------ */

function Shell({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fill-4 text-label-tertiary">
        {icon}
      </div>
      <h3 className="mt-4 text-headline text-label">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-subhead text-label-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  return (
    <Shell
      icon={icon ?? <Inbox size={24} strokeWidth={1.75} />}
      title={title ?? t('state.empty.title')}
      description={description ?? t('state.empty.desc')}
      action={action}
      className={className}
    />
  )
}

export function NoResultsState({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <Shell
      icon={<SearchX size={24} strokeWidth={1.75} />}
      title={t('state.noResults.title')}
      description={t('state.noResults.desc')}
      className={className}
    />
  )
}

export function ErrorState({
  onRetry,
  message,
  className,
}: {
  onRetry?: () => void
  message?: string
  className?: string
}) {
  const { t } = useI18n()
  return (
    <Shell
      icon={<AlertTriangle size={24} strokeWidth={1.75} />}
      title={t('state.error.title')}
      description={message ?? t('state.error.desc')}
      action={
        onRetry ? (
          <Button variant="tinted" icon={<RotateCw size={15} />} onClick={onRetry}>
            {t('action.retry')}
          </Button>
        ) : undefined
      }
      className={className}
    />
  )
}

export function ForbiddenState({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <Shell
      icon={<Lock size={24} strokeWidth={1.75} />}
      title={t('state.forbidden.title')}
      description={t('state.forbidden.desc')}
      className={className}
    />
  )
}
