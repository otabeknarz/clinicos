import type { ReactNode } from 'react'

import { Fab } from './Fab'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * Sahifa sarlavhasi — barcha ichki sahifalarda bir xil.
 *
 * Apple uslubi: katta qalin sarlavha, ostida kulrang izoh,
 * o'ng tomonda harakatlar.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  primaryAction,
  back,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /*
    Sahifaning ASOSIY amali — bittasi.

    Kompyuterda odatdagidek yuqori o'ngda turadi, telefonda esa
    pastda suzuvchi tugmaga aylanadi: uzun ekranda yuqori burchak
    bosh barmoq yetmaydigan joy.
  */
  primaryAction?: {
    icon: ReactNode
    label: string
    /** Telefondagi suzuvchi tugma uchun qisqa yozuv */
    shortLabel?: string
    onClick: () => void
  }
  back?: ReactNode
  className?: string
}) {
  return (
    <header
      // `page-head` — platforma panelidagi animatsiya ilgagi
      className={cn(
        'page-head',
        /*
          Telefonda ustunga tushadi: sarlavha butun kenglikni oladi,
          amallar ostiga o'tadi.

          NEGA: yonma-yon turganda "Registratura, Kamola" kabi uzun
          sarlavha ikkiga bo'linib, tugma esa siqilib qolardi.
        */
        'mb-5 flex flex-col items-stretch gap-3',
        'sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {back ? <div className="mb-1.5 sm:mb-2">{back}</div> : null}
        <h1 className="text-title-2 text-label sm:text-title-1">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-footnote text-label-secondary sm:mt-1 sm:text-subhead">
            {subtitle}
          </p>
        ) : null}
      </div>
      {/*
        `primaryAction` telefonda suzuvchi tugmaga aylanadi, shuning
        uchun u yolg'iz bo'lsa bu yerda qator ochilmaydi.
      */}
      {actions ? (
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {actions}
        </div>
      ) : null}

      {primaryAction ? (
        /*
          Telefonda buning o'rniga pastdagi suzuvchi tugma chiqadi.

          `hidden` tugmaning o'ziga emas, o'ramga beriladi: `cn()`
          Tailwind classlarini birlashtirmaydi, shuning uchun
          tugmaning o'z `inline-flex`i uni bosib ketardi.
        */
        <span className="hidden shrink-0 md:inline-flex">
          <Button icon={primaryAction.icon} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        </span>
      ) : null}

      {primaryAction ? (
        <Fab
          icon={primaryAction.icon}
          label={primaryAction.shortLabel ?? primaryAction.label}
          onClick={primaryAction.onClick}
        />
      ) : null}
    </header>
  )
}
