/**
 * ManageTagsModal.tsx
 * Modal for viewing, creating, editing, and deleting board tags.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useBoardContext } from '@/context/BoardContext'
import { tagsApi } from '@/utils/api'
import type { Tag } from '@/types/entities'
import '@/styles/components/ManageTagsModal.css'

/* ── Preset palette ─────────────────────────────────────────────── */
const COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#0ea5e9',
  '#84cc16',
  '#f43f5e',
]

interface Props {
  boardId: string
  onClose: () => void
}

interface EditingTag {
  id: string | null // null = new tag
  label: string
  color: string
}

const BLANK: EditingTag = { id: null, label: '', color: COLOR_PALETTE[5] }

export function ManageTagsModal({ boardId, onClose }: Props) {
  const { activeBoard, dispatch } = useBoardContext()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [editing, setEditing] = useState<EditingTag | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tags = activeBoard?.tags ?? []

  /* open dialog */
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    el.showModal()
    const handleCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    el.addEventListener('cancel', handleCancel)
    return () => el.removeEventListener('cancel', handleCancel)
  }, [onClose])

  /* close on backdrop click */
  function handleBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  /* start adding a new tag */
  function startAdd() {
    setEditing({ ...BLANK })
    setError(null)
  }

  /* start editing an existing tag */
  function startEdit(tag: Tag) {
    setEditing({ id: tag.id, label: tag.label, color: tag.color })
    setError(null)
  }

  /* cancel edit / add */
  function cancelEdit() {
    setEditing(null)
    setError(null)
  }

  /* save (create or update) */
  async function handleSave() {
    if (!editing) return
    const label = editing.label.trim()
    if (!label) {
      setError('Tag name is required')
      return
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(editing.color)) {
      setError('Invalid color')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editing.id === null) {
        // create
        const res = await tagsApi.create(boardId, { label, color: editing.color })
        dispatch({ type: 'ADD_TAG', payload: { boardId, tag: res.data } })
      } else {
        // update
        const res = await tagsApi.update(editing.id, { label, color: editing.color })
        dispatch({ type: 'UPDATE_TAG', payload: { boardId, tag: res.data } })
      }
      setEditing(null)
    } catch {
      setError('Failed to save tag. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  /* delete a tag */
  async function handleDelete(tagId: string) {
    setDeleting(tagId)
    try {
      await tagsApi.delete(tagId)
      dispatch({ type: 'DELETE_TAG', payload: { boardId, tagId } })
    } catch {
      setError('Failed to delete tag.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="manage-tags-modal"
      onClick={handleBackdrop}
      aria-label="Manage board tags"
    >
      {/* ── Header ── */}
      <div className="manage-tags-modal__header">
        <h2 className="manage-tags-modal__title">
          Manage Tags
          <span className="manage-tags-modal__count"> · {tags.length}</span>
        </h2>
        <button className="manage-tags-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* ── Tag list ── */}
      <ul className="manage-tags-modal__list" role="list">
        {tags.length === 0 && !editing && (
          <li className="manage-tags-modal__empty">No tags yet. Add your first tag below.</li>
        )}
        {tags.map((tag) => (
          <li key={tag.id} className="manage-tags-modal__tag-row">
            <span
              className="manage-tags-modal__tag-swatch"
              style={{ backgroundColor: tag.color }}
              aria-hidden="true"
            />
            <span
              className="manage-tags-modal__tag-chip"
              style={{
                backgroundColor: `${tag.color}22`,
                color: tag.color,
                borderColor: `${tag.color}55`,
              }}
            >
              {tag.label}
            </span>
            <div className="manage-tags-modal__tag-actions">
              <button
                className="manage-tags-modal__icon-btn"
                onClick={() => startEdit(tag)}
                aria-label={`Edit tag "${tag.label}"`}
                title="Edit"
                disabled={saving || !!editing}
              >
                <Pencil size={14} />
              </button>
              <button
                className="manage-tags-modal__icon-btn manage-tags-modal__icon-btn--danger"
                onClick={() => void handleDelete(tag.id)}
                aria-label={`Delete tag "${tag.label}"`}
                title="Delete"
                disabled={deleting === tag.id || saving || !!editing}
              >
                {deleting === tag.id ? (
                  <span className="manage-tags-modal__spinner" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Add / Edit form ── */}
      {editing ? (
        <div className="manage-tags-modal__form">
          <div className="manage-tags-modal__form-row">
            <input
              className="manage-tags-modal__name-input"
              value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="Tag name (e.g. Bug, Feature)"
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') cancelEdit()
              }}
              aria-label="Tag name"
            />
            {/* Color picker + hex input */}
            <div className="manage-tags-modal__color-picker">
              <input
                type="color"
                className="manage-tags-modal__color-input"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                aria-label="Custom color"
                title="Pick a custom color"
              />
            </div>
          </div>

          {/* Palette swatches */}
          <div className="manage-tags-modal__palette">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`manage-tags-modal__swatch${editing.color.toLowerCase() === c ? ' manage-tags-modal__swatch--selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setEditing({ ...editing, color: c })}
                aria-label={`Select color ${c}`}
                title={c}
              >
                {editing.color.toLowerCase() === c && <Check size={10} color="#fff" />}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="manage-tags-modal__preview-row">
            <span className="manage-tags-modal__preview-label">Preview:</span>
            <span
              className="manage-tags-modal__tag-chip"
              style={{
                backgroundColor: `${editing.color}22`,
                color: editing.color,
                borderColor: `${editing.color}55`,
              }}
            >
              {editing.label || 'Tag name'}
            </span>
          </div>

          {error && (
            <p className="manage-tags-modal__error" role="alert">
              {error}
            </p>
          )}

          <div className="manage-tags-modal__form-actions">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editing.id ? 'Save Changes' : 'Add Tag'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="manage-tags-modal__footer">
          {error && (
            <p className="manage-tags-modal__error" role="alert">
              {error}
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={startAdd}>
            <Plus size={14} aria-hidden="true" />
            Add Tag
          </Button>
        </div>
      )}
    </dialog>
  )
}
