/**
 * Sidebar.tsx
 * App sidebar — board list, nav links, user info.
 * User Management link shown only if currentUser.role === 'MANAGER' (spec requirement).
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import type { Board } from '@/types/entities'
import '@/styles/layout/Sidebar.css'

interface SidebarProps {
  boards: Board[]
  activeBoardId?: string
  onNewBoard: () => void
}

export function Sidebar({ boards, activeBoardId, onNewBoard }: SidebarProps) {
  const { state } = useAuth()
  const navigate = useNavigate()
  const isManager = state.user?.role === 'MANAGER'

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
            <li key={board.id} role="listitem">
              <NavLink
                to={`/boards/${board.id}`}
                className={({ isActive }) =>
                  `sidebar__nav-item${isActive || board.id === activeBoardId ? ' sidebar__nav-item--active' : ''}`
                }
              >
                {board.title}
              </NavLink>
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNewBoard}
          style={{ marginTop: 'var(--space-2)', width: '100%', justifyContent: 'flex-start' }}
          aria-label="Create new board"
        >
          <Plus size={14} aria-hidden="true" />
          New Board
        </Button>
      </nav>

      {/* User Management — manager only (spec requirement) */}
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
          <div className="sidebar__user">
            <div>
              <div className="sidebar__user-name">{state.user.name}</div>
              <div className="sidebar__user-role">
                {state.user.role === 'MANAGER' ? 'Manager' : 'Team Member'}
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/login')}
          style={{ display: 'none' }}
          aria-hidden="true"
        >
          {/* Logout is in Header */}
        </Button>
      </div>
    </aside>
  )
}
