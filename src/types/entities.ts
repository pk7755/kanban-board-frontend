/**
 * entities.ts
 * Core domain models for the Kanban board application.
 */

/* ─── Primitive constants ─────────────────────────────────────────── */

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const ROLES = ['MANAGER', 'TEAM_MEMBER'] as const
export type Role = (typeof ROLES)[number]

export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

/* ─── User ────────────────────────────────────────────────────────── */

export interface User {
  readonly id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  isDeleted?: boolean
  avatarUrl?: string
  readonly createdAt: string
}

/** Shape returned after login — extends User with auth fields */
export interface AuthUser extends Readonly<Pick<User, 'id' | 'name' | 'email' | 'role'>> {
  token: string
  avatarUrl?: string
}

/* ─── Tag ─────────────────────────────────────────────────────────── */

export interface Tag {
  readonly id: string
  label: string
  color: string
}

/* ─── Checklist ───────────────────────────────────────────────────── */

export interface ChecklistItem {
  readonly id: string
  text: string
  completed: boolean
}

/* ─── Task (PBI) ──────────────────────────────────────────────────── */

export interface Task {
  readonly id: string
  title: string
  description: string
  priority: Priority
  dueDate?: string
  /** Tag IDs (for filtering / lookup) */
  tags: ReadonlyArray<string>
  /** Full tag objects embedded from backend response — always in sync */
  tagObjects?: ReadonlyArray<Tag>
  assigneeId?: string
  /** Embedded from backend response — avoids separate userMap lookup */
  assigneeName?: string
  assigneeAvatarUrl?: string | null
  checklist: ChecklistItem[]
  archived: boolean
  order: number
  readonly columnId: string
  readonly boardId: string
  readonly createdAt: string
  updatedAt: string
}

/** Task shape required when creating a new task (omit auto-generated fields) */
export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'order'>

/** Task shape for partial updates */
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'boardId'>>

/* ─── Column ──────────────────────────────────────────────────────── */

export interface Column {
  readonly id: string
  title: string
  order: number
  readonly boardId: string
  taskIds: string[]
}

export type CreateColumnInput = Omit<Column, 'id' | 'taskIds'>

/* ─── Board Member ─────────────────────────────────────────────────── */

export interface BoardMember {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  isActive: boolean
}

/* ─── Board ───────────────────────────────────────────────────────── */

export interface Board {
  readonly id: string
  title: string
  description?: string
  columns: Column[]
  tags: Tag[]
  memberIds: ReadonlyArray<string>
  /** Full member objects — populated after board detail is fetched */
  members?: ReadonlyArray<BoardMember>
  readonly ownerId: string
  readonly createdAt: string
  updatedAt: string
}

export type CreateBoardInput = Pick<Board, 'title' | 'description'>

/* ─── Normalized store shape ──────────────────────────────────────── */

/** All tasks keyed by id for O(1) lookup */
export type TaskMap = Record<string, Task>

/** All users keyed by id for O(1) lookup */
export type UserMap = Record<string, User>

/* ─── Type guards ─────────────────────────────────────────────────── */

export function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'columnId' in value &&
    'boardId' in value
  )
}
