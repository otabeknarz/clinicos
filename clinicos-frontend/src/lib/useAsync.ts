import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ma'lumot yuklash uchun yagona hook.
 *
 * Har bir sahifada uchta holat kerak: yuklanmoqda / xato / ma'lumot.
 * Shu hook ularni bir joyda beradi, shuning uchun sahifalarda takroriy
 * `useState` zanjiri yozilmaydi.
 *
 *   const { data, loading, error, reload } = useAsync(
 *     () => listPatients({ search }),
 *     [search],
 *   )
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options: { skip?: boolean } = {},
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)

  // Eski so'rov javobi yangisining ustiga yozilmasligi uchun
  const requestId = useRef(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(() => {
    if (options.skip) {
      setLoading(false)
      return
    }

    const id = ++requestId.current
    setLoading(true)
    setError(null)

    loaderRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return
        setData(result)
      })
      .catch((e: unknown) => {
        if (id !== requestId.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (id !== requestId.current) return
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.skip, ...deps])

  useEffect(() => {
    run()
    return () => {
      // Komponent yopilsa, kelayotgan javobni e'tiborsiz qoldiramiz
      requestId.current++
    }
  }, [run])

  return { data, loading, error, reload: run, setData }
}

/**
 * Yozish amallari uchun (yaratish/o'chirish/holat o'zgartirish).
 * Tugmani bloklash va xatoni ko'rsatish uchun `pending` qaytaradi.
 */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(
    async (...args: A): Promise<R | null> => {
      setPending(true)
      setError(null)
      try {
        return await action(...args)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
        return null
      } finally {
        setPending(false)
      }
    },
    [action],
  )

  return { run, pending, error }
}

/** Qidiruv maydonlari uchun kechiktirilgan qiymat */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return debounced
}
