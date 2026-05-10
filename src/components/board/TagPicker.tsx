/**
 * TagPicker.tsx
 * Searchable, multi-select tag picker used in TaskDetail and CreateTaskModal.
 *
 * Two modes:
 *  compact=true  (TaskDetail edit flow)
 *    - Selected tags always visible as removable chips.
 *    - A small "+" button opens an inline search input + dropdown.
 *    - Dropdown shows ALL board tags; already-selected ones appear checked.
 *  compact=false (CreateTaskModal, default)
 *    - Search input always visible.
 *    - Selected chips shown above input.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'
import type { Tag } from '@/types/entities'
import '@/styles/components/TagPicker.css'
import '@/styles/components/TagPicker.dropdown.css'

const COLOR_PALETTE = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#64748b',
]

interface TagPickerProps {
  /** All tags available on this board */
  boardTags: ReadonlyArray<Tag>
  /** IDs of currently selected tags */
  selectedTagIds: string[]
  /** Whether the picker is read-only */
  disabled?: boolean
  /**
   * compact=true → chips always visible + "+" button to open dropdown.
   * compact=false (default) → search input always visible above chips.
   */
  compact?: boolean
  /**
   * For CREATE flow: called with the full new tag-ID array on every change.
   * Provide either onChange OR (onAdd + onRemove), not both.
   */
  onChange?: (nextIds: string[]) => void
  /**
   * For EDIT flow: called with a single tagId when the user attaches a tag.
   * Should call the dedicated POST /tasks/:id/tags/:tagId API.
   */
  onAdd?: (tagId: string) => Promise<void>
  /**
   * For EDIT flow: called with a single tagId when the user detaches a tag.
   * Should call the dedicated DELETE /tasks/:id/tags/:tagId API.
   */
  onRemove?: (tagId: string) => Promise<void>
  /** Called to create a brand-new tag; returns the created Tag */
  onCreateTag: (name: string, color: string) => Promise<Tag>
  /**
   * DOM element to portal the dropdown into.
   * Pass `dialogRef.current` when used inside a <dialog> so the dropdown
   * renders inside the top-layer context and is not blocked by the backdrop.
   */
  portalTarget?: Element | null
}

export function TagPicker({
  boardTags,
  selectedTagIds,
  disabled = false,
  compact = false,
  onChange,
  onAdd,
  onRemove,
  onCreateTag,
  portalTarget,
}: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  // In compact mode the "+" button acts as the anchor for the dropdown
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // Recalculate dropdown position whenever it opens or the viewport changes
  useEffect(() => {
    if (!open) return
    // In compact mode, anchor to the "+" button; otherwise anchor to the input wrap
    const anchor = compact ? addBtnRef.current : inputWrapRef.current
    if (!anchor) return
    const updatePos = () => {
      const rect = anchor.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: compact ? Math.max(rect.width, 240) : rect.width,
        zIndex: 9999,
      })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open, compact])

  // Guard against corrupt board tags (stale localStorage, nulls, etc.)
  const safeTags = boardTags.filter(
    (t): t is typeof t & { id: string } => !!t && typeof t.id === 'string' && t.id.length > 0,
  )

  const selectedTags = safeTags.filter((t) => selectedTagIds.includes(t.id))
  const q = query.trim().toLowerCase()

  // Show ALL tags in the dropdown filtered by search query
  const filteredTags = safeTags.filter((t) => !q || (t.label ?? '').toLowerCase().includes(q))

  const exactMatch = safeTags.some((t) => (t.label ?? '').toLowerCase() === q)
  const showCreateOption = q.length > 0 && !exactMatch

  /** Add a tag — no-op if already selected */
  async function addTag(id: string) {
    if (selectedTagIds.includes(id)) return
    if (onAdd) {
      await onAdd(id)
    } else {
      onChange?.([...selectedTagIds, id])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  /** Remove a tag explicitly (chip × or unchecking a selected row) */
  async function removeTag(id: string) {
    if (onRemove) {
      await onRemove(id)
    } else {
      onChange?.(selectedTagIds.filter((x) => x !== id))
    }
    inputRef.current?.focus()
  }

  /** Toggle called from dropdown row */
  function toggleTag(id: string) {
    if (selectedTagIds.includes(id)) {
      void removeTag(id)
    } else {
      void addTag(id)
    }
  }

  async function handleCreate() {
    const name = query.trim() || 'New tag'
    setCreating(true)
    setCreateError(null)
    try {
      const tag = await onCreateTag(name, newColor)
      if (tag?.id) {
        // After creation the tag is auto-attached; update local selection
        if (onAdd) {
          await onAdd(tag.id)
        } else {
          onChange?.([...selectedTagIds, tag.id])
        }
        setQuery('')
        setNewColor(COLOR_PALETTE[0])
      }
    } catch (err) {
      const apiErr = err as { message?: string }
      setCreateError(apiErr?.message ?? 'Failed to create tag')
    } finally {
      setCreating(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const unselected = filteredTags.filter((t) => !selectedTagIds.includes(t.id))
      if (unselected.length === 1) {
        void addTag(unselected[0].id)
        return
      }
      if (showCreateOption) void handleCreate()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
    if (e.key === 'Backspace' && query === '' && selectedTagIds.length > 0) {
      void removeTag(selectedTagIds[selectedTagIds.length - 1])
    }
  }

  return (
    <div className={`tag-picker${compact ? ' tag-picker--compact' : ''}`}>
      {/* ── Chips row (always visible) ───────────────────────────── */}
      <div className="tag-picker__chips-row">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="tag-picker__chip"
            style={
              {
                '--chip-color': tag.color,
                '--chip-bg': `${tag.color}22`,
                '--chip-border': `${tag.color}55`,
              } as CSSProperties
            }
          >
            <span className="tag-picker__chip-dot" style={{ background: tag.color }} />
            {tag.label}
            {!disabled && (
              <button
                type="button"
                className="tag-picker__chip-remove"
                onClick={() => void removeTag(tag.id)}
                aria-label={`Remove tag ${tag.label}`}
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* ── Compact mode: "+" button to open dropdown ──────────── */}
        {compact && !disabled && (
          <button
            ref={addBtnRef}
            type="button"
            className="tag-picker__add-btn"
            aria-label="Add tag"
            onClick={() => {
              setOpen((v) => !v)
              if (!open) setTimeout(() => inputRef.current?.focus(), 50)
            }}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Non-compact mode: always-visible search input ────────── */}
      {!compact && !disabled && (
        <div ref={inputWrapRef} className="tag-picker__input-wrap">
          <input
            ref={inputRef}
            className="tag-picker__input"
            type="text"
            placeholder={selectedTags.length === 0 ? 'Search or create tags…' : 'Add more tags…'}
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {/* ── Dropdown — portalled into dialog top layer ───────────── */}
      {open &&
        !disabled &&
        createPortal(
          <div
            className="tag-picker__dropdown"
            role="listbox"
            aria-label="Available tags"
            style={dropdownStyle}
          >
            {/* Inline search input shown inside dropdown when in compact mode */}
            {compact && (
              <div className="tag-picker__dropdown-search">
                <input
                  ref={inputRef}
                  className="tag-picker__input"
                  type="text"
                  placeholder="Search or create tags…"
                  value={query}
                  autoFocus
                  onBlur={() =>
                    setTimeout(() => {
                      setOpen(false)
                      setQuery('')
                    }, 150)
                  }
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}

            {filteredTags.length === 0 && !showCreateOption && (
              <p className="tag-picker__empty">
                {safeTags.length === 0
                  ? 'No tags on this board yet.'
                  : 'No tags match your search.'}
              </p>
            )}

            {filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`tag-picker__option${isSelected ? ' tag-picker__option--selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    toggleTag(tag.id)
                  }}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={`tag-picker__check${isSelected ? ' tag-picker__check--on' : ''}`}
                    aria-hidden="true"
                  >
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className="tag-picker__option-dot" style={{ background: tag.color }} />
                  <span className="tag-picker__option-label">{tag.label}</span>
                </button>
              )
            })}

            {showCreateOption && (
              <div className="tag-picker__create-row">
                <div className="tag-picker__create-palette">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`tag-picker__swatch${newColor === c ? ' tag-picker__swatch--active' : ''}`}
                      style={{ background: c }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setNewColor(c)
                      }}
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
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void handleCreate()
                  }}
                >
                  <span className="tag-picker__create-preview" style={{ background: newColor }} />
                  {creating ? 'Creating…' : `Create "${query.trim()}"`}
                </button>
                {createError && (
                  <p className="tag-picker__create-error" role="alert">
                    {createError}
                  </p>
                )}
              </div>
            )}
          </div>,
          portalTarget ?? document.body,
        )}
    </div>
  )
}
