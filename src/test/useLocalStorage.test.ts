/**
 * useLocalStorage.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { Migrator } from '@/hooks/useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the default value when nothing is stored', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 0 }),
    )
    expect(result.current[0]).toEqual({ count: 0 })
  })

  it('persists a value to localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 0 }),
    )

    act(() => {
      result.current[1]({ count: 42 })
    })

    expect(result.current[0]).toEqual({ count: 42 })
    const stored = JSON.parse(localStorage.getItem('test-key') ?? '{}')
    expect(stored.data).toEqual({ count: 42 })
  })

  it('reads an existing value from localStorage on mount', () => {
    localStorage.setItem('test-key', JSON.stringify({ version: 1, data: { count: 99 } }))

    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 0 }, { version: 1 }),
    )
    expect(result.current[0]).toEqual({ count: 99 })
  })

  it('runs the migrator when versions differ', () => {
    localStorage.setItem('test-key', JSON.stringify({ version: 1, data: { value: 'old' } }))

    // cast needed because vi.fn() mock shape and Migrator<T> aren't directly assignable
    const migrate = vi.fn().mockReturnValue({ value: 'migrated' }) as unknown as Migrator<{ value: string }>

    const { result } = renderHook(() =>
      useLocalStorage('test-key', { value: 'default' }, { version: 2, migrate }),
    )

    expect(migrate).toHaveBeenCalledOnce()
    expect(result.current[0]).toEqual({ value: 'migrated' })
  })

  it('removes the value from storage on removeValue()', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 0 }),
    )

    act(() => result.current[1]({ count: 7 }))
    act(() => result.current[2]())

    expect(result.current[0]).toEqual({ count: 0 })
    expect(localStorage.getItem('test-key')).toBeNull()
  })

  it('accepts a functional updater', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 5 }),
    )

    act(() => {
      result.current[1]((prev) => ({ count: prev.count + 1 }))
    })

    expect(result.current[0]).toEqual({ count: 6 })
  })
})
