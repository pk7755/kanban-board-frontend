/**
 * Column.tsx
 * Kanban column with inline editing, sorting, and quick task creation.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TaskCard } from '@/components/board/TaskCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { useBoardContext } from '@/context/BoardContext'
import { useDragContext } from '@/context/DragContext'
import type { Column as ColumnEntity, Task, TaskMap, UserMap } from '@/types/entities'
import { columnsApi, tasksApi } from '@/utils/api'
import '@/styles/board/Column.css'

interface ColumnProps {
  column: ColumnEntity
  tasks: Task[]
  taskMap: TaskMap
  userMap: UserMap
  searchQuery: string
  onTaskClick: (taskId: string) => void
  /** Called when user wants to add a task — opens the create modal */
  onAddTask: (columnId: string) => void
  /** True for the first column — receives the global "N" new-task shortcut */
  isFirst?: boolean
}

type SortMode = 'default' | 'priority' | 'dueDate' | 'title'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export function Column({
  column,
  tasks,
  taskMap,
  userMap,
  searchQuery,
  onTaskClick,
  onAddTask,
  isFirst = false,
}: ColumnProps) {
  const { state: authState } = useAuth()
  const { dispatch } = useBoardContext()
  const { taskId: draggedTaskId, fromColumnId, endDrag } = useDragContext()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(column.title)
  const [sortMode, setSortMode] = useState<SortMode>('default')
  // Drop indicator: index in filteredTasks where the card will be inserted
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Counter to debounce dragleave (fires when entering a child element)
  const dragEnterCountRef = useRef(0)

  useEffect(() => {
    if (!isFirst) return
    function handleNewTask() {
      onAddTask(column.id)
    }
    window.addEventListener('kanban:new-task', handleNewTask)
    return () => window.removeEventListener('kanban:new-task', handleNewTask)
  }, [isFirst, column.id, onAddTask])

  const isManager = authState.user?.role === 'MANAGER'

  // Total unarchived task count for the badge — always reads from taskMap so
  // the number doesn't change when the board-level filter hides tasks.
  const totalTaskCount = useMemo(() => {
    return column.taskIds
      .map((id) => taskMap[id])
      .filter((t): t is Task => Boolean(t) && !t.archived).length
  }, [column.taskIds, taskMap])

  // `tasks` is already board-level-filtered by BoardPage. Never fall back to
  // column.taskIds here — that fallback bypassed the priority/tag/assignee
  // filter when a column had zero matching tasks, making filtered-out tasks
  // reappear.
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const nonArchived = tasks.filter((t) => !t.archived)

    const visible = query
      ? nonArchived.filter((task) => {
          const tagLabels = task.tags.map((tag) => (tag.label ?? '').toLowerCase()).join(' ')
          const assigneeName = task.assigneeId
            ? (userMap[task.assigneeId]?.name ?? '').toLowerCase()
            : ''
          return [task.title ?? '', task.description ?? '', tagLabels, assigneeName]
            .join(' ')
            .toLowerCase()
            .includes(query)
        })
      : nonArchived

    return visible.slice().sort((left, right) => {
      switch (sortMode) {
        case 'priority':
          return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
        case 'dueDate': {
          if (!left.dueDate && !right.dueDate) return left.order - right.order
          if (!left.dueDate) return 1
          if (!right.dueDate) return -1
          return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime()
        }
        case 'title':
          return (left.title ?? '').localeCompare(right.title ?? '')
        default:
          return left.order - right.order
      }
    })
  }, [tasks, searchQuery, sortMode, userMap])

  /* ── Drop helpers ── */

  function computeDropIndex(e: React.DragEvent): number {
    const body = bodyRef.current
    if (!body) return filteredTasks.length
    const cards = Array.from(body.querySelectorAll<HTMLElement>('[data-task-id]'))
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) return i
    }
    return filteredTasks.length
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragEnterCountRef.current += 1
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndex(computeDropIndex(e))
  }

  function handleDragLeave() {
    dragEnterCountRef.current -= 1
    if (dragEnterCountRef.current <= 0) {
      dragEnterCountRef.current = 0
      setDropIndex(null)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    // Prevent the drop from bubbling to the column wrapper's onDrop handler,
    // which would otherwise invoke handleColumnDrop and reorder columns.
    e.stopPropagation()
    dragEnterCountRef.current = 0
    setDropIndex(null)

    const taskId = draggedTaskId ?? e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const toIndex = computeDropIndex(e)
    const resolvedFromColumnId = fromColumnId ?? column.id

    // Optimistic update
    dispatch({
      type: 'MOVE_TASK',
      payload: { taskId, fromColumnId: resolvedFromColumnId, toColumnId: column.id, toIndex },
    })
    endDrag()

    // Persist to API (fire-and-forget; undo available via Ctrl+Z)
    try {
      await tasksApi.move(taskId, { toColumnId: column.id, toIndex })
    } catch {
      // Silently ignore — optimistic state stays, user can undo if needed
    }
  }

  const isDropTarget = dropIndex !== null

  const handleRename = async () => {
    const nextTitle = draftTitle.trim()
    if (!nextTitle || nextTitle === column.title) {
      setDraftTitle(column.title)
      setIsEditingTitle(false)
      return
    }
    const response = await columnsApi.rename(column.id, nextTitle)
    dispatch({
      type: 'RENAME_COLUMN',
      payload: { columnId: column.id, title: response.data.title },
    })
    setDraftTitle(response.data.title)
    setIsEditingTitle(false)
  }

  const handleDelete = async () => {
    if (!isManager) return
    const confirmed = window.confirm(
      `Delete column “${column.title}”? This will remove all tasks in it.`,
    )
    if (!confirmed) return
    await columnsApi.delete(column.id)
    dispatch({ type: 'DELETE_COLUMN', payload: { columnId: column.id, boardId: column.boardId } })
  }

  return (
    <section className="board-column" role="list" aria-label={column.title}>
      <header className="board-column__header">
        <div className="board-column__header-main">
          {isEditingTitle ? (
            <input
              className="board-column__title-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                void handleRename()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setDraftTitle(column.title)
                  setIsEditingTitle(false)
                }
              }}
              autoFocus
              aria-label="Rename column"
            />
          ) : (
            <button
              className="board-column__title-button"
              type="button"
              onClick={() => {
                setDraftTitle(column.title)
                setIsEditingTitle(true)
              }}
            >
              <span className="board-column__title">{column.title}</span>
            </button>
          )}
          <Badge label={String(totalTaskCount)} variant="status" />
        </div>

        <div className="board-column__actions">
          <label className="board-column__sort-label">
            <span className="board-column__sort-text">Sort</span>
            <select
              className="board-column__sort-select"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              aria-label={`Sort tasks in ${column.title}`}
            >
              <option value="default">Default</option>
              <option value="priority">Priority</option>
              <option value="dueDate">Due date</option>
              <option value="title">Title</option>
            </select>
          </label>
          {isManager ? (
            <button
              type="button"
              className="board-column__delete"
              onClick={() => {
                void handleDelete()
              }}
              aria-label={`Delete ${column.title}`}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={bodyRef}
        className={`board-column__body${isDropTarget ? ' board-column__body--drop-target' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          void handleDrop(e)
        }}
      >
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task, i) => (
            <div key={task.id} className="board-column__task-slot">
              {dropIndex === i && <div className="drop-indicator" aria-hidden="true" />}
              <div data-task-id={task.id}>
                <TaskCard
                  task={task}
                  userMap={userMap}
                  searchQuery={searchQuery}
                  onTaskClick={onTaskClick}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title={totalTaskCount === 0 ? 'No tasks yet' : 'No matching tasks'}
            description={
              totalTaskCount === 0
                ? 'Add a task to start filling this column.'
                : 'Try a different search or sort option.'
            }
          />
        )}
        {/* Drop indicator at end of list */}
        {dropIndex === filteredTasks.length && filteredTasks.length > 0 && (
          <div className="drop-indicator" aria-hidden="true" />
        )}
      </div>
    </section>
  )
}
