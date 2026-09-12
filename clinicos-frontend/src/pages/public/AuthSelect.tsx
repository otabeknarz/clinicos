import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { Icon } from '@/pages/public/PublicIcons'

/**
 * RO'YXATDAN TANLASH — O'ZIMIZNING KO'RINISHDA.
 *
 * Brauzerning `<select>` ro'yxati operatsion tizimniki: kulrang
 * ramka, boshqa shrift, boshqa burchak radiusi. Sahifaning
 * qolgan qismi bilan yonma-yon turganda u eski oynadek
 * ko'rinadi — ro'yxatdan o'tish esa mahsulot bilan birinchi
 * uchrashuv.
 *
 * Shuning uchun tugma + ro'yxat o'zimiz chizamiz. Klaviatura
 * ishlashi shart: `<select>` da u tekin keladi, qo'lda
 * yozilganda esa unutilsa, sahifa faqat sichqoncha bilan
 * to'ldiriladigan bo'lib qoladi.
 */
export interface AuthOption {
  value: string
  label: string
}

export function AuthSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: AuthOption[]
  /** Tanlanmagan holat uchun yozuv. Berilmasa — birinchi qiymat majburiy. */
  placeholder?: string
  onChange: (value: string) => void
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [open, setOpen] = useState(false)
  /* Klaviatura bilan yurilayotgan qator — tanlangani bilan bir xil emas */
  const [cursor, setCursor] = useState(0)

  const selected = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    /*
      AYLANTIRISHDA YOPILMAYDI. Ro'yxat maydonning O'ZIGA
      bog'langan (`position:absolute`), ya'ni u bilan birga
      suriladi. Ilgari bu yerda "aylantirilsa yop" degan qoida
      bor edi va u tugmani bosishning o'zidayoq ishlab ketardi:
      brauzer maydonni ko'rinishga surib qo'yadi, ro'yxat esa
      ochilishi bilan yopilardi.
    */
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /* Ochilganda tanlangan qator ko'rinib tursin */
  useEffect(() => {
    if (!open) return
    const index = options.findIndex((option) => option.value === value)
    setCursor(index >= 0 ? index : 0)
    listRef.current?.children[Math.max(index, 0)]?.scrollIntoView({ block: 'nearest' })
  }, [open, options, value])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (!open) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (cursor + step + options.length) % options.length
      setCursor(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[cursor]
      if (option) choose(option.value)
    }
  }

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>

      <div className={cn('ui-select', open && 'is-open')} ref={rootRef}>
        <button
          id={id}
          type="button"
          className={cn('ui-select-button', !selected && 'is-empty')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onKeyDown={onKeyDown}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{selected ? selected.label : placeholder}</span>
          <Icon name="chevron" />
        </button>

        {open ? (
          <ul className="ui-select-list" id={listId} role="listbox" ref={listRef}>
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'ui-select-option',
                  index === cursor && 'is-cursor',
                  option.value === value && 'is-selected',
                )}
                onPointerEnter={() => setCursor(index)}
                onClick={() => choose(option.value)}
              >
                {option.label}
                {option.value === value ? <Icon name="check" /> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
