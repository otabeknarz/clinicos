import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * BOSH SAHIFANING BIRINCHI KARTASI — to'q ko'k.
 *
 * Telefonda ekranga bir vaqtda ikki-uch karta sig'adi, ya'ni odam
 * nimaga qarashni birinchi sekundda hal qiladi. To'q sirt shu qarorni
 * o'zi qilib beradi: qolgan hamma narsa oq, bittasi qora — ko'z
 * o'shanga tushadi.
 *
 * SHUNING UCHUN SAHIFADA BITTA BO'LADI. Ikkitasi qo'yilsa ikkalasi
 * ham "eng muhim" bo'lib qoladi, ya'ni ikkalasi ham muhim emas.
 */
export function Hero({
  eyebrow,
  value,
  unit,
  meta,
  aside,
  to,
  className,
}: {
  /** Kartaning ustidagi kichik yozuv — "Bugungi tushum" */
  eyebrow: ReactNode
  /** Katta raqam yoki sana */
  value: ReactNode
  /** Raqamdan keyingi kichik birlik — "so'm", "ta" */
  unit?: string
  /** Raqam ostidagi qatorlar */
  meta?: ReactNode
  /**
   * O'ng tomondagi bo'sh joy — doiraviy indikator, ikonka yoki
   * kichik ro'yxat. Bo'lmasa raqam butun kenglikni oladi.
   */
  aside?: ReactNode
  /** Berilsa karta bosiladigan havolaga aylanadi */
  to?: string
  className?: string
}) {
  const body = (
    <>
      {/*
        Yorug'lik dog'i. To'q sirt tekis bo'lsa "o'chirilgan" ko'rinadi;
        bitta yumshoq gradient uni tirik qiladi. Rasm emas — o'lchamga
        ta'sir qilmaydi va qorong'i rejimda ham to'g'ri chiqadi.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/[0.06] blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-footnote font-medium text-white/60">{eyebrow}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-large-title tnum text-white">{value}</span>
            {unit ? <span className="text-subhead text-white/50">{unit}</span> : null}
          </p>
          {meta ? <div className="mt-2 text-footnote text-white/70">{meta}</div> : null}
        </div>

        {aside ? <div className="shrink-0">{aside}</div> : null}

        {to ? (
          <span
            aria-hidden
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'bg-white/12 text-white transition-colors duration-200',
              'group-hover:bg-white/20',
            )}
          >
            <ArrowRight size={17} />
          </span>
        ) : null}
      </div>
    </>
  )

  const shell = cn(
    'group squircle relative isolate block overflow-hidden',
    'rounded-[22px] bg-navy p-5 sm:p-6',
    'shadow-[0_10px_30px_-12px_rgb(16_31_56_/_0.45)]',
    className,
  )

  return to ? (
    <Link to={to} className={shell}>
      {body}
    </Link>
  ) : (
    <section className={shell}>{body}</section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * BITTA KARTADA YONMA-YON TURGAN RAQAMLAR.
 *
 * Har raqamga alohida karta berilsa telefonda ular ustma-ust
 * to'rt qator bo'lib cho'ziladi va bosh sahifa faqat raqamdan
 * iborat bo'lib qoladi. Bitta kartada, yupqa ajratgich bilan
 * turganda — bu bitta "ko'rsatkichlar" bloki, to'rtta emas.
 *
 * UCHTADAN OSHIRMANG: telefonda to'rtinchi ustun 60px ga tushadi
 * va raqam ikki qatorga bo'linib ketadi.
 */
export function StatStrip({
  title,
  action,
  items,
  className,
}: {
  title?: ReactNode
  /** Sarlavha yonidagi boshqaruv — davr tanlagichi kabi */
  action?: ReactNode
  items: {
    key: string
    label: ReactNode
    value: ReactNode
    unit?: string
    /** Raqam yonidagi kichik ikonka — o'z rangi bilan */
    icon?: ReactNode
    tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'brand' | 'neutral'
  }[]
  className?: string
}) {
  return (
    <section className={cn('card squircle rounded-[20px] p-4 sm:p-5', className)}>
      {title ? (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-subhead font-semibold text-label">{title}</h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div className="flex items-stretch">
        {items.map((item, index) => (
          <div
            key={item.key}
            className={cn(
              'min-w-0 flex-1 px-3 first:pl-0 last:pr-0',
              /*
                Ajratgich chapga, birinchisidan tashqari. `border-l`
                bo'lgani uchun oxirgi ustundan keyin chiziq qolmaydi.
              */
              index > 0 && 'border-l-[0.5px] border-separator',
            )}
          >
            {/*
              IKONKA YORLIQ YONIDA, RAQAM YONIDA EMAS.

              Raqam yonida turganda uch ustunli blokda katakka ~95px
              qolib, "24.6M so'm" — ya'ni pul summasi — "24.6..."
              bo'lib kesilardi. Yorliq esa allaqachon ikkinchi
              darajali: u qisqarsa ma'no yo'qolmaydi, raqam
              qisqarsa yo'qoladi.
            */}
            <p className="flex items-center gap-1.5">
              {item.icon ? (
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    TONE_CHIP[item.tone ?? 'accent'],
                  )}
                >
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate text-caption text-label-tertiary">{item.label}</span>
            </p>
            {/*
              Telefonda raqam kichikroq: uch ustunga bo'linganda
              katakka ~70px qoladi va 20px li "232.4M" sig'masdi.
              Kompyuterda joy bor — u yerda to'liq o'lchamda.
            */}
            <p className="mt-1.5 flex items-baseline gap-0.5">
              <span className="truncate text-callout tnum font-bold text-label sm:text-title-3">
                {item.value}
              </span>
              {item.unit ? (
                <span className="shrink-0 text-caption-2 text-label-tertiary">
                  {item.unit}
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

const TONE_CHIP: Record<string, string> = {
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  brand: 'bg-brand-soft text-brand',
  neutral: 'bg-neutral-soft text-neutral',
}

/* ------------------------------------------------------------------ */

/**
 * TEZ KIRISH — doiraviy ikonkalar qatori.
 *
 * Telefonda eng ko'p ochiladigan to'rt-besh bo'lim. Pastki panelga
 * hammasi sig'maydi va "Yana" varag'i bir bosish qo'shadi; bu qator
 * o'sha bosishni olib tashlaydi.
 *
 * NEGA IKONKA + YOZUV: yolg'iz ikonka taxmin qildiradi. Yozuv
 * ostida turgani uchun qator baribir ixcham qoladi.
 */
export function QuickAccess({
  title,
  items,
  className,
}: {
  title?: ReactNode
  items: { key: string; to: string; label: string; icon: ReactNode }[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <section className={cn('card squircle rounded-[20px] p-4 sm:p-5', className)}>
      {title ? (
        <h2 className="mb-4 text-subhead font-semibold text-label">{title}</h2>
      ) : null}

      <ul className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="group flex flex-col items-center gap-2 rounded-[14px] py-1 text-center"
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  'bg-navy-soft text-navy',
                  'transition-colors duration-200',
                  'group-hover:bg-navy group-hover:text-white',
                  /* Qorong'ida `text-navy` ko'rinmaydi — oqartiramiz */
                  'dark:text-white',
                )}
              >
                {item.icon}
              </span>
              <span className="text-caption-2 font-medium leading-tight text-label-secondary">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
