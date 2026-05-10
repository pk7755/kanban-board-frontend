/**
 * boardReducer.test.ts
 *
 * Unit tests for the board reducer — the core state machine of the app.
 * Covers board CRUD, column CRUD, task CRUD, task movement, and tag management.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { boardReducer, type BoardState } from '@/context/BoardContext'
import type { Board, Column, Task, Tag } from '@/types/entities'

/* ─── Test fixtures ──────────────────────────────────────────────── */

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    title: 'Test Board',
    description: '',
    columns: [],
    tags: [],
    memberIds: [],
    ownerId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col-1',
    title: 'To Do',
    order: 0,
    boardId: 'board-1',
    taskIds: [],
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    priority: 'medium',
    tags: [],
    checklist: [],
    archived: false,
    order: 0,
    columnId: 'col-1',
    boardId: 'board-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: 'tag-1', label: 'Bug', color: '#ef4444', ...overrides }
}

function makeInitialState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    boards: [],
    tasks: {},
    activeBoardId: null,
    isLoading: false,
    error: null,
    ...overrides,
  }
}

/* ─── Board actions ──────────────────────────────────────────────── */

describe('boardReducer — Board', () => {
  it('ADD_BOARD: adds a new board to the list', () => {
    const state = makeInitialState()
    const next = boardReducer(state, {
      type: 'ADD_BOARD',
      payload: { id: 'board-1', title: 'Sprint 1', ownerId: 'user-1' },
    })
    expect(next.boards).toHaveLength(1)
    expect(next.boards[0].id).toBe('board-1')
    expect(next.boards[0].title).toBe('Sprint 1')
  })

  it('ADD_BOARD: initialises with empty columns, tags, and memberIds', () => {
    const state = makeInitialState()
    const next = boardReducer(state, {
      type: 'ADD_BOARD',
      payload: { id: 'b1', title: 'New Board', ownerId: 'u1' },
    })
    expect(next.boards[0].columns).toEqual([])
    expect(next.boards[0].tags).toEqual([])
    expect(next.boards[0].memberIds).toEqual([])
  })

  it('RENAME_BOARD: updates only the matching board title', () => {
    const state = makeInitialState({
      boards: [
        makeBoard({ id: 'board-1', title: 'Old Title' }),
        makeBoard({ id: 'board-2', title: 'Keep Me' }),
      ],
    })
    const next = boardReducer(state, {
      type: 'RENAME_BOARD',
      payload: { boardId: 'board-1', title: 'New Title' },
    })
    expect(next.boards.find((b) => b.id === 'board-1')?.title).toBe('New Title')
    expect(next.boards.find((b) => b.id === 'board-2')?.title).toBe('Keep Me')
  })

  it('DELETE_BOARD: removes the board and its tasks', () => {
    const col = makeColumn()
    const task = makeTask({ id: 'task-1', boardId: 'board-1', columnId: 'col-1' })
    const state = makeInitialState({
      boards: [makeBoard({ columns: [col] })],
      tasks: { 'task-1': task },
      activeBoardId: 'board-1',
    })
    const next = boardReducer(state, {
      type: 'DELETE_BOARD',
      payload: { boardId: 'board-1' },
    })
    expect(next.boards).toHaveLength(0)
    expect(next.tasks['task-1']).toBeUndefined()
  })

  it('DELETE_BOARD: falls back activeBoardId to the next available board', () => {
    const state = makeInitialState({
      boards: [makeBoard({ id: 'board-1' }), makeBoard({ id: 'board-2' })],
      activeBoardId: 'board-1',
    })
    const next = boardReducer(state, {
      type: 'DELETE_BOARD',
      payload: { boardId: 'board-1' },
    })
    expect(next.activeBoardId).toBe('board-2')
  })
})

/* ─── Column actions ─────────────────────────────────────────────── */

describe('boardReducer — Column', () => {
  let stateWithBoard: BoardState

  beforeEach(() => {
    stateWithBoard = makeInitialState({ boards: [makeBoard()] })
  })

  it('ADD_COLUMN: adds a column to the correct board', () => {
    const next = boardReducer(stateWithBoard, {
      type: 'ADD_COLUMN',
      payload: { id: 'col-new', title: 'In Progress', order: 0, boardId: 'board-1' },
    })
    const board = next.boards.find((b) => b.id === 'board-1')
    expect(board?.columns).toHaveLength(1)
    expect(board?.columns[0].id).toBe('col-new')
  })

  it('RENAME_COLUMN: updates only the matching column title', () => {
    const col1 = makeColumn({ id: 'col-1', title: 'To Do' })
    const col2 = makeColumn({ id: 'col-2', title: 'Done' })
    const state = makeInitialState({ boards: [makeBoard({ columns: [col1, col2] })] })
    const next = boardReducer(state, {
      type: 'RENAME_COLUMN',
      payload: { columnId: 'col-1', title: 'Backlog' },
    })
    const board = next.boards[0]
    expect(board.columns.find((c) => c.id === 'col-1')?.title).toBe('Backlog')
    expect(board.columns.find((c) => c.id === 'col-2')?.title).toBe('Done')
  })

  it('DELETE_COLUMN: removes column and its tasks from state', () => {
    const col = makeColumn({ id: 'col-1', taskIds: ['task-1'] })
    const task = makeTask({ id: 'task-1', columnId: 'col-1' })
    const state = makeInitialState({
      boards: [makeBoard({ columns: [col] })],
      tasks: { 'task-1': task },
    })
    const next = boardReducer(state, {
      type: 'DELETE_COLUMN',
      payload: { columnId: 'col-1', boardId: 'board-1' },
    })
    const board = next.boards[0]
    expect(board.columns).toHaveLength(0)
    expect(next.tasks['task-1']).toBeUndefined()
  })
})

/* ─── Task actions ───────────────────────────────────────────────── */

describe('boardReducer — Task', () => {
  let stateWithTask: BoardState

  beforeEach(() => {
    const col = makeColumn({ taskIds: ['task-1'] })
    const task = makeTask()
    stateWithTask = makeInitialState({
      boards: [makeBoard({ columns: [col] })],
      tasks: { 'task-1': task },
    })
  })

  it('ADD_TASK: adds task to state and appends taskId to column', () => {
    const state = makeInitialState({ boards: [makeBoard({ columns: [makeColumn()] })] })
    const next = boardReducer(state, {
      type: 'ADD_TASK',
      payload: {
        id: 'task-new',
        title: 'New Task',
        description: '',
        priority: 'low',
        tags: [],
        checklist: [],
        columnId: 'col-1',
        boardId: 'board-1',
      },
    })
    expect(next.tasks['task-new']).toBeDefined()
    expect(next.tasks['task-new'].title).toBe('New Task')
    const col = next.boards[0].columns.find((c) => c.id === 'col-1')
    expect(col?.taskIds).toContain('task-new')
  })

  it('UPDATE_TASK: merges fields without changing boardId', () => {
    const next = boardReducer(stateWithTask, {
      type: 'UPDATE_TASK',
      payload: { taskId: 'task-1', title: 'Updated Title', priority: 'high' },
    })
    expect(next.tasks['task-1'].title).toBe('Updated Title')
    expect(next.tasks['task-1'].priority).toBe('high')
    expect(next.tasks['task-1'].boardId).toBe('board-1')
  })

  it('UPDATE_TASK: is a no-op when taskId does not exist', () => {
    const next = boardReducer(stateWithTask, {
      type: 'UPDATE_TASK',
      payload: { taskId: 'ghost-id', title: 'Ghost' },
    })
    expect(next).toBe(stateWithTask)
  })

  it('DELETE_TASK: removes task from state and from column taskIds', () => {
    const next = boardReducer(stateWithTask, {
      type: 'DELETE_TASK',
      payload: { taskId: 'task-1', columnId: 'col-1' },
    })
    expect(next.tasks['task-1']).toBeUndefined()
    const col = next.boards[0].columns.find((c) => c.id === 'col-1')
    expect(col?.taskIds).not.toContain('task-1')
  })

  it('ARCHIVE_TASK: sets archived=true without removing from state', () => {
    const next = boardReducer(stateWithTask, {
      type: 'ARCHIVE_TASK',
      payload: { taskId: 'task-1' },
    })
    expect(next.tasks['task-1'].archived).toBe(true)
    const col = next.boards[0].columns.find((c) => c.id === 'col-1')
    expect(col?.taskIds).toContain('task-1')
  })
})

/* ─── Task movement ──────────────────────────────────────────────── */

describe('boardReducer — MOVE_TASK', () => {
  it('MOVE_TASK: moves task from one column to another', () => {
    const col1 = makeColumn({ id: 'col-1', taskIds: ['task-1'] })
    const col2 = makeColumn({ id: 'col-2', taskIds: [] })
    const task = makeTask({ id: 'task-1', columnId: 'col-1' })
    const state = makeInitialState({
      boards: [makeBoard({ columns: [col1, col2] })],
      tasks: { 'task-1': task },
    })
    const next = boardReducer(state, {
      type: 'MOVE_TASK',
      payload: { taskId: 'task-1', fromColumnId: 'col-1', toColumnId: 'col-2', toIndex: 0 },
    })
    const board = next.boards[0]
    expect(board.columns.find((c) => c.id === 'col-1')?.taskIds).not.toContain('task-1')
    expect(board.columns.find((c) => c.id === 'col-2')?.taskIds).toContain('task-1')
    expect(next.tasks['task-1'].columnId).toBe('col-2')
  })

  it('MOVE_TASK: reorders within the same column', () => {
    const col = makeColumn({ id: 'col-1', taskIds: ['task-1', 'task-2', 'task-3'] })
    const tasks = {
      'task-1': makeTask({ id: 'task-1', columnId: 'col-1', order: 0 }),
      'task-2': makeTask({ id: 'task-2', columnId: 'col-1', order: 1 }),
      'task-3': makeTask({ id: 'task-3', columnId: 'col-1', order: 2 }),
    }
    const state = makeInitialState({ boards: [makeBoard({ columns: [col] })], tasks })
    // Move task-3 to position 0
    const next = boardReducer(state, {
      type: 'MOVE_TASK',
      payload: { taskId: 'task-3', fromColumnId: 'col-1', toColumnId: 'col-1', toIndex: 0 },
    })
    const resultCol = next.boards[0].columns.find((c) => c.id === 'col-1')
    expect(resultCol?.taskIds[0]).toBe('task-3')
  })

  it('MOVE_TASK: is a no-op when taskId does not exist', () => {
    const state = makeInitialState({ boards: [makeBoard()] })
    const next = boardReducer(state, {
      type: 'MOVE_TASK',
      payload: { taskId: 'ghost', fromColumnId: 'col-1', toColumnId: 'col-2', toIndex: 0 },
    })
    expect(next).toBe(state)
  })
})

/* ─── Tag actions ────────────────────────────────────────────────── */

describe('boardReducer — Tags', () => {
  const stateWithBoard = makeInitialState({ boards: [makeBoard()] })

  it('ADD_TAG: appends tag to board tags', () => {
    const tag = makeTag()
    const next = boardReducer(stateWithBoard, {
      type: 'ADD_TAG',
      payload: { boardId: 'board-1', tag },
    })
    expect(next.boards[0].tags).toHaveLength(1)
    expect(next.boards[0].tags[0].id).toBe('tag-1')
  })

  it('UPDATE_TAG: updates matching tag by id', () => {
    const state = makeInitialState({
      boards: [makeBoard({ tags: [makeTag({ label: 'Bug' })] })],
    })
    const next = boardReducer(state, {
      type: 'UPDATE_TAG',
      payload: { boardId: 'board-1', tag: makeTag({ label: 'Feature' }) },
    })
    expect(next.boards[0].tags[0].label).toBe('Feature')
  })

  it('DELETE_TAG: removes tag with matching id', () => {
    const state = makeInitialState({
      boards: [makeBoard({ tags: [makeTag({ id: 'tag-1' }), makeTag({ id: 'tag-2' })] })],
    })
    const next = boardReducer(state, {
      type: 'DELETE_TAG',
      payload: { boardId: 'board-1', tagId: 'tag-1' },
    })
    expect(next.boards[0].tags).toHaveLength(1)
    expect(next.boards[0].tags[0].id).toBe('tag-2')
  })
})

/* ─── Loading / Error state ──────────────────────────────────────── */

describe('boardReducer — Loading and Error', () => {
  it('SET_LOADING: updates isLoading flag', () => {
    const state = makeInitialState({ isLoading: false })
    const next = boardReducer(state, { type: 'SET_LOADING', payload: { isLoading: true } })
    expect(next.isLoading).toBe(true)
  })

  it('SET_ERROR: stores error message', () => {
    const state = makeInitialState()
    const next = boardReducer(state, {
      type: 'SET_ERROR',
      payload: { error: 'Network error' },
    })
    expect(next.error).toBe('Network error')
  })

  it('SET_BOARDS: clears loading and error flags', () => {
    const state = makeInitialState({ isLoading: true, error: 'old error' })
    const next = boardReducer(state, {
      type: 'SET_BOARDS',
      payload: { boards: [makeBoard()] },
    })
    expect(next.isLoading).toBe(false)
    expect(next.error).toBeNull()
    expect(next.boards).toHaveLength(1)
  })
})
