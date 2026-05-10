/**
 * TaskCard.tsx
 * Memoized board task card with inline title editing and task metadata.
 */

import { memo, useMemo, useRef, useState } from 'react'
import { CalendarDays, GripVertical, ListChecks, Lock, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useBoardContext } from '@/context/BoardContext'
import { useDragContext } from '@/context/DragContext'
import type { Task, UserMap } from '@/types/entities'
import { tasksApi } from '@/utils/api'
import '@/styles/board/TaskCard.css'
import '@/styles/board/TaskCard.detail.css'

interface TaskCardProps {
  task: Task
  userMap: UserMap
  searchQuery: string
  onTaskClick: (taskId: string) => void
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text: string | null | undefined, query: string) {
  const safeText = text ?? ''
  if (!query.trim()) return safeText
  const trimmedQuery = query.trim()
  const parts = safeText.split(new RegExp(`(${escapeRegExp(trimmedQuery)})`, 'gi'))
  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      part
    ),
  )
}

function formatDueDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function TaskCardComponent({ task, userMap, searchQuery, onTaskClick }: TaskCardProps) {
  const { state: authState } = useAuth()
  const { dispatch } = useBoardContext()
  const { startDrag, endDrag, taskId: draggedTaskId } = useDragContext()
  const ghostRef = useRef<HTMLElement | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)

  const currentUser = authState.user
  // Prefer assignee data embedded in the task (from backend response); fall back to userMap
  const assigneeFromMap = task.assigneeId ? userMap[task.assigneeId] : undefined
  const assigneeName = task.assigneeName ?? assigneeFromMap?.name
  const assigneeAvatarUrl = task.assigneeAvatarUrl ?? assigneeFromMap?.avatarUrl
  // Tags are now full Tag objects on task.tags — no lookup needed
  const tags = [...task.tags]
  const checklistTotal = task.checklist.length
  const checklistCompleted = task.checklist.filter((item) => item.completed).length
  const formattedDueDate = formatDueDate(task.dueDate)
  const isOverdue = useMemo(() => {
    if (!task.dueDate) return false
    // eslint-disable-next-line react-hooks/purity
    return new Date(task.dueDate).getTime() < Date.now()
  }, [task.dueDate])
  const isReadOnly = currentUser?.role === 'TEAM_MEMBER' && task.assigneeId !== currentUser.id
  const isDraggingThis = draggedTaskId === task.id

  /* ── Drag handlers ── */
  function handleDragStart(e: React.DragEvent<HTMLElement>) {
    if (isReadOnly) {
      e.preventDefault()
      return
    }

    // CRITICAL: prevent the event from bubbling to the column wrapper <div draggable>.
    // Without this, the column's onDragStart fires too, setting draggingColumnId and
    // causing columns to reorder on every task drop.
    e.stopPropagation()

    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)

    // Create a styled ghost: rotated + elevated clone
    const el = e.currentTarget
    const ghost = el.cloneNode(true) as HTMLElement
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: `${el.offsetWidth}px`,
      transform: 'rotate(2deg) scale(1.04)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
      pointerEvents: 'none',
      borderRadius: 'var(--radius-lg)',
    })
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY)

    startDrag(task.id, task.columnId)
  }

  function handleDragEnd() {
    if (ghostRef.current && document.body.contains(ghostRef.current)) {
      document.body.removeChild(ghostRef.current)
      ghostRef.current = null
    }
    endDrag()
  }

  const handleSaveTitle = async () => {
    const nextTitle = draftTitle.trim()
    if (!nextTitle || nextTitle === task.title || isReadOnly) {
      setDraftTitle(task.title)
      setIsEditingTitle(false)
      return
    }

    const response = await tasksApi.update(task.id, { title: nextTitle })
    dispatch({ type: 'UPDATE_TASK', payload: { taskId: task.id, ...response.data } })
    setDraftTitle(response.data.title)
    setIsEditingTitle(false)
  }

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      await handleSaveTitle()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraftTitle(task.title)
      setIsEditingTitle(false)
    }
  }

  const assigneeLabel = useMemo(() => {
    if (!task.assigneeId) return 'Unassigned'
    return assigneeName ?? 'Unassigned'
  }, [task.assigneeId, assigneeName])

  return (
    <article
      className={`task-card${isReadOnly ? ' task-card--readonly' : ''}${isDraggingThis ? ' task-card--dragging' : ''}`}
      role="listitem"
      aria-label={task.title}
      tabIndex={0}
      draggable={!isReadOnly}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onTaskClick(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onTaskClick(task.id)
        }
      }}
    >
      <div className="task-card__top-row">
        <span
          className={`task-card__drag-handle${isReadOnly ? ' task-card__drag-handle--locked' : ''}`}
          aria-hidden="true"
          title={
            isReadOnly ? `Read-only — assigned to ${assigneeName ?? 'someone'}` : 'Drag to move'
          }
        >
          {isReadOnly ? <Lock size={14} /> : <GripVertical size={16} />}
        </span>
        <div className="task-card__title-wrap">
          {isEditingTitle ? (
            <input
              className="task-card__title-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                void handleSaveTitle()
              }}
              onKeyDown={(event) => {
                void handleKeyDown(event)
              }}
              autoFocus
              aria-label="Edit task title"
            />
          ) : (
            <h4
              className="task-card__title"
              onDoubleClick={(event) => {
                event.stopPropagation()
                if (!isReadOnly) {
                  setDraftTitle(task.title)
                  setIsEditingTitle(true)
                }
              }}
            >
              {renderHighlightedText(task.title, searchQuery)}
            </h4>
          )}
        </div>
      </div>

      <div className="task-card__meta-row">
        <Badge label={task.priority} variant="priority" />
        {formattedDueDate ? (
          <span
            className={`task-card__due-date${isOverdue ? ' task-card__due-date--overdue' : ''}`}
          >
            <CalendarDays size={14} aria-hidden="true" />
            {formattedDueDate}
          </span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="task-card__tags" aria-label="Task tags">
          {tags.map((tag) => (
            <Badge key={tag.id} label={tag.label} color={tag.color} variant="tag" />
          ))}
        </div>
      ) : null}

      <div className="task-card__footer">
        <div className="task-card__assignee" aria-label={`Assignee: ${assigneeLabel}`}>
          <span className="task-card__avatar">
            {assigneeAvatarUrl ? (
              <img
                src={assigneeAvatarUrl}
                alt={assigneeName ?? ''}
                className="task-card__avatar-img"
                onError={(e) => {
                  const target = e.currentTarget
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent && assigneeName)
                    parent.textContent = assigneeName.charAt(0).toUpperCase()
                }}
              />
            ) : assigneeName ? (
              assigneeName.charAt(0).toUpperCase()
            ) : (
              <UserRound size={12} aria-hidden="true" />
            )}
          </span>
          <span className="task-card__assignee-name">{assigneeLabel}</span>
        </div>

        {checklistTotal > 0 ? (
          <span
            className="task-card__checklist"
            aria-label={`Checklist progress ${checklistCompleted} of ${checklistTotal}`}
          >
            <ListChecks size={14} aria-hidden="true" />
            {checklistCompleted}/{checklistTotal}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export const TaskCard = memo(TaskCardComponent, (previousProps, nextProps) => {
  return (
    previousProps.task === nextProps.task &&
    previousProps.searchQuery === nextProps.searchQuery &&
    previousProps.onTaskClick === nextProps.onTaskClick &&
    previousProps.userMap === nextProps.userMap
  )
})
