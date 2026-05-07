/**
 * ToastContext.tsx
 * Manages a queue of toast notifications displayed at the bottom-right corner.
 *
 * Usage:
 *   const { showToast } = useToast()
 *   showToast({ message: 'Task deleted', variant: 'info', action: { label: 'Undo', onClick: fn } })
 *
 * Each toast auto-dismisses after `duration` ms (default 4000).
 * Passing an `action` (e.g. Undo) pauses auto-dismiss on hover.
 */

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react'
import type { ReactNode } from 'react'

/* ─── Types ───────────────────────────────────────────────────────── */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
  duration: number
}

type ToastInput = Omit<Toast, 'id' | 'duration'> & { duration?: number }

/* ─── Reducer ─────────────────────────────────────────────────────── */

type ToastAction2 =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }

function toastReducer(state: Toast[], action: ToastAction2): Toast[] {
  switch (action.type) {
    case 'ADD':
      // Keep at most 5 toasts in the stack
      return [...state.slice(-4), action.toast]
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id)
    default:
      return state
  }
}

/* ─── Context ─────────────────────────────────────────────────────── */

interface ToastContextValue {
  toasts: Toast[]
  showToast: (input: ToastInput) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/* ─── Provider ────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])
  // Map of toast id → timeout handle so we can clear on hover
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    dispatch({ type: 'REMOVE', id })
  }, [])

  const showToast = useCallback(
    (input: ToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = input.duration ?? 4000
      const toast: Toast = { ...input, id, duration }

      dispatch({ type: 'ADD', toast })

      const timer = setTimeout(() => dismissToast(id), duration)
      timers.current.set(id, timer)

      return id
    },
    [dismissToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  )
}

/* ─── Hook ────────────────────────────────────────────────────────── */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
