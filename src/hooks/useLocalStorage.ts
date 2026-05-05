/**
 * useLocalStorage.ts
 * Generic hook for persisting state to localStorage with versioned migrations.
 *
 * Usage:
 *   const [value, setValue] = useLocalStorage<MyType>('key', defaultValue, 1)
 */

import { useState, useCallback } from 'react'

type Migrator<T> = (raw: unknown, fromVersion: number) => T

export type { Migrator }

interface UseLocalStorageOptions<T extends object> {
  /** Schema version — increment when data shape changes */
  version?: number
  /** Called when stored version < current version. Return migrated data. */
  migrate?: Migrator<T>
}

interface StoredEnvelope<T> {
  version: number
  data: T
}

function isStoredEnvelope<T>(value: unknown): value is StoredEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'data' in value &&
    typeof (value as StoredEnvelope<T>).version === 'number'
  )
}

function readFromStorage<T extends object>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T>,
): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue

    const parsed: unknown = JSON.parse(raw)
    const currentVersion = options.version ?? 1

    if (isStoredEnvelope<T>(parsed)) {
      if (parsed.version === currentVersion) {
        return parsed.data
      }
      if (options.migrate) {
        return options.migrate(parsed.data, parsed.version)
      }
      // Version mismatch and no migrator — discard stale data
      return defaultValue
    }

    // Legacy data stored without envelope — treat as v0
    if (options.migrate) {
      return options.migrate(parsed, 0)
    }
    return defaultValue
  } catch {
    return defaultValue
  }
}

function writeToStorage<T extends object>(key: string, value: T, version: number): void {
  try {
    const envelope: StoredEnvelope<T> = { version, data: value }
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Silently fail (e.g. private browsing, quota exceeded)
  }
}

export function useLocalStorage<T extends object>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {},
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const version = options.version ?? 1

  const [storedValue, setStoredValue] = useState<T>(() =>
    readFromStorage(key, defaultValue, options),
  )

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? value(prev) : value
        writeToStorage(key, next, version)
        return next
      })
    },
    [key, version],
  )

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      // Silently fail
    }
    setStoredValue(defaultValue)
  }, [key, defaultValue])

  return [storedValue, setValue, removeValue]
}
