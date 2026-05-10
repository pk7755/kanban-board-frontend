/**
 * actions.ts
 * Discriminated union of all board reducer actions.
 * Every state mutation is expressed as one of these types.
 */

import type {
  Board,
  Task,
  Tag,
  CreateBoardInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateColumnInput,
} from './entities'

/* ─── Board actions ───────────────────────────────────────────────── */

export type BoardAction =
  /* Board CRUD */
  | { type: 'ADD_BOARD'; payload: CreateBoardInput & { id: string; ownerId: string } }
  | { type: 'RENAME_BOARD'; payload: { boardId: string; title: string } }
  | { type: 'DELETE_BOARD'; payload: { boardId: string } }
  | { type: 'SET_BOARDS'; payload: { boards: Board[] } }
  | { type: 'SET_ACTIVE_BOARD'; payload: { boardId: string } }

  /* Column CRUD */
  | { type: 'ADD_COLUMN'; payload: CreateColumnInput & { id: string } }
  | { type: 'RENAME_COLUMN'; payload: { columnId: string; title: string } }
  | { type: 'DELETE_COLUMN'; payload: { columnId: string; boardId: string } }
  | { type: 'REORDER_COLUMNS'; payload: { boardId: string; columnIds: string[] } }

  /* Task CRUD */
  | { type: 'ADD_TASK'; payload: CreateTaskInput & { id: string } }
  | { type: 'UPDATE_TASK'; payload: { taskId: string } & UpdateTaskInput }
  | { type: 'DELETE_TASK'; payload: { taskId: string; columnId: string } }
  | { type: 'ARCHIVE_TASK'; payload: { taskId: string } }

  /* Task movement (triggers undo/redo) */
  | {
      type: 'MOVE_TASK'
      payload: {
        taskId: string
        fromColumnId: string
        toColumnId: string
        toIndex: number
      }
    }
  | {
      type: 'REORDER_TASKS'
      payload: { columnId: string; taskIds: string[] }
    }

  /* Tags */
  | { type: 'ADD_TAG'; payload: { boardId: string; tag: Tag } }
  | { type: 'UPDATE_TAG'; payload: { boardId: string; tag: Tag } }
  | { type: 'DELETE_TAG'; payload: { boardId: string; tagId: string } }

  /* Board member management */
  | { type: 'UPDATE_BOARD_MEMBERS'; payload: { boardId: string; memberIds: string[]; members: import('./entities').BoardMember[] } }

  /* Import */
  | { type: 'IMPORT_BOARD'; payload: { board: Board; tasks: Task[] } }

/* ─── Auth actions ────────────────────────────────────────────────── */

export type AuthAction =
  | { type: 'LOGIN'; payload: { user: import('./entities').AuthUser } }
  | { type: 'UPDATE_PROFILE'; payload: { name: string; email: string; avatarUrl?: string } }
  | { type: 'LOGOUT' }

/* ─── UI / app-level actions ──────────────────────────────────────── */

export type AppAction =
  | { type: 'SET_THEME'; payload: { theme: import('./entities').Theme } }
  | { type: 'SET_ONLINE'; payload: { online: boolean } }
