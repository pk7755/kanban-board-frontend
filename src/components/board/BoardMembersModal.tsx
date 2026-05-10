/**
 * BoardMembersModal.tsx
 * Popup displaying board members with add/remove controls.
 * Opens when user clicks the member count badge on the board.
 */

import { useEffect, useRef, useState } from 'react'
import { UserPlus, UserMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { BoardMember } from '@/types/entities'
import '@/styles/components/BoardMembersModal.css'

export interface BoardMembersModalProps {
  boardId: string
  ownerId: string
  currentUserId: string
  isManager: boolean
  members: ReadonlyArray<BoardMember>
  onAddMember: (email: string) => Promise<void>
  onRemoveMember: (userId: string) => Promise<void>
  onClose: () => void
}

export function BoardMembersModal({
  ownerId,
  currentUserId,
  isManager,
  members,
  onAddMember,
  onRemoveMember,
  onClose,
}: BoardMembersModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  /** Open on mount */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  /** ESC → close */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const email = addEmail.trim()
    if (!email) return
    setAddError(null)
    setIsAdding(true)
    try {
      await onAddMember(email)
      setAddEmail('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setIsAdding(false)
    }
  }

  /** Backdrop click: auto-save pending email then close */
  const handleBackdropClick = async (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return
    if (isAdding) return
    if (addEmail.trim()) {
      await handleAdd()
    }
    onClose()
  }

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    try {
      await onRemoveMember(userId)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="board-members-modal"
      aria-labelledby="bm-modal-title"
      aria-modal="true"
      onClick={(e) => {
        void handleBackdropClick(e)
      }}
    >
      <div className="board-members-modal__header">
        <h2 id="bm-modal-title" className="board-members-modal__title">
          Board Members <span className="board-members-modal__count">({members.length})</span>
        </h2>
        <button className="board-members-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <ul className="board-members-modal__list" role="list">
        {members.map((member) => (
          <li key={member.userId} className="board-members-modal__member">
            <div className="board-members-modal__avatar" aria-hidden="true">
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="board-members-modal__info">
              <span className="board-members-modal__name">
                {member.name}
                {member.userId === ownerId && (
                  <span className="board-members-modal__owner-tag"> (Owner)</span>
                )}
              </span>
              <span className="board-members-modal__email">{member.email}</span>
            </div>
            <span
              className={`board-members-modal__status board-members-modal__status--${member.isActive ? 'active' : 'inactive'}`}
            >
              {member.isActive ? 'Active' : 'Inactive'}
            </span>
            {isManager && member.userId !== ownerId && member.userId !== currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void handleRemove(member.userId)
                }}
                disabled={removingId === member.userId}
                aria-label={`Remove ${member.name} from board`}
                title="Remove from board"
              >
                <UserMinus size={14} aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="board-members-modal__empty">No members yet.</li>}
      </ul>

      {isManager && (
        <form
          className="board-members-modal__add-form"
          onSubmit={(e) => {
            void handleAdd(e)
          }}
          noValidate
        >
          <div className="board-members-modal__add-row">
            <input
              type="email"
              className="board-members-modal__add-input"
              placeholder="Add member by email…"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              disabled={isAdding}
              aria-label="Add member by email"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isAdding || !addEmail.trim()}
            >
              <UserPlus size={14} aria-hidden="true" />
              {isAdding ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {addError && (
            <p className="board-members-modal__add-error" role="alert">
              {addError}
            </p>
          )}
        </form>
      )}
    </dialog>
  )
}
