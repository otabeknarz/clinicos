import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { IconButton } from './Button'
import { NoResultsState, TableSkeleton } from './States'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n'

/**
 * Jadval.
 *
 * Desktopda — haqiqiy `<table>`. Telefonda jadval o'qib bo'lmaydi,
 * shuning uchun sahifa `renderMobile` bergan bo'lsa, o'sha kartochkalar
 * ko'rsatiladi (aks holda gorizontal skroll).
 */

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  /** Tailwind kengligi, masalan 'w-40' */
  width?: string
  /** Shu nuqtadan pastda ustun yashiriladi */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  render: (row: T) => ReactNode
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  onRowClick,
  renderMobile,
  emptyState,
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  loading?: boolean
  onRowClick?: (row: T) => void
  renderMobile?: (row: T) => ReactNode
  emptyState?: ReactNode
  className?: string
}) {
  if (loading) return <TableSkeleton rows={7} columns={Math.min(columns.length, 6)} />

  if (rows.length === 0) return <>{emptyState ?? <NoResultsState />}</>

  return (
    <div className={className}>
      {/* --- Telefon ko'rinishi --- */}
      {renderMobile ? (
        <ul className="md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="hairline last:border-b-0">
              {/*
                Qator bosiladigan bo'lsagina tugma bo'ladi.

                NEGA: kartochka ichida o'z tugmasi bo'lishi mumkin
                (masalan hisobdagi "To'landi"). Tugma ichida tugma —
                yaroqsiz HTML: brauzer ichkarisini bosishga yo'l
                qo'ymasligi ham mumkin.
              */}
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="row-press block w-full px-5 py-3.5 text-left"
                >
                  {renderMobile(row)}
                </button>
              ) : (
                <div className="px-5 py-3.5">{renderMobile(row)}</div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* --- Jadval --- */}
      <div className={cn('scroll-slim overflow-x-auto', renderMobile && 'hidden md:block')}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="hairline">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 pb-2.5 pt-1 text-caption font-medium text-label-tertiary',
                    'whitespace-nowrap uppercase tracking-wide',
                    ALIGN[column.align ?? 'left'],
                    column.width,
                    column.hideBelow && HIDE[column.hideBelow],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'hairline last:border-b-0',
                  onRowClick && 'row-press cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 text-subhead text-label align-middle',
                      ALIGN[column.align ?? 'left'],
                      column.hideBelow && HIDE[column.hideBelow],
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sahifalash                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ko'rsatiladigan sahifa raqamlari: birinchi, oxirgi va joriyning
 * qo'shnilari, oradagi bo'shliq "…" bilan. Yetti sahifagacha — hammasi.
 */
function pageList(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)

  const shown = [...new Set([1, pages, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b)

  const out: (number | 'gap')[] = []
  shown.forEach((p, i) => {
    if (i > 0 && p - shown[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
  className?: string
}) {
  const { t } = useI18n()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className={cn('flex items-center justify-between gap-4 px-5 py-3', className)}>
      <p className="text-footnote text-label-secondary tnum">
        {from}–{to} {t('common.of')} {total}
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          label={t('action.prev')}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </IconButton>
        {/* Raqamli sahifalar — kerakli sahifaga bir bosishda o'tiladi */}
        <span className="flex items-center gap-1.5 px-1">
            {pageList(page, pages).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="px-0.5 text-footnote text-label-tertiary">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'h-8 min-w-8 rounded-[9px] px-2 text-footnote font-semibold tnum',
                    'transition-[background-color,color,box-shadow] duration-150',
                    item === page
                      ? 'bg-accent text-white shadow-[0_6px_14px_-6px_var(--color-accent)]'
                      : 'bg-raised text-label-secondary shadow-[var(--elev-sm)] hover:text-label',
                  )}
                >
                  {item}
                </button>
              ),
            )}
        </span>
        <IconButton
          label={t('action.next')}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </IconButton>
      </div>
    </div>
  )
}
