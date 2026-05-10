/**
 * FilterContext.tsx
 * Holds the active filter state for the current board view.
 * Consumed by FilterBar (controls) and BoardPage (applies filter to tasks).
 */

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Priority } from '@/types/entities'

/* ─── Shape ───────────────────────────────────────────────────────── */

export interface FilterState {
  /** Active priority filters — empty array means "show all" */
  priorities: Priority[]
  /** Active tag id filters — empty array means "show all" */
  tagIds: string[]
  /**
   * Filter by multiple assignees. Each entry is either a user id or the
   * special token "__unassigned__". Empty array means "show all".
   */
  assigneeIds: string[]
  /**
   * Filter by column ids (status). Empty array means "show all".
   */
  columnIds: string[]
  /** Show only tasks whose due date is before this ISO date */
  dueBefore: string | null
  /** Show only tasks whose due date is after this ISO date */
  dueAfter: string | null
  /** Show only tasks that are already past their due date */
  overdueOnly: boolean
}

export const EMPTY_FILTER: FilterState = {
  priorities: [],
  tagIds: [],
  assigneeIds: [],
  columnIds: [],
  dueBefore: null,
  dueAfter: null,
  overdueOnly: false,
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.priorities.length > 0 ||
    f.tagIds.length > 0 ||
    f.assigneeIds.length > 0 ||
    f.columnIds.length > 0 ||
    f.dueBefore !== null ||
    f.dueAfter !== null ||
    f.overdueOnly
  )
}

/* ─── Context ─────────────────────────────────────────────────────── */

interface FilterContextValue {
  filter: FilterState
  setFilter: (patch: Partial<FilterState>) => void
  clearFilter: () => void
  /** Remove stale member IDs from assigneeIds (call after member deletion) */
  pruneAssigneeIds: (validIds: string[]) => void
  isActive: boolean
}

const FilterContext = createContext<FilterContextValue | null>(null)

/* ─── Provider ────────────────────────────────────────────────────── */

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterState>(EMPTY_FILTER)

  const setFilter = useCallback((patch: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilter = useCallback(() => setFilterState(EMPTY_FILTER), [])

  const pruneAssigneeIds = useCallback((validIds: string[]) => {
    setFilterState((prev) => {
      const next = prev.assigneeIds.filter((id) => id === '__unassigned__' || validIds.includes(id))
      if (next.length === prev.assigneeIds.length) return prev
      return { ...prev, assigneeIds: next }
    })
  }, [])

  return (
    <FilterContext.Provider
      value={{ filter, setFilter, clearFilter, pruneAssigneeIds, isActive: isFilterActive(filter) }}
    >
      {children}
    </FilterContext.Provider>
  )
}

/* ─── Hook ────────────────────────────────────────────────────────── */

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used inside FilterProvider')
  return ctx
}
