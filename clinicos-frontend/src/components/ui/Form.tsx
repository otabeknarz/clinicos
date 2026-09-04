import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'
import { phoneInputMask } from '@/lib/format'
import { useI18n } from '@/i18n'

/**
 * Forma elementlari.
 *
 * Har bir maydon: yorliq + yordamchi matn + xato. Xato bo'lsa chegara
 * qizaradi va matn pastda chiqadi — foydalanuvchi nima noto'g'ri
 * ekanini o'qiy oladi (spec talabi).
 */

const CONTROL = cn(
  'w-full rounded-[10px] bg-sunken px-3.5 text-subhead text-label',
  'border border-transparent outline-none',
  'placeholder:text-label-tertiary',
  'transition-[border-color,background-color,box-shadow] duration-150',
  'focus:border-accent focus:bg-raised',
  'disabled:opacity-50 disabled:cursor-not-allowed',
)

const CONTROL_ERROR = 'border-bad focus:border-bad'

/* ------------------------------------------------------------------ */
/* Maydon o'ramasi                                                     */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-footnote font-medium text-label-secondary"
        >
          {label}
          {required ? <span className="ml-0.5 text-bad">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-caption text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-caption text-label-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  /** O'ng tomondagi qo'shimcha (masalan "so'm") */
  suffix?: ReactNode
  fieldClassName?: string
}

export function TextInput({
  label,
  hint,
  error,
  icon,
  suffix,
  required,
  className,
  fieldClassName,
  id,
  ...rest
}: TextInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={fieldClassName}
    >
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-label-tertiary">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            'h-10',
            icon && 'pl-10',
            suffix && 'pr-14',
            error && CONTROL_ERROR,
            className,
          )}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-footnote text-label-tertiary">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Telefon                                                             */
/* ------------------------------------------------------------------ */

/** O'zbekiston raqami uchun jonli maska: +998 90 123 45 67 */
export function PhoneInput({
  value,
  onChange,
  ...rest
}: Omit<TextInputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <TextInput
      type="tel"
      inputMode="tel"
      value={value}
      placeholder="+998 90 123 45 67"
      onChange={(e) => onChange(phoneInputMask(e.target.value))}
      {...rest}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Textarea                                                            */
/* ------------------------------------------------------------------ */

export function TextArea({
  label,
  hint,
  error,
  required,
  className,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <textarea
        id={inputId}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', error && CONTROL_ERROR, className)}
        {...rest}
      />
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string
  label: string
}

export function Select({
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  className,
  id,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: string
  hint?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const { t } = useI18n()

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="relative">
        <select
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            'h-10 cursor-pointer appearance-none pr-9',
            error && CONTROL_ERROR,
            className,
          )}
          {...rest}
        >
          <option value="">{placeholder ?? t('action.select')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute inset-y-0 right-3 my-auto text-label-tertiary"
        />
      </div>
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Radio guruhi (jins tanlash kabi)                                    */
/* ------------------------------------------------------------------ */

export function RadioGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label?: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  error?: string
  required?: boolean
}) {
  return (
    <Field label={label} error={error} required={required}>
      <div className="flex gap-2">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'h-10 flex-1 rounded-[10px] text-subhead font-medium',
                'transition-colors duration-150',
                active
                  ? 'bg-accent-soft text-accent ring-1 ring-accent/40 ring-inset'
                  : 'bg-sunken text-label-secondary hover:text-label',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Qidiruv maydoni                                                     */
/* ------------------------------------------------------------------ */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  icon,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  icon?: ReactNode
}) {
  return (
    <div className={cn('relative', className)}>
      {icon ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-label-tertiary">
          {icon}
        </span>
      ) : null}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTROL, 'h-10', icon && 'pl-10')}
      />
    </div>
  )
}
