/**
 * useUndoRedo.ts
 * Generic undo/redo history stack capped at MAX_HISTORY entries.
 *
 * Usage:
 *   const { state, push, undo, redo, canUndo, canRedo } = useUndoRedo(initialState)
 *
 * push(newState) — add a snapshot to history
 * undo()         — go back one snapshot
 * redo()         — go forward one snapshot (only available after undo)
 */

import { useState, useCallback } from 'react'

const MAX_HISTORY = 20

interface UndoRedoState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UseUndoRedoReturn<T> {
  state: T
  push: (newState: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Reset history entirely with a new starting state */
  reset: (newState: T) => void
}

export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [history, setHistory] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const push = useCallback((newState: T) => {
    setHistory((prev) => {
      const past = [...prev.past, prev.present].slice(-MAX_HISTORY)
      return { past, present: newState, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev
      const past = prev.past.slice(0, -1)
      const present = prev.past[prev.past.length - 1]
      const future = [prev.present, ...prev.future]
      return { past, present, future }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev
      const present = prev.future[0]
      const future = prev.future.slice(1)
      const past = [...prev.past, prev.present]
      return { past, present, future }
    })
  }, [])

  const reset = useCallback((newState: T) => {
    setHistory({ past: [], present: newState, future: [] })
  }, [])

  return {
    state: history.present,
    push,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    reset,
  }
}
