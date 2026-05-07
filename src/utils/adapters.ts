/**
 * adapters.ts
 * Pure functions that normalise raw backend responses into frontend entity types
 * and convert frontend payloads into the shape the backend expects.
 *
 * All field-name mismatches, enum-case differences, and missing fields are
 * handled here so no component or context needs to know about the backend shape.
 */

import type { Board, Column, Task, Tag, Priority, ChecklistItem } from '@/types/entities'

/* ─── Raw backend shapes ──────────────────────────────────────────── */
// These are NOT exported — they live only in the adapter layer.

interface RawBoardListItem {
  id: string
  name: string
  ownerId: string
  memberCount?: number
  createdAt: string | Date
}

interface RawColumn {
  id: string
  name: string
  position: number
  color?: string | null
  boardId?: string
}

interface RawMember {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
}

interface RawBoardDetail extends RawBoardListItem {
  columns: RawColumn[]
  members: RawMember[]
}

interface RawTag {
  id: string
  label: string
  color: string
}

interface RawTaskTag {
  tagId: string
  tag?: RawTag
}

interface RawChecklistItem {
  id: string
  text: string
  completed: boolean
}

interface RawTask {
  id: string
  title: string
  description?: string | null
  priority: string          // 'LOW' | 'MEDIUM' | 'HIGH'
  dueDate?: string | null
  columnId: string
  position: number
  assigneeId?: string | null
  archived: boolean
  createdAt: string | Date
  updatedAt: string | Date
  tags?: RawTaskTag[]
  checklistItems?: RawChecklistItem[]
}

interface RawTasksMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface RawTasksResponse {
  data: RawTask[]
  meta: RawTasksMeta
}

/* ─── Incoming (backend → frontend) ──────────────────────────────── */

/** Backend `LOW/MEDIUM/HIGH` → frontend `low/medium/high` */
function adaptPriority(raw: string): Priority {
  return raw.toLowerCase() as Priority
}

/** Normalise a tag from the backend */
export function adaptTag(raw: RawTag): Tag {
  return { id: raw.id, label: raw.label, color: raw.color }
}

/** Normalise a column from the backend */
export function adaptColumn(raw: RawColumn, boardId: string): Column {
  return {
    id: raw.id,
    title: raw.name,
    order: raw.position,
    boardId,
    taskIds: [],
  }
}

/**
 * Normalise a board list item (no columns, no tags — those come from the detail
 * endpoint and are populated via HYDRATE_BOARD_DETAIL).
 */
export function adaptBoard(raw: RawBoardListItem): Board {
  const ts = String(raw.createdAt)
  return {
    id: raw.id,
    title: raw.name,
    description: '',
    columns: [],
    tags: [],
    memberIds: [],
    ownerId: raw.ownerId,
    createdAt: ts,
    updatedAt: ts,
  }
}

/** Normalise a full board detail (columns + memberIds). */
export function adaptBoardDetail(raw: RawBoardDetail): Board {
  const ts = String(raw.createdAt)
  return {
    id: raw.id,
    title: raw.name,
    description: '',
    columns: raw.columns.map((col) => adaptColumn(col, raw.id)),
    tags: [],
    memberIds: raw.members.map((m) => m.userId),
    ownerId: raw.ownerId,
    createdAt: ts,
    updatedAt: ts,
  }
}

/**
 * Normalise a task returned by the backend.
 * boardId must be supplied by the caller (not present on the raw task).
 */
export function adaptTask(raw: RawTask, boardId: string): Task {
  const checklist: ChecklistItem[] = (raw.checklistItems ?? []).map((item) => ({
    id: item.id,
    text: item.text,
    completed: item.completed,
  }))

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    priority: adaptPriority(raw.priority),
    dueDate: raw.dueDate ?? undefined,
    tags: (raw.tags ?? []).map((t) => t.tagId),
    assigneeId: raw.assigneeId ?? undefined,
    checklist,
    archived: raw.archived,
    order: raw.position,
    columnId: raw.columnId,
    boardId,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

/**
 * Normalise the paginated tasks response:
 * backend `{data, meta}` → frontend `{data, total, page, limit, hasMore}`
 */
export function adaptTasksResponse(
  raw: RawTasksResponse,
  boardId: string,
): { data: Task[]; total: number; page: number; limit: number; hasMore: boolean } {
  return {
    data: raw.data.map((t) => adaptTask(t, boardId)),
    total: raw.meta.total,
    page: raw.meta.page,
    limit: raw.meta.limit,
    hasMore: raw.meta.page < raw.meta.totalPages,
  }
}

/* ─── Outgoing (frontend → backend) ──────────────────────────────── */

/** Frontend `low/medium/high` → backend `LOW/MEDIUM/HIGH` */
export function adaptPriorityOut(p: Priority): 'LOW' | 'MEDIUM' | 'HIGH' {
  return p.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH'
}

/** Strip/remap fields for POST /tasks */
export function adaptTaskCreatePayload(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
  return {
    title: data.title,
    ...(data.description ? { description: data.description } : {}),
    priority: adaptPriorityOut(data.priority),
    ...(data.dueDate ? { dueDate: data.dueDate } : {}),
    columnId: data.columnId,
    ...(data.assigneeId ? { assigneeId: data.assigneeId } : {}),
    ...(data.tags.length > 0 ? { tagIds: [...data.tags] } : {}),
  }
}

/** Strip/remap fields for PATCH /tasks/:id */
export function adaptTaskUpdatePayload(data: Partial<Task>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (data.title !== undefined) out.title = data.title
  if (data.description !== undefined) out.description = data.description
  if (data.priority !== undefined) out.priority = adaptPriorityOut(data.priority)
  if (data.dueDate !== undefined) out.dueDate = data.dueDate ?? null
  if (data.columnId !== undefined) out.columnId = data.columnId
  if (data.assigneeId !== undefined) out.assigneeId = data.assigneeId ?? null
  if (data.tags !== undefined) out.tagIds = [...data.tags]
  return out
}

/**
 * Frontend `{toColumnId, toIndex}` → backend `{columnId, position}`.
 * Backend position is 1-based.
 */
export function adaptMoveTaskPayload(toColumnId: string, toIndex: number) {
  return { columnId: toColumnId, position: toIndex + 1 }
}
