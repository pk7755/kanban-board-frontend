/**
 * Toast.tsx
 * Renders the active toast stack in a fixed portal at the bottom-right.
 * Hovering pauses the auto-dismiss timer; moving away restarts it.
 */

import { useEffect, useRef } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import type { Toast, ToastVariant } from '@/context/ToastContext'
import '@/styles/components/Toast.css'

/* ─── Icon map ────────────────────────────────────────────────────── */

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={16} aria-hidden="true" />,
  error: <AlertCircle size={16} aria-hidden="true" />,
  warning: <AlertTriangle size={16} aria-hidden="true" />,
  info: <Info size={16} aria-hidden="true" />,
}

/* ─── Single toast item ───────────────────────────────────────────── */

interface ToastItemProps {
  toast: Toast
}

function ToastItem({ toast }: ToastItemProps) {
  const { dismissToast } = useToast()
  // Store the remaining time so hover-pause → resume works correctly
  const pausedAtRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const remainingRef = useRef<number>(toast.duration)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialise startedAt after mount so Date.now() is not called during render
  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [])

  function startTimer() {
    timerRef.current = setTimeout(() => dismissToast(toast.id), remainingRef.current)
    startedAtRef.current = Date.now()
  }

  function pauseTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pausedAtRef.current = Date.now()
    remainingRef.current -= Date.now() - startedAtRef.current
    if (remainingRef.current < 0) remainingRef.current = 0
  }

  function handleAction() {
    toast.action?.onClick()
    dismissToast(toast.id)
  }

  return (
    <div
      className={`toast toast--${toast.variant}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      <span className="toast__icon">{ICONS[toast.variant]}</span>

      <span className="toast__message">{toast.message}</span>

      {toast.action && (
        <button className="toast__action" onClick={handleAction}>
          {toast.action.label}
        </button>
      )}

      <button
        className="toast__close"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

/* ─── Toast stack ─────────────────────────────────────────────────── */

export function ToastStack() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-label="Notifications" role="region">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
