/**
 * AuthContext.tsx
 * Manages authentication state.
 *
 * JWT stored in memory (tokenStore) — never in localStorage (XSS protection).
 * Refresh token + expiry stored in localStorage.
 * On app load, if the access token is still valid we restore the session
 * directly from localStorage without hitting /auth/refresh, preventing
 * concurrent-refresh races on rapid page reloads.
 * Only when the access token has expired do we call /auth/refresh.
 *
 * Tradeoff (documented per spec): storing refresh token in localStorage means
 * it is accessible to JS on the page. An httpOnly cookie would be more secure
 * but requires backend CORS/cookie support. For this project localStorage is
 * used until the backend intern adds cookie support.
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'
import type { AuthState } from '@/types/auth'
import type { AuthAction } from '@/types/actions'
import type { AuthUser } from '@/types/entities'
import { authApi, configureApiClient } from '@/utils/api'
import { tokenStore } from '@/utils/tokenStore'

/* ─── Reducer ─────────────────────────────────────────────────────── */

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload.user, isAuthenticated: true, isLoading: false }
    case 'LOGOUT':
      return { user: null, token: null, isAuthenticated: false, isLoading: false }
    default:
      return state
  }
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
}

/* ─── Context ─────────────────────────────────────────────────────── */

interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const REFRESH_KEY = 'kanban:refreshToken'
const USER_KEY = 'kanban:user'
const EXPIRY_KEY = 'kanban:tokenExpiry'

/** 15 min access token lifetime minus 30 s safety buffer (matches JWT_ACCESS_EXPIRES_IN) */
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000 - 30_000

function saveSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  tokenStore.set(accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + ACCESS_TOKEN_TTL_MS))
}

function clearSession(): void {
  tokenStore.set(null)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(EXPIRY_KEY)
}

function isAccessTokenFresh(): boolean {
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? '0')
  return Date.now() < expiry
}

/* ─── Provider ────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const abortRef = useRef<AbortController | null>(null)

  const logout = useCallback(() => {
    clearSession()
    dispatch({ type: 'LOGOUT' })
  }, [])

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) return null
    try {
      const res = await authApi.refresh(refreshToken)
      const storedUser = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthUser | null
      if (!storedUser) { logout(); return null }
      saveSession(res.data.accessToken, res.data.refreshToken, storedUser)
      dispatch({ type: 'LOGIN', payload: { user: { ...storedUser, token: res.data.accessToken } } })
      return res.data.accessToken
    } catch {
      logout()
      return null
    }
  }, [logout])

  // Wire up the API client so it can trigger refresh / force-logout on 401
  useEffect(() => {
    configureApiClient(silentRefresh, logout)
  }, [silentRefresh, logout])

  // On mount: restore session from localStorage if token is still fresh,
  // otherwise attempt a silent refresh. This prevents concurrent /auth/refresh
  // calls when the user rapidly reloads the page.
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AuthUser | null
    const refreshToken = localStorage.getItem(REFRESH_KEY)

    if (!refreshToken || !storedUser) {
      dispatch({ type: 'LOGOUT' })
      return
    }

    if (isAccessTokenFresh()) {
      // Access token is still valid — restore session without hitting the backend
      tokenStore.set(storedUser.token)
      dispatch({ type: 'LOGIN', payload: { user: storedUser } })
      return
    }

    // Access token expired — need a new one
    silentRefresh().then((token) => {
      if (!token) dispatch({ type: 'LOGOUT' })
    })
  }, [silentRefresh])

  const login = useCallback(async (email: string, password: string) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const res = await authApi.login(
      { email: email.trim().toLowerCase(), password },
      { signal: abortRef.current.signal },
    )
    const { accessToken, refreshToken, user } = res.data

    const authUser: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role, token: accessToken }
    saveSession(accessToken, refreshToken, authUser)
    dispatch({ type: 'LOGIN', payload: { user: authUser } })
  }, [])

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
