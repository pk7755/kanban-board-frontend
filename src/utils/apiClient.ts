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
 */

import type { ApiError, RequestOptions } from '@/types/api'
import type { LoginCredentials } from '@/types/auth'
import type { Board, Task, User, Column } from '@/types/entities'
import type { ApiResponse, PaginatedResponse, TaskQueryParams, MoveTaskRequest } from '@/types/api'
import { tokenStore } from './tokenStore'

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
  login: (credentials: LoginCredentials, options?: RequestOptions) =>
    request<ApiResponse<{ accessToken: string; refreshToken: string; user: User }>>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(credentials) },
      options,
    ),

  refresh: (refreshToken: string, options?: RequestOptions) =>
    request<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      options,
    ),
}

/* ─── Boards ──────────────────────────────────────────────────────── */
export const boardsApi = {
  list: (options?: RequestOptions) => request<ApiResponse<Board[]>>('/boards', {}, options),

  get: (boardId: string, options?: RequestOptions) =>
    request<ApiResponse<Board>>(`/boards/${boardId}`, {}, options),

  create: (data: { title: string; description?: string }, options?: RequestOptions) =>
    request<ApiResponse<Board>>('/boards', { method: 'POST', body: JSON.stringify(data) }, options),

  rename: (boardId: string, title: string, options?: RequestOptions) =>
    request<ApiResponse<Board>>(
      `/boards/${boardId}`,
      { method: 'PATCH', body: JSON.stringify({ title }) },
      options,
    ),

  delete: (boardId: string, options?: RequestOptions) =>
    request<void>(`/boards/${boardId}`, { method: 'DELETE' }, options),
}

/* ─── Columns ─────────────────────────────────────────────────────── */
export const columnsApi = {
  create: (data: Omit<Column, 'id' | 'taskIds'>, options?: RequestOptions) =>
    request<ApiResponse<Column>>(
      '/columns',
      { method: 'POST', body: JSON.stringify(data) },
      options,
    ),

  rename: (columnId: string, title: string, options?: RequestOptions) =>
    request<ApiResponse<Column>>(
      `/columns/${columnId}`,
      { method: 'PATCH', body: JSON.stringify({ title }) },
      options,
    ),

  delete: (columnId: string, options?: RequestOptions) =>
    request<void>(`/columns/${columnId}`, { method: 'DELETE' }, options),
}

/* ─── Tasks ───────────────────────────────────────────────────────── */
export const tasksApi = {
  list: (params: TaskQueryParams, options?: RequestOptions) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v))
    })
    return request<PaginatedResponse<Task>>(`/tasks?${query}`, {}, options)
  },

  create: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, options?: RequestOptions) =>
    request<ApiResponse<Task>>('/tasks', { method: 'POST', body: JSON.stringify(data) }, options),

  update: (taskId: string, data: Partial<Task>, options?: RequestOptions) =>
    request<ApiResponse<Task>>(
      `/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      options,
    ),

  delete: (taskId: string, options?: RequestOptions) =>
    request<void>(`/tasks/${taskId}`, { method: 'DELETE' }, options),

  move: (taskId: string, data: MoveTaskRequest, options?: RequestOptions) =>
    request<ApiResponse<Task>>(
      `/tasks/${taskId}/move`,
      { method: 'PATCH', body: JSON.stringify(data) },
      options,
    ),
}

/* ─── Users ───────────────────────────────────────────────────────── */
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

  deactivate: (userId: string, options?: RequestOptions) =>
    request<void>(`/users/${userId}/deactivate`, { method: 'PATCH' }, options),

  resetPassword: (userId: string, options?: RequestOptions) =>
    request<ApiResponse<{ temporaryPassword: string }>>(
      `/users/${userId}/reset-password`,
      { method: 'POST' },
      options,
    ),
}
