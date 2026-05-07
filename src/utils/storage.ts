/**
 * storage.ts
 * Versioned localStorage persistence for board state.
 */

import type { Board, TaskMap, Task } from '@/types/entities'

const STORAGE_KEY = 'kanban:state'
export const STORAGE_VERSION = 1

export interface StorageState {
  version: number
  boards: Board[]
  tasks: TaskMap
  activeBoardId: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTaskMap(value: unknown): value is TaskMap {
  return isRecord(value)
}

function normalizeBoards(value: unknown): Board[] {
  return Array.isArray(value) ? (value as Board[]) : []
}

function normalizeTasks(value: unknown): TaskMap {
  if (isTaskMap(value)) return value as TaskMap
  if (Array.isArray(value)) {
    return value.reduce<TaskMap>((acc, task) => {
      const candidate = task as Task
      if (candidate?.id) acc[candidate.id] = candidate
      return acc
    }, {})
  }
  return {}
}

export function migrateState(raw: unknown): StorageState {
  if (!isRecord(raw)) {
    return {
      version: STORAGE_VERSION,
      boards: [],
      tasks: {},
      activeBoardId: null,
    }
  }

  const version = typeof raw.version === 'number' ? raw.version : 0

  if (version === STORAGE_VERSION) {
    return {
      version,
      boards: normalizeBoards(raw.boards),
      tasks: normalizeTasks(raw.tasks),
      activeBoardId: typeof raw.activeBoardId === 'string' ? raw.activeBoardId : null,
    }
  }

  return {
    version: STORAGE_VERSION,
    boards: normalizeBoards(raw.boards),
    tasks: normalizeTasks(raw.tasks),
    activeBoardId: typeof raw.activeBoardId === 'string' ? raw.activeBoardId : null,
  }
}

export function loadState(): StorageState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return migrateState(parsed)
  } catch {
    return null
  }
}

export function saveState(state: StorageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage write failures.
  }
}
