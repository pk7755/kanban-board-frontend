/**
 * FilterBar.tsx
 * Compact filter strip with per-group dropdown checkboxes.
 * Groups: Priority · Status · Members · Tags
 * Each group button shows selected count; clicking opens a checkbox dropdown.
 */

import { useEffect, useRef, useState } from 'react'
import { X, Filter, ChevronDown } from 'lucide-react'
import { useFilter } from '@/context/FilterContext'
import { PRIORITIES } from '@/types/entities'
import type { BoardMember, Column, Tag } from '@/types/entities'
import '@/styles/board/FilterBar.css'

interface FilterBarProps {
  boardMembers: ReadonlyArray<BoardMember>
  boardTags: ReadonlyArray<Tag>
  boardColumns: ReadonlyArray<Column>
}

const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }
const PRIORITY_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }

/* ── Generic checkbox dropdown group ─────────────────────────── */

interface CheckGroup {
  label: string
  options: { id: string; label: string; color?: string }[]
  selected: string[]
  onToggle: (id: string) => void
  onClear: () => void
}

function FilterGroup({ label, options, selected, onToggle, onClear }: CheckGroup) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const count = selected.length

  return (
    <div className="fbar-group" ref={ref}>
      <button
        type="button"
        className={`fbar-group__trigger${count > 0 ? ' fbar-group__trigger--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{label}</span>
        {count > 0 && <span className="fbar-group__badge">{count}</span>}
        <ChevronDown size={12} className={`fbar-group__chevron${open ? ' fbar-group__chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="fbar-group__dropdown" role="listbox" aria-multiselectable="true" aria-label={label}>
          {options.map((opt) => {
            const checked = selected.includes(opt.id)
            return (
              <label key={opt.id} className={`fbar-option${checked ? ' fbar-option--checked' : ''}`}>
                <input
                  type="checkbox"
                  className="fbar-option__checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.id)}
                />
                {opt.color && (
                  <span className="fbar-option__dot" style={{ background: opt.color }} aria-hidden="true" />
                )}
                <span className="fbar-option__label">{opt.label}</span>
              </label>
            )
          })}
          {selected.length > 0 && (
            <button type="button" className="fbar-group__clear-btn" onClick={onClear}>
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── FilterBar ────────────────────────────────────────────────── */

export function FilterBar({ boardMembers, boardTags, boardColumns }: FilterBarProps) {
  const { filter, setFilter, clearFilter, isActive } = useFilter()

  function toggle(field: 'priorities' | 'tagIds' | 'assigneeIds' | 'columnIds', id: string) {
    const current = filter[field] as string[]
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    setFilter({ [field]: next })
  }

  const activeMembers = boardMembers.filter((m) => m.isActive)

  const memberOptions = [
    { id: '__unassigned__', label: 'Unassigned' },
    ...activeMembers.map((m) => ({ id: m.userId, label: m.name ?? m.email ?? m.userId })),
  ]

  const priorityOptions = PRIORITIES.map((p) => ({
    id: p,
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
  }))

  const statusOptions = boardColumns.map((c) => ({ id: c.id, label: c.title }))

  const tagOptions = boardTags.map((t) => ({ id: t.id, label: t.label ?? t.id, color: t.color }))

  return (
    <div className={`filter-bar${isActive ? ' filter-bar--active' : ''}`} aria-label="Board filters">
      <span className="filter-bar__label">
        <Filter size={13} aria-hidden="true" />
        Filter
      </span>

      {/* Priority */}
      <FilterGroup
        label="Priority"
        options={priorityOptions}
        selected={filter.priorities as string[]}
        onToggle={(id) => toggle('priorities', id)}
        onClear={() => setFilter({ priorities: [] })}
      />

      {/* Status */}
      {statusOptions.length > 0 && (
        <FilterGroup
          label="Status"
          options={statusOptions}
          selected={filter.columnIds}
          onToggle={(id) => toggle('columnIds', id)}
          onClear={() => setFilter({ columnIds: [] })}
        />
      )}

      {/* Members */}
      {activeMembers.length > 0 && (
        <FilterGroup
          label="Members"
          options={memberOptions}
          selected={filter.assigneeIds}
          onToggle={(id) => toggle('assigneeIds', id)}
          onClear={() => setFilter({ assigneeIds: [] })}
        />
      )}

      {/* Tags */}
      {tagOptions.length > 0 && (
        <FilterGroup
          label="Tags"
          options={tagOptions}
          selected={filter.tagIds}
          onToggle={(id) => toggle('tagIds', id)}
          onClear={() => setFilter({ tagIds: [] })}
        />
      )}

      {/* Clear all */}
      {isActive && (
        <button type="button" className="filter-bar__clear" onClick={clearFilter} aria-label="Clear all filters">
          <X size={13} aria-hidden="true" />
          Clear all
        </button>
      )}
    </div>
  )
}
