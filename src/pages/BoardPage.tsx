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
import { FolderKanban, Plus, Tag, Users, Download, Upload } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Column } from '@/components/board/Column'
import { BoardMembersModal } from '@/components/board/BoardMembersModal'
import { ManageTagsModal } from '@/components/board/ManageTagsModal'
import { CreateTaskModal } from '@/components/board/CreateTaskModal'
import { FilterBar } from '@/components/board/FilterBar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useBoardContext } from '@/context/BoardContext'
import { FilterProvider, useFilter } from '@/context/FilterContext'
import { DragProvider } from '@/context/DragContext'
import { useSearchContext } from '@/context/SearchContext'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { useAuth } from '@/context/AuthContext'
import type { Task, UserMap, Board } from '@/types/entities'
import { boardsApi, boardMembersApi, columnsApi, usersApi } from '@/utils/api'
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
  const { state: authState } = useAuth()
  const { state, dispatch, activeBoard, activeTasks, retryLoadBoards, loadBoardTasks } =
    useBoardContext()
  const { searchQuery, newBoardDialogOpen, closeNewBoardDialog, openNewBoardDialog } =
    useSearchContext()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const handleCloseTaskDetail = useCallback(() => setSelectedTaskId(null), [])
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | null>(null)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [userMap, setUserMap] = useState<UserMap>({})
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [columnTitle, setColumnTitle] = useState('')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [newBoardDescription, setNewBoardDescription] = useState('')
  const newBoardDialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showTagsModal, setShowTagsModal] = useState(false)

  const currentUserId = authState.user?.id ?? ''
  const isManager = authState.user?.role === 'MANAGER'

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

  const { filter, pruneAssigneeIds } = useFilter()

  const tasksByColumn = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()

    function matchesFilter(task: Task): boolean {
      // ── Priority (OR within priorities) ──
      if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) return false

      // ── Tags (OR within tags) ──
      if (
        filter.tagIds.length > 0 &&
        !filter.tagIds.some((id) => task.tags.some((t) => t.id === id))
      )
        return false

      // ── Assignee (multi-select — OR logic) ──
      if (filter.assigneeIds.length > 0) {
        const matchesUnassigned = filter.assigneeIds.includes('__unassigned__') && !task.assigneeId
        const matchesMember = task.assigneeId && filter.assigneeIds.includes(task.assigneeId)
        if (!matchesUnassigned && !matchesMember) return false
      }

      // ── Status / Column (OR within columns) ──
      if (filter.columnIds.length > 0 && !filter.columnIds.includes(task.columnId)) return false

      // ── Overdue only ──
      if (filter.overdueOnly) {
        if (!task.dueDate) return false
        if (new Date(task.dueDate).getTime() >= now) return false
      }

      // ── Date range ──
      const anyDateRange = filter.dueAfter !== null || filter.dueBefore !== null
      if (anyDateRange) {
        if (!task.dueDate) return false
        const due = new Date(task.dueDate).getTime()
        if (filter.dueAfter !== null && due < new Date(filter.dueAfter).getTime()) return false
        if (filter.dueBefore !== null && due > new Date(filter.dueBefore).getTime()) return false
      }

      return true
    }

    return activeTasks.filter(matchesFilter).reduce<Record<string, Task[]>>((acc, task) => {
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
    dispatch({
      type: 'RENAME_BOARD',
      payload: { boardId: activeBoard.id, title: response.data.title },
    })
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

  const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done']

  const handleCreateBoard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newBoardTitle.trim()
    if (!title) return
    const response = await boardsApi.create({
      title,
      description: newBoardDescription.trim() || undefined,
    })
    const board = response.data

    // Create the 4 default columns in parallel
    const columnResponses = await Promise.all(
      DEFAULT_COLUMNS.map((colTitle, i) =>
        columnsApi.create({ title: colTitle, boardId: board.id, order: i }),
      ),
    )
    const boardWithColumns = {
      ...board,
      columns: columnResponses.map((r) => r.data),
    }

    dispatch({ type: 'ADD_BOARD', payload: boardWithColumns })
    setNewBoardTitle('')
    setNewBoardDescription('')
    closeNewBoardDialog()
    navigate(`/boards/${board.id}`)
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

  // ── Column drag-and-drop reordering ──
  const draggingOverColumnId = useRef<string | null>(null)

  const handleColumnDragStart = useCallback((columnId: string) => {
    setDraggingColumnId(columnId)
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    draggingOverColumnId.current = columnId
  }, [])

  const handleColumnDrop = useCallback(async () => {
    if (!activeBoard || !draggingColumnId || !draggingOverColumnId.current) {
      setDraggingColumnId(null)
      return
    }
    const fromId = draggingColumnId
    const toId = draggingOverColumnId.current
    if (fromId === toId) {
      setDraggingColumnId(null)
      return
    }
    const columns = [...activeBoard.columns]
    const fromIndex = columns.findIndex((c) => c.id === fromId)
    const toIndex = columns.findIndex((c) => c.id === toId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingColumnId(null)
      return
    }
    // Optimistic reorder
    const reordered = [...columns]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const columnIds = reordered.map((c) => c.id)
    dispatch({ type: 'REORDER_COLUMNS', payload: { boardId: activeBoard.id, columnIds } })
    setDraggingColumnId(null)
    draggingOverColumnId.current = null
    try {
      await columnsApi.reorder(activeBoard.id, columnIds)
    } catch {
      // Revert on failure
      dispatch({
        type: 'REORDER_COLUMNS',
        payload: { boardId: activeBoard.id, columnIds: columns.map((c) => c.id) },
      })
    }
  }, [activeBoard, draggingColumnId, dispatch])

  const handleAddMember = useCallback(
    async (email: string) => {
      if (!activeBoard) return
      await boardMembersApi.add(activeBoard.id, email)
      // Reload board detail to get fresh member list
      const detail = await boardsApi.get(activeBoard.id)
      dispatch({
        type: 'UPDATE_BOARD_MEMBERS',
        payload: {
          boardId: activeBoard.id,
          memberIds: detail.data.memberIds as string[],
          members: (detail.data.members ?? []) as import('@/types/entities').BoardMember[],
        },
      })
    },
    [activeBoard, dispatch],
  )

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!activeBoard) return
      await boardMembersApi.remove(activeBoard.id, userId)
      const remainingMembers = (activeBoard.members ?? []).filter((m) => m.userId !== userId)
      // Optimistic update
      dispatch({
        type: 'UPDATE_BOARD_MEMBERS',
        payload: {
          boardId: activeBoard.id,
          memberIds: activeBoard.memberIds.filter((id) => id !== userId) as string[],
          members: remainingMembers as import('@/types/entities').BoardMember[],
        },
      })
      // Remove the deleted member from active assignee filters
      pruneAssigneeIds(remainingMembers.map((m) => m.userId))
    },
    [activeBoard, dispatch, pruneAssigneeIds],
  )

  if (!boardId && state.boards.length > 0) {
    return <Navigate to={`/boards/${state.boards[0].id}`} replace />
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

  if (state.error && state.boards.length === 0) {
    return (
      <div className="board-page board-page--empty">
        <EmptyState
          icon={<FolderKanban size={28} aria-hidden="true" />}
          title="Failed to load boards"
          description={state.error}
          action={
            <Button variant="primary" onClick={() => void retryLoadBoards()}>
              Retry
            </Button>
          }
        />
      </div>
    )
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
        <dialog
          ref={newBoardDialogRef}
          className="board-page__dialog"
          aria-label="Create new board"
        >
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => newBoardDialogRef.current?.close()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </dialog>
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
            <button
              className="board-page__title-button"
              type="button"
              onClick={() => setIsEditingTitle(true)}
            >
              <h1 className="board-page__title">{activeBoard.title}</h1>
            </button>
          )}
          <p className="board-page__description">
            {activeBoard.description || 'No board description yet.'}
          </p>
          <div className="board-page__meta">
            <button
              type="button"
              className="board-page__meta-item board-page__meta-item--clickable"
              onClick={() => setShowMembersModal(true)}
              aria-label={`${activeBoard.memberIds.length} members — click to manage`}
            >
              <Users size={14} aria-hidden="true" />
              {activeBoard.memberIds.length}{' '}
              {activeBoard.memberIds.length === 1 ? 'member' : 'members'}
            </button>
            <button
              type="button"
              className="board-page__meta-item board-page__meta-item--clickable"
              onClick={() => setShowTagsModal(true)}
              aria-label={`${activeBoard.tags.length} tags — click to manage`}
            >
              <Tag size={14} aria-hidden="true" />
              {activeBoard.tags.length} {activeBoard.tags.length === 1 ? 'tag' : 'tags'}
            </button>
            {state.error ? (
              <span className="board-page__error">
                {state.error}
                <button
                  type="button"
                  className="board-page__retry-btn"
                  onClick={() => void loadBoardTasks(activeBoard.id)}
                >
                  Retry
                </button>
              </span>
            ) : null}
          </div>
        </div>

        <div className="board-page__header-actions">
          {/* Global Create Task button */}
          {activeBoard.columns.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateTaskColumnId(activeBoard.columns[0].id)}
              aria-label="Create new task"
            >
              <Plus size={14} aria-hidden="true" />
              Create Task
            </Button>
          ) : null}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            aria-label="Export board as JSON"
            title="Export board"
          >
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

      <FilterBar
        boardMembers={activeBoard.members ?? []}
        boardTags={activeBoard.tags}
        boardColumns={(activeBoard.columns ?? []).slice().sort((a, b) => a.order - b.order)}
      />

      <div
        className="board-page__canvas"
        ref={canvasRef}
        aria-label={`${activeBoard.title} columns`}
      >
        {activeBoard.columns.map((column, index) => (
          <div
            key={column.id}
            draggable
            onDragStart={() => handleColumnDragStart(column.id)}
            onDragOver={(e) => handleColumnDragOver(e, column.id)}
            onDrop={handleColumnDrop}
            onDragEnd={() => setDraggingColumnId(null)}
            style={{
              opacity: draggingColumnId === column.id ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <Column
              column={column}
              tasks={tasksByColumn[column.id] ?? []}
              taskMap={state.tasks}
              userMap={userMap}
              searchQuery={searchQuery}
              onTaskClick={setSelectedTaskId}
              onAddTask={setCreateTaskColumnId}
              isFirst={index === 0}
            />
          </div>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => newBoardDialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>

      {selectedTaskId ? (
        <Suspense fallback={<Skeleton className="board-page__modal-skeleton" height="12rem" />}>
          <TaskDetail
            key={selectedTaskId}
            taskId={selectedTaskId}
            onClose={handleCloseTaskDetail}
          />
        </Suspense>
      ) : null}

      {createTaskColumnId && activeBoard ? (
        <CreateTaskModal
          key={createTaskColumnId}
          columnId={createTaskColumnId}
          boardId={activeBoard.id}
          onClose={() => setCreateTaskColumnId(null)}
          onCreated={(task) => {
            setCreateTaskColumnId(null)
            setSelectedTaskId(task.id)
          }}
        />
      ) : null}

      {showMembersModal && activeBoard && (
        <BoardMembersModal
          boardId={activeBoard.id}
          ownerId={activeBoard.ownerId}
          currentUserId={currentUserId}
          isManager={isManager}
          members={activeBoard.members ?? []}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      {showTagsModal && activeBoard && (
        <ManageTagsModal boardId={activeBoard.id} onClose={() => setShowTagsModal(false)} />
      )}
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
