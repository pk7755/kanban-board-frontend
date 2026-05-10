/**
 * TaskDetail.tsx
 * Full-screen task detail dialog with field-level persistence.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Lock, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { TagPicker } from '@/components/board/TagPicker'
import { useBoardContext } from '@/context/BoardContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { ChecklistItem, Tag, Task } from '@/types/entities'
import { tasksApi } from '@/utils/api'
import { tasksApi as tasksApiDirect } from '@/utils/apiClient'
import '@/styles/components/Input.css'
import '@/styles/pages/TaskDetail.css'

interface TaskDetailProps {
  taskId: string
  onClose: () => void
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function normalizeDateValue(value?: string): string {
  return value ? value.slice(0, 10) : ''
}

export default function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { state, dispatch } = useBoardContext()
  const task = state.tasks[taskId]

  // contextBoard is always populated from HYDRATE_BOARD_DETAIL (columns + members + tags).
  // The separate boardsApi.get call was using adaptBoardDetail which returns tags:[],
  // so we use contextBoard as the single source of truth for all board data.
  const contextBoard = task ? state.boards.find((b) => b.id === task.boardId) : undefined

  // All board tags from context (full Tag objects with id+label+color).
  // Fall back to the tags already embedded in the task (they are Tag[] now).
  const contextBoardTags = contextBoard?.tags ?? []
  const boardTags: Tag[] =
    contextBoardTags.length > 0 ? [...contextBoardTags] : [...(task?.tags ?? [])]

  // Draft initialized once from the task in state.
  // We do NOT continuously sync draft from task on every UPDATE_TASK dispatch —
  // that would wipe in-progress text edits. Tag/assignee saves update draft
  // directly from the API response via setDraft(res.data).
  const [draft, setDraft] = useState<Task | null>(task ?? null)
  const [newChecklistItem, setNewChecklistItem] = useState('')

  // Derive loading state from draft — no separate isLoading state needed.
  // draft is null only before the context hydrates (rare: direct URL navigation).
  const isLoading = draft === null && (!task || !contextBoard)

  // Once context hydrates (task + board available), sync tags and auth fields.
  // Always sync tags from fresh task data — they are backend-controlled
  // (not user-typed), so syncing them never wipes in-progress edits.
  // Text fields (title, description, etc.) are preserved from draft to avoid
  // wiping in-progress edits.
  useEffect(() => {
    if (task && contextBoard) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((prev) => {
        if (prev === null) return task
        // Sync non-editable, backend-authoritative fields without overwriting
        // anything the user may be actively typing.
        return {
          ...prev,
          tags: task.tags,
          assigneeId: task.assigneeId,
          assigneeName: task.assigneeName,
          assigneeAvatarUrl: task.assigneeAvatarUrl,
          archived: task.archived,
          columnId: task.columnId,
          updatedAt: task.updatedAt,
        }
      })
    }
  }, [task, contextBoard])

  // Guard: if task is removed from state (deleted), close the dialog
  useEffect(() => {
    if (!task) onClose()
  }, [onClose, task])

  /**
   * Effect 1 — Open the dialog on mount, close it on unmount.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  /**
   * Effect 2 — Intercept the native ESC key (cancel event).
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  /**
   * Effect 3 — Tab-key focus trap within the dialog.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { canEditTask, canDeleteTask } = usePermissions()
  const canEdit = Boolean(task && canEditTask(task))
  const canDelete = Boolean(task && canDeleteTask(task))

  const saveTask = async (changes: Partial<Task>) => {
    if (!task || !draft || !canEdit) return
    // Capture the current draft so we can roll back if the API call fails.
    // (Some callers update draft optimistically before calling saveTask.)
    const prevDraft = draft
    try {
      const response = await tasksApi.update(task.id, changes)
      dispatch({ type: 'UPDATE_TASK', payload: { taskId: task.id, ...response.data } })
      setDraft(response.data)
    } catch {
      // Revert any optimistic UI changes
      setDraft(prevDraft)
    }
  }

  const saveField = async <K extends keyof Task>(field: K, value: Task[K]) => {
    if (!task || !draft || !canEdit) return
    if (draft[field] === task[field]) return
    await saveTask({ [field]: value } as Partial<Task>)
  }

  /** Move task to a different column (status change). */
  const handleStatusChange = async (toColumnId: string) => {
    if (!task || !draft || !canEdit || toColumnId === draft.columnId) return
    // Move to end of the target column
    const targetCol = contextBoard?.columns.find((c) => c.id === toColumnId)
    const toIndex = targetCol ? targetCol.taskIds.length : 0
    const fromColumnId = draft.columnId
    // Optimistic state update
    setDraft((current) => (current ? { ...current, columnId: toColumnId } : current))
    dispatch({ type: 'MOVE_TASK', payload: { taskId: task.id, fromColumnId, toColumnId, toIndex } })
    try {
      await tasksApi.move(task.id, { toColumnId, toIndex })
    } catch {
      // Revert on failure
      setDraft((current) => (current ? { ...current, columnId: fromColumnId } : current))
      dispatch({
        type: 'MOVE_TASK',
        payload: {
          taskId: task.id,
          fromColumnId: toColumnId,
          toColumnId: fromColumnId,
          toIndex: 0,
        },
      })
    }
  }

  const checklistProgress = useMemo(() => {
    if (!draft || draft.checklist.length === 0) return null
    const completed = draft.checklist.filter((item) => item.completed).length
    return `${completed}/${draft.checklist.length}`
  }, [draft])

  if (!task || !draft) return null

  return (
    <dialog ref={dialogRef} className="task-detail" aria-label={`Task details for ${task.title}`}>
      {/* Backdrop click calls onClose() directly — React state drives the unmount */}
      <div className="task-detail__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="task-detail__panel">
        <header className="task-detail__header">
          <div className="task-detail__header-info">
            <p className="task-detail__eyebrow">Task details</p>
            <h2 className="task-detail__heading">{task.title}</h2>
            {/* Status dropdown — always rendered; uses contextBoard columns */}
            {contextBoard && contextBoard.columns.length > 0 ? (
              <div className="task-detail__status-row">
                <span className="task-detail__status-pill-label">Status</span>
                <select
                  className="task-detail__status-pill"
                  value={draft.columnId}
                  disabled={!canEdit}
                  aria-label="Task status"
                  onChange={(event) => {
                    void handleStatusChange(event.target.value)
                  }}
                >
                  {contextBoard.columns
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="task-detail__status-row">
                <span className="task-detail__status-pill-label">Status</span>
                <span className="task-detail__status-loading">Loading…</span>
              </div>
            )}
          </div>
          <div className="task-detail__header-actions">
            {!canEdit ? (
              <span className="task-detail__readonly" aria-label="Read only task details">
                <Lock size={14} aria-hidden="true" />
                Read only
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onClose}
              aria-label="Close task details"
            >
              <X size={16} />
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="task-detail__loading">
            <Skeleton height="2.5rem" />
            <Skeleton lines={4} height="1rem" />
            <Skeleton height="2.5rem" />
          </div>
        ) : (
          <div className="task-detail__content">
            <div className="field">
              <label className="field__label" htmlFor="task-title">
                Title
              </label>
              <input
                id="task-title"
                className="field__control"
                value={draft.title}
                readOnly={!canEdit}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, title: event.target.value } : current,
                  )
                }
                onBlur={() => {
                  void saveField('title', draft.title)
                }}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="task-description">
                Description
              </label>
              <textarea
                id="task-description"
                className="field__control task-detail__textarea"
                value={draft.description}
                readOnly={!canEdit}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
                onBlur={() => {
                  void saveField('description', draft.description)
                }}
                rows={5}
              />
            </div>

            <div className="task-detail__grid">
              <div className="field">
                <label className="field__label" htmlFor="task-priority">
                  Priority
                </label>
                <select
                  id="task-priority"
                  className="field__control"
                  value={draft.priority}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, priority: event.target.value as Task['priority'] }
                        : current,
                    )
                  }
                  onBlur={() => {
                    void saveField('priority', draft.priority)
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="task-due-date">
                  Due date
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  className="field__control"
                  value={normalizeDateValue(draft.dueDate)}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            dueDate: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : undefined,
                          }
                        : current,
                    )
                  }
                  onBlur={() => {
                    void saveField('dueDate', draft.dueDate)
                  }}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="task-assignee">
                  Assignee
                </label>
                <select
                  id="task-assignee"
                  className="field__control"
                  value={draft.assigneeId ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => {
                    const newAssigneeId = event.target.value || undefined
                    setDraft((current) =>
                      current ? { ...current, assigneeId: newAssigneeId } : current,
                    )
                    // Save immediately; spread with key present so null is sent for unassign
                    void saveTask({ assigneeId: newAssigneeId })
                  }}
                >
                  <option value="">Unassigned</option>
                  {(contextBoard?.members ?? [])
                    .filter((m) => m.isActive)
                    .map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label">Checklist progress</label>
                <div className="task-detail__meta-box">
                  {checklistProgress ?? 'No checklist items'}
                </div>
              </div>
            </div>

            <section className="task-detail__section" aria-labelledby="task-tags-heading">
              <div className="task-detail__section-header">
                <h3 id="task-tags-heading">Tags</h3>
              </div>

              {/* TagPicker — uses dedicated attach/detach APIs for instant, safe tag management */}
              <TagPicker
                boardTags={boardTags}
                selectedTagIds={draft.tags.map((t) => t.id)}
                disabled={!canEdit}
                compact
                // eslint-disable-next-line react-hooks/refs
                portalTarget={dialogRef.current}
                onAdd={async (tagId) => {
                  // Optimistically add the tag so the chip appears instantly
                  const tagObj = boardTags.find((t) => t.id === tagId)
                  setDraft((cur) => (cur && tagObj ? { ...cur, tags: [...cur.tags, tagObj] } : cur))
                  try {
                    const res = await tasksApiDirect.attachTag(task.id, tagId, task.boardId)
                    dispatch({ type: 'UPDATE_TASK', payload: { taskId: task.id, ...res.data } })
                    setDraft(res.data)
                  } catch {
                    // Revert if API fails
                    setDraft((cur) =>
                      cur ? { ...cur, tags: cur.tags.filter((t) => t.id !== tagId) } : cur,
                    )
                  }
                }}
                onRemove={async (tagId) => {
                  // Optimistically remove the chip so it disappears instantly
                  setDraft((cur) =>
                    cur ? { ...cur, tags: cur.tags.filter((t) => t.id !== tagId) } : cur,
                  )
                  try {
                    const res = await tasksApiDirect.detachTag(task.id, tagId, task.boardId)
                    dispatch({ type: 'UPDATE_TASK', payload: { taskId: task.id, ...res.data } })
                    setDraft(res.data)
                  } catch {
                    // Revert if API fails — add it back
                    const tagObj = boardTags.find((t) => t.id === tagId)
                    setDraft((cur) =>
                      cur && tagObj ? { ...cur, tags: [...cur.tags, tagObj] } : cur,
                    )
                  }
                }}
                onCreateTag={async (name, color) => {
                  const { tagsApi } = await import('@/utils/apiClient')
                  const res = await tagsApi.create(task.boardId, { label: name, color })
                  dispatch({ type: 'ADD_TAG', payload: { boardId: task.boardId, tag: res.data } })
                  return res.data
                }}
              />

              {draft.tags.length === 0 && !canEdit && (
                <p className="task-detail__muted">No tags attached.</p>
              )}
              {draft.tags.length === 0 && canEdit && (
                <p className="task-detail__muted task-detail__muted--hint">
                  Click + to attach tags
                </p>
              )}
            </section>

            <section className="task-detail__section" aria-labelledby="task-checklist-heading">
              <div className="task-detail__section-header">
                <h3 id="task-checklist-heading">Checklist</h3>
              </div>
              <div className="task-detail__checklist">
                {draft.checklist.map((item) => (
                  <div key={item.id} className="task-detail__checklist-item">
                    <label className="task-detail__checklist-label">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const nextChecklist = draft.checklist.map((candidate) =>
                            candidate.id === item.id
                              ? { ...candidate, completed: event.target.checked }
                              : candidate,
                          )
                          setDraft((current) =>
                            current ? { ...current, checklist: nextChecklist } : current,
                          )
                          void saveTask({ checklist: nextChecklist })
                        }}
                      />
                      <input
                        className="field__control task-detail__checklist-text"
                        value={item.text}
                        readOnly={!canEdit}
                        onChange={(event) => {
                          const nextChecklist = draft.checklist.map((candidate) =>
                            candidate.id === item.id
                              ? { ...candidate, text: event.target.value }
                              : candidate,
                          )
                          setDraft((current) =>
                            current ? { ...current, checklist: nextChecklist } : current,
                          )
                        }}
                        onBlur={() => {
                          if (!canEdit) return
                          void saveTask({ checklist: draft.checklist })
                        }}
                      />
                    </label>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const nextChecklist = draft.checklist.filter(
                            (candidate) => candidate.id !== item.id,
                          )
                          setDraft((current) =>
                            current ? { ...current, checklist: nextChecklist } : current,
                          )
                          void saveTask({ checklist: nextChecklist })
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              {canEdit ? (
                <div className="task-detail__add-checklist">
                  <input
                    className="field__control"
                    value={newChecklistItem}
                    placeholder="Add checklist item"
                    onChange={(event) => setNewChecklistItem(event.target.value)}
                    onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      const value = newChecklistItem.trim()
                      if (!value) return
                      const nextChecklist: ChecklistItem[] = [
                        ...draft.checklist,
                        { id: `check-${Date.now()}`, text: value, completed: false },
                      ]
                      setDraft((current) =>
                        current ? { ...current, checklist: nextChecklist } : current,
                      )
                      setNewChecklistItem('')
                      void saveTask({ checklist: nextChecklist })
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const value = newChecklistItem.trim()
                      if (!value) return
                      const nextChecklist: ChecklistItem[] = [
                        ...draft.checklist,
                        { id: `check-${Date.now()}`, text: value, completed: false },
                      ]
                      setDraft((current) =>
                        current ? { ...current, checklist: nextChecklist } : current,
                      )
                      setNewChecklistItem('')
                      void saveTask({ checklist: nextChecklist })
                    }}
                  >
                    Add item
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        )}

        {canDelete ? (
          <footer className="task-detail__footer">
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (!task) return
                void tasksApi.delete(task.id).then(() => {
                  dispatch({
                    type: 'DELETE_TASK',
                    payload: { taskId: task.id, columnId: task.columnId },
                  })
                  dialogRef.current?.close()
                })
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete task
            </Button>
          </footer>
        ) : null}
      </div>
    </dialog>
  )
}
