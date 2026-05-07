/**
 * ConfirmModal.tsx
 * Reusable confirmation dialog used across the app.
 * Renders when mounted; parent controls visibility by conditionally rendering it.
 * Uses the same 3-effect dialog pattern as TaskDetail for StrictMode safety.
 */

import { type ReactNode, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import '@/styles/components/ConfirmModal.css'

export interface ConfirmModalProps {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Danger = red confirm button; primary = accent confirm button */
  variant?: 'danger' | 'primary'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  /** Effect 1 — open on mount, close on unmount */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Effect 2 — intercept ESC and route through onCancel */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      if (!isLoading) onCancel()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [isLoading, onCancel])

  return (
    <dialog ref={dialogRef} className="confirm-modal" aria-labelledby="confirm-modal-title" aria-modal="true">
      <div className="confirm-modal__content">
        <h2 id="confirm-modal-title" className="confirm-modal__title">{title}</h2>
        <p className="confirm-modal__message">{message}</p>
        <div className="confirm-modal__actions">
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
