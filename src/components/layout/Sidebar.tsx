/**
 * Sidebar.tsx
 * App sidebar — board list, nav links, user info.
 */

import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Plus, Trash2, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { Board } from '@/types/entities'
import '@/styles/layout/Sidebar.css'

interface SidebarProps {
  boards: Board[]
  activeBoardId?: string
  onNewBoard: () => void
  onDeleteBoard: (boardId: string) => Promise<void>
}

/** Small avatar shown in the sidebar footer — image if available, else initials */
function SidebarAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className="sidebar__avatar-img"
      />
    )
  }
  return (
    <span className="sidebar__avatar-initials" aria-hidden="true">
      {name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')}
    </span>
  )
}

export function Sidebar({ boards, activeBoardId, onNewBoard, onDeleteBoard }: SidebarProps) {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const isManager = state.user?.role === 'MANAGER'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleDelete = async (e: React.MouseEvent, board: Board) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete board "${board.title}"? This cannot be undone.`)) return
    await onDeleteBoard(board.id)
    // Navigate away if we just deleted the active board
    if (board.id === activeBoardId) {
      const remaining = boards.filter((b) => b.id !== board.id)
      navigate(remaining[0] ? `/boards/${remaining[0].id}` : '/boards')
    }
  }

  const handleLogoutConfirm = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar" aria-label="Application navigation">
      <div className="sidebar__brand">
        <LayoutDashboard size={18} aria-hidden="true" />
        Kanban Board
      </div>

      <nav className="sidebar__section" aria-label="Boards">
        <div className="sidebar__section-title">Boards</div>
        <ul className="sidebar__nav" role="list">
          {boards.map((board) => (
            <li key={board.id} role="listitem" className="sidebar__board-item">
              <NavLink
                to={`/boards/${board.id}`}
                className={({ isActive }) =>
                  `sidebar__nav-item${isActive || board.id === activeBoardId ? ' sidebar__nav-item--active' : ''}`
                }
              >
                <span className="sidebar__board-title">{board.title}</span>
              </NavLink>
              {isManager && (
                <button
                  type="button"
                  className="sidebar__board-delete"
                  onClick={(e) => { void handleDelete(e, board) }}
                  aria-label={`Delete board "${board.title}"`}
                  title={`Delete "${board.title}"`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNewBoard}
          className="sidebar__new-board"
          aria-label="Create new board"
        >
          <Plus size={14} aria-hidden="true" />
          New Board
        </Button>
      </nav>

      {isManager && (
        <nav className="sidebar__section" aria-label="Management">
          <div className="sidebar__section-title">Manage</div>
          <ul className="sidebar__nav" role="list">
            <li role="listitem">
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
                }
              >
                <Users size={14} aria-hidden="true" />
                Team Members
              </NavLink>
            </li>
          </ul>
        </nav>
      )}

      <div className="sidebar__footer">
        {state.user && (
          <>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `sidebar__nav-item sidebar__profile-link${isActive ? ' sidebar__nav-item--active' : ''}`
              }
              aria-label="My profile"
            >
              <span className="sidebar__avatar">
                <SidebarAvatar name={state.user.name} avatarUrl={state.user.avatarUrl} />
              </span>
              {state.user.name}
            </NavLink>
            <div className="sidebar__user-role">
              {state.user.role === 'MANAGER' ? 'Manager' : 'Team Member'}
            </div>
            <button
              type="button"
              className="sidebar__logout-btn"
              onClick={() => setShowLogoutConfirm(true)}
              aria-label="Logout"
            >
              <LogOut size={14} aria-hidden="true" />
              Logout
            </button>
          </>
        )}
      </div>

      {showLogoutConfirm && (
        <ConfirmModal
          title="Logout Confirmation"
          message="Are you sure you want to logout?"
          confirmLabel="Logout"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </aside>
  )
}

