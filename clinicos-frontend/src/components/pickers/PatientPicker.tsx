import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'

import { listPatients } from '@/api/patients'
import { Avatar } from '@/components/ui/Avatar'
import { Field } from '@/components/ui/Form'
import { cn } from '@/lib/cn'
import { phone as formatPhone } from '@/lib/format'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useI18n } from '@/i18n'

/**
 * BEMORNI TANLASH.
 *
 * Ro'yxat emas, QIDIRUV: klinikada minglab bemor bo'ladi va
 * ochiladigan ro'yxatdan topib bo'lmaydi. Yozilgan zahoti server
 * qidiradi, sakkiztasi ko'rsatiladi.
 *
 * Bir joyda turadi, chunki uchta oqim ishlatadi: qabulga yozish,
 * bemorlarga xabar va onlayn retsept. Ilgari u ikki faylda
 * nusxalangan edi va bittasi tuzatilsa, ikkinchisi eskirardi.
 */
export function PatientPicker({
  value,
  onChange,
  label,
  error,
  required = true,
}: {
  value: string | null
  onChange: (id: string) => void
  label?: string
  error?: string
  required?: boolean
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 200)

  const { data } = useAsync(() => listPatients({ search: debounced, pageSize: 8 }), [debounced])

  const rows = useMemo(() => data?.items ?? [], [data])
  const selected = rows.find((patient) => patient.id === value)

  return (
    <Field label={label ?? t('common.patient')} required={required} error={error}>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute inset-y-0 left-3 my-auto text-label-tertiary"
        />
        <input
          type="search"
          value={selected && !query ? selected.fullName : query}
          placeholder={t('patients.search')}
          onChange={(event) => {
            setQuery(event.target.value)
            if (value) onChange('')
          }}
          className={cn(
            'h-10 w-full rounded-[10px] bg-sunken pl-10 pr-3.5 text-subhead text-label',
            'border outline-none placeholder:text-label-tertiary',
            'transition-colors duration-150 focus:bg-raised',
            error ? 'border-bad' : 'border-transparent focus:border-accent',
          )}
        />
      </div>

      {rows.length > 0 ? (
        <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto scroll-slim rounded-[12px] bg-sunken p-1.5">
          {rows.map((patient) => {
            const active = patient.id === value
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(patient.id)
                    setQuery('')
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left',
                    'transition-colors duration-150 hover:bg-fill-4',
                    active && 'bg-accent-soft',
                  )}
                >
                  <Avatar name={patient.fullName} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-subhead text-label">
                      {patient.fullName}
                    </span>
                    <span className="block truncate text-caption text-label-tertiary tnum">
                      {formatPhone(patient.phone)}
                    </span>
                  </span>
                  {active ? <Check size={15} className="shrink-0 text-accent" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Field>
  )
}
