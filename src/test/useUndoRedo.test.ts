/**
 * useUndoRedo.test.ts
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '@/hooks/useUndoRedo'

describe('useUndoRedo', () => {
  it('starts with the initial state and no history', () => {
    const { result } = renderHook(() => useUndoRedo('initial'))
    expect(result.current.state).toBe('initial')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('push() adds a new state and enables undo', () => {
    const { result } = renderHook(() => useUndoRedo('a'))

    act(() => result.current.push('b'))

    expect(result.current.state).toBe('b')
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('undo() reverts to the previous state', () => {
    const { result } = renderHook(() => useUndoRedo('a'))

    act(() => result.current.push('b'))
    act(() => result.current.undo())

    expect(result.current.state).toBe('a')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('redo() re-applies the undone state', () => {
    const { result } = renderHook(() => useUndoRedo('a'))

    act(() => result.current.push('b'))
    act(() => result.current.undo())
    act(() => result.current.redo())

    expect(result.current.state).toBe('b')
    expect(result.current.canRedo).toBe(false)
  })

  it('push() clears the redo stack', () => {
    const { result } = renderHook(() => useUndoRedo('a'))

    act(() => result.current.push('b'))
    act(() => result.current.undo())
    act(() => result.current.push('c')) // new branch

    expect(result.current.state).toBe('c')
    expect(result.current.canRedo).toBe(false)
  })

  it('caps history at 20 entries', () => {
    const { result } = renderHook(() => useUndoRedo(0))

    // Push 25 entries
    act(() => {
      Array.from({ length: 25 }).forEach((_, i) => result.current.push(i + 1))
    })

    // Undo 20 times — should stop at earliest kept state (entry 6)
    act(() => {
      Array.from({ length: 20 }).forEach(() => result.current.undo())
    })

    expect(result.current.canUndo).toBe(false)
    // After 25 pushes capped at 20, the oldest kept entry is 5
    expect(result.current.state).toBe(5)
  })

  it('reset() clears all history', () => {
    const { result } = renderHook(() => useUndoRedo('a'))

    act(() => result.current.push('b'))
    act(() => result.current.push('c'))
    act(() => result.current.reset('fresh'))

    expect(result.current.state).toBe('fresh')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})
