/**
 * api.ts
 * API response shapes, error types, and request option types.
 */

/* ─── Generic response wrapper ────────────────────────────────────── */

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/* ─── API error ────────────────────────────────────────────────────── */

export interface ApiError {
  message: string
  code?: string
  /** Field-level validation errors from server */
  fieldErrors?: Record<string, string>
  status: number
}

/** Type guard for ApiError */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'status' in value &&
    typeof (value as ApiError).status === 'number'
  )
}

/* ─── Request options ──────────────────────────────────────────────── */

export interface RequestOptions {
  signal?: AbortSignal
  headers?: Record<string, string>
}

/* ─── Task query params ────────────────────────────────────────────── */

export interface TaskQueryParams {
  boardId: string
  columnId?: string
  priority?: string
  assigneeId?: string
  search?: string
  tags?: string[]
  dueBefore?: string
  dueAfter?: string
  archived?: boolean
  page?: number
  limit?: number
}

/* ─── Move task request ────────────────────────────────────────────── */

export interface MoveTaskRequest {
  toColumnId: string
  toIndex: number
}
