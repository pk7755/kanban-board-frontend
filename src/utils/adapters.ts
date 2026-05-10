/**
 * adapters.ts
 * Pure functions that normalise raw backend responses into frontend entity types
 * and convert frontend payloads into the shape the backend expects.
 *
 * All field-name mismatches, enum-case differences, and missing fields are
 * handled here so no component or context needs to know about the backend shape.
 */

import type {
  Board,
  BoardMember,
  Column,
  Task,
  Tag,
  Priority,
  ChecklistItem,
} from '@/types/entities'

/** UUID v4 pattern — used to validate tag IDs before sending to backend */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUUIDv4(str: unknown): str is string {
  return typeof str === 'string' && UUID_V4_RE.test(str)
}

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
  isActive?: boolean
}

interface RawBoardDetail extends RawBoardListItem {
  columns: RawColumn[]
  members: RawMember[]
  tags?: { id: string; name: string; color: string }[]
}

interface RawTag {
  id: string
  /** Backend returns `name`; older snapshots may use `label` */
  name?: string
  label?: string
  color: string
}

interface RawTaskTag {
  tagId: string
  tag?: RawTag
}

interface RawChecklistItem {
  id: string
  text: string
  done: boolean
}

interface RawTaskAssignee {
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
}

interface RawTask {
  id: string
  title: string
  description?: string | null
  priority: string // 'LOW' | 'MEDIUM' | 'HIGH'
  dueDate?: string | null
  columnId: string
  position: number
  assigneeId?: string | null
  assignee?: RawTaskAssignee | null
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
  return { id: raw.id, label: raw.name ?? raw.label ?? '', color: raw.color }
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

/** Normalise a full board detail (columns + memberIds + members). */
export function adaptBoardDetail(raw: RawBoardDetail): Board {
  const ts = String(raw.createdAt)
  const members: BoardMember[] = raw.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatarUrl ?? null,
    isActive: m.isActive ?? true,
  }))
  const boardTags: Tag[] = (raw.tags ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    color: t.color,
  }))
  return {
    id: raw.id,
    title: raw.name,
    description: '',
    columns: raw.columns.map((col) => adaptColumn(col, raw.id)),
    tags: boardTags,
    memberIds: members.map((m) => m.userId),
    members,
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
    completed: item.done,
  }))

  // Full Tag objects — always resolve from the joined relation data.
  // Falls back to id-only when the join is missing (e.g. move endpoint).
  const tags: Tag[] = (raw.tags ?? [])
    .filter((t) => (t.tag ? !!t.tag.id : !!t.tagId))
    .map((t) => (t.tag ? adaptTag(t.tag) : { id: t.tagId, label: '', color: '#64748b' }))

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    priority: adaptPriority(raw.priority),
    dueDate: raw.dueDate ?? undefined,
    tags,
    assigneeId: raw.assigneeId ?? undefined,
    assigneeName: raw.assignee?.name,
    assigneeAvatarUrl: raw.assignee?.avatarUrl ?? null,
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
    ...(data.tags.length > 0 ? { tagIds: data.tags.map((t) => t.id).filter(isUUIDv4) } : {}),
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
  // Use key-presence check: `{ assigneeId: undefined }` = "unassign" → null
  if ('assigneeId' in data) out.assigneeId = data.assigneeId ?? null
  if (data.tags !== undefined) out.tagIds = data.tags.map((t) => t.id).filter(isUUIDv4)
  if (data.checklist !== undefined) {
    out.checklistItems = data.checklist.map((item, index) => ({
      text: item.text,
      done: item.completed,
      position: index,
    }))
  }
  return out
}

/**
 * Frontend `{toColumnId, toIndex}` → backend `{columnId, position}`.
 * Backend position is 1-based.
 */
export function adaptMoveTaskPayload(toColumnId: string, toIndex: number) {
  return { columnId: toColumnId, position: toIndex + 1 }
}
