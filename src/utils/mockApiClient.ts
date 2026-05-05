/**
 * mockApiClient.ts
 * Mock implementation — same export shape as apiClient.ts.
 * Used when VITE_USE_MOCK=true.
 *
 * Mock credentials (development only — do NOT hardcode in production):
 *   Manager:     manager@test.com / Manager@123
 *   Team Member: member@test.com  / Member@123
 */

import type { LoginCredentials } from '@/types/auth'
import type { Board, Task, User, Column } from '@/types/entities'
import type {
  ApiResponse,
  PaginatedResponse,
  TaskQueryParams,
  MoveTaskRequest,
  RequestOptions,
} from '@/types/api'

/* ─── Seed data ───────────────────────────────────────────────────── */

const MOCK_USERS: User[] = [
  {
    id: 'mock-manager',
    name: 'Pradyuman',
    email: 'manager@test.com',
    role: 'MANAGER',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'mock-member',
    name: 'Team Member',
    email: 'member@test.com',
    role: 'TEAM_MEMBER',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

/* ─── Helpers ─────────────────────────────────────────────────────── */

function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function mockError(message: string, status: number): never {
  throw { message, status }
}

function ok<T>(data: T): ApiResponse<T> {
  return { data }
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`mock:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`mock:${key}`, JSON.stringify(value))
  } catch {
    // Silently fail
  }
}

/* ─── Auth ────────────────────────────────────────────────────────── */

export const authApi = {
  login: (credentials: LoginCredentials, _options?: RequestOptions) => {
    const user = MOCK_USERS.find((u) => u.email === credentials.email.trim().toLowerCase())
    if (
      !user ||
      credentials.password !== (user.role === 'MANAGER' ? 'Manager@123' : 'Member@123')
    ) {
      mockError('Invalid email or password', 401)
    }
    return delay(
      ok({
        accessToken: `mock-jwt-${user!.id}`,
        refreshToken: `mock-refresh-${user!.id}`,
        user: user!,
      }),
    )
  },

  refresh: (refreshToken: string, _options?: RequestOptions) => {
    // The refresh token passed here is the one stored under kanban:refreshToken
    const userId = refreshToken.replace('mock-refresh-', '')
    if (!userId || userId === refreshToken) mockError('Invalid refresh token', 401)
    return delay(ok({ accessToken: `mock-jwt-${userId}`, refreshToken: `mock-refresh-${userId}` }))
  },
}

/* ─── Boards ──────────────────────────────────────────────────────── */

export const boardsApi = {
  list: (_options?: RequestOptions) => {
    return delay(ok(readStore<Board[]>('boards', [])))
  },

  get: (boardId: string, _options?: RequestOptions) => {
    const board = readStore<Board[]>('boards', []).find((b) => b.id === boardId)
    if (!board) mockError('Board not found', 404)
    return delay(ok(board!))
  },

  create: (data: { title: string; description?: string }, _options?: RequestOptions) => {
    const boards = readStore<Board[]>('boards', [])
    const board: Board = {
      id: `board-${Date.now()}`,
      title: data.title,
      description: data.description,
      columns: [],
      tags: [],
      memberIds: [],
      ownerId: 'mock-manager',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeStore('boards', [...boards, board])
    return delay(ok(board))
  },

  rename: (boardId: string, title: string, _options?: RequestOptions) => {
    const boards = readStore<Board[]>('boards', [])
    const updated = boards.map((b) =>
      b.id === boardId ? { ...b, title, updatedAt: new Date().toISOString() } : b,
    )
    writeStore('boards', updated)
    const board = updated.find((b) => b.id === boardId)!
    return delay(ok(board))
  },

  delete: (boardId: string, _options?: RequestOptions) => {
    writeStore(
      'boards',
      readStore<Board[]>('boards', []).filter((b) => b.id !== boardId),
    )
    return delay(undefined as unknown as void)
  },
}

/* ─── Columns ─────────────────────────────────────────────────────── */

export const columnsApi = {
  create: (data: Omit<Column, 'id' | 'taskIds'>, _options?: RequestOptions) => {
    const boards = readStore<Board[]>('boards', [])
    const column: Column = { id: `col-${Date.now()}`, ...data, taskIds: [] }
    writeStore(
      'boards',
      boards.map((b) => (b.id === data.boardId ? { ...b, columns: [...b.columns, column] } : b)),
    )
    return delay(ok(column))
  },

  rename: (columnId: string, title: string, _options?: RequestOptions) => {
    const boards = readStore<Board[]>('boards', [])
    let found: Column | undefined
    writeStore(
      'boards',
      boards.map((b) => ({
        ...b,
        columns: b.columns.map((c) => {
          if (c.id === columnId) {
            found = { ...c, title }
            return found
          }
          return c
        }),
      })),
    )
    if (!found) mockError('Column not found', 404)
    return delay(ok(found!))
  },

  delete: (columnId: string, _options?: RequestOptions) => {
    writeStore(
      'boards',
      readStore<Board[]>('boards', []).map((b) => ({
        ...b,
        columns: b.columns.filter((c) => c.id !== columnId),
      })),
    )
    return delay(undefined as unknown as void)
  },
}

/* ─── Tasks ───────────────────────────────────────────────────────── */

export const tasksApi = {
  list: (params: TaskQueryParams, _options?: RequestOptions) => {
    const all = readStore<Task[]>('tasks', [])
    const filtered = all.filter((t) => {
      if (params.boardId && t.boardId !== params.boardId) return false
      if (params.columnId && t.columnId !== params.columnId) return false
      if (params.assigneeId && t.assigneeId !== params.assigneeId) return false
      if (params.priority && t.priority !== params.priority) return false
      if (params.archived !== undefined && t.archived !== params.archived) return false
      if (params.search) {
        const q = params.search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q))
          return false
      }
      return true
    })
    const page = params.page ?? 1
    const limit = params.limit ?? 50
    const result: PaginatedResponse<Task> = {
      data: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      hasMore: page * limit < filtered.length,
    }
    return delay(result)
  },

  create: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, _options?: RequestOptions) => {
    const tasks = readStore<Task[]>('tasks', [])
    const task: Task = {
      ...data,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeStore('tasks', [...tasks, task])
    return delay(ok(task))
  },

  update: (taskId: string, data: Partial<Task>, _options?: RequestOptions) => {
    const tasks = readStore<Task[]>('tasks', [])
    let updated: Task | undefined
    writeStore(
      'tasks',
      tasks.map((t) => {
        if (t.id === taskId) {
          updated = { ...t, ...data, updatedAt: new Date().toISOString() }
          return updated
        }
        return t
      }),
    )
    if (!updated) mockError('Task not found', 404)
    return delay(ok(updated!))
  },

  delete: (taskId: string, _options?: RequestOptions) => {
    writeStore(
      'tasks',
      readStore<Task[]>('tasks', []).filter((t) => t.id !== taskId),
    )
    return delay(undefined as unknown as void)
  },

  move: (taskId: string, data: MoveTaskRequest, _options?: RequestOptions) => {
    const tasks = readStore<Task[]>('tasks', [])
    let updated: Task | undefined
    writeStore(
      'tasks',
      tasks.map((t) => {
        if (t.id === taskId) {
          updated = {
            ...t,
            columnId: data.toColumnId,
            order: data.toIndex,
            updatedAt: new Date().toISOString(),
          }
          return updated
        }
        return t
      }),
    )
    if (!updated) mockError('Task not found', 404)
    return delay(ok(updated!))
  },
}

/* ─── Users ───────────────────────────────────────────────────────── */

export const usersApi = {
  list: (_options?: RequestOptions) => {
    const extra = readStore<User[]>('users', [])
    return delay(ok([...MOCK_USERS, ...extra]))
  },

  create: (data: Partial<User> & { password: string }, _options?: RequestOptions) => {
    const users = readStore<User[]>('users', [])
    const user: User = {
      id: `user-${Date.now()}`,
      name: data.name ?? '',
      email: data.email ?? '',
      role: data.role ?? 'TEAM_MEMBER',
      active: true,
      createdAt: new Date().toISOString(),
    }
    writeStore('users', [...users, user])
    return delay(ok(user))
  },

  update: (userId: string, data: Partial<User>, _options?: RequestOptions) => {
    const users = readStore<User[]>('users', [])
    let updated: User | undefined
    writeStore(
      'users',
      users.map((u) => {
        if (u.id === userId) {
          updated = { ...u, ...data }
          return updated
        }
        return u
      }),
    )
    if (!updated) mockError('User not found', 404)
    return delay(ok(updated!))
  },

  deactivate: (userId: string, _options?: RequestOptions) => {
    writeStore(
      'users',
      readStore<User[]>('users', []).map((u) => (u.id === userId ? { ...u, active: false } : u)),
    )
    return delay(undefined as unknown as void)
  },

  resetPassword: (_userId: string, _options?: RequestOptions) => {
    return delay(ok({ temporaryPassword: 'Temp@1234' }))
  },
}
