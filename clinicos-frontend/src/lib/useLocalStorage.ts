import { useCallback, useEffect, useState } from 'react'

/**
 * localStorage bilan sinxron holat.
 * Boshqa tabda o'zgarsa — shu tabda ham yangilanadi.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial))

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* kvota to'lgan yoki xususiy rejim — holat baribir ishlaydi */
        }
        return resolved
      })
    },
    [key],
  )

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setValue(read(key, initial))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, update] as const
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
