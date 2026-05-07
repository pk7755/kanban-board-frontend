/**
 * FilterBar.tsx
 * Horizontal filter strip rendered below the board header.
 * Filters: priority chips, tag chips, assignee dropdown,
 *          due-date range, overdue-only toggle, clear-all button.
 *
 * Spec: filter by priority, tag, assignee, due date range, and "overdue only".
 * Manager also gets a "View as" assignee filter (same control, different label).
 */

import { useMemo } from 'react'
import { X, Filter } from 'lucide-react'
import { useFilter } from '@/context/FilterContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PRIORITIES } from '@/types/entities'
import type { Tag, UserMap } from '@/types/entities'
import '@/styles/board/FilterBar.css'

interface FilterBarProps {
  boardTags: Tag[]
  userMap: UserMap
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export function FilterBar({ boardTags, userMap }: FilterBarProps) {
  const { filter, setFilter, clearFilter, isActive } = useFilter()
  const { isManager } = usePermissions()

  const users = useMemo(() => Object.values(userMap), [userMap])

  function togglePriority(p: string) {
    const priorities = filter.priorities.includes(p as never)
      ? filter.priorities.filter((x) => x !== p)
      : [...filter.priorities, p as never]
    setFilter({ priorities })
  }

  function toggleTag(tagId: string) {
    const tagIds = filter.tagIds.includes(tagId)
      ? filter.tagIds.filter((x) => x !== tagId)
      : [...filter.tagIds, tagId]
    setFilter({ tagIds })
  }

  return (
    <div
      className={`filter-bar${isActive ? ' filter-bar--active' : ''}`}
      role="search"
      aria-label="Board filters"
    >
      <span className="filter-bar__label">
        <Filter size={13} aria-hidden="true" />
        Filter
      </span>

      {/* ── Priority chips ── */}
      <div className="filter-bar__group" role="group" aria-label="Filter by priority">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            className={`filter-chip filter-chip--priority-${p}${filter.priorities.includes(p) ? ' filter-chip--active' : ''}`}
            onClick={() => togglePriority(p)}
            aria-pressed={filter.priorities.includes(p)}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── Tag chips ── */}
      {boardTags.length > 0 && (
        <div className="filter-bar__group" role="group" aria-label="Filter by tag">
          {boardTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`filter-chip${filter.tagIds.includes(tag.id) ? ' filter-chip--active' : ''}`}
              style={
                filter.tagIds.includes(tag.id)
                  ? { backgroundColor: tag.color + '33', borderColor: tag.color, color: tag.color }
                  : { borderColor: tag.color + '66', color: tag.color }
              }
              onClick={() => toggleTag(tag.id)}
              aria-pressed={filter.tagIds.includes(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Assignee / "View as" dropdown ── */}
      {users.length > 0 && (
        <select
          className="filter-bar__select"
          value={filter.assigneeId ?? ''}
          onChange={(e) => setFilter({ assigneeId: e.target.value || null })}
          aria-label={isManager ? 'View as team member' : 'Filter by assignee'}
        >
          <option value="">{isManager ? 'View as…' : 'Assignee'}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}

      {/* ── Due date range ── */}
      <div className="filter-bar__group filter-bar__group--dates" role="group" aria-label="Filter by due date">
        <label className="filter-bar__date-label" htmlFor="filter-due-after">
          From
        </label>
        <input
          id="filter-due-after"
          type="date"
          className="filter-bar__date"
          value={filter.dueAfter ?? ''}
          onChange={(e) => setFilter({ dueAfter: e.target.value || null })}
          aria-label="Due date from"
        />
        <label className="filter-bar__date-label" htmlFor="filter-due-before">
          To
        </label>
        <input
          id="filter-due-before"
          type="date"
          className="filter-bar__date"
          value={filter.dueBefore ?? ''}
          onChange={(e) => setFilter({ dueBefore: e.target.value || null })}
          aria-label="Due date to"
        />
      </div>

      {/* ── Overdue only toggle ── */}
      <label className="filter-bar__toggle">
        <input
          type="checkbox"
          checked={filter.overdueOnly}
          onChange={(e) => setFilter({ overdueOnly: e.target.checked })}
          aria-label="Show overdue tasks only"
        />
        Overdue only
      </label>

      {/* ── Clear all ── */}
      {isActive && (
        <button
          type="button"
          className="filter-bar__clear"
          onClick={clearFilter}
          aria-label="Clear all filters"
        >
          <X size={13} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}
