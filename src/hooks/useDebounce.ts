/**
 * useDebounce.ts
 * Returns a debounced copy of the given value.
 * Updates only after the value stops changing for `delay` ms.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchTerm, 300)
 */

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
