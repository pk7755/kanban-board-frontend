/**
 * TagPicker.tsx
 * Searchable, multi-select tag picker used in TaskDetail and CreateTaskModal.
 *
 * UX:
 *  - Selected tags appear as removable chips at the top.
 *  - A search input filters existing board tags.
 *  - "Create tag" form appears when search term doesn't match any existing tag
 *    (or when the user explicitly clicks "+ New tag").
 */

import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { Tag } from '@/types/entities'
import '@/styles/components/TagPicker.css'

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
]

interface TagPickerProps {
  /** All tags available on this board */
  boardTags: ReadonlyArray<Tag>
  /** IDs of currently selected tags */
  selectedTagIds: string[]
  /** Whether the picker is read-only */
  disabled?: boolean
  /** Called when the selection changes */
  onChange: (nextIds: string[]) => void
  /** Called to create a brand-new tag; returns the created Tag */
  onCreateTag: (name: string, color: string) => Promise<Tag>
}

export function TagPicker({ boardTags, selectedTagIds, disabled = false, onChange, onCreateTag }: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedTags = boardTags.filter((t) => selectedTagIds.includes(t.id))
  const q = query.trim().toLowerCase()

  const filteredTags = boardTags.filter((t) => {
    if (selectedTagIds.includes(t.id)) return false
    if (!q) return true
    return (t.label ?? '').toLowerCase().includes(q)
  })

  const exactMatch = boardTags.some((t) => (t.label ?? '').toLowerCase() === q)
  const showCreateOption = q.length > 0 && !exactMatch

  function toggleTag(id: string) {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter((x) => x !== id))
    } else {
      onChange([...selectedTagIds, id])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  function removeTag(id: string) {
    onChange(selectedTagIds.filter((x) => x !== id))
  }

  async function handleCreate() {
    const name = query.trim() || 'New tag'
    setCreating(true)
    try {
      const tag = await onCreateTag(name, newColor)
      onChange([...selectedTagIds, tag.id])
      setQuery('')
      setNewColor(COLOR_PALETTE[0])
    } finally {
      setCreating(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTags.length === 1) { toggleTag(filteredTags[0].id); return }
      if (showCreateOption) void handleCreate()
    }
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    if (e.key === 'Backspace' && query === '' && selectedTagIds.length > 0) {
      removeTag(selectedTagIds[selectedTagIds.length - 1])
    }
  }

  return (
    <div className="tag-picker">
      {/* Selected tag chips */}
      {selectedTags.length > 0 && (
        <div className="tag-picker__selected">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="tag-picker__chip"
              style={{ '--chip-color': tag.color, '--chip-bg': `${tag.color}22`, '--chip-border': `${tag.color}55` } as CSSProperties}
            >
              <span className="tag-picker__chip-dot" style={{ background: tag.color }} />
              {tag.label}
              {!disabled && (
                <button
                  type="button"
                  className="tag-picker__chip-remove"
                  onClick={() => removeTag(tag.id)}
                  aria-label={`Remove tag ${tag.label}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {!disabled && (
        <div className="tag-picker__input-wrap">
          <input
            ref={inputRef}
            className="tag-picker__input"
            type="text"
            placeholder={selectedTags.length === 0 ? 'Search or create tags…' : 'Add more tags…'}
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {/* Dropdown list */}
      {open && !disabled && (
        <div className="tag-picker__dropdown" role="listbox" aria-label="Available tags">
          {filteredTags.length === 0 && !showCreateOption && (
            <p className="tag-picker__empty">
              {boardTags.length === 0 ? 'No tags on this board yet.' : 'All tags already selected.'}
            </p>
          )}

          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              role="option"
              aria-selected={false}
              className="tag-picker__option"
              onMouseDown={(e) => { e.preventDefault(); toggleTag(tag.id) }}
            >
              <span className="tag-picker__option-dot" style={{ background: tag.color }} />
              <span className="tag-picker__option-label">{tag.label}</span>
            </button>
          ))}

          {showCreateOption && (
            <div className="tag-picker__create-row">
              <div className="tag-picker__create-palette">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tag-picker__swatch${newColor === c ? ' tag-picker__swatch--active' : ''}`}
                    style={{ background: c }}
                    onMouseDown={(e) => { e.preventDefault(); setNewColor(c) }}
                    aria-label={`Color ${c}`}
                  />
                ))}
                <input
                  type="color"
                  className="tag-picker__color-input"
                  value={newColor}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => setNewColor(e.target.value)}
                  title="Custom color"
                />
              </div>
              <button
                type="button"
                className="tag-picker__create-btn"
                disabled={creating}
                onMouseDown={(e) => { e.preventDefault(); void handleCreate() }}
              >
                <span className="tag-picker__create-preview" style={{ background: newColor }} />
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
