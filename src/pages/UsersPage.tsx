/**
 * UsersPage.tsx
 * Manager-only user management page.
 * Features: table, debounced search, role/active filters, Add/Edit popup,
 * password-strength indicator, Deactivate confirmation, Reset password.
 */

import { useEffect, useRef, useState } from 'react'
import { Copy, Plus, RefreshCw, UserX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/context/AuthContext'
import { useDebounce } from '@/hooks/useDebounce'
import type { Role, User } from '@/types/entities'
import { ROLES } from '@/types/entities'
import { usersApi } from '@/utils/api'
import '@/styles/pages/UsersPage.css'

/* ─── Password strength ─────────────────────────────────────────── */

const PW_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const

function scorePassword(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

/* ─── Form state ──────────────────────────────────────────────────── */

interface UserFormState {
  name: string
  email: string
  role: Role
  password: string
}

const EMPTY_FORM: UserFormState = { name: '', email: '', role: 'TEAM_MEMBER', password: '' }

/* ─── Main component ─────────────────────────────────────────────── */

export function UsersPage() {
  const { state: authState } = useAuth()
  const currentUserId = authState.user?.id ?? ''

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const searchQuery = useDebounce(searchInput, 300)
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  // Add / Edit dialog
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<UserFormState>>({})
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Deactivate confirmation dialog
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null)
  const deactivateDialogRef = useRef<HTMLDialogElement>(null)

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resetDialogRef = useRef<HTMLDialogElement>(null)

  /* ── Load users ── */
  useEffect(() => {
    usersApi.list().then((res) => {
      setUsers(res.data)
      setIsLoading(false)
    })
  }, [])

  /* ── Dialog open/close helpers ── */
  const openAddDialog = () => {
    setDialogMode('add')
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  const openEditDialog = (user: User) => {
    setDialogMode('edit')
    setEditingUser(user)
    setForm({ name: user.name, email: user.email, role: user.role, password: '' })
    setFormErrors({})
  }

  const closeFormDialog = () => {
    setDialogMode(null)
    dialogRef.current?.close()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (dialogMode && !dialog.open) dialog.showModal()
    if (!dialogMode && dialog.open) dialog.close()
  }, [dialogMode])

  useEffect(() => {
    const dialog = deactivateDialogRef.current
    if (!dialog) return
    if (deactivateTarget && !dialog.open) dialog.showModal()
    if (!deactivateTarget && dialog.open) dialog.close()
  }, [deactivateTarget])

  useEffect(() => {
    const dialog = resetDialogRef.current
    if (!dialog) return
    if (resetTarget && !dialog.open) dialog.showModal()
    if (!resetTarget && dialog.open) dialog.close()
  }, [resetTarget])

  /* ── Form validation ── */
  function validateForm(): boolean {
    const errors: Partial<UserFormState> = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!form.email.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email.'
    if (dialogMode === 'add' && !form.password) errors.password = 'Password is required.'
    if (form.password && scorePassword(form.password) < 2)
      errors.password = 'Password is too weak.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  /* ── Submit add / edit ── */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    if (dialogMode === 'add') {
      const res = await usersApi.create({ ...form })
      setUsers((prev) => [...prev, res.data])
    } else if (editingUser) {
      const payload: Partial<User> = { name: form.name, email: form.email }
      // Spec: Cannot change own role
      if (editingUser.id !== currentUserId) payload.role = form.role
      const res = await usersApi.update(editingUser.id, payload)
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)))
    }
    closeFormDialog()
  }

  /* ── Deactivate ── */
  const handleDeactivate = async () => {
    if (!deactivateTarget) return
    await usersApi.deactivate(deactivateTarget.id)
    setUsers((prev) =>
      prev.map((u) => (u.id === deactivateTarget.id ? { ...u, active: false } : u)),
    )
    setDeactivateTarget(null)
  }

  /* ── Reset password ── */
  const handleResetPassword = async (user: User) => {
    setResetTarget(user)
    setTempPassword(null)
    setCopied(false)
    const res = await usersApi.resetPassword(user.id)
    setTempPassword(res.data.temporaryPassword)
  }

  const handleCopy = async () => {
    if (!tempPassword) return
    await navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Filtered list ── */
  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
    if (activeFilter === 'ACTIVE' && !u.active) return false
    if (activeFilter === 'INACTIVE' && u.active) return false
    return true
  })

  const pwScore = scorePassword(form.password)

  return (
    <main className="users-page">
      <h1 className="users-page__heading">Team Members</h1>

      {/* Toolbar */}
      <div className="users-page__toolbar" role="search">
        <input
          className="users-page__search"
          type="search"
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search team members"
        />
        <select
          className="users-page__filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
          aria-label="Filter by role"
        >
          <option value="ALL">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === 'MANAGER' ? 'Manager' : 'Team Member'}
            </option>
          ))}
        </select>
        <select
          className="users-page__filter"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <Button variant="primary" onClick={openAddDialog}>
          <Plus size={14} aria-hidden="true" />
          Add Member
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height="48px" />)}
        </div>
      ) : (
        <div className="users-page__table-wrap" role="region" aria-label="Team members table">
          <table className="users-page__table" aria-label="Team members">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-8)' }}>
                    No team members match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="users-page__name-cell">
                        <div className="users-page__avatar" aria-hidden="true">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role === 'MANAGER' ? 'Manager' : 'Team Member'}</td>
                    <td>
                      <span className={`users-page__status-badge users-page__status-badge--${user.active ? 'active' : 'inactive'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(
                        new Date(user.createdAt),
                      )}
                    </td>
                    <td>
                      <div className="users-page__actions-cell">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} aria-label={`Edit ${user.name}`}>
                          Edit
                        </Button>
                        {user.active && user.id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeactivateTarget(user)}
                            aria-label={`Deactivate ${user.name}`}
                          >
                            <UserX size={13} aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { void handleResetPassword(user) }}
                          aria-label={`Reset password for ${user.name}`}
                          title="Reset password"
                        >
                          <RefreshCw size={13} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit dialog ── */}
      <dialog ref={dialogRef} className="users-page__dialog" aria-label={dialogMode === 'add' ? 'Add team member' : 'Edit team member'}>
        <h2 className="users-page__dialog-title">
          {dialogMode === 'add' ? 'Add Team Member' : 'Edit Team Member'}
        </h2>
        <form className="users-page__dialog-form" onSubmit={(e) => { void handleFormSubmit(e) }} noValidate>
          {/* Name */}
          <div className="field">
            <label className="field__label" htmlFor="um-name">Name</label>
            <input
              id="um-name"
              className={`field__control${formErrors.name ? ' field__control--error' : ''}`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="name"
              required
            />
            {formErrors.name && <span className="field__error" role="alert">{formErrors.name}</span>}
          </div>
          {/* Email */}
          <div className="field">
            <label className="field__label" htmlFor="um-email">Email</label>
            <input
              id="um-email"
              type="email"
              className={`field__control${formErrors.email ? ' field__control--error' : ''}`}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoComplete="email"
              required
            />
            {formErrors.email && <span className="field__error" role="alert">{formErrors.email}</span>}
          </div>
          {/* Role — disabled when editing self */}
          <div className="field">
            <label className="field__label" htmlFor="um-role">Role</label>
            <select
              id="um-role"
              className="field__control"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              disabled={dialogMode === 'edit' && editingUser?.id === currentUserId}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r === 'MANAGER' ? 'Manager' : 'Team Member'}</option>
              ))}
            </select>
            {dialogMode === 'edit' && editingUser?.id === currentUserId && (
              <span className="field__hint">You cannot change your own role.</span>
            )}
          </div>
          {/* Password (required on add, optional on edit) */}
          <div className="field">
            <label className="field__label" htmlFor="um-password">
              {dialogMode === 'add' ? 'Password' : 'New password (leave blank to keep current)'}
            </label>
            <input
              id="um-password"
              type="password"
              className={`field__control${formErrors.password ? ' field__control--error' : ''}`}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
              required={dialogMode === 'add'}
            />
            {form.password && (
              <>
                <div className="users-page__pw-strength" aria-hidden="true">
                  <div className="users-page__pw-strength-bar" data-level={String(pwScore)} />
                </div>
                <span className="users-page__pw-strength-label">
                  Strength: {PW_LABELS[pwScore]}
                </span>
              </>
            )}
            {formErrors.password && <span className="field__error" role="alert">{formErrors.password}</span>}
          </div>

          <div className="users-page__dialog-actions">
            <Button type="submit" variant="primary">
              {dialogMode === 'add' ? 'Add Member' : 'Save Changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeFormDialog}>
              Cancel
            </Button>
          </div>
        </form>
      </dialog>

      {/* ── Deactivate confirmation dialog ── */}
      <dialog ref={deactivateDialogRef} className="users-page__dialog" aria-label="Confirm deactivation">
        <h2 className="users-page__dialog-title">Deactivate Member</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-5)' }}>
          Are you sure you want to deactivate{' '}
          <strong>{deactivateTarget?.name}</strong>? They will lose access immediately.
        </p>
        <div className="users-page__dialog-actions">
          <Button variant="danger" onClick={() => { void handleDeactivate() }}>
            Deactivate
          </Button>
          <Button variant="ghost" onClick={() => setDeactivateTarget(null)}>
            Cancel
          </Button>
        </div>
      </dialog>

      {/* ── Reset password result dialog ── */}
      <dialog ref={resetDialogRef} className="users-page__dialog" aria-label="Temporary password">
        <h2 className="users-page__dialog-title">Temporary Password</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>
          Share this temporary password with <strong>{resetTarget?.name}</strong>.
          They should change it on next login.
        </p>
        {tempPassword ? (
          <div className="users-page__temp-pw">
            <span className="users-page__temp-pw-value" aria-label="Temporary password">{tempPassword}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void handleCopy() }}
              aria-label="Copy temporary password"
            >
              <Copy size={13} aria-hidden="true" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        ) : (
          <Skeleton height="42px" />
        )}
        <div className="users-page__dialog-actions" style={{ marginTop: 'var(--space-5)' }}>
          <Button
            variant="primary"
            onClick={() => { setResetTarget(null); setTempPassword(null) }}
          >
            Done
          </Button>
        </div>
      </dialog>
    </main>
  )
}

