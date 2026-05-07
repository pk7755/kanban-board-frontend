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
  /** Filter to a single assignee — null means "show all" */
  assigneeId: string | null
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
  assigneeId: null,
  dueBefore: null,
  dueAfter: null,
  overdueOnly: false,
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.priorities.length > 0 ||
    f.tagIds.length > 0 ||
    f.assigneeId !== null ||
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

  return (
    <FilterContext.Provider
      value={{ filter, setFilter, clearFilter, isActive: isFilterActive(filter) }}
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
