/**
 * apiClient.ts
 * Central fetch wrapper for all real API calls.
 *
 * - Reads base URL from VITE_API_BASE_URL
 * - Attaches JWT from tokenStore
 * - Adds ngrok-skip-browser-warning header on every request
 * - Handles 401 → attempts one token refresh → force logout on second 401
 * - Normalises errors into ApiError shape
 * - Supports AbortController via RequestOptions.signal
 *
 * All backend↔frontend shape mismatches (field names, enum casing, missing
 * fields) are handled by adapters imported from ./adapters.ts — no raw
 * backend shapes leak into the rest of the app.
 */

import type { ApiError, RequestOptions } from '@/types/api'
import type { LoginCredentials } from '@/types/auth'
import type { Board, Tag, Task, User, Column } from '@/types/entities'
import type { ApiResponse, PaginatedResponse, TaskQueryParams, MoveTaskRequest } from '@/types/api'
import { tokenStore } from './tokenStore'
import {
  adaptBoard,
  adaptBoardDetail,
  adaptColumn,
  adaptTag,
  adaptTask,
  adaptTasksResponse,
  adaptTaskCreatePayload,
  adaptTaskUpdatePayload,
  adaptMoveTaskPayload,
} from './adapters'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** Called by AuthContext to inject the refresh + logout functions after mount */
let _onRefresh: (() => Promise<string | null>) | null = null
let _onForceLogout: (() => void) | null = null

export function configureApiClient(
  onRefresh: () => Promise<string | null>,
  onForceLogout: () => void,
): void {
  _onRefresh = onRefresh
  _onForceLogout = onForceLogout
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
  retry = true,
): Promise<T> {
  const token = tokenStore.get()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: options.signal,
  })

  // Only attempt token refresh on 401 if we already have a token in memory.
  // A 401 during login (no existing token) means wrong credentials — not session expiry.
  if (response.status === 401 && retry && _onRefresh && tokenStore.get()) {
    const newToken = await _onRefresh()
    if (newToken) {
      tokenStore.set(newToken)
      return request<T>(path, init, options, false)
    }
    _onForceLogout?.()
    throw buildError('Session expired. Please log in again.', 401)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw buildError(
      (body as { message?: string }).message ?? response.statusText,
      response.status,
      (body as { fieldErrors?: Record<string, string> }).fieldErrors,
    )
  }

  return response.json() as Promise<T>
}

function buildError(
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
): ApiError {
  return { message, status, fieldErrors }
}

/* ─── Auth ────────────────────────────────────────────────────────── */
export const authApi = {
  /**
   * Backend returns {user, accessToken, refreshToken} directly (no {data:} wrapper).
   * We wrap here so AuthContext can use the same res.data shape as the mock.
   */
  login: async (credentials: LoginCredentials, options?: RequestOptions) => {
    // Backend returns { data: { user, accessToken, refreshToken }, statusCode, timestamp }
    return request<{ data: { accessToken: string; refreshToken: string; user: User } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(credentials) },
      options,
    )
  },

  refresh: async (refreshToken: string, options?: RequestOptions) => {
    // Backend returns { data: { accessToken, refreshToken }, statusCode, timestamp }
    return request<{ data: { accessToken: string; refreshToken: string } }>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      options,
    )
  },
}

/* ─── Boards ──────────────────────────────────────────────────────── */
export const boardsApi = {
  /** GET /boards — returns raw array; normalised to {data: Board[]} */
  list: async (options?: RequestOptions): Promise<ApiResponse<Board[]>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any[]>('/boards', {}, options)
    return { data: raw.map(adaptBoard) }
  },

  /** GET /boards/:id — returns full detail with columns + members */
  get: async (boardId: string, options?: RequestOptions): Promise<ApiResponse<Board>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(`/boards/${boardId}`, {}, options)
    return { data: adaptBoardDetail(raw) }
  },

  /** POST /boards — backend field is `name`, not `title` */
  create: async (
    data: { title: string; description?: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<Board>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      '/boards',
      { method: 'POST', body: JSON.stringify({ name: data.title }) },
      options,
    )
    return { data: adaptBoard(raw) }
  },

  /** PATCH /boards/:id — backend field is `name`, not `title` */
  rename: async (boardId: string, title: string, options?: RequestOptions): Promise<ApiResponse<Board>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      `/boards/${boardId}`,
      { method: 'PATCH', body: JSON.stringify({ name: title }) },
      options,
    )
    return { data: adaptBoard(raw) }
  },

  delete: (boardId: string, options?: RequestOptions) =>
    request<void>(`/boards/${boardId}`, { method: 'DELETE' }, options),
}

/* ─── Columns ─────────────────────────────────────────────────────── */
export const columnsApi = {
  /** POST /columns — backend uses `name` not `title`; `order` is ignored */
  create: async (
    data: Omit<Column, 'id' | 'taskIds'>,
    options?: RequestOptions,
  ): Promise<ApiResponse<Column>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      '/columns',
      { method: 'POST', body: JSON.stringify({ name: data.title, boardId: data.boardId }) },
      options,
    )
    return { data: adaptColumn(raw, data.boardId) }
  },

  /** PATCH /columns/:id — backend uses `name` not `title` */
  rename: async (
    columnId: string,
    title: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<Column>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      `/columns/${columnId}`,
      { method: 'PATCH', body: JSON.stringify({ name: title }) },
      options,
    )
    // raw.boardId may be present in the response
    return { data: adaptColumn(raw, raw.boardId ?? '') }
  },

  /** PATCH /columns/reorder — expects [{id, position}] */
  reorder: async (
    _boardId: string,
    columnIds: string[],
    options?: RequestOptions,
  ): Promise<void> => {
    const items = columnIds.map((id, i) => ({ id, position: i + 1 }))
    await request<unknown>('/columns/reorder', { method: 'PATCH', body: JSON.stringify(items) }, options)
  },

  delete: (columnId: string, options?: RequestOptions) =>
    request<void>(`/columns/${columnId}`, { method: 'DELETE' }, options),
}

/* ─── Tasks ───────────────────────────────────────────────────────── */
export const tasksApi = {
  list: async (
    params: TaskQueryParams,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<Task>> => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v))
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(`/tasks?${query}`, {}, options)
    return adaptTasksResponse(raw, params.boardId)
  },

  create: async (
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>,
    options?: RequestOptions,
  ): Promise<ApiResponse<Task>> => {
    const body = adaptTaskCreatePayload(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>('/tasks', { method: 'POST', body: JSON.stringify(body) }, options)
    return { data: adaptTask(raw, data.boardId) }
  },

  update: async (
    taskId: string,
    data: Partial<Task>,
    options?: RequestOptions,
  ): Promise<ApiResponse<Task>> => {
    const body = adaptTaskUpdatePayload(data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      `/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      options,
    )
    // boardId from the raw response is not present; use data.boardId if supplied
    return { data: adaptTask(raw, data.boardId ?? '') }
  },

  delete: (taskId: string, options?: RequestOptions) =>
    request<void>(`/tasks/${taskId}`, { method: 'DELETE' }, options),

  /** PATCH /tasks/:id/move — converts frontend {toColumnId, toIndex} to backend {columnId, position} */
  move: async (
    taskId: string,
    data: MoveTaskRequest,
    options?: RequestOptions,
  ): Promise<void> => {
    const body = adaptMoveTaskPayload(data.toColumnId, data.toIndex)
    await request<unknown>(`/tasks/${taskId}/move`, { method: 'PATCH', body: JSON.stringify(body) }, options)
  },
}

/* ─── Tags ────────────────────────────────────────────────────────── */
export const tagsApi = {
  list: async (boardId: string, options?: RequestOptions): Promise<ApiResponse<Tag[]>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any[]>(`/boards/${boardId}/tags`, {}, options)
    return { data: raw.map(adaptTag) }
  },

  create: async (
    boardId: string,
    data: { label: string; color: string },
    options?: RequestOptions,
  ): Promise<ApiResponse<Tag>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      `/boards/${boardId}/tags`,
      { method: 'POST', body: JSON.stringify(data) },
      options,
    )
    return { data: adaptTag(raw) }
  },

  update: async (
    tagId: string,
    data: Partial<Tag>,
    options?: RequestOptions,
  ): Promise<ApiResponse<Tag>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await request<any>(
      `/tags/${tagId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      options,
    )
    return { data: adaptTag(raw) }
  },

  delete: (tagId: string, options?: RequestOptions) =>
    request<void>(`/tags/${tagId}`, { method: 'DELETE' }, options),
}
export const usersApi = {
  list: (options?: RequestOptions) => request<ApiResponse<User[]>>('/users', {}, options),

  create: (data: Partial<User> & { password: string }, options?: RequestOptions) =>
    request<ApiResponse<User>>('/users', { method: 'POST', body: JSON.stringify(data) }, options),

  update: (userId: string, data: Partial<User>, options?: RequestOptions) =>
    request<ApiResponse<User>>(
      `/users/${userId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      options,
    ),

  /** Update the currently authenticated user's own profile (PATCH /users/me) */
  updateMe: (_userId: string, data: Partial<User>, options?: RequestOptions) =>
    request<ApiResponse<User>>(
      '/users/me',
      { method: 'PATCH', body: JSON.stringify(data) },
      options,
    ),

  deactivate: (userId: string, options?: RequestOptions) =>
    request<void>(`/users/${userId}/deactivate`, { method: 'PATCH' }, options),

  resetPassword: (userId: string, options?: RequestOptions) =>
    request<ApiResponse<{ temporaryPassword: string }>>(
      `/users/${userId}/reset-password`,
      { method: 'POST' },
      options,
    ),

  changePassword: (
    userId: string,
    data: { currentPassword: string; newPassword: string },
    options?: RequestOptions,
  ) =>
    request<ApiResponse<{ message: string }>>(
      `/users/${userId}/change-password`,
      { method: 'POST', body: JSON.stringify(data) },
      options,
    ),
}
