/**
 * Header.tsx
 * App header — flexbox toolbar (spec requirement).
 * Contains: search bar, offline indicator, theme toggle, user badge, logout.
 */

import { useRef } from 'react'
import { WifiOff, Sun, Moon, Monitor, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'
import '@/styles/layout/Header.css'

interface HeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  isOnline: boolean
}

export function Header({ searchValue, onSearchChange, isOnline }: HeaderProps) {
  const { state, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const searchRef = useRef<HTMLInputElement>(null)

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <header className="header" role="banner">
      {/* Search — spec: "/ to focus search" handled in BoardPage via ref */}
      <div className="header__search">
        <input
          ref={searchRef}
          id="global-search"
          type="search"
          className="header__search-input"
          placeholder="Search tasks… (/)"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search tasks"
        />
      </div>

      <div className="header__actions">
        {!isOnline && (
          <span className="header__offline-badge" role="status" aria-live="polite">
            <WifiOff size={12} aria-hidden="true" />
            Offline
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => setTheme(nextTheme)}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Current: ${theme} — click to switch to ${nextTheme}`}
        >
          <ThemeIcon size={16} aria-hidden="true" />
        </Button>

        {state.user && (
          <span className="header__user-badge" aria-label="Logged in user">
            {state.user.name}
            <span className="header__user-role">
              {state.user.role === 'MANAGER' ? 'Manager' : 'Member'}
            </span>
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={logout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={16} aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
