/**
 * BoardPage.tsx
 * Full board experience with board header, columns, and task detail modal.
 */

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { FolderKanban, Plus, Users, Download, Upload } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Column } from '@/components/board/Column'
import { FilterBar } from '@/components/board/FilterBar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBoardContext } from '@/context/BoardContext'
import { FilterProvider, useFilter } from '@/context/FilterContext'
import { DragProvider } from '@/context/DragContext'
import { useSearchContext } from '@/context/SearchContext'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import type { Task, UserMap, Board } from '@/types/entities'
import { boardsApi, columnsApi, usersApi } from '@/utils/api'
import { isTask } from '@/types/entities'
import '@/styles/components/Input.css'
import '@/styles/pages/BoardPage.css'

const TaskDetail = lazy(() => import('./TaskDetail'))

function toUserMap(users: Awaited<ReturnType<typeof usersApi.list>>['data']): UserMap {
  return users.reduce<UserMap>((acc, user) => {
    acc[user.id] = user
    return acc
  }, {})
}

function BoardPageInner() {
  const navigate = useNavigate()
  const { boardId } = useParams<{ boardId?: string }>()
  const { state, dispatch, activeBoard, activeTasks } = useBoardContext()
  const { searchQuery, newBoardDialogOpen, closeNewBoardDialog, openNewBoardDialog } = useSearchContext()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [userMap, setUserMap] = useState<UserMap>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [columnTitle, setColumnTitle] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [newBoardDescription, setNewBoardDescription] = useState('')
  const newBoardDialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Spec: "N" opens new-task form in the first column via a custom event
  const handleNewTask = useCallback(() => {
    window.dispatchEvent(new CustomEvent('kanban:new-task'))
  }, [])
  useKeyboardShortcut({ n: handleNewTask })

  // Spec: arrow-key navigation between task cards on the board
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleArrowNav(e: KeyboardEvent) {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      const focused = document.activeElement as HTMLElement | null
      if (!focused?.closest('[data-task-id]')) return

      e.preventDefault()

      const columns = Array.from(canvas!.querySelectorAll<HTMLElement>('[role="list"]'))
      const colIdx = columns.findIndex((col) => col.contains(focused))
      if (colIdx === -1) return

      const slots = Array.from(columns[colIdx].querySelectorAll<HTMLElement>('[data-task-id]'))
      const taskIdx = slots.findIndex((slot) => slot.contains(focused))

      const focusSlot = (col: HTMLElement, idx: number) => {
        const s = Array.from(col.querySelectorAll<HTMLElement>('[data-task-id]'))
        const target = s[Math.min(idx, s.length - 1)]
        target?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
      }

      if (e.key === 'ArrowDown') {
        slots[taskIdx + 1]?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
      } else if (e.key === 'ArrowUp') {
        slots[taskIdx - 1]?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
      } else if (e.key === 'ArrowRight' && columns[colIdx + 1]) {
        focusSlot(columns[colIdx + 1], taskIdx)
      } else if (e.key === 'ArrowLeft' && columns[colIdx - 1]) {
        focusSlot(columns[colIdx - 1], taskIdx)
      }
    }

    canvas.addEventListener('keydown', handleArrowNav)
    return () => canvas.removeEventListener('keydown', handleArrowNav)
  }, [])

  useEffect(() => {
    let cancelled = false
    usersApi.list().then((response) => {
      if (!cancelled) setUserMap(toUserMap(response.data))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!boardId) return
    dispatch({ type: 'SET_ACTIVE_BOARD', payload: { boardId } })
  }, [boardId, dispatch])

  useEffect(() => {
    if (activeBoard) {
      // Sync draft title only when board changes identity (not every re-render)
      setDraftTitle(activeBoard.title) // eslint-disable-line react-hooks/set-state-in-effect
    }
  // We deliberately reset only on board id change, not every property change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoard?.id])

  useEffect(() => {
    const dialog = newBoardDialogRef.current
    if (!dialog) return
    if (newBoardDialogOpen && !dialog.open) {
      dialog.showModal()
      return
    }
    if (!newBoardDialogOpen && dialog.open) {
      dialog.close()
    }
  }, [newBoardDialogOpen])

  useEffect(() => {
    const dialog = newBoardDialogRef.current
    if (!dialog) return
    const handleClose = () => closeNewBoardDialog()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [closeNewBoardDialog])

  const { filter } = useFilter()

  const tasksByColumn = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const _now = Date.now()

    function matchesFilter(task: Task): boolean {
      if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false
      if (filter.tagIds.length > 0 && !filter.tagIds.some((id) => task.tags.includes(id))) return false
      if (filter.assigneeId !== null && task.assigneeId !== filter.assigneeId) return false
      if (filter.overdueOnly) {
        if (!task.dueDate) return false
        if (new Date(task.dueDate).getTime() >= _now) return false
      }
      if (filter.dueAfter !== null && task.dueDate) {
        if (new Date(task.dueDate) < new Date(filter.dueAfter)) return false
      }
      if (filter.dueBefore !== null && task.dueDate) {
        if (new Date(task.dueDate) > new Date(filter.dueBefore)) return false
      }
      return true
    }

    return activeTasks
      .filter(matchesFilter)
      .reduce<Record<string, Task[]>>((acc, task) => {
        acc[task.columnId] = [...(acc[task.columnId] ?? []), task]
        return acc
      }, {})
  }, [activeTasks, filter])

  const handleRenameBoard = async () => {
    if (!activeBoard) return
    const title = draftTitle.trim()
    if (!title || title === activeBoard.title) {
      setDraftTitle(activeBoard.title)
      setIsEditingTitle(false)
      return
    }
    const response = await boardsApi.rename(activeBoard.id, title)
    dispatch({ type: 'RENAME_BOARD', payload: { boardId: activeBoard.id, title: response.data.title } })
    setDraftTitle(response.data.title)
    setIsEditingTitle(false)
  }

  const handleAddColumn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeBoard) return
    const title = columnTitle.trim()
    if (!title) return
    const response = await columnsApi.create({
      title,
      boardId: activeBoard.id,
      order: activeBoard.columns.length,
    })
    dispatch({ type: 'ADD_COLUMN', payload: response.data })
    setColumnTitle('')
    setIsAddingColumn(false)
  }

  const handleCreateBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newBoardTitle.trim()
    if (!title) return
    const response = await boardsApi.create({
      title,
      description: newBoardDescription.trim() || undefined,
    })
    dispatch({ type: 'ADD_BOARD', payload: response.data })
    setNewBoardTitle('')
    setNewBoardDescription('')
    closeNewBoardDialog()
    navigate(`/boards/${response.data.id}`)
  }

  // ── Export: serialize active board + its tasks to a JSON file ──
  const handleExport = useCallback(() => {
    if (!activeBoard) return
    const tasks = Object.values(state.tasks).filter((t) => t.boardId === activeBoard.id)
    const payload = { board: activeBoard, tasks, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeBoard.title.replace(/\s+/g, '-').toLowerCase()}-export.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeBoard, state.tasks])

  // ── Import: parse JSON file and hydrate board ──
  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target?.result as string) as { board: Board; tasks: unknown[] }
          if (!raw.board?.id || !raw.board?.title) throw new Error('Invalid board JSON')
          const tasks = raw.tasks.filter(isTask)
          dispatch({ type: 'IMPORT_BOARD', payload: { board: raw.board, tasks } })
          navigate(`/boards/${raw.board.id}`)
        } catch {
          // Show an alert — no toast context here since we're inside a file handler
          window.alert('Failed to import: the file does not look like a valid board export.')
        }
      }
      reader.readAsText(file)
      // Reset input so the same file can be re-imported
      event.target.value = ''
    },
    [dispatch, navigate],
  )
  const importInputRef = useRef<HTMLInputElement>(null)

  if (!boardId && state.boards.length > 0) {
    return <Navigate to={`/boards/${state.boards[0].id}`} replace />
  }

  if (!state.isLoading && state.boards.length === 0) {
    return (
      <div className="board-page board-page--empty">
        <EmptyState
          icon={<FolderKanban size={28} aria-hidden="true" />}
          title="No boards yet"
          description="Create your first board to start organizing tasks."
          action={
            <Button variant="primary" onClick={openNewBoardDialog}>
              Create your first board
            </Button>
          }
        />
        <dialog ref={newBoardDialogRef} className="board-page__dialog" aria-label="Create new board">
          <form className="board-page__dialog-form" method="dialog" onSubmit={handleCreateBoard}>
            <h2>Create new board</h2>
            <div className="field">
              <label className="field__label" htmlFor="new-board-title-empty">
                Title
              </label>
              <input
                id="new-board-title-empty"
                className="field__control"
                value={newBoardTitle}
                onChange={(event) => setNewBoardTitle(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="new-board-description-empty">
                Description
              </label>
              <textarea
                id="new-board-description-empty"
                className="field__control board-page__dialog-textarea"
                value={newBoardDescription}
                onChange={(event) => setNewBoardDescription(event.target.value)}
                rows={4}
              />
            </div>
            <div className="board-page__dialog-actions">
              <Button type="submit" variant="primary">
                Create board
              </Button>
              <Button type="button" variant="ghost" onClick={() => newBoardDialogRef.current?.close()}>
                Cancel
              </Button>
            </div>
          </form>
        </dialog>
      </div>
    )
  }

  if (state.isLoading) {
    return (
      <div className="board-page board-page--loading">
        <Skeleton height="2.75rem" width="18rem" />
        <div className="board-page__skeleton-columns">
          <Skeleton className="board-page__column-skeleton" height="24rem" />
          <Skeleton className="board-page__column-skeleton" height="24rem" />
          <Skeleton className="board-page__column-skeleton" height="24rem" />
        </div>
      </div>
    )
  }

  if (!activeBoard) {
    return (
      <div className="board-page board-page--empty">
        <EmptyState
          title="Board not found"
          description="Choose another board from the sidebar."
          action={
            state.boards[0] ? (
              <Button variant="secondary" onClick={() => navigate(`/boards/${state.boards[0].id}`)}>
                Go to first board
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="board-page">
      <header className="board-page__header">
        <div>
          {isEditingTitle ? (
            <input
              className="board-page__title-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => {
                void handleRenameBoard()
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleRenameBoard()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setDraftTitle(activeBoard.title)
                  setIsEditingTitle(false)
                }
              }}
              autoFocus
              aria-label="Rename board"
            />
          ) : (
            <button className="board-page__title-button" type="button" onClick={() => setIsEditingTitle(true)}>
              <h1 className="board-page__title">{activeBoard.title}</h1>
            </button>
          )}
          <p className="board-page__description">{activeBoard.description || 'No board description yet.'}</p>
          <div className="board-page__meta">
            <span className="board-page__meta-item">
              <Users size={14} aria-hidden="true" />
              {activeBoard.memberIds.length} members
            </span>
            {state.error ? <span className="board-page__error">{state.error}</span> : null}
          </div>
        </div>

        <div className="board-page__header-actions">
          {isAddingColumn ? (
            <form className="board-page__column-form" onSubmit={handleAddColumn}>
              <input
                className="field__control board-page__column-input"
                value={columnTitle}
                onChange={(event) => setColumnTitle(event.target.value)}
                placeholder="Column title"
                autoFocus
                aria-label="New column title"
              />
              <Button type="submit" variant="primary" size="sm">
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setColumnTitle('')
                  setIsAddingColumn(false)
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setIsAddingColumn(true)}>
              <Plus size={14} aria-hidden="true" />
              Add Column
            </Button>
          )}
          {/* Export / Import */}
          <Button variant="ghost" size="sm" onClick={handleExport} aria-label="Export board as JSON" title="Export board">
            <Download size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            aria-label="Import board from JSON"
            title="Import board"
          >
            <Upload size={14} aria-hidden="true" />
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            aria-hidden="true"
            onChange={handleImport}
          />
        </div>
      </header>

      <FilterBar boardTags={activeBoard.tags} userMap={userMap} />

      <div className="board-page__canvas" ref={canvasRef} aria-label={`${activeBoard.title} columns`}>
        {activeBoard.columns.map((column, index) => (
          <Column
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] ?? []}
            taskMap={state.tasks}
            userMap={userMap}
            searchQuery={searchQuery}
            onTaskClick={setSelectedTaskId}
            isFirst={index === 0}
          />
        ))}
      </div>

      <dialog ref={newBoardDialogRef} className="board-page__dialog" aria-label="Create new board">
        <form className="board-page__dialog-form" method="dialog" onSubmit={handleCreateBoard}>
          <h2>Create new board</h2>
          <div className="field">
            <label className="field__label" htmlFor="new-board-title">
              Title
            </label>
            <input
              id="new-board-title"
              className="field__control"
              value={newBoardTitle}
              onChange={(event) => setNewBoardTitle(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="new-board-description">
              Description
            </label>
            <textarea
              id="new-board-description"
              className="field__control board-page__dialog-textarea"
              value={newBoardDescription}
              onChange={(event) => setNewBoardDescription(event.target.value)}
              rows={4}
            />
          </div>
          <div className="board-page__dialog-actions">
            <Button type="submit" variant="primary">
              Create board
            </Button>
            <Button type="button" variant="ghost" onClick={() => newBoardDialogRef.current?.close()}>
              Cancel
            </Button>
          </div>
        </form>
      </dialog>

      {selectedTaskId ? (
        <Suspense fallback={<Skeleton className="board-page__modal-skeleton" height="12rem" />}>
          <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
        </Suspense>
      ) : null}
    </div>
  )
}

export function BoardPage() {
  return (
    <FilterProvider>
      <DragProvider>
        <BoardPageInner />
      </DragProvider>
    </FilterProvider>
  )
}
