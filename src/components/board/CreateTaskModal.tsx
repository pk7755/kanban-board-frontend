/**
 * CreateTaskModal.tsx
 * Centered dialog for creating a new task — same visual style as TaskDetail.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useBoardContext } from '@/context/BoardContext'
import { useAuth } from '@/context/AuthContext'
import { TagPicker } from '@/components/board/TagPicker'
import type { Board, Task } from '@/types/entities'
import { tasksApi } from '@/utils/api'
import '@/styles/components/Input.css'
import '@/styles/pages/TaskDetail.css'

interface CreateTaskModalProps {
  /** Column where the task will be created */
  columnId: string
  boardId: string
  onClose: () => void
  /** Called with the newly created task so the parent can open the detail view */
  onCreated: (task: Task) => void
}

export function CreateTaskModal({ columnId, boardId, onClose, onCreated }: CreateTaskModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { state: authState } = useAuth()
  const { state, dispatch } = useBoardContext()

  // Resolve board and active board members from context
  const activeBoard: Board | undefined = state.boards.find((b) => b.id === boardId)
  const boardMembers = (activeBoard?.members ?? []).filter((m) => m.isActive)
  const boardTags = activeBoard?.tags ?? []

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assigneeId, setAssigneeId] = useState<string>(authState.user?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedColumnId, setSelectedColumnId] = useState(columnId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({})

  /* ── Open/close dialog ─────────────────────────────────────────── */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Validation ────────────────────────────────────────────────── */
  function validate(): boolean {
    const next: typeof errors = {}
    if (!title.trim()) next.title = 'Title is required'
    if (!description.trim()) next.description = 'Description is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  /* ── Submit ────────────────────────────────────────────────────── */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const response = await tasksApi.create({
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        tags: selectedTagIds,
        checklist: [],
        archived: false,
        order: 0,
        columnId: selectedColumnId,
        boardId,
      })
      dispatch({ type: 'ADD_TASK', payload: response.data })
      onCreated(response.data)
    } catch {
      // API errors are surfaced via toast elsewhere; just re-enable the button
    } finally {
      setIsSubmitting(false)
    }
  }

  const sortedColumns = (activeBoard?.columns ?? []).slice().sort((a, b) => a.order - b.order)

  return (
    <dialog ref={dialogRef} className="task-detail" aria-label="Create new task">
      <div className="task-detail__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="task-detail__panel">
        <header className="task-detail__header">
          <div className="task-detail__header-info">
            <p className="task-detail__eyebrow">New task</p>
            <h2 className="task-detail__heading">Create Task</h2>
            {/* Status / column inline */}
            {sortedColumns.length > 0 && (
              <div className="task-detail__status-row">
                <span className="task-detail__status-pill-label">Status</span>
                <select
                  className="task-detail__status-pill"
                  value={selectedColumnId}
                  onChange={(e) => setSelectedColumnId(e.target.value)}
                  aria-label="Column / Status"
                >
                  {sortedColumns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>

        {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
        <form className="task-detail__content" onSubmit={handleSubmit} noValidate>
          {/* Title */}
          <div className="field">
            <label className="field__label" htmlFor="ct-title">
              Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="ct-title"
              className="field__control"
              value={title}
              placeholder="Enter task title"
              autoFocus
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
              }}
              aria-describedby={errors.title ? 'ct-title-error' : undefined}
            />
            {errors.title && (
              <p id="ct-title-error" className="task-detail__field-error" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="field">
            <label className="field__label" htmlFor="ct-description">
              Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="ct-description"
              className="field__control task-detail__textarea"
              value={description}
              placeholder="Describe the task…"
              rows={4}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }))
              }}
              aria-describedby={errors.description ? 'ct-desc-error' : undefined}
            />
            {errors.description && (
              <p id="ct-desc-error" className="task-detail__field-error" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          {/* Grid: Priority / Assignee / Due date */}
          <div className="task-detail__grid">
            <div className="field">
              <label className="field__label" htmlFor="ct-priority">
                Priority
              </label>
              <select
                id="ct-priority"
                className="field__control"
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="ct-assignee">
                Assignee
              </label>
              <select
                id="ct-assignee"
                className="field__control"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {boardMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="ct-due-date">
                Due date
              </label>
              <input
                id="ct-due-date"
                type="date"
                className="field__control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="field">
            <label className="field__label">Tags</label>
            <TagPicker
              boardTags={boardTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              onCreateTag={async (name, color) => {
                const { tagsApi } = await import('@/utils/apiClient')
                const res = await tagsApi.create(boardId, { label: name, color })
                dispatch({ type: 'ADD_TAG', payload: { boardId, tag: res.data } })
                return res.data
              }}
            />
          </div>

          {/* Actions */}
          <div className="task-detail__create-actions">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create task'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
