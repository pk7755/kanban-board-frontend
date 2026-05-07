/**
 * BoardContext.tsx
 * Board state container backed by a reducer plus API hydration.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BoardAction } from '@/types/actions'
import type { Board, Column, CreateBoardInput, CreateColumnInput, CreateTaskInput, Tag, Task, TaskMap } from '@/types/entities'
import { boardsApi, tasksApi, tagsApi } from '@/utils/api'
import { loadState, saveState, STORAGE_VERSION } from '@/utils/storage'

interface BoardState {
  boards: Board[]
  tasks: TaskMap
  activeBoardId: string | null
  isLoading: boolean
  error: string | null
}

interface BoardContextValue {
  state: BoardState
  dispatch: React.Dispatch<BoardAction>
  activeBoard: Board | undefined
  activeTasks: Task[]
  /** Imperatively fetch and hydrate tasks for any board (e.g. on navigation) */
  loadBoardTasks: (boardId: string) => Promise<void>
  /** Undo the last undoable action (MOVE_TASK, DELETE_TASK, UPDATE_TASK) */
  undo: () => void
  /** Redo the last undone action */
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Human-readable description of the action that will be undone, e.g. "Task deleted" */
  lastUndoDescription: string
}

type InternalBoardAction =
  | BoardAction
  | { type: 'HYDRATE_BOARD_TASKS'; payload: { boardId: string; tasks: Task[] } }
  | { type: 'HYDRATE_BOARD_DETAIL'; payload: { boardId: string; columns: Column[]; tags: Tag[] } }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'SET_ACTIVE_BOARD_ID'; payload: { boardId: string | null } }
  | { type: 'RESTORE_SNAPSHOT'; payload: BoardState }

/** Actions that are undoable — max history 20 (per spec) */
const UNDOABLE_ACTIONS = new Set<BoardAction['type']>(['MOVE_TASK', 'DELETE_TASK', 'UPDATE_TASK'])

const UNDO_DESCRIPTIONS: Partial<Record<BoardAction['type'], string>> = {
  MOVE_TASK: 'Task moved',
  DELETE_TASK: 'Task deleted',
  UPDATE_TASK: 'Task updated',
}

const MAX_UNDO_HISTORY = 20

const BoardContext = createContext<BoardContextValue | null>(null)

function sortColumns(columns: Column[]): Column[] {
  return [...columns].sort((left, right) => left.order - right.order)
}

function buildBoard(payload: CreateBoardInput & { id: string; ownerId: string }): Board {
  const candidate = payload as Partial<Board>
  const now = new Date().toISOString()
  return {
    id: payload.id,
    title: payload.title,
    description: payload.description,
    columns: sortColumns(Array.isArray(candidate.columns) ? candidate.columns : []),
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    memberIds: Array.isArray(candidate.memberIds) ? candidate.memberIds : [],
    ownerId: payload.ownerId,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
  }
}

function buildColumn(payload: CreateColumnInput & { id: string }): Column {
  const candidate = payload as Partial<Column>
  return {
    id: payload.id,
    title: payload.title,
    order: payload.order,
    boardId: payload.boardId,
    taskIds: Array.isArray(candidate.taskIds) ? [...candidate.taskIds] : [],
  }
}

function buildTask(payload: CreateTaskInput & { id: string }, fallbackOrder: number): Task {
  const candidate = payload as Partial<Task>
  const now = new Date().toISOString()
  return {
    id: payload.id,
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    dueDate: payload.dueDate,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    assigneeId: payload.assigneeId,
    checklist: Array.isArray(payload.checklist) ? payload.checklist : [],
    archived: typeof candidate.archived === 'boolean' ? candidate.archived : false,
    order: typeof candidate.order === 'number' ? candidate.order : fallbackOrder,
    columnId: payload.columnId,
    boardId: payload.boardId,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
  }
}

function updateBoard(
  boards: Board[],
  boardId: string,
  updater: (board: Board) => Board,
): Board[] {
  return boards.map((board) => (board.id === boardId ? updater(board) : board))
}

function removeTaskId(taskIds: string[], taskId: string): string[] {
  return taskIds.filter((candidate) => candidate !== taskId)
}

function hydrateBoardTasks(state: BoardState, boardId: string, tasks: Task[]): BoardState {
  const nextTasks = Object.fromEntries(
    Object.entries(state.tasks).filter(([, task]) => task.boardId !== boardId),
  ) as TaskMap

  for (const task of tasks) {
    nextTasks[task.id] = task
  }

  const groupedByColumn = new Map<string, string[]>()
  tasks
    .slice()
    .sort((left, right) => left.order - right.order)
    .forEach((task) => {
      const existing = groupedByColumn.get(task.columnId) ?? []
      existing.push(task.id)
      groupedByColumn.set(task.columnId, existing)
    })

  return {
    ...state,
    boards: updateBoard(state.boards, boardId, (board) => ({
      ...board,
      columns: sortColumns(board.columns).map((column) => ({
        ...column,
        taskIds: groupedByColumn.get(column.id) ?? [],
      })),
    })),
    tasks: nextTasks,
  }
}

function boardReducer(state: BoardState, action: InternalBoardAction): BoardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload.isLoading }
    case 'SET_ERROR':
      return { ...state, error: action.payload.error }
    case 'SET_ACTIVE_BOARD_ID':
      return { ...state, activeBoardId: action.payload.boardId }
    case 'HYDRATE_BOARD_TASKS':
      return hydrateBoardTasks(state, action.payload.boardId, action.payload.tasks)
    case 'HYDRATE_BOARD_DETAIL':
      return {
        ...state,
        boards: state.boards.map((board) =>
          board.id === action.payload.boardId
            ? {
                ...board,
                columns: sortColumns(action.payload.columns).map((col) => ({
                  ...col,
                  taskIds: board.columns.find((c) => c.id === col.id)?.taskIds ?? [],
                })),
                tags: action.payload.tags,
              }
            : board,
        ),
      }
    case 'SET_BOARDS': {
      return {
        ...state,
        boards: action.payload.boards.map((board) => ({
          ...board,
          columns: sortColumns(board.columns).map((column) => ({
            ...column,
            taskIds: Array.isArray(column.taskIds) ? [...column.taskIds] : [],
          })),
        })),
        isLoading: false,
        error: null,
      }
    }
    case 'SET_ACTIVE_BOARD':
      return { ...state, activeBoardId: action.payload.boardId }
    case 'ADD_BOARD': {
      const board = buildBoard(action.payload)
      return {
        ...state,
        boards: [...state.boards, board],
      }
    }
    case 'RENAME_BOARD':
      return {
        ...state,
        boards: state.boards.map((board) =>
          board.id === action.payload.boardId
            ? { ...board, title: action.payload.title, updatedAt: new Date().toISOString() }
            : board,
        ),
      }
    case 'DELETE_BOARD': {
      const remainingBoards = state.boards.filter((board) => board.id !== action.payload.boardId)
      const remainingTasks = Object.fromEntries(
        Object.entries(state.tasks).filter(([, task]) => task.boardId !== action.payload.boardId),
      ) as TaskMap
      return {
        ...state,
        boards: remainingBoards,
        tasks: remainingTasks,
        activeBoardId:
          state.activeBoardId === action.payload.boardId ? (remainingBoards[0]?.id ?? null) : state.activeBoardId,
      }
    }
    case 'ADD_COLUMN': {
      const column = buildColumn(action.payload)
      return {
        ...state,
        boards: updateBoard(state.boards, column.boardId, (board) => ({
          ...board,
          columns: sortColumns([...board.columns, column]),
          updatedAt: new Date().toISOString(),
        })),
      }
    }
    case 'RENAME_COLUMN':
      return {
        ...state,
        boards: state.boards.map((board) => ({
          ...board,
          columns: board.columns.map((column) =>
            column.id === action.payload.columnId ? { ...column, title: action.payload.title } : column,
          ),
        })),
      }
    case 'DELETE_COLUMN': {
      const columnTaskIds = new Set(
        state.boards
          .find((board) => board.id === action.payload.boardId)
          ?.columns.find((column) => column.id === action.payload.columnId)
          ?.taskIds ?? [],
      )
      const nextTasks = Object.fromEntries(
        Object.entries(state.tasks).filter(([taskId, task]) => {
          return task.columnId !== action.payload.columnId && !columnTaskIds.has(taskId)
        }),
      ) as TaskMap

      return {
        ...state,
        boards: updateBoard(state.boards, action.payload.boardId, (board) => ({
          ...board,
          columns: board.columns.filter((column) => column.id !== action.payload.columnId),
          updatedAt: new Date().toISOString(),
        })),
        tasks: nextTasks,
      }
    }
    case 'REORDER_COLUMNS':
      return {
        ...state,
        boards: updateBoard(state.boards, action.payload.boardId, (board) => {
          const byId = new Map(board.columns.map((column) => [column.id, column]))
          return {
            ...board,
            columns: action.payload.columnIds
              .map((columnId, index) => {
                const column = byId.get(columnId)
                return column ? { ...column, order: index } : null
              })
              .filter((column): column is Column => column !== null),
            updatedAt: new Date().toISOString(),
          }
        }),
      }
    case 'ADD_TASK': {
      const board = state.boards.find((candidate) => candidate.id === action.payload.boardId)
      const column = board?.columns.find((candidate) => candidate.id === action.payload.columnId)
      const task = buildTask(action.payload, column?.taskIds.length ?? 0)
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: task },
        boards: updateBoard(state.boards, task.boardId, (currentBoard) => ({
          ...currentBoard,
          columns: currentBoard.columns.map((currentColumn) =>
            currentColumn.id === task.columnId
              ? { ...currentColumn, taskIds: [...currentColumn.taskIds, task.id] }
              : currentColumn,
          ),
          updatedAt: new Date().toISOString(),
        })),
      }
    }
    case 'UPDATE_TASK': {
      const currentTask = state.tasks[action.payload.taskId]
      if (!currentTask) return state
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [action.payload.taskId]: {
            ...currentTask,
            ...action.payload,
            updatedAt: new Date().toISOString(),
          },
        },
      }
    }
    case 'DELETE_TASK': {
      const nextTasks = { ...state.tasks }
      delete nextTasks[action.payload.taskId]
      const boardId = state.tasks[action.payload.taskId]?.boardId
      return {
        ...state,
        tasks: nextTasks,
        boards: boardId
          ? updateBoard(state.boards, boardId, (board) => ({
              ...board,
              columns: board.columns.map((column) =>
                column.id === action.payload.columnId
                  ? { ...column, taskIds: removeTaskId(column.taskIds, action.payload.taskId) }
                  : column,
              ),
            }))
          : state.boards,
      }
    }
    case 'ARCHIVE_TASK': {
      const currentTask = state.tasks[action.payload.taskId]
      if (!currentTask) return state
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [action.payload.taskId]: { ...currentTask, archived: true, updatedAt: new Date().toISOString() },
        },
      }
    }
    case 'MOVE_TASK': {
      const task = state.tasks[action.payload.taskId]
      if (!task) return state
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [task.id]: {
            ...task,
            columnId: action.payload.toColumnId,
            order: action.payload.toIndex,
            updatedAt: new Date().toISOString(),
          },
        },
        boards: updateBoard(state.boards, task.boardId, (board) => ({
          ...board,
          columns: board.columns.map((column) => {
            if (column.id === action.payload.fromColumnId) {
              return { ...column, taskIds: removeTaskId(column.taskIds, task.id) }
            }
            if (column.id === action.payload.toColumnId) {
              const nextTaskIds = removeTaskId(column.taskIds, task.id)
              nextTaskIds.splice(action.payload.toIndex, 0, task.id)
              return { ...column, taskIds: nextTaskIds }
            }
            return column
          }),
        })),
      }
    }
    case 'REORDER_TASKS': {
      const boardId = state.tasks[action.payload.taskIds[0]]?.boardId
      if (!boardId) {
        const locatedBoard = state.boards.find((board) =>
          board.columns.some((column) => column.id === action.payload.columnId),
        )
        if (!locatedBoard) return state
        return {
          ...state,
          boards: updateBoard(state.boards, locatedBoard.id, (board) => ({
            ...board,
            columns: board.columns.map((column) =>
              column.id === action.payload.columnId ? { ...column, taskIds: [...action.payload.taskIds] } : column,
            ),
          })),
        }
      }
      return {
        ...state,
        boards: updateBoard(state.boards, boardId, (board) => ({
          ...board,
          columns: board.columns.map((column) =>
            column.id === action.payload.columnId ? { ...column, taskIds: [...action.payload.taskIds] } : column,
          ),
        })),
      }
    }
    case 'ADD_TAG':
      return {
        ...state,
        boards: updateBoard(state.boards, action.payload.boardId, (board) => ({
          ...board,
          tags: [...board.tags, action.payload.tag],
          updatedAt: new Date().toISOString(),
        })),
      }
    case 'DELETE_TAG':
      return {
        ...state,
        boards: updateBoard(state.boards, action.payload.boardId, (board) => ({
          ...board,
          tags: board.tags.filter((tag) => tag.id !== action.payload.tagId),
          updatedAt: new Date().toISOString(),
        })),
      }
    case 'IMPORT_BOARD': {
      const nextBoard = buildBoard(action.payload.board as CreateBoardInput & { id: string; ownerId: string })
      const mergedTasks = { ...state.tasks }
      action.payload.tasks.forEach((task) => {
        mergedTasks[task.id] = task
      })
      const existingIndex = state.boards.findIndex((board) => board.id === nextBoard.id)
      const boards = [...state.boards]
      if (existingIndex >= 0) {
        boards[existingIndex] = nextBoard
      } else {
        boards.push(nextBoard)
      }
      return {
        ...state,
        boards,
        tasks: mergedTasks,
      }
    }
    case 'RESTORE_SNAPSHOT':
      return { ...action.payload }
    default:
      return state
  }
}

function createInitialState(): BoardState {
  const stored = loadState()
  return {
    boards: stored?.boards ?? [],
    tasks: stored?.tasks ?? {},
    activeBoardId: stored?.activeBoardId ?? null,
    isLoading: true,
    error: null,
  }
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, internalDispatch] = useReducer(boardReducer, undefined, createInitialState)

  useEffect(() => {
    let cancelled = false

    async function loadBoards() {
      internalDispatch({ type: 'SET_LOADING', payload: { isLoading: true } })
      internalDispatch({ type: 'SET_ERROR', payload: { error: null } })

      try {
        const response = await boardsApi.list()
        if (cancelled) return
        const boards = response.data.map((board) => ({
          ...board,
          columns: sortColumns(board.columns).map((column) => ({ ...column, taskIds: [] })),
        }))
        internalDispatch({ type: 'SET_BOARDS', payload: { boards } })

        const nextActiveBoardId = boards.some((board) => board.id === state.activeBoardId)
          ? state.activeBoardId
          : (boards[0]?.id ?? null)

        internalDispatch({ type: 'SET_ACTIVE_BOARD_ID', payload: { boardId: nextActiveBoardId } })
        if (!nextActiveBoardId) {
          internalDispatch({ type: 'SET_LOADING', payload: { isLoading: false } })
        }
      } catch {
        if (cancelled) return
        internalDispatch({ type: 'SET_ERROR', payload: { error: 'Unable to load boards.' } })
        internalDispatch({ type: 'SET_LOADING', payload: { isLoading: false } })
      }
    }

    void loadBoards()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadBoardTasks = useCallback(async (boardId: string) => {
    internalDispatch({ type: 'SET_LOADING', payload: { isLoading: true } })
    internalDispatch({ type: 'SET_ERROR', payload: { error: null } })
    try {
      // Fetch board detail (columns + members), tasks, and tags concurrently
      const [boardDetail, tasksResponse, tagsResponse] = await Promise.all([
        boardsApi.get(boardId),
        tasksApi.list({ boardId, limit: 500 }),
        tagsApi.list(boardId),
      ])
      internalDispatch({
        type: 'HYDRATE_BOARD_DETAIL',
        payload: { boardId, columns: boardDetail.data.columns, tags: tagsResponse.data },
      })
      internalDispatch({ type: 'HYDRATE_BOARD_TASKS', payload: { boardId, tasks: tasksResponse.data } })
    } catch {
      internalDispatch({ type: 'SET_ERROR', payload: { error: 'Unable to load board tasks.' } })
    } finally {
      internalDispatch({ type: 'SET_LOADING', payload: { isLoading: false } })
    }
  }, [])

  useEffect(() => {
    if (!state.activeBoardId) return
    void loadBoardTasks(state.activeBoardId)
  }, [state.activeBoardId, loadBoardTasks])

  useEffect(() => {
    saveState({
      version: STORAGE_VERSION,
      boards: state.boards,
      tasks: state.tasks,
      activeBoardId: state.activeBoardId,
    })
  }, [state.activeBoardId, state.boards, state.tasks])

  // Always-fresh ref to current state — lets undo/redo callbacks read it without deps
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // Undo/redo stacks — each entry is a { snapshot, description } pair
  interface HistoryEntry { snapshot: BoardState; description: string }
  const undoStackRef = useRef<HistoryEntry[]>([])
  const redoStackRef = useRef<HistoryEntry[]>([])
  // Track flags as real state so they can be read during render without accessing refs
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [lastUndoDescription, setLastUndoDescription] = useState('')

  const syncFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(redoStackRef.current.length > 0)
    setLastUndoDescription(undoStackRef.current.at(-1)?.description ?? '')
  }, [])

  const dispatch = useCallback<React.Dispatch<BoardAction>>(
    (action) => {
      if (UNDOABLE_ACTIONS.has(action.type)) {
        const entry: HistoryEntry = {
          snapshot: stateRef.current,
          description: UNDO_DESCRIPTIONS[action.type] ?? 'Action',
        }
        undoStackRef.current = [
          ...undoStackRef.current.slice(-MAX_UNDO_HISTORY + 1),
          entry,
        ]
        redoStackRef.current = [] // clear redo on new action
        syncFlags()
      }
      internalDispatch(action)
    },
    [syncFlags],
  )

  const undo = useCallback(() => {
    const entry = undoStackRef.current.at(-1)
    if (!entry) return
    redoStackRef.current = [
      { snapshot: stateRef.current, description: entry.description },
      ...redoStackRef.current,
    ]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    syncFlags()
    internalDispatch({ type: 'RESTORE_SNAPSHOT', payload: entry.snapshot })
  }, [syncFlags])

  const redo = useCallback(() => {
    const entry = redoStackRef.current[0]
    if (!entry) return
    undoStackRef.current = [
      ...undoStackRef.current.slice(-MAX_UNDO_HISTORY + 1),
      { snapshot: stateRef.current, description: entry.description },
    ]
    redoStackRef.current = redoStackRef.current.slice(1)
    syncFlags()
    internalDispatch({ type: 'RESTORE_SNAPSHOT', payload: entry.snapshot })
  }, [syncFlags])

  const activeBoard = useMemo(
    () => state.boards.find((board) => board.id === state.activeBoardId),
    [state.activeBoardId, state.boards],
  )

  const activeTasks = useMemo(() => {
    if (!activeBoard) return []
    return activeBoard.columns.flatMap((column) =>
      column.taskIds
        .map((taskId) => state.tasks[taskId])
        .filter((task): task is Task => Boolean(task)),
    )
  }, [activeBoard, state.tasks])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      activeBoard,
      activeTasks,
      loadBoardTasks,
      undo,
      redo,
      canUndo,
      canRedo,
      lastUndoDescription,
    }),
    [activeBoard, activeTasks, canUndo, canRedo, dispatch, lastUndoDescription, loadBoardTasks, redo, state, undo],
  )

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

export function useBoardContext(): BoardContextValue {
  const context = useContext(BoardContext)
  if (!context) throw new Error('useBoardContext must be used inside BoardProvider')
  return context
}
